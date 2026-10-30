// 統計's numbers (lib/stats.mjs): categories with their subs, accounts with
// their ways to pay, fixed against the rest, places, weekdays, months, pace.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as B from '../public/lib/books.mjs';
import * as S from '../public/lib/stats.mjs';
import * as C from '../public/lib/cats.mjs';

const T = Date.UTC(2026, 10, 1);
const parent = id => C.subOf(id)?.parent || '';
function books() {
  C.useCats({});
  const b = B.emptyBooks();
  const e = (id, d, amt, more = {}) => B.put(b, 'entries', { id, d, k: 'out', amt, cat: 'digital', sub: '', a: 'card', via: '', ...more }, T);
  e('g', '2026-11-02', 1290, { sub: 'digital:games', note: 'Steam' });
  e('c', '2026-11-03', 155, { sub: 'digital:cloud', note: 'Cloudflare', fee: 5 });
  e('n', '2026-11-03', 100, { note: 'misc' });
  e('l', '2026-11-04', 300, { cat: 'food', sub: 'food:lunch', a: 'pay', also: [{ a: 'pts', amt: 50 }], note: '全家' });
  e('l2', '2026-11-05', 200, { cat: 'food', sub: 'food:lunch', a: 'cash', via: '', note: '全家 ' });
  e('r-rent-2026-11-01', '2026-11-01', 8000, { cat: 'home', sub: 'home:rent', a: 'bank', via: 'deb' });
  B.put(b, 'entries', { id: 'back', d: '2026-11-06', k: 'back', why: 'friend', of: 'l', amt: 100, a: 'cash' }, T);
  B.put(b, 'entries', { id: 'sal', d: '2026-11-05', k: 'in', amt: 30000, cat: 'salary', a: 'bank' }, T);
  B.put(b, 'entries', { id: 'old', d: '2026-10-10', k: 'out', amt: 500, cat: 'food', sub: 'food:lunch', a: 'cash' }, T);
  return b;
}
const NOV = ['2026-11-01', '2026-11-30'];

test('categories carry their subs, each its own amount; 數位 games and tools apart', () => {
  const cats = S.byCat(books(), 'out', ...NOV, parent);
  const dig = cats.find(c => c.cat === 'digital');
  assert.equal(dig.amt, 1290 + 155 + 100);
  assert.deepEqual(dig.subs, [{ sub: 'digital:games', amt: 1290 }, { sub: 'digital:cloud', amt: 155 }, { sub: '', amt: 100 }]);
  // (A friend's share comes off the lunch; the fee is 稅費's.)
  assert.equal(cats.find(c => c.cat === 'food').amt, 400);
  assert.equal(cats.find(c => c.cat === 'tax').amt, 5);
  assert.equal(cats[0].cat, 'home');
  // (Income is its own view, never in the spending.)
  assert.ok(!cats.some(c => c.cat === 'salary'));
  assert.equal(S.byCat(books(), 'in', ...NOV, parent)[0].amt, 30000);
});

test('accounts: points pay their part, a way to pay is kept apart, money back off the main part', () => {
  const list = S.byAccount(books(), 'out', ...NOV);
  const of = a => list.find(x => x.a === a)?.amt || 0;
  assert.equal(of('pts'), 50);
  assert.equal(of('pay'), 150);
  assert.equal(of('card'), 1290 + 155 + 5 + 100);
  assert.deepEqual(list.find(x => x.a === 'bank').ways, [{ via: 'deb', amt: 8000 }]);
  assert.equal(list.reduce((n, x) => n + x.amt, 0), S.total(books(), 'out', ...NOV));
});

test('the shape: fixed (a repeat), day to day, fees, money back', () => {
  const s = S.shape(books(), ...NOV);
  assert.equal(s.fixed, 8000);
  assert.equal(s.fees, 5);
  assert.equal(s.back, 100);
  assert.equal(s.fixed + s.variable + s.fees, s.total);
});

test('不計入: categories left out are left out of every figure, money back with them', () => {
  const b = { ...books(), skip: new Set(['home', 'food']) };
  assert.equal(S.total(b, 'out', ...NOV), 1290 + 155 + 100 + 5);
  assert.deepEqual(S.byCat(b, 'out', ...NOV, parent).map(c => c.cat), ['digital', 'tax']);
  const s = S.shape(b, ...NOV);
  assert.equal(s.fixed, 0);
  assert.equal(s.back, 0);
  assert.equal(S.byAccount(b, 'out', ...NOV).reduce((n, x) => n + x.amt, 0), S.total(b, 'out', ...NOV));
  // (Income keeps its own; the books themselves are untouched.)
  assert.equal(S.total(b, 'in', ...NOV), 30000);
  assert.equal(S.total(books(), 'out', ...NOV), 8000 + 400 + 1290 + 155 + 100 + 5);
});

test('不計入 down to a sub: one sub, or the entries with none, and shares count the rest', () => {
  const b = { ...books(), skip: new Set(['digital:games', 'digital/-']) };
  const dig = S.byCat(b, 'out', ...NOV, parent).find(c => c.cat === 'digital');
  assert.deepEqual(dig.subs, [{ sub: 'digital:cloud', amt: 155 }]);
  assert.equal(S.total(b, 'out', ...NOV), 8000 + 400 + 155 + 5);
  // (A friend's share goes with its lunch when lunch is off.)
  assert.equal(S.shape({ ...books(), skip: new Set(['food:lunch']) }, ...NOV).back, 0);
});

test('changes against the period before, largest first, new ones too', () => {
  const ch = S.changes(books(), 'out', { from: NOV[0], to: NOV[1] }, { from: '2026-10-01', to: '2026-10-31' });
  assert.equal(ch[0].cat, 'home');
  const food = ch.find(x => x.cat === 'food');
  assert.deepEqual([food.before, food.amt, food.diff], [500, 400, -100]);
});

test('places: a store seen twice, spelled a little differently, is one', () => {
  const p = S.places(books(), 'out', ...NOV);
  assert.equal(p.length, 1);
  assert.equal(p[0].n, 2);
  assert.equal(p[0].amt, 400);
});

test('largest, weekdays, months, pace, the share kept', () => {
  const b = books();
  assert.deepEqual(S.largest(b, 'out', ...NOV, 2).map(l => l.e.id), ['r-rent-2026-11-01', 'g']);
  const wd = S.weekdays(b, '2026-11-01', '2026-11-07', '2026-11-30');
  assert.equal(wd[6].amt, 8000); // 11-01 is a Sunday
  assert.equal(wd[6].avg, 8000);
  const m = S.months(b, '2026-11', 2);
  assert.deepEqual(m.map(x => x.ym), ['2026-10', '2026-11']);
  assert.equal(m[0].out, 500);
  assert.equal(m[1].in, 30000);
  assert.equal(S.months(b, '2026-11', 2, { cat: 'food', sub: 'food:lunch', kind: 'out' })[1].out, 400);
  // (Rent once, the rest at its pace over 30 days.)
  const day = S.total(b, 'out', '2026-11-01', '2026-11-10') - 8000;
  assert.equal(S.pace(b, '2026-11', '2026-11-10'), Math.round(8000 + (day / 10) * 30));
  assert.equal(S.pace(b, '2026-11', '2026-11-02'), null);
  assert.equal(S.pace(b, '2026-10', '2026-11-10'), null);
  assert.equal(S.kept(1000, 250), 0.75);
  assert.equal(S.kept(0, 250), null);
  assert.equal(S.firstDay(b), '2026-10-10');
});

test('數位: 訂閱 is 影音串流 now, storage moved to 雲端・網域, unsorted ones sorted, once', () => {
  C.useCats({});
  const b = B.emptyBooks();
  B.put(b, 'entries', { id: 'i', d: '2026-11-01', k: 'out', amt: 30, cat: 'digital', sub: 'digital:subs', note: 'iCloud+' }, T);
  B.put(b, 'entries', { id: 'n', d: '2026-11-01', k: 'out', amt: 390, cat: 'digital', sub: 'digital:subs', note: 'Netflix' }, T);
  B.put(b, 'entries', { id: 's', d: '2026-11-01', k: 'out', amt: 990, cat: 'digital', sub: '', note: 'Steam 夏季特賣' }, T);
  B.put(b, 'entries', { id: 'x', d: '2026-11-01', k: 'out', amt: 99, cat: 'digital', sub: '', note: '' }, T);
  assert.ok(C.upgradeCats(b, T + 1) >= 3);
  assert.equal(b.entries.i.sub, 'digital:cloud');
  assert.equal(b.entries.n.sub, 'digital:subs');
  assert.equal(b.entries.s.sub, 'digital:games');
  assert.equal(b.entries.x.sub, '');
  assert.equal(C.subOf('digital:subs').zh, '影音串流');
  assert.deepEqual(C.subsOf('digital').map(s => s.id), ['digital:ai', 'digital:cloud', 'digital:apps', 'digital:subs', 'digital:games']);
  // (Once: a choice made after stands.)
  B.put(b, 'entries', { ...b.entries.i, sub: 'digital:subs' }, T + 2);
  assert.equal(C.upgradeCats(b, T + 3), 0);
  assert.equal(b.entries.i.sub, 'digital:subs');
});
