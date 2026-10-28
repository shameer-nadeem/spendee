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
