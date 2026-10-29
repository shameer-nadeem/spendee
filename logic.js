export const CATEGORIES = ['Food', 'Coffee', 'Transport', 'Earning', 'Payments', 'Others'];

const sum = list => list.reduce((t, x) => t + x.amount, 0);

export function getBalance(start, txs, splits) {
  const ids = new Set(txs.map(t => t.id));
  const earned = sum(txs.filter(t => t.category === 'Earning'));
  const paid = sum(txs.filter(t => t.category !== 'Earning'));
  const back = sum(splits.filter(s => s.settled && ids.has(s.txId)));
  return start + earned - paid + back;
}

export function getTxRealSpend(tx, splits) {
  if (tx.category === 'Earning') return 0;
  const owed = sum(splits.filter(s => s.txId === tx.id));
  return tx.amount - owed;
}

export function getRealSpend(txs, splits) {
  return txs.reduce((t, x) => t + getTxRealSpend(x, splits), 0);
}

export function getOwedByFriend(splits) {
  const out = {};
  splits.filter(s => !s.settled).forEach(s => {
    out[s.friend] = (out[s.friend] || 0) + s.amount;
  });
  return out;
}

export function checkSplits(total, rows) {
  const used = rows.filter(r => r.name || r.amount);
  const owed = used.reduce((t, r) => t + (r.amount || 0), 0);
  const real = total - owed;
  if (used.some(r => !r.name)) return { ok: false, owed, real, error: 'Add a name for each friend' };
  if (used.some(r => !r.amount)) return { ok: false, owed, real, error: 'Add an amount for each friend' };
  if (owed > total) return { ok: false, owed, real, error: 'Friends owe more than the total' };
  return { ok: true, owed, real, error: '' };
}

export function matchName(name, known) {
  const hit = known.find(k => k.toLowerCase() === name.toLowerCase());
  return hit || name;
}

export function sortNewest(txs) {
  return [...txs].sort((a, b) => b.date.localeCompare(a.date) || (b.createdAt || 0) - (a.createdAt || 0));
}

export function filterByCategory(txs, cat) {
  return cat === 'All' ? txs : txs.filter(t => t.category === cat);
}

export function getPendingItems(splits, friend) {
  return splits.filter(s => !s.settled && s.friend === friend);
}

export function settle(split, date) {
  return { ...split, settled: true, settledDate: date };
}

export const monthOf = date => date.slice(0, 7);

export function getMonths(txs, now) {
  const set = new Set(txs.map(t => monthOf(t.date)));
  set.add(now);
  return [...set].sort().reverse();
}

export function getTotalOwed(txs, splits) {
  const ids = new Set(txs.map(t => t.id));
  return sum(splits.filter(s => !s.settled && ids.has(s.txId)));
}

export function getMonthStats(txs, splits, month) {
  const inMonth = txs.filter(t => monthOf(t.date) === month);
  const earned = sum(inMonth.filter(t => t.category === 'Earning'));
  const spend = getRealSpend(inMonth, splits);
  const by = {};
  inMonth.forEach(t => {
    const r = getTxRealSpend(t, splits);
    if (r > 0) by[t.category] = (by[t.category] || 0) + r;
  });
  const cats = Object.entries(by)
    .sort((a, b) => b[1] - a[1])
    .map(([cat, amount]) => ({ cat, amount, pct: Math.round((amount * 100) / spend) }));
  return { earned, spend, cats, top: cats.slice(0, 3) };
}

export function buildBackup(data, now) {
  return {
    app: 'spendee',
    version: 1,
    exportedAt: now,
    settings: data.settings.filter(s => s.key !== 'lastBackup'),
    transactions: data.transactions,
    splits: data.splits
  };
}

export function parseBackup(text) {
  let b;
  try {
    b = JSON.parse(text);
  } catch {
    throw new Error('Not a valid backup file');
  }
  if (!b || b.app !== 'spendee') throw new Error('Not a Spendee backup');
  if (!Array.isArray(b.transactions) || !Array.isArray(b.splits) || !Array.isArray(b.settings)) {
    throw new Error('Backup is missing data');
  }
  const whole = n => Number.isInteger(n) && n > 0;
  const badTx = b.transactions.find(t => !Number.isInteger(t.id) || !whole(t.amount) || !CATEGORIES.includes(t.category) || typeof t.date !== 'string');
  if (badTx) throw new Error('Backup has a bad transaction');
  const badSplit = b.splits.find(s => !Number.isInteger(s.id) || !Number.isInteger(s.txId) || typeof s.friend !== 'string' || !whole(s.amount) || typeof s.settled !== 'boolean');
  if (badSplit) throw new Error('Backup has a bad friend entry');
  if (b.settings.some(s => typeof s.key !== 'string')) throw new Error('Backup has bad settings');
  return { settings: b.settings, transactions: b.transactions, splits: b.splits, exportedAt: b.exportedAt || '' };
}

export function daysSince(iso, now) {
  return Math.floor((Date.parse(now) - Date.parse(iso)) / 86400000);
}

export function needsBackup(last, now, hasData) {
  if (!hasData) return false;
  return !last || daysSince(last, now) > 14;
}
