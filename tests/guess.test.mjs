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

test('nothing logged: what most people log at the hour; income on its own day of the month', () => {
  assert.equal(G.guessWhat([]), null);
  const fresh = G.cluesFor(B.emptyBooks(), { day: '2026-10-29', at: at('2026-10-29', '12:10') });
  assert.deepEqual([G.guessWhat(fresh).cat, G.guessWhat(fresh).sub], ['food', 'food:lunch']);
  assert.equal(G.guessWhat(G.cluesFor(B.emptyBooks(), { day: '2026-10-29', at: at('2026-10-29', '07:20') })).sub, 'food:breakfast');
  const b = books();
  B.put(b, 'entries', { id: 's1', d: '2026-10-05', k: 'in', cat: 'salary', amt: 50000, a: 'bank', t: at('2026-10-05', '09:00') }, 0);
  B.put(b, 'entries', { id: 's2', d: '2026-09-05', k: 'in', cat: 'salary', amt: 50000, a: 'bank', t: at('2026-09-05', '09:00') }, 0);
  // Payday (the 5th): the pay, though most mornings are breakfast.
  const pay = G.cluesFor(b, { day: '2026-11-05', at: at('2026-11-05', '09:00') });
  assert.equal(G.guessWhat(pay).k, 'in');
  assert.equal(G.guessWhat(pay).cat, 'salary');
  // Any other morning: breakfast, and pay only when asked for income.
  const other = G.cluesFor(b, { day: '2026-10-29', at: at('2026-10-29', '09:00') });
  assert.equal(G.guessWhat(other).k, 'out');
  assert.equal(G.guessWhat(other, { k: 'in' }).cat, 'salary');
});

test('a catch-up goes through the day in its order', () => {
  const b = books();
  const add = (id, d, hm, cat, sub) => B.put(b, 'entries', { id, d, k: 'out', cat, sub, amt: 60, a: 'cash', via: '', t: at(d, hm) }, 0);
  // At night, nothing yet for the day, from a person who writes most days down at night: the day's first thing.
  for (const d of ['2026-10-05', '2026-10-06', '2026-10-07', '2026-10-08', '2026-10-09']) add(`n${d}`, d, '22:30', 'food', 'food:breakfast'), add(`m${d}`, d, '22:32', 'food', 'food:lunch');
  assert.equal(G.guessWhat(G.cluesFor(b, { day: '2026-10-29', at: at('2026-10-29', '22:30') })).sub, 'food:breakfast');
  // The morning after, for yesterday, lunch already in: what comes after lunch, not breakfast again.
  add('y1', '2026-10-28', '12:15', 'food', 'food:lunch');
  const g = G.guessWhat(G.cluesFor(b, { day: '2026-10-28', at: null }));
  assert.notEqual(g.sub, 'food:breakfast');
  assert.notEqual(g.sub, 'food:lunch');
});

test('guessNew: a first entry ever is the meal of the hour', () => {
  const g = G.guessNew(G.cluesFor(B.emptyBooks(), { day: '2026-10-29', at: at('2026-10-29', '18:40') }), { first: () => 'food' });
  assert.deepEqual([g.k, g.cat, g.sub], ['out', 'food', 'food:dinner']);
});

test('a first week: what most people log at the hour, told apart by the amount typed', () => {
  const g = (day, hm, amt = 0) => G.guessWhat(G.cluesFor(B.emptyBooks(), { day, at: at(day, hm), amt })).sub;
  // A Wednesday at 8: breakfast, unless it's a bus fare.
  assert.equal(g('2026-11-04', '08:00'), 'food:breakfast');
  assert.equal(g('2026-11-04', '08:00', 60), 'food:breakfast');
  assert.equal(g('2026-11-04', '08:00', 25), 'transport:ride');
  // NT$600 at noon is a meal out with others; NT$10,000 in the morning, the rent.
  assert.equal(g('2026-11-04', '12:20', 110), 'food:lunch');
  assert.equal(g('2026-11-04', '12:20', 600), 'food:out');
  assert.equal(g('2026-11-04', '10:00', 10000), 'home:rent');
  assert.equal(g('2026-11-04', '15:30'), 'food:drink');
});

test('what most people do gives way to the person\'s own within days: their noon is the gym', () => {
  const b = B.emptyBooks();
  const gym = d => B.put(b, 'entries', { id: `g${d}`, d, k: 'out', cat: 'fun', sub: 'fun:sport', amt: 150, a: 'cash', via: '', t: at(d, '12:10') }, at(d, '12:10'));
  const noon = () => G.guessWhat(G.cluesFor(b, { day: '2026-10-30', at: at('2026-10-30', '12:10') })).sub;
  gym('2026-10-26');
  assert.equal(noon(), 'food:lunch', 'once is no habit');
  for (const d of ['2026-10-27', '2026-10-28', '2026-10-29']) gym(d);
  assert.equal(noon(), 'fun:sport');
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
  // (One guessed the old way: not counted, the count is of the guesses made now.)
  B.put(b, 'entries', { id: 'd', d: '2026-10-29', k: 'out', cat: 'drink', amt: 55, a: 'cash', t: 4, g: 'food|food:lunch|cash||0' }, 0);
  assert.deepEqual(G.guessScore(b), { of: 2, what: 1, pay: 2, amt: 1 });
});

test('what was logged today counts: a second lunch is rare, and what usually comes next comes first', () => {
  const b = books();
  const add = (id, d, hm, cat, sub, amt, a) => B.put(b, 'entries', { id, d, k: 'out', cat, sub, amt, a, via: '', t: at(d, hm) }, 0);
  // Lunch already logged at 12:05: at 12:20 the guess isn't lunch again.
  add('l', '2026-10-29', '12:05', 'food', 'food:lunch', 120, 'linepay');
  const g = G.guessWhat(G.cluesFor(b, { day: '2026-10-29', at: at('2026-10-29', '12:40') }));
  assert.notEqual(g.sub, 'food:lunch');
  // A catch-up at night: breakfast just logged, so the next is what follows it (lunch), not the evening's movie.
  add('b', '2026-10-30', '22:00', 'food', 'food:breakfast', 60, 'cash');
  const next = G.guessWhat(G.cluesFor(b, { day: '2026-10-30', at: at('2026-10-30', '22:02') }));
  assert.equal(next.sub, 'food:lunch');
});

test('guessReplay guesses each entry again from what came before it', () => {
  const r = G.guessReplay(books());
  assert.ok(r.of > 10);
  assert.ok(r.what / r.of > 0.5, JSON.stringify(r));
  assert.ok(r.chips >= r.amt);
});

test('a transfer: the accounts the person usually moves between, and that pair’s usual amounts', () => {
  const b = B.emptyBooks();
  const mv = (id, d, a, to, amt, more = {}) => B.put(b, 'entries', { id, d, k: 'move', a, to, amt, t: at(d, '09:00'), ...more }, 0);
  mv('m1', '2026-10-01', 'bank', 'ez', 500);
  mv('m2', '2026-10-10', 'bank', 'ez', 500);
  mv('m3', '2026-10-20', 'bank', 'cash', 3000);
  mv('m4', '2026-10-21', 'bank', 'ez', 300);
  // (The card topping itself up isn't the person's own.)
  mv('m5', '2026-10-22', 'cc', 'ez', 500, { auto: 'reload' }), mv('m6', '2026-10-23', 'cc', 'ez', 500, { auto: 'reload' });
  const g = G.guessMove(b, { day: '2026-10-29' });
  assert.deepEqual([g[0].a, g[0].to], ['bank', 'ez']);
  assert.deepEqual(g[0].amts, [500]);
  assert.deepEqual([g[1].a, g[1].to, g[1].amts.length], ['bank', 'cash', 0]);
  assert.deepEqual(G.guessMove(B.emptyBooks(), { day: '2026-10-29' }), []);
});
