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
