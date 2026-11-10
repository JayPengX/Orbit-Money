// 問我的帳's facts (lib/ask.mjs): the phone adds up the books; every number
// the AI may say is here, once, lean.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as B from '../public/lib/books.mjs';
import * as C from '../public/lib/cats.mjs';
import { booksFacts } from '../public/lib/ask.mjs';

test('the facts: this month by category and meal, the places, last month to the same day, the week', () => {
  C.useCats({});
  const b = B.emptyBooks();
  const T = Date.UTC(2026, 10, 1);
  const e = (id, d, amt, more = {}) => B.put(b, 'entries', { id, d, k: 'out', amt, cat: 'food', sub: 'food:lunch', a: 'cash', via: '', note: '', ...more }, T);
  e('a', '2026-11-03', 120, { note: '全家' });
  e('b', '2026-11-04', 95, { note: '全家' });
  e('c', '2026-11-09', 1290, { cat: 'digital', sub: 'digital:games', note: 'Steam' });
  e('d', '2026-10-05', 300, { sub: 'food:dinner' });
  e('i', '2026-11-01', 2000, { k: 'in', cat: 'allowance', sub: '' });
  B.put(b, 'budgets', { id: 'all', cat: '', amt: 5000 }, T);
  const f = booksFacts(b, '2026-11-10');
  assert.match(f, /2026-11 \(to 2026-11-10\): spent 1505, income 2000/);
  assert.match(f, /餐飲 215 \(午餐 215\)/);
  assert.match(f, /全家 215 \(2 times\)/);
  assert.match(f, /Last month to the same day \(2026-10-10\): spent 300/);
  assert.match(f, /This week \(from 2026-11-09\): spent 1290; last week: 215/);
  assert.match(f, /left this month 3495/);
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
  assert.equal(reviewOf(b, '2026-08'), null, 'nothing spent: no review');
});
