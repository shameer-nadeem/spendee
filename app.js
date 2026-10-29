import { add, list, getSetting, setSetting } from './db.js';
import { CATEGORIES, getBalance } from './logic.js';

const $ = id => document.getElementById(id);
const tabs = document.querySelectorAll('#tabs button');
const screens = document.querySelectorAll('.screen');
let cat = null;
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
    });
    box.appendChild(b);
  });
}

function resetForm() {
  $('amount').value = '';
  $('note').value = '';
  $('date').value = today();
  cat = null;
  drawChips();
}

$('form').addEventListener('submit', async e => {
  e.preventDefault();
  const amount = toNum($('amount').value);
  if (!amount) return toast('Enter an amount');
  if (!cat) return toast('Pick a category');
  await add('transactions', {
    amount,
    note: $('note').value.trim(),
    category: cat,
    date: $('date').value || today(),
    createdAt: Date.now()
  });
  resetForm();
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
  const start = await getSetting('startBalance', null);
  if (start === null) $('setup').hidden = false;
  else await refreshBalance();
}

init();

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js');
}
