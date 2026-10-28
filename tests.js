import assert from 'node:assert/strict';
import { getBalance, getRealSpend, getTxRealSpend, getOwedByFriend } from './logic.js';

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

console.log('\n' + passed + ' tests passed');
