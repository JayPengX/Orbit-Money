// The books (lib/books.mjs): balances, the 總資產, months, budgets, repeats, cards, merging.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as B from '../public/lib/books.mjs';

const T = Date.UTC(2026, 9, 27);
function sample() {
  const b = B.emptyBooks();
  B.put(b, 'accts', { id: 'cash', name: '現金', kind: 'cash', open: 2000, inTotal: true }, T);
  B.put(b, 'accts', { id: 'bank', name: '玉山', kind: 'bank', open: 50000, inTotal: true }, T);
  B.put(b, 'accts', { id: 'cc', name: 'CUBE', kind: 'credit', open: -1000, inTotal: true, pay: 'bank', close: 15, due: 3 }, T);
  B.put(b, 'accts', { id: 'save', name: '定存', kind: 'bank', open: 100000, inTotal: false }, T);
  B.put(b, 'cards', { id: 'deb', acct: 'bank', name: '金融卡' }, T);
  B.put(b, 'entries', { id: 'e1', d: '2026-10-01', k: 'out', amt: 120, cat: 'food', a: 'cash' }, T);
  B.put(b, 'entries', { id: 'e2', d: '2026-10-05', k: 'out', amt: 3000, cat: 'shop', a: 'cc' }, T);
  B.put(b, 'entries', { id: 'e3', d: '2026-10-05', k: 'in', amt: 40000, cat: 'salary', a: 'bank' }, T);
  B.put(b, 'entries', { id: 'e4', d: '2026-10-20', k: 'move', amt: 1000, a: 'bank', to: 'cc' }, T);
  B.put(b, 'entries', { id: 'e5', d: '2026-10-21', k: 'out', amt: 500, cat: 'food', a: 'bank', via: 'deb' }, T);
  B.put(b, 'entries', { id: 'e6', d: '2026-11-02', k: 'out', amt: 80, cat: 'food', a: 'cash' }, T);
  return b;
}

test('balances: opening plus what came in less what went out; a move both sides; up to a day', () => {
  const b = sample();
  assert.deepEqual(B.balances(b), { cash: 1800, bank: 88500, cc: -3000, save: 100000 });
  assert.equal(B.balances(b, '2026-10-31').cash, 1880);
});

test('the 總資產: counted accounts only, a card owing is a debt', () => {
  assert.deepEqual(B.worth(sample()), { assets: 90300, debts: 3000, net: 87300 });
});

test('a month: spent and earned by day and category; moves and balance fixes are neither', () => {
  const b = sample();
  B.put(b, 'entries', { id: 'fix', d: '2026-10-22', k: 'adj', amt: -55, a: 'cash' }, T);
  const t = B.monthTotals(b, '2026-10');
  assert.equal(t.out, 3620);
  assert.equal(t.in, 40000);
  assert.deepEqual(t.cats, [{ cat: 'shop', amt: 3000 }, { cat: 'food', amt: 620 }]);
  assert.deepEqual(B.monthByDay(b, '2026-10')['2026-10-05'], { out: 3000, in: 40000, n: 2 });
  assert.equal(B.adjustBy(b, 'cash', 1700), -45);
});

test('budgets: spent, left, pace against the days gone, per day left', () => {
  const b = sample();
  B.put(b, 'budgets', { id: 'all', cat: '', amt: 10000 }, T);
  B.put(b, 'budgets', { id: 'f', cat: 'food', amt: 1000 }, T);
  const [all, food] = B.budgetState(b, '2026-10', '2026-10-16');
  assert.equal(all.spent, 3620);
  assert.equal(food.left, 380);
  assert.ok(Math.abs(food.pace - 0.62 / (16 / 31)) < 1e-9);
  assert.equal(food.perDay, Math.floor(380 / 16));
  assert.equal(B.budgetState(b, '2026-09', '2026-10-16')[0].pace, 0);
});

test('repeats: monthly on the last day when shorter, weekly, yearly; made once, a removed one stays removed', () => {
  const r = { id: 'rent', k: 'out', amt: 15000, cat: 'home', a: 'bank', every: 'month', day: 31, from: '2026-01-15' };
  assert.deepEqual(B.repeatDays(r, '2026-01-01', '2026-03-31'), ['2026-01-31', '2026-02-28', '2026-03-31']);
  assert.deepEqual(B.repeatDays({ every: 'week', day: 1, from: '2026-10-01' }, '2026-10-01', '2026-10-20'), ['2026-10-05', '2026-10-12', '2026-10-19']);
  assert.deepEqual(B.repeatDays({ every: 'year', day: '02-29', from: '2026-01-01' }, '2026-01-01', '2028-12-31'), ['2026-02-28', '2027-02-28', '2028-02-29']);
  const b = sample();
  B.put(b, 'recur', r, T);
  assert.equal(B.runRepeats(b, '2026-03-31', T), 3);
  assert.equal(B.runRepeats(b, '2026-03-31', T), 0);
  B.drop(b, 'entries', 'r-rent-2026-02-28', T);
  assert.equal(B.runRepeats(b, '2026-03-31', T), 0);
  assert.equal(B.nextRepeat(r, '2026-04-02'), '2026-04-30');
});

test("a card's bill: buys between the last two closing days, paid since, due after the close", () => {
  const b = sample();
  const bill = B.cardBill(b, b.accts.cc, '2026-10-27');
  assert.deepEqual(bill, { closed: '2026-10-15', opened: '2026-09-16', bill: 3000, paid: 1000, left: 2000, due: '2026-11-03' });
  assert.equal(B.cardBill(b, { ...b.accts.cc, close: 0 }, '2026-10-27'), null);
});

test('removing an account takes its cards, repeats and entries, and unlinks a card paid from it', () => {
  const b = sample();
  B.dropAccount(b, 'bank', T + 1);
  assert.equal(B.live(b.cards).length, 0);
  assert.deepEqual(B.live(b.entries).map(e => e.id).sort(), ['e1', 'e2', 'e6']);
  assert.equal(b.accts.cc.pay, '');
});

test('merging: each record the one changed last, removals win when newer, old removals let go; settings the newer', async () => {
  const a = sample();
  const c = structuredClone(a);
  B.put(a, 'entries', { ...a.entries.e1, amt: 150 }, T + 5);
  B.drop(c, 'entries', 'e1', T + 9);
  B.put(c, 'entries', { id: 'n', d: '2026-10-27', k: 'out', amt: 1, a: 'cash' }, T + 3);
  a.st = 5;
  a.opt = { start: 'mon' };
  c.st = 3;
  const m = B.mergeBooks(a, c, T + 10);
  assert.equal(m.entries.e1.del, 1);
  assert.ok(m.entries.n);
  assert.deepEqual(m.opt, { start: 'mon' });
  const later = B.mergeBooks(m, B.emptyBooks(), T + 10 + B.KEEP_GONE_MS + 1);
  assert.equal(later.entries.e1, undefined);
  const back = await B.decodeBooks(await B.encodeBooks(m));
  assert.deepEqual(back.entries, m.entries);
  assert.equal(await B.decodeBooks('z3:abc'), null);
  assert.equal(await B.decodeBooks('m1:!!!'), null);
});

test('封存: out of use, its entries and balance kept, its repeats stop; back again', () => {
  const b = sample();
  B.put(b, 'recur', { id: 'r1', k: 'out', amt: 300, cat: 'home', a: 'cc', every: 'month', day: 1, from: '2026-10-01' }, T);
  B.closeAccount(b, 'cc', true, T + 1);
  assert.ok(!B.isOpen(b.accts.cc));
  assert.equal(B.balances(b).cc, -3000);
  assert.ok(b.recur.r1.del);
  B.closeAccount(b, 'cc', false, T + 2);
  assert.ok(B.isOpen(b.accts.cc));
});

test('轉移: an account onto another keeps every total; moves between the two drop', () => {
  const b = sample();
  B.put(b, 'accts', { id: 'bank2', name: '新帳戶', kind: 'bank', open: 0, inTotal: true }, T);
  const before = B.worth(b);
  B.moveAccount(b, 'bank', 'bank2', T + 1);
  assert.ok(b.accts.bank.del);
  assert.equal(B.balances(b).bank2, 88500);
  assert.deepEqual(B.worth(b), before);
  assert.equal(b.entries.e5.a, 'bank2');
  assert.equal(b.cards.deb.acct, 'bank2');
  assert.equal(b.accts.cc.pay, 'bank2');
  assert.deepEqual(B.historyOf(b, 'bank'), { entries: 0, recur: 0, cards: 0 });
});

test('a way to pay replaced or let go: its entries follow, never lost', () => {
  const b = sample();
  B.put(b, 'cards', { id: 'deb2', acct: 'bank', name: '新金融卡' }, T);
  B.moveCard(b, 'deb', 'deb2', T + 1);
  assert.equal(b.entries.e5.via, 'deb2');
  assert.ok(b.cards.deb.del);
  B.moveCard(b, 'deb2', '', T + 2);
  assert.equal(b.entries.e5.via, '');
  assert.equal(b.entries.e5.a, 'bank');
});

test('removed with its history, then 復原 puts every record back', () => {
  const b = sample();
  const snap = B.snapshot(b, B.accountParts(b, 'bank'));
  B.dropAccount(b, 'bank', T + 1);
  assert.ok(b.entries.e3.del && b.accts.bank.del);
  B.restore(b, snap, T + 2);
  assert.deepEqual(B.balances(b), { cash: 1800, bank: 88500, cc: -3000, save: 100000 });
  assert.equal(b.accts.cc.pay, 'bank');
});
