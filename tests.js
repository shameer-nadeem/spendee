import assert from 'node:assert/strict';
import { parseEntry } from './parser.js';
import { getBalance, getRealSpend, getTxRealSpend, getOwedByFriend, checkSplits, matchName, sortNewest, filterByCategory, getPendingItems, settle, monthOf, getMonths, getTotalOwed, getMonthStats, buildBackup, parseBackup, daysSince, needsBackup } from './logic.js';

let passed = 0;

function test(name, fn) {
  fn();
  passed++;
  console.log('ok   ' + name);
}

const lunch = { id: 1, amount: 6000, category: 'Food' };
const splits = [
  { id: 1, txId: 1, friend: 'Ali', amount: 2000, settled: false },
  { id: 2, txId: 1, friend: 'Hamza', amount: 2500, settled: false }
];

test('lunch: money paid out lowers balance by 6000', () => {
  assert.equal(getBalance(10000, [lunch], splits), 4000);
});

test('lunch: real spend is 1500', () => {
  assert.equal(getTxRealSpend(lunch, splits), 1500);
  assert.equal(getRealSpend([lunch], splits), 1500);
});

test('lunch: Ali and Hamza are pending', () => {
  assert.deepEqual(getOwedByFriend(splits), { Ali: 2000, Hamza: 2500 });
});

test('lunch: Ali pays back, balance goes up, real spend stays 1500', () => {
  const paid = [{ ...splits[0], settled: true, settledDate: '2026-10-30' }, splits[1]];
  assert.equal(getBalance(10000, [lunch], paid), 6000);
  assert.equal(getRealSpend([lunch], paid), 1500);
  assert.deepEqual(getOwedByFriend(paid), { Hamza: 2500 });
});

test('no friends: real spend equals total paid', () => {
  const tx = { id: 2, amount: 800, category: 'Coffee' };
  assert.equal(getRealSpend([tx], []), 800);
});

test('earning adds to balance and is not spend', () => {
  const tx = { id: 3, amount: 50000, category: 'Earning' };
  assert.equal(getBalance(0, [tx], []), 50000);
  assert.equal(getRealSpend([tx], []), 0);
});

test('payments category counts as money out', () => {
  const tx = { id: 4, amount: 8000, category: 'Payments' };
  assert.equal(getBalance(20000, [tx], []), 12000);
  assert.equal(getRealSpend([tx], []), 8000);
});

test('friend with two pending items is summed', () => {
  const more = [
    { id: 1, txId: 1, friend: 'Ali', amount: 2000, settled: false },
    { id: 2, txId: 2, friend: 'Ali', amount: 500, settled: false },
    { id: 3, txId: 2, friend: 'Ali', amount: 700, settled: true }
  ];
  assert.deepEqual(getOwedByFriend(more), { Ali: 2500 });
});

test('settled split of a deleted transaction is ignored', () => {
  const orphan = [{ id: 1, txId: 99, friend: 'Ali', amount: 2000, settled: true }];
  assert.equal(getBalance(1000, [], orphan), 1000);
});

test('empty data gives starting balance', () => {
  assert.equal(getBalance(5000, [], []), 5000);
  assert.equal(getRealSpend([], []), 0);
  assert.deepEqual(getOwedByFriend([]), {});
});

test('checkSplits: lunch example is valid with real spend 1500', () => {
  const r = checkSplits(6000, [{ name: 'Ali', amount: 2000 }, { name: 'Hamza', amount: 2500 }]);
  assert.equal(r.ok, true);
  assert.equal(r.owed, 4500);
  assert.equal(r.real, 1500);
});

test('checkSplits: friends owing more than total is blocked', () => {
  const r = checkSplits(1000, [{ name: 'Ali', amount: 700 }, { name: 'Hamza', amount: 400 }]);
  assert.equal(r.ok, false);
});

test('checkSplits: friends owing exactly the total is allowed', () => {
  const r = checkSplits(1000, [{ name: 'Ali', amount: 1000 }]);
  assert.equal(r.ok, true);
  assert.equal(r.real, 0);
});

test('checkSplits: empty rows are ignored, no friends means real = total', () => {
  const r = checkSplits(500, [{ name: '', amount: 0 }]);
  assert.equal(r.ok, true);
  assert.equal(r.real, 500);
});

test('checkSplits: missing name or amount is blocked', () => {
  assert.equal(checkSplits(500, [{ name: '', amount: 100 }]).ok, false);
  assert.equal(checkSplits(500, [{ name: 'Ali', amount: 0 }]).ok, false);
});

test('matchName reuses the known spelling', () => {
  assert.equal(matchName('ali', ['Ali', 'Hamza']), 'Ali');
  assert.equal(matchName('Sara', ['Ali']), 'Sara');
});

test('settle marks paid with a date and raises balance by the split', () => {
  const done = settle(splits[0], '2026-10-31');
  assert.equal(done.settled, true);
  assert.equal(done.settledDate, '2026-10-31');
  assert.equal(splits[0].settled, false);
  assert.equal(getBalance(10000, [lunch], [done, splits[1]]), 6000);
});

test('getPendingItems returns only unsettled items of one friend', () => {
  const all = [...splits, { id: 3, txId: 2, friend: 'Ali', amount: 300, settled: true }];
  const items = getPendingItems(all, 'Ali');
  assert.equal(items.length, 1);
  assert.equal(items[0].amount, 2000);
});

test('sortNewest puts the latest date first, then latest created', () => {
  const list = [
    { id: 1, date: '2026-10-01', createdAt: 1 },
    { id: 2, date: '2026-10-05', createdAt: 2 },
    { id: 3, date: '2026-10-05', createdAt: 3 }
  ];
  assert.deepEqual(sortNewest(list).map(t => t.id), [3, 2, 1]);
});

test('filterByCategory filters and All keeps everything', () => {
  const list = [{ category: 'Food' }, { category: 'Coffee' }, { category: 'Food' }];
  assert.equal(filterByCategory(list, 'Food').length, 2);
  assert.equal(filterByCategory(list, 'All').length, 3);
});

test('deleting a transaction and its splits restores the balance', () => {
  const paid = [settle(splits[0], '2026-10-31'), splits[1]];
  assert.equal(getBalance(10000, [lunch], paid), 6000);
  const left = paid.filter(s => s.txId !== lunch.id);
  assert.equal(getBalance(10000, [], left), 10000);
  assert.deepEqual(getOwedByFriend(left), {});
});

const oct = [
  { id: 1, amount: 6000, category: 'Food', date: '2026-10-05' },
  { id: 2, amount: 1000, category: 'Coffee', date: '2026-10-09' },
  { id: 3, amount: 2000, category: 'Transport', date: '2026-10-12' },
  { id: 4, amount: 50000, category: 'Earning', date: '2026-10-20' },
  { id: 5, amount: 9000, category: 'Payments', date: '2026-09-28' }
];

test('month stats: earning is not spend, lunch counts as real spend 1500', () => {
  const m = getMonthStats(oct, splits, '2026-10');
  assert.equal(m.earned, 50000);
  assert.equal(m.spend, 1500 + 1000 + 2000);
});

test('month stats: categories sorted with percentages, no Earning', () => {
  const m = getMonthStats(oct, splits, '2026-10');
  assert.deepEqual(m.cats.map(c => c.cat), ['Transport', 'Food', 'Coffee']);
  assert.deepEqual(m.cats.map(c => c.pct), [44, 33, 22]);
  assert.equal(m.cats.some(c => c.cat === 'Earning'), false);
});

test('month stats: top 3 keeps only the biggest three', () => {
  const more = [...oct, { id: 6, amount: 300, category: 'Others', date: '2026-10-15' }];
  const m = getMonthStats(more, splits, '2026-10');
  assert.equal(m.cats.length, 4);
  assert.deepEqual(m.top.map(c => c.cat), ['Transport', 'Food', 'Coffee']);
});

test('month stats: other months are left out', () => {
  const m = getMonthStats(oct, splits, '2026-09');
  assert.equal(m.spend, 9000);
  assert.equal(m.earned, 0);
  assert.deepEqual(getMonthStats(oct, splits, '2026-08').cats, []);
});

test('month stats: a fully split bill leaves no real spend', () => {
  const tx = [{ id: 1, amount: 1000, category: 'Food', date: '2026-10-01' }];
  const sp = [{ id: 1, txId: 1, friend: 'Ali', amount: 1000, settled: false }];
  const m = getMonthStats(tx, sp, '2026-10');
  assert.equal(m.spend, 0);
  assert.deepEqual(m.cats, []);
});

test('getMonths lists months newest first and always has the current one', () => {
  assert.deepEqual(getMonths(oct, '2026-10'), ['2026-10', '2026-09']);
  assert.deepEqual(getMonths([], '2026-11'), ['2026-11']);
  assert.equal(monthOf('2026-10-05'), '2026-10');
});

test('getTotalOwed adds up pending money only', () => {
  const sp = [...splits, { id: 9, txId: 1, friend: 'Sara', amount: 100, settled: true }];
  assert.equal(getTotalOwed([lunch], sp), 4500);
  assert.equal(getTotalOwed([], sp), 0);
});

test('parser: lunch with two friends', () => {
  const r = parseEntry('lunch 6000 Ali 2000 Hamza 2500');
  assert.equal(r.amount, 6000);
  assert.equal(r.category, 'Food');
  assert.equal(r.note, 'lunch');
  assert.deepEqual(r.friends, [{ name: 'Ali', amount: 2000 }, { name: 'Hamza', amount: 2500 }]);
});

test('parser: gym fee is a payment', () => {
  const r = parseEntry('gym fee 8000');
  assert.equal(r.amount, 8000);
  assert.equal(r.category, 'Payments');
  assert.equal(r.note, 'gym fee');
  assert.deepEqual(r.friends, []);
});

test('parser: got paid is earning', () => {
  const r = parseEntry('got paid 50000 freelance');
  assert.equal(r.amount, 50000);
  assert.equal(r.category, 'Earning');
  assert.equal(r.note, 'got paid freelance');
});

test('parser: messy case, commas, Rs, filler words, trailing rupees', () => {
  const r = parseEntry('  LUNCH   Rs. 6,000 with ali, 2,000 and HAMZA 2500 rupees ');
  assert.equal(r.amount, 6000);
  assert.equal(r.category, 'Food');
  assert.deepEqual(r.friends, [{ name: 'Ali', amount: 2000 }, { name: 'Hamza', amount: 2500 }]);
});

test('parser: glued currency, colon names, and k suffix', () => {
  assert.equal(parseEntry('uber Rs.450').amount, 450);
  assert.equal(parseEntry('uber 1.5k').amount, 1500);
  assert.equal(parseEntry('uber 2k').category, 'Transport');
  const r = parseEntry('dinner 3000 Ali:1000');
  assert.deepEqual(r.friends, [{ name: 'Ali', amount: 1000 }]);
});

test('parser: coffee, internet bill, unknown words', () => {
  assert.equal(parseEntry('coffee 450').category, 'Coffee');
  assert.equal(parseEntry('internet bill 3500').category, 'Payments');
  assert.equal(parseEntry('icloud storage 400').category, 'Payments');
  assert.equal(parseEntry('random thing 300').category, 'Others');
});

test('parser: extra words before a friend stay in the note', () => {
  const r = parseEntry('dinner 5000 at KFC Ali 1000');
  assert.equal(r.note, 'dinner at KFC');
  assert.deepEqual(r.friends, [{ name: 'Ali', amount: 1000 }]);
});

test('parser: no amount gives an error', () => {
  const r = parseEntry('just some words');
  assert.equal(r.error, 'No amount found');
  assert.equal(parseEntry('').error, 'No amount found');
});

test('parser: earning ignores friends', () => {
  const r = parseEntry('salary 80000 Ali 100');
  assert.equal(r.category, 'Earning');
  assert.deepEqual(r.friends, []);
});

test('parser: friend amount with no name keeps an empty name', () => {
  const r = parseEntry('lunch 600 200');
  assert.deepEqual(r.friends, [{ name: '', amount: 200 }]);
});

test('parser: custom keyword rules are used', () => {
  assert.equal(parseEntry('chai 100', { Coffee: ['chai'] }).category, 'Coffee');
  assert.equal(parseEntry('chai 100').category, 'Others');
});

const sample = {
  settings: [{ key: 'startBalance', value: 10000 }, { key: 'lastBackup', value: '2026-10-01T00:00:00.000Z' }],
  transactions: [
    { id: 1, amount: 6000, note: 'lunch', category: 'Food', date: '2026-10-05', createdAt: 111 },
    { id: 2, amount: 50000, note: '', category: 'Earning', date: '2026-10-06', createdAt: 222 }
  ],
  splits: [
    { id: 1, txId: 1, friend: 'Ali', amount: 2000, settled: true, settledDate: '2026-10-07', date: '2026-10-05' },
    { id: 2, txId: 1, friend: 'Hamza', amount: 2500, settled: false, settledDate: null, date: '2026-10-05' }
  ]
};

test('backup: export then import gives identical data', () => {
  const text = JSON.stringify(buildBackup(sample, '2026-10-29T10:00:00.000Z'));
  const back = parseBackup(text);
  assert.deepEqual(back.transactions, sample.transactions);
  assert.deepEqual(back.splits, sample.splits);
  assert.deepEqual(back.settings, [{ key: 'startBalance', value: 10000 }]);
  assert.equal(back.exportedAt, '2026-10-29T10:00:00.000Z');
});

test('backup: balance and owed are the same after a round trip', () => {
  const back = parseBackup(JSON.stringify(buildBackup(sample, '2026-10-29T10:00:00.000Z')));
  assert.equal(getBalance(10000, back.transactions, back.splits), getBalance(10000, sample.transactions, sample.splits));
  assert.deepEqual(getOwedByFriend(back.splits), { Hamza: 2500 });
});

test('backup: lastBackup setting is not stored in the file', () => {
  const b = buildBackup(sample, '2026-10-29T10:00:00.000Z');
  assert.equal(b.settings.some(x => x.key === 'lastBackup'), false);
});

test('backup: bad files are rejected', () => {
  assert.throws(() => parseBackup('not json'), /valid backup/);
  assert.throws(() => parseBackup('{"app":"other"}'), /Not a Spendee/);
  assert.throws(() => parseBackup('{"app":"spendee","transactions":[]}'), /missing/);
  const bad = b => JSON.stringify({ app: 'spendee', settings: [], transactions: [], splits: [], ...b });
  assert.throws(() => parseBackup(bad({ transactions: [{ id: 1, amount: -5, category: 'Food', date: 'x' }] })), /transaction/);
  assert.throws(() => parseBackup(bad({ transactions: [{ id: 1, amount: 5, category: 'Pets', date: 'x' }] })), /transaction/);
  assert.throws(() => parseBackup(bad({ splits: [{ id: 1, txId: 1, friend: 'Ali', amount: 5 }] })), /friend/);
});

test('backup: empty data round trips', () => {
  const back = parseBackup(JSON.stringify(buildBackup({ settings: [], transactions: [], splits: [] }, 'x')));
  assert.deepEqual(back.transactions, []);
  assert.deepEqual(back.splits, []);
});

test('needsBackup: reminder only when data exists and last backup is over 14 days', () => {
  const now = '2026-10-29T12:00:00.000Z';
  assert.equal(needsBackup(null, now, true), true);
  assert.equal(needsBackup(null, now, false), false);
  assert.equal(needsBackup('2026-10-25T12:00:00.000Z', now, true), false);
  assert.equal(needsBackup('2026-10-15T12:00:00.000Z', now, true), false);
  assert.equal(needsBackup('2026-10-14T12:00:00.000Z', now, true), true);
  assert.equal(daysSince('2026-10-19T12:00:00.000Z', now), 10);
});

console.log('\n' + passed + ' tests passed');
