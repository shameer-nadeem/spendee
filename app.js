import { parseEntry } from './parser.js';
import { add, update, remove, list, getSetting, setSetting } from './db.js';
import { CATEGORIES, getBalance, checkSplits, matchName, sortNewest, filterByCategory, getPendingItems, getOwedByFriend, settle, getMonths, getMonthStats, getTotalOwed, monthOf } from './logic.js';

const $ = id => document.getElementById(id);
const tabs = document.querySelectorAll('#tabs button');
const screens = document.querySelectorAll('.screen');
let cat = null;
let known = [];
let friend = null;
let filterCat = 'All';
let editing = null;
let editCat = null;
let month = null;
let toastTimer;

function show(name) {
  tabs.forEach(t => t.classList.toggle('active', t.dataset.tab === name));
  screens.forEach(s => s.classList.toggle('active', s.id === name));
  if (name === 'owed') friend = null;
  renderAll();
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

function chipRow(box, items, selected, pick) {
  box.textContent = '';
  items.forEach(c => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'chip' + (c === selected ? ' on' : '');
    b.textContent = c;
    b.addEventListener('click', () => pick(c));
    box.appendChild(b);
  });
}

function drawChips() {
  chipRow($('chips'), CATEGORIES, cat, c => {
    cat = c;
    drawChips();
    drawSplit();
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
  $('quick').value = '';
  $('parsed').hidden = true;
  cat = null;
  drawChips();
  drawSplit();
}

function fillForm(p) {
  $('amount').value = p.amount;
  $('note').value = p.note;
  cat = p.category;
  $('split-on').checked = p.friends.length > 0;
  drawChips();
  drawSplit();
  p.friends.forEach((f, i) => {
    if (i) addRow();
    const r = $('rows').children[i];
    r.querySelector('.name').value = f.name;
    r.querySelector('.amt').value = f.amount;
  });
  updateReal();
}

$('quick-form').addEventListener('submit', e => {
  e.preventDefault();
  const text = $('quick').value.trim();
  if (!text) return;
  const p = parseEntry(text);
  const box = $('parsed');
  if (p.error) {
    box.textContent = p.error + '. Try: lunch 6000 Ali 2000';
    box.classList.add('bad');
    box.hidden = false;
    return;
  }
  resetForm();
  $('quick').value = text;
  fillForm(p);
  const lines = [money(p.amount) + ' \u00b7 ' + p.category + (p.note ? ' \u00b7 ' + p.note : '')];
  if (p.friends.length) lines.push(p.friends.map(f => (f.name || 'Friend?') + ' ' + money(f.amount)).join(' \u00b7 '));
  lines.push('Check the form below, then tap Save.');
  box.textContent = lines.join('\n');
  box.classList.remove('bad');
  box.hidden = false;
});

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
  await renderAll();
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

const row = (title, sub, val, cls) => {
  const el = document.createElement('div');
  el.className = 'item';
  const main = document.createElement('div');
  main.className = 'main';
  const t = document.createElement('div');
  t.className = 'title';
  t.textContent = title;
  const u = document.createElement('div');
  u.className = 'sub';
  u.textContent = sub;
  main.append(t, u);
  el.appendChild(main);
  if (val) {
    const v = document.createElement('div');
    v.className = 'val ' + (cls || '');
    v.textContent = val;
    el.appendChild(v);
  }
  return el;
};

const asButton = el => {
  const b = document.createElement('button');
  b.className = el.className;
  b.append(...el.childNodes);
  return b;
};

async function drawOwed() {
  const body = $('owed-body');
  body.textContent = '';
  const [txs, splits] = await Promise.all([list('transactions'), list('splits')]);
  const byId = new Map(txs.map(t => [t.id, t]));
  const live = splits.filter(sp => byId.has(sp.txId));
  const owed = getOwedByFriend(live);
  if (friend && !owed[friend]) friend = null;

  if (!friend) {
    const names = Object.keys(owed).sort();
    if (!names.length) {
      const p = document.createElement('p');
      p.className = 'empty';
      p.textContent = 'Nobody owes you anything.';
      body.appendChild(p);
    }
    names.forEach(n => {
      const b = asButton(row(n, 'Tap to see items', money(owed[n])));
      b.addEventListener('click', () => {
        friend = n;
        drawOwed();
      });
      body.appendChild(b);
    });
    return;
  }

  const back = document.createElement('button');
  back.className = 'back';
  back.textContent = '\u2039 Back';
  back.addEventListener('click', () => {
    friend = null;
    drawOwed();
  });
  const sum = document.createElement('p');
  sum.className = 'sum';
  sum.textContent = friend + ' owes you ' + money(owed[friend]);
  body.append(back, sum);

  getPendingItems(live, friend).forEach(sp => {
    const tx = byId.get(sp.txId);
    const el = row(tx.note || tx.category, tx.date + ' \u00b7 ' + tx.category, money(sp.amount));
    const btn = document.createElement('button');
    btn.className = 'small';
    btn.textContent = 'Mark paid';
    btn.addEventListener('click', async () => {
      await update('splits', settle(sp, today()));
      await renderAll();
      toast('Marked paid');
    });
    el.appendChild(btn);
    body.appendChild(el);
  });
}

async function drawHistory() {
  chipRow($('filter'), ['All', ...CATEGORIES], filterCat, c => {
    filterCat = c;
    drawHistory();
  });
  const box = $('hist-list');
  box.textContent = '';
  const txs = sortNewest(filterByCategory(await list('transactions'), filterCat));
  if (!txs.length) {
    const p = document.createElement('p');
    p.className = 'empty';
    p.textContent = 'Nothing here yet.';
    box.appendChild(p);
  }
  txs.forEach(tx => {
    const earn = tx.category === 'Earning';
    const b = asButton(row(
      tx.note || tx.category,
      tx.date + ' \u00b7 ' + tx.category,
      (earn ? '+' : '-') + money(tx.amount),
      earn ? 'in' : ''
    ));
    b.addEventListener('click', () => openEdit(tx));
    box.appendChild(b);
  });
}

async function openEdit(tx) {
  editing = tx;
  editCat = tx.category;
  $('e-amount').value = tx.amount;
  $('e-note').value = tx.note;
  $('e-date').value = tx.date;
  const sp = (await list('splits')).filter(x => x.txId === tx.id);
  $('e-splits').textContent = sp.map(x => x.friend + ' owes ' + money(x.amount) + (x.settled ? ' (paid)' : ' (pending)')).join('\n');
  $('e-splits').style.whiteSpace = 'pre-line';
  drawEditChips();
  $('edit').hidden = false;
}

function drawEditChips() {
  chipRow($('e-chips'), CATEGORIES, editCat, c => {
    editCat = c;
    drawEditChips();
  });
}

function closeEdit() {
  $('edit').hidden = true;
  editing = null;
}

$('e-cancel').addEventListener('click', closeEdit);

$('edit-form').addEventListener('submit', async e => {
  e.preventDefault();
  const amount = toNum($('e-amount').value);
  if (!amount) return toast('Enter an amount');
  const sp = (await list('splits')).filter(x => x.txId === editing.id);
  if (sp.length && editCat === 'Earning') return toast('Delete this entry to make it Earning');
  const check = checkSplits(amount, sp.map(x => ({ name: x.friend, amount: x.amount })));
  if (!check.ok) return toast('Friends owe more than the total');
  await update('transactions', {
    ...editing,
    amount,
    note: $('e-note').value.trim(),
    category: editCat,
    date: $('e-date').value || editing.date
  });
  closeEdit();
  await renderAll();
  toast('Updated');
});

$('e-del').addEventListener('click', async () => {
  if (!confirm('Delete this entry? Its friend entries will be removed too.')) return;
  const sp = (await list('splits')).filter(x => x.txId === editing.id);
  for (const x of sp) await remove('splits', x.id);
  await remove('transactions', editing.id);
  closeEdit();
  await renderAll();
  toast('Deleted');
});

function monthLabel(m) {
  const [y, n] = m.split('-').map(Number);
  return new Date(y, n - 1, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

async function drawDashboard() {
  const [txs, splits, start] = await Promise.all([list('transactions'), list('splits'), getSetting('startBalance', 0)]);
  const months = getMonths(txs, monthOf(today()));
  if (!month || !months.includes(month)) month = months[0];
  const sel = $('month');
  sel.textContent = '';
  months.forEach(m => {
    const o = document.createElement('option');
    o.value = m;
    o.textContent = monthLabel(m);
    o.selected = m === month;
    sel.appendChild(o);
  });
  const st = getMonthStats(txs, splits, month);
  $('d-balance').textContent = money(getBalance(start, txs, splits));
  $('d-earned').textContent = money(st.earned);
  $('d-spend').textContent = money(st.spend);
  $('d-owed').textContent = money(getTotalOwed(txs, splits));

  const bars = $('bars');
  bars.textContent = '';
  if (!st.cats.length) {
    const p = document.createElement('p');
    p.className = 'empty';
    p.textContent = 'No spending this month.';
    bars.appendChild(p);
  }
  st.cats.forEach(c => {
    const item = document.createElement('div');
    item.className = 'bar';
    const head = document.createElement('div');
    head.className = 'bar-head';
    const name = document.createElement('span');
    name.textContent = c.cat;
    const val = document.createElement('span');
    val.className = 'bar-val';
    val.textContent = money(c.amount) + ' \u00b7 ' + c.pct + '%';
    head.append(name, val);
    const track = document.createElement('div');
    track.className = 'track';
    const fill = document.createElement('div');
    fill.className = 'fill';
    fill.style.width = c.pct + '%';
    track.appendChild(fill);
    item.append(head, track);
    bars.appendChild(item);
  });

  const top = $('top');
  top.textContent = '';
  st.top.forEach(c => {
    const li = document.createElement('li');
    li.textContent = c.cat + ' \u2013 ' + money(c.amount) + ' (' + c.pct + '%)';
    top.appendChild(li);
  });
  $('top').previousElementSibling.hidden = !st.top.length;
}

$('month').addEventListener('change', e => {
  month = e.target.value;
  drawDashboard();
});

async function renderAll() {
  await Promise.all([refreshBalance(), loadFriends(), drawOwed(), drawHistory(), drawDashboard()]);
}

async function init() {
  resetForm();
  const start = await getSetting('startBalance', null);
  if (start === null) $('setup').hidden = false;
  await renderAll();
}

init();

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js');
}
