import { add, list, getSetting, setSetting } from './db.js';
import { CATEGORIES, getBalance, checkSplits, matchName } from './logic.js';

const $ = id => document.getElementById(id);
const tabs = document.querySelectorAll('#tabs button');
const screens = document.querySelectorAll('.screen');
let cat = null;
let known = [];
let toastTimer;

function show(name) {
  tabs.forEach(t => t.classList.toggle('active', t.dataset.tab === name));
  screens.forEach(s => s.classList.toggle('active', s.id === name));
}

tabs.forEach(t => t.addEventListener('click', () => show(t.dataset.tab)));

const money = n => (n < 0 ? '-' : '') + 'Rs ' + Math.abs(n).toLocaleString('en-US');
const today = () => new Date().toLocaleDateString('en-CA');
const toNum = s => parseInt(String(s).replace(/[^0-9]/g, ''), 10);

function toast(msg) {
  const t = $('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2000);
}

async function refreshBalance() {
  const start = await getSetting('startBalance', 0);
  const [txs, splits] = await Promise.all([list('transactions'), list('splits')]);
  $('balance').textContent = money(getBalance(start, txs, splits));
}

function drawChips() {
  const box = $('chips');
  box.textContent = '';
  CATEGORIES.forEach(c => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'chip' + (c === cat ? ' on' : '');
    b.textContent = c;
    b.addEventListener('click', () => {
      cat = c;
      drawChips();
      drawSplit();
    });
    box.appendChild(b);
  });
}

function addRow() {
  const row = document.createElement('div');
  row.className = 'row';
  const name = document.createElement('input');
  name.className = 'name';
  name.placeholder = 'Friend';
  name.setAttribute('list', 'friends');
  const amt = document.createElement('input');
  amt.className = 'amt';
  amt.placeholder = 'Owes';
  amt.inputMode = 'numeric';
  const del = document.createElement('button');
  del.type = 'button';
  del.className = 'del';
  del.textContent = '\u00d7';
  del.addEventListener('click', () => {
    row.remove();
    updateReal();
  });
  row.append(name, amt, del);
  row.addEventListener('input', updateReal);
  $('rows').appendChild(row);
}

function readRows() {
  return [...$('rows').children].map(r => ({
    name: r.querySelector('.name').value.trim(),
    amount: toNum(r.querySelector('.amt').value) || 0
  }));
}

function splitOn() {
  return $('split-on').checked && cat !== 'Earning';
}

function updateReal() {
  const el = $('real');
  const total = toNum($('amount').value) || 0;
  if (!splitOn()) {
    el.textContent = '';
    return null;
  }
  const r = checkSplits(total, readRows());
  const over = r.owed > total;
  el.textContent = over ? 'Friends owe more than the total' : 'Your real spend: ' + money(r.real);
  el.classList.toggle('bad', over);
  return r;
}

function drawSplit() {
  $('split-box').hidden = cat === 'Earning';
  $('split-body').hidden = !splitOn();
  if (splitOn() && !$('rows').children.length) addRow();
  updateReal();
}

async function loadFriends() {
  const splits = await list('splits');
  known = [...new Set(splits.map(s => s.friend))];
  const dl = $('friends');
  dl.textContent = '';
  known.forEach(k => {
    const o = document.createElement('option');
    o.value = k;
    dl.appendChild(o);
  });
}

function resetForm() {
  $('amount').value = '';
  $('note').value = '';
  $('date').value = today();
  $('split-on').checked = false;
  $('rows').textContent = '';
  cat = null;
  drawChips();
  drawSplit();
}

$('split-on').addEventListener('change', drawSplit);
$('add-friend').addEventListener('click', addRow);
$('amount').addEventListener('input', updateReal);

$('form').addEventListener('submit', async e => {
  e.preventDefault();
  const amount = toNum($('amount').value);
  if (!amount) return toast('Enter an amount');
  if (!cat) return toast('Pick a category');
  const rows = splitOn() ? readRows().filter(r => r.name || r.amount) : [];
  const check = checkSplits(amount, rows);
  if (!check.ok) return toast(check.error);
  const date = $('date').value || today();
  const txId = await add('transactions', {
    amount,
    note: $('note').value.trim(),
    category: cat,
    date,
    createdAt: Date.now()
  });
  for (const r of rows) {
    await add('splits', {
      txId,
      friend: matchName(r.name, known),
      amount: r.amount,
      settled: false,
      settledDate: null,
      date
    });
  }
  resetForm();
  await loadFriends();
  await refreshBalance();
  toast('Saved');
});

$('setup-form').addEventListener('submit', async e => {
  e.preventDefault();
  const raw = $('start').value.trim();
  const n = raw === '' ? 0 : toNum(raw);
  if (Number.isNaN(n)) return;
  await setSetting('startBalance', n);
  $('setup').hidden = true;
  await refreshBalance();
});

async function init() {
  resetForm();
  await loadFriends();
  const start = await getSetting('startBalance', null);
  if (start === null) $('setup').hidden = false;
  else await refreshBalance();
}

init();

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js');
}
