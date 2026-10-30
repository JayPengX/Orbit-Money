// 記一筆's guesses (lib/guess.mjs): from the person's own entries most like now.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as B from '../public/lib/books.mjs';
import * as G from '../public/lib/guess.mjs';

// A Taiwan time on a day, as ms.
const at = (d, hm) => Date.parse(`${d}T${hm}:00+08:00`);
const HOME = '24.804,120.968';
const OFFICE = '24.786,121.017';
function books() {
  const b = B.emptyBooks();
  let n = 0;
  const add = (d, hm, cat, sub, amt, a, more = {}) => B.put(b, 'entries', { id: `e${n++}`, d, k: 'out', cat, sub, amt, a, via: '', t: at(d, hm), ...more }, at(d, hm));
  // Weekday mornings: breakfast NT$60 in cash near home; lunch NT$120 on LINE Pay at the office.
  for (const d of ['2026-10-19', '2026-10-20', '2026-10-21', '2026-10-22', '2026-10-23', '2026-10-26', '2026-10-27']) {
    add(d, '07:40', 'food', 'food:breakfast', 60, 'cash', { pl: HOME });
    add(d, '12:15', 'food', 'food:lunch', 120, 'linepay', { pl: OFFICE });
  }
  // Afternoons at the office: bubble tea on LINE Pay.
  for (const d of ['2026-10-20', '2026-10-22', '2026-10-27']) add(d, '15:30', 'drink', 'drink:tea', 55, 'linepay', { pl: OFFICE });
  // Weekend evenings: a movie by credit card.
  for (const d of ['2026-10-18', '2026-10-25']) add(d, '19:00', 'fun', 'fun:movie', 320, 'cc');
  // Once, YouBike near home at 07:50 (the place says it's not breakfast-only there).
  add('2026-10-28', '07:50', 'transport', 'transport:youbike', 10, 'ez', { pl: '24.810,120.990' });
  // Imported and repeated ones say nothing about the hour.
  B.put(b, 'entries', { id: 'inv-AA1', d: '2026-10-27', k: 'out', cat: 'daily', amt: 400, a: 'cc', t: at('2026-10-29', '07:45') }, 0);
  B.put(b, 'entries', { id: 'r-rent-2026-10-01', d: '2026-10-01', k: 'out', cat: 'home', amt: 9000, a: 'bank', t: at('2026-10-01', '07:45') }, 0);
  return b;
}

test('the hour picks the category, its sub and the way to pay', () => {
  const b = books();
  const morning = G.cluesFor(b, { day: '2026-10-29', at: at('2026-10-29', '07:35') });
  const g = G.guessWhat(morning);
  assert.equal(g.k, 'out');
  assert.equal(g.cat, 'food');
  assert.equal(g.sub, 'food:breakfast');
  assert.deepEqual(G.guessPay(morning, g)[0], { a: 'cash', via: '', s: G.guessPay(morning, g)[0].s });
  assert.equal(G.guessAmts(morning, g)[0].amt, 60);

  const noon = G.cluesFor(b, { day: '2026-10-29', at: at('2026-10-29', '12:05') });
  const n = G.guessWhat(noon);
  assert.equal(n.sub, 'food:lunch');
  assert.equal(G.guessPay(noon, n)[0].a, 'linepay');

  const tea = G.cluesFor(b, { day: '2026-10-29', at: at('2026-10-29', '15:20') });
  assert.equal(G.guessWhat(tea).cat, 'drink');
});

test('the kind of day counts: a weekend evening is the movie, a weekday one is not', () => {
  const b = books();
  const sat = G.cluesFor(b, { day: '2026-11-01', at: at('2026-11-01', '19:10') });
  assert.equal(G.guessWhat(sat).cat, 'fun');
  assert.equal(G.guessPay(sat, { k: 'out', cat: 'fun' })[0].a, 'cc');
});

test('where the phone is outweighs the hour alone', () => {
  const b = books();
  // 07:45, but standing where the YouBike was taken.
  const bike = G.cluesFor(b, { day: '2026-10-30', at: at('2026-10-30', '07:45'), pl: '24.8105,120.9905' });
  assert.equal(G.guessWhat(bike).cat, 'food', 'one ride does not beat a week of breakfasts');
  B.put(b, 'entries', { id: 'yb2', d: '2026-10-29', k: 'out', cat: 'transport', sub: 'transport:youbike', amt: 10, a: 'ez', t: at('2026-10-29', '07:52'), pl: '24.810,120.990' }, 0);
  const again = G.cluesFor(b, { day: '2026-10-30', at: at('2026-10-30', '07:45'), pl: '24.810,120.990' });
  const g = G.guessWhat(again);
  assert.equal(g.cat, 'transport');
  assert.equal(g.sub, 'transport:youbike');
  assert.equal(G.guessPay(again, g)[0].a, 'ez');
});

test('a category picked by hand gets its own likeliest sub, way to pay and amounts', () => {
  const b = books();
  const c = G.cluesFor(b, { day: '2026-10-29', at: at('2026-10-29', '07:35') });
  assert.equal(G.guessSubIn(c, 'out', 'drink'), 'drink:tea');
  assert.equal(G.guessSubIn(c, 'out', 'pet'), null);
  assert.equal(G.guessPay(c, { k: 'out', cat: 'drink' })[0].a, 'linepay');
  // A category never used: the way the person pays at this hour.
  assert.equal(G.guessPay(c, { k: 'out', cat: 'pet' })[0].a, 'cash');
  assert.deepEqual(G.guessAmts(c, { k: 'out', cat: 'food' }).map(x => x.amt), [60, 120]);
});

test('repeats, automatic top-ups and old entries are no clues; imports carry no hour', () => {
  const b = books();
  B.put(b, 'entries', { id: 'old', d: '2026-01-01', k: 'out', cat: 'pet', amt: 5, a: 'cash', t: at('2026-01-01', '07:40') }, 0);
  B.put(b, 'entries', { id: 'auto', d: '2026-10-28', k: 'in', cat: 'topup', amt: 500, a: 'ez', auto: 'reload', t: at('2026-10-28', '07:40') }, 0);
  const c = G.cluesFor(b, { day: '2026-10-29', at: at('2026-10-29', '07:40') });
  const ids = c.map(x => x.e.id);
  assert.ok(!ids.includes('old') && !ids.includes('auto') && !ids.includes('r-rent-2026-10-01'));
  const inv = c.find(x => x.e.id === 'inv-AA1');
  const bf = c.find(x => x.e.id === 'e12');
  assert.ok(inv.w < bf.w);
});

test('nothing logged: no guess; income only when it clearly outweighs spending', () => {
  assert.equal(G.guessWhat([]), null);
  const b = B.emptyBooks();
  B.put(b, 'entries', { id: 's1', d: '2026-10-05', k: 'in', cat: 'salary', amt: 50000, a: 'bank', t: at('2026-10-05', '09:00') }, 0);
  B.put(b, 'entries', { id: 's2', d: '2026-09-05', k: 'in', cat: 'salary', amt: 50000, a: 'bank', t: at('2026-09-05', '09:00') }, 0);
  const c = G.cluesFor(b, { day: '2026-10-29', at: at('2026-10-29', '09:00') });
  assert.equal(G.guessWhat(c).k, 'in');
  assert.equal(G.guessWhat(c, { k: 'out' }), null);
});

test('places: kept to about 100 m, and how far apart', () => {
  assert.equal(G.cellOf(24.80437, 120.96812), '24.804,120.968');
  assert.equal(G.cellOf(NaN, 1), '');
  assert.ok(Math.abs(G.placeGap('25.000,121.000', '25.001,121.000') - 111) < 2);
  assert.equal(G.placeGap('', HOME), Infinity);
  assert.ok(G.placeGap(HOME, OFFICE) > 4000);
});

test('how often the guesses were right', () => {
  const b = B.emptyBooks();
  B.put(b, 'entries', { id: 'a', d: '2026-10-29', k: 'out', cat: 'food', sub: 'food:lunch', amt: 120, a: 'cash', via: '', t: 3, g: G.guessStamp({ cat: 'food', sub: 'food:lunch', a: 'cash', amt: 120 }) }, 0);
  B.put(b, 'entries', { id: 'b', d: '2026-10-29', k: 'out', cat: 'drink', sub: '', amt: 55, a: 'cash', via: '', t: 2, g: G.guessStamp({ cat: 'food', sub: 'food:snack', a: 'cash', amt: 60 }) }, 0);
  B.put(b, 'entries', { id: 'c', d: '2026-10-29', k: 'out', cat: 'drink', amt: 55, a: 'cash', t: 1 }, 0);
  assert.deepEqual(G.guessScore(b), { of: 2, what: 1, pay: 2, amt: 1 });
});
