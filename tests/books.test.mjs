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

test('a category’s usual amounts and way to pay, from its own history', () => {
  const b = B.emptyBooks();
  const add = (id, d, amt, a, sub = 'food:breakfast') => B.put(b, 'entries', { id, d, k: 'out', amt, cat: 'food', sub, a }, T);
  add('a', '2026-10-20', 34, 'cash');
  add('b', '2026-10-21', 34, 'cash');
  add('c', '2026-10-22', 55, 'cash');
  add('d', '2026-10-23', 55, 'card');
  add('e', '2026-10-24', 34, 'cash');
  add('f', '2026-10-25', 120, 'cash', 'food:lunch');
  add('g', '2026-01-01', 99, 'cash');
  add('h', '2026-01-02', 99, 'cash');
  const u = B.usualFor(b, { k: 'out', cat: 'food', sub: 'food:breakfast' }, '2026-10-27');
  assert.deepEqual(u.amts, [{ amt: 34, n: 3 }, { amt: 55, n: 2 }]);
  assert.deepEqual(u.pay, { a: 'cash', via: '', n: 4 });
  assert.equal(u.of, 5);
  assert.equal(B.usualFor(b, { k: 'out', cat: 'food' }, '2026-10-27').of, 6);
});

test('自動加值: a spend that sets it off brings the reload in from the card behind it', () => {
  const b = sample();
  B.put(b, 'accts', { id: 'ez', name: '悠遊卡', kind: 'ticket', open: 120, inTotal: true, reload: { on: true, from: 'cc', amt: 500, below: 100 } }, T);
  const spend = (id, amt) => B.autoReload(b, B.put(b, 'entries', { id, d: '2026-10-25', k: 'out', amt, cat: 'transport', a: 'ez' }, T), T);
  assert.equal(spend('r1', 15), 0);
  assert.equal(B.balances(b)['ez'], 105);
  assert.equal(spend('r1b', 30), 0);
  // Under NT$100 when it's tapped: NT$500 in, then the fare.
  assert.equal(spend('r2', 30), 500);
  assert.equal(B.balances(b)['ez'], 545);
  assert.equal(b.entries['r2-r'].a, 'cc');
  assert.equal(b.entries['r2-r'].for, 'r2');
  // Changed so it no longer does (paid in cash): its reload goes.
  B.put(b, 'entries', { ...b.entries.r2, a: 'cash' }, T + 1);
  assert.equal(B.autoReload(b, b.entries.r2, T + 1), 0);
  assert.ok(b.entries['r2-r'].del);
  // Short by more than one reload: as many as it takes.
  assert.equal(spend('r3', 1200), 1500);
  assert.ok(B.balances(b)['ez'] >= 0);
  // Off: nothing.
  B.put(b, 'accts', { ...b.accts.ez, reload: { ...b.accts.ez.reload, on: false } }, T);
  assert.equal(spend('r4', 5000), 0);
});

test('自動加值 with nothing behind it (a parent’s card): the card’s balance goes up as income, nobody else’s', () => {
  const b = sample();
  B.put(b, 'accts', { id: 'ez', name: '悠遊卡', kind: 'ticket', open: 50, inTotal: true, reload: { on: true, from: '', amt: 500, below: 100 } }, T);
  const before = B.balances(b);
  const t0 = B.totals(b, '2026-10-01', '2026-10-31');
  const e = B.put(b, 'entries', { id: 'm1', d: '2026-10-25', k: 'out', amt: 15, cat: 'transport', a: 'ez' }, T);
  assert.equal(B.autoReload(b, e, T), 500);
  assert.equal(b.entries['m1-r'].k, 'in');
  const after = B.balances(b);
  assert.equal(after.ez, 535);
  assert.equal(after.cc, before.cc);
  const t1 = B.totals(b, '2026-10-01', '2026-10-31');
  assert.equal(t1.in, t0.in + 500);
  assert.equal(t1.out, t0.out + 15);
});

test('a 退款, whole or part, comes off its spend (not income), on the spend’s day; the money lands where it went back to', () => {
  const b = sample();
  const t0 = B.totals(b, '2026-10-01', '2026-10-31');
  const bal0 = B.balances(b);
  // NT$3,000 on the card on 10-05; NT$1,000 of it back on the card on 11-02.
  B.put(b, 'entries', { id: 'r1', d: '2026-11-02', k: 'back', why: 'refund', of: 'e2', amt: 1000, a: 'cc', cat: 'shop' }, T);
  const t1 = B.totals(b, '2026-10-01', '2026-10-31');
  assert.equal(t1.out, t0.out - 1000);
  assert.equal(t1.in, t0.in);
  assert.equal(t1.cats.find(c => c.cat === 'shop').amt, 2000);
  assert.equal(B.totals(b, '2026-11-01', '2026-11-30').in, 0);
  assert.equal(B.balances(b).cc, bal0.cc + 1000);
  assert.equal(B.monthByDay(b, '2026-10')['2026-10-05'].out, 2000);
  // All of it back: the spend is 0, never below.
  B.put(b, 'entries', { id: 'r2', d: '2026-11-03', k: 'back', why: 'refund', of: 'e2', amt: 2500, a: 'cc' }, T);
  assert.equal(B.totals(b, '2026-10-01', '2026-10-31').cats.find(c => c.cat === 'shop'), undefined);
  assert.equal(B.netOf(b.entries.e2, B.backs(b)), 0);
});

test('a friend’s share: comes off the spend at once; their cash moves a balance only once handed over', () => {
  const b = sample();
  const bal0 = B.balances(b);
  B.put(b, 'entries', { id: 'd1', d: '2026-10-10', k: 'out', amt: 900, cat: 'food', sub: 'food:out', a: 'cc' }, T);
  B.put(b, 'entries', { id: 'f1', d: '2026-10-10', k: 'back', why: 'friend', who: '小明', of: 'd1', amt: 300, a: 'cash', wait: 1 }, T);
  B.put(b, 'entries', { id: 'f2', d: '2026-10-10', k: 'back', why: 'friend', who: '阿華', of: 'd1', amt: 300, a: 'cash' }, T);
  const t = B.totals(b, '2026-10-01', '2026-10-31');
  assert.equal(t.cats.find(c => c.cat === 'food').amt, 120 + 500 + 300);
  const bal = B.balances(b);
  assert.equal(bal.cc, bal0.cc - 900);
  assert.equal(bal.cash, bal0.cash + 300);
  assert.deepEqual(B.owed(b).map(x => [x.e.who, x.of.id]), [['小明', 'd1']]);
  B.put(b, 'entries', { ...b.entries.f1, wait: 0, d: '2026-10-12' }, T + 1);
  assert.equal(B.balances(b).cash, bal0.cash + 600);
  assert.equal(B.owed(b).length, 0);
});

test('paid two ways (LINE Pay and LINE Points): each pays its part, the spend is the whole', () => {
  const b = sample();
  B.put(b, 'accts', { id: 'lp', name: 'LINE Pay', kind: 'wallet', open: 1000, inTotal: true }, T);
  B.put(b, 'accts', { id: 'pts', name: 'LINE Points', kind: 'wallet', open: 200, inTotal: true }, T);
  const t0 = B.totals(b, '2026-10-01', '2026-10-31').out;
  B.put(b, 'entries', { id: 'x', d: '2026-10-12', k: 'out', amt: 350, cat: 'shop', a: 'lp', also: [{ a: 'pts', amt: 50 }] }, T);
  const bal = B.balances(b);
  assert.equal(bal.lp, 700);
  assert.equal(bal.pts, 150);
  assert.equal(B.totals(b, '2026-10-01', '2026-10-31').out, t0 + 350);
  // Never more than the spend.
  B.put(b, 'entries', { id: 'y', d: '2026-10-12', k: 'out', amt: 40, cat: 'shop', a: 'lp', also: [{ a: 'pts', amt: 90 }] }, T);
  assert.equal(B.balances(b).pts, 110);
  assert.equal(B.balances(b).lp, 700);
  // The points account moved over (轉移) takes its part with it.
  B.put(b, 'accts', { id: 'pts2', name: 'LINE Points 新', kind: 'wallet', open: 0, inTotal: true }, T);
  B.moveAccount(b, 'pts', 'pts2', T + 1);
  assert.equal(B.balances(b).pts2, 110);
  assert.equal(B.historyOf(b, 'pts2').entries, 2);
});

test('a fee (ATM, 境外交易) is spending under 稅費 › 手續費, paid from the same account; on a transfer only the fee is spending', () => {
  const b = sample();
  const bal0 = B.balances(b);
  const t0 = B.totals(b, '2026-10-01', '2026-10-31');
  B.put(b, 'entries', { id: 'atm', d: '2026-10-11', k: 'move', amt: 2000, a: 'bank', to: 'cash', fee: 15 }, T);
  B.put(b, 'entries', { id: 'fx', d: '2026-10-11', k: 'out', amt: 600, cat: 'fun', a: 'cc', fee: 9 }, T);
  const bal = B.balances(b);
  assert.equal(bal.bank, bal0.bank - 2015);
  assert.equal(bal.cash, bal0.cash + 2000);
  assert.equal(bal.cc, bal0.cc - 609);
  const t = B.totals(b, '2026-10-01', '2026-10-31');
  assert.equal(t.out, t0.out + 600 + 24);
  assert.equal(t.cats.find(c => c.cat === 'tax').amt, 24);
  assert.equal(B.lines(b, '2026-10-11', '2026-10-11').filter(l => l.fee).every(l => l.sub === 'tax:fee'), true);
  // The card's bill has the fee in it.
  assert.equal(B.cardBill(b, b.accts.cc, '2026-10-20').bill, 3000 + 609);
});

test('older books brought up: 退款 income becomes money back for its likeliest spend; a 自動加值 from nobody becomes income; twice does nothing', () => {
  const b = sample();
  B.put(b, 'entries', { id: 'old1', d: '2026-10-08', k: 'in', amt: 500, cat: 'refund', a: 'bank' }, T);
  B.put(b, 'entries', { id: 'old2', d: '2026-10-09', k: 'in', amt: 99999, cat: 'refund', a: 'cash' }, T);
  B.put(b, 'entries', { id: 'rl', d: '2026-10-09', k: 'adj', amt: 500, cat: '', a: 'cash', auto: 'reload', for: 'e1' }, T);
  const bal0 = B.balances(b);
  assert.equal(B.upgradeBooks(b, T + 1), 3);
  // (500 back: only e2's 3,000 is big enough before it.)
  assert.equal(b.entries.old1.k, 'back');
  assert.equal(b.entries.old1.of, 'e2');
  assert.equal(b.entries.old2.of, '');
  assert.equal(b.entries.rl.k, 'in');
  assert.deepEqual(B.balances(b), bal0);
  const t = B.totals(b, '2026-10-01', '2026-10-31');
  assert.equal(t.in, 40000 + 500);
  assert.equal(t.cats.find(c => c.cat === 'shop').amt, 2500);
  assert.equal(B.upgradeBooks(b, T + 2), 0);
});

test('a 載具 invoice matches what was logged by hand (same amount, its day or next to it); only the rest are new', () => {
  const b = B.emptyBooks();
  B.put(b, 'entries', { id: 'e1', d: '2026-11-03', k: 'out', amt: 85, cat: 'food', a: 'cash' }, 1);
  B.put(b, 'entries', { id: 'e2', d: '2026-11-04', k: 'out', amt: 240, cat: 'move', a: 'cash' }, 1);
  B.put(b, 'entries', { id: 'e3', d: '2026-11-03', k: 'out', amt: 85, cat: 'food', a: 'cash', inv: { no: 'AA00000009' } }, 1);
  const inv = (no, day, total) => ({ no, day, total, items: [], seller: '' });
  const { attach, fresh } = B.matchInvoices(b, [inv('AA00000001', '2026-11-03', 85), inv('AA00000002', '2026-11-03', 240), inv('AA00000003', '2026-11-03', 85), inv('AA00000009', '2026-11-03', 85)]);
  assert.deepEqual(attach.map(([id, i]) => [id, i.no]), [['e1', 'AA00000001'], ['e2', 'AA00000002']]);
  // A second 85 that day has no hand entry left: new. One already in: left out.
  assert.deepEqual(fresh.map(i => i.no), ['AA00000003']);
});
