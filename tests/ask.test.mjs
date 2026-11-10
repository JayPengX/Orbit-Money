// 問我的帳's facts (lib/ask.mjs): the phone adds up the books; every number
// the AI may say is here, once, lean.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as B from '../public/lib/books.mjs';
import * as C from '../public/lib/cats.mjs';
import { booksFacts, askTables, byPay } from '../public/lib/ask.mjs';

test('the facts: tables by id (by category, how it was paid, inside a category, places, against last month, the week, the budget), each number once', () => {
  C.useCats({});
  const b = B.emptyBooks();
  const T = Date.UTC(2026, 10, 1);
  B.put(b, 'accts', { id: 'cash', name: '現金', kind: 'cash' }, T);
  B.put(b, 'accts', { id: 'cc', name: '國泰CUBE', kind: 'credit' }, T);
  B.put(b, 'cards', { id: 'lp', acct: 'cc', name: 'LINE Pay' }, T);
  B.put(b, 'cards', { id: 'v', acct: 'cc', name: '實體卡', last4: '8812' }, T);
  const e = (id, d, amt, more = {}) => B.put(b, 'entries', { id, d, k: 'out', amt, cat: 'food', sub: 'food:lunch', a: 'cash', via: '', note: '', ...more }, T);
  e('a', '2026-11-03', 120, { note: '全家' });
  e('b', '2026-11-04', 95, { note: '全家', a: 'cc', via: 'lp' });
  e('c', '2026-11-09', 1290, { cat: 'digital', sub: 'digital:games', note: 'Steam', a: 'cc', via: 'v', also: [{ a: 'cash', amt: 90 }] });
  e('d', '2026-10-05', 300, { sub: 'food:dinner' });
  e('i', '2026-11-01', 2000, { k: 'in', cat: 'allowance', sub: '' });
  B.put(b, 'budgets', { id: 'all', cat: '', amt: 5000 }, T);
  // (How it was paid: by the card used, a part paid another way under that way.)
  assert.deepEqual(byPay(b, '2026-11-01', '2026-11-10').map(p => [p.label, p.amt, p.n]), [['實體卡 •8812', 1200, 1], ['現金', 210, 2], ['國泰CUBE LINE Pay', 95, 1]]);
  const { tables } = askTables(b, '2026-11-10');
  assert.deepEqual(tables.pay0.rows.map(r => r.amt), [1200, 210, 95]);
  assert.deepEqual(tables.budget.rows.map(r => r.amt), [5000, 1505, 3495]);
  const f = booksFacts(b, '2026-11-10');
  assert.match(f, /^\[cat0\] 11月（到今天）花在哪: 數位 1290; 餐飲 215$/m);
  assert.match(f, /^\[pay0\] .*實體卡 •8812 1200 \(1 times\); 現金 210 \(2 times\)/m);
  assert.match(f, /^\[place0\] .*全家 215 \(2 times\)/m);
  assert.match(f, /^\[vs\] .*餐飲 215 \(was 300\)/m);
  assert.match(f, /^\[week\] .*這週 1290; 上週 215/m);
  assert.match(f, /^\[budget\] .*還剩 3495/m);
  assert.ok(f.length < 1500, `lean: ${f.length}`);
  assert.ok(!/\d,\d{3}/.test(f), 'no thousands commas');
});

test('每月回顧: last month in the first week, against the month before; the facts the AI writes from', async () => {
  const { reviewMonth, reviewOf, reviewFacts } = await import('../public/lib/month.mjs');
  C.useCats({});
  const b = B.emptyBooks();
  const T = Date.UTC(2026, 10, 1);
  const e = (id, d, amt, more = {}) => B.put(b, 'entries', { id, d, k: 'out', amt, cat: 'food', sub: 'food:lunch', a: 'cash', via: '', note: '', ...more }, T);
  e('a', '2026-10-03', 120, { note: '全家' });
  e('b', '2026-10-04', 95, { note: '全家' });
  e('c', '2026-10-09', 1290, { cat: 'digital', sub: 'digital:games' });
  e('d', '2026-09-05', 300);
  e('i', '2026-10-01', 2000, { k: 'in', cat: 'allowance', sub: '' });
  assert.equal(reviewMonth('2026-11-03'), '2026-10');
  assert.equal(reviewMonth('2026-11-08'), null);
  const v = reviewOf(b, '2026-10');
  assert.equal(v.spent, 1505);
  assert.equal(v.before, 300);
  assert.equal(v.top.cat, 'digital');
  assert.equal(v.up.cat, 'digital');
  assert.equal(v.kept, 25);
  const f = reviewFacts(v);
  assert.match(f, /Spent 1505; the month before 300/);
  assert.match(f, /Went most often to 全家: 2 times, 215/);
  // (What the card shows comes first, then only what it doesn't: the AI's suggestion is from those, Jay 11-10.)
  assert.ok(f.indexOf('already sees') > f.indexOf('Spent') && f.indexOf('already sees') < f.indexOf('Went most often'));
  assert.match(f, /The biggest single buy: 1290/);
  assert.equal(reviewOf(b, '2026-08'), null, 'nothing spent: no review');
});
