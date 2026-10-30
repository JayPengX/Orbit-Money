// 記一筆's guesses (Jay 2026-10-30: "a guess of everything"): what a new
// entry probably is, from the person's own entries only (nothing made up):
// spend or income, the category and its sub, the way to pay, and the amounts
// it's likely to be. Each past entry is a clue, weighed by how much it looks
// like now: logged near this time of day, on the same kind of day (weekday or
// weekend), near here (when the person lets the app use where they are), and
// lately. The amount is never filled in from a guess, only offered: a tap
// fills it. Pure, tested (tests/guess.test.mjs).
import { addDays, twDay } from '#kit/format.mjs';
import { live } from './books.mjs';

const H = 3_600_000;
// Taiwan's hour of a moment (0–24, minutes as a fraction), as the books' days are Taiwan's.
export const hourOf = t => (((t / H + 8) % 24) + 24) % 24;
const weekend = day => [0, 6].includes(new Date(`${day}T00:00:00Z`).getUTCDay());

// Where: "lat,lon" to 3 decimals (about 100 m), never finer; '' when unknown.
export const cellOf = (lat, lon) => (Number.isFinite(lat) && Number.isFinite(lon) ? `${lat.toFixed(3)},${lon.toFixed(3)}` : '');
// Metres between two places (Infinity when either is unknown).
export function placeGap(p, q) {
  const [a, b] = String(p || '').split(',').map(Number);
  const [c, d] = String(q || '').split(',').map(Number);
  if (![a, b, c, d].every(Number.isFinite) || !p || !q) return Infinity;
  const x = (d - b) * Math.cos(((a + c) / 2) * (Math.PI / 180));
  return Math.hypot(c - a, x) * 111_320;
}

const DAYS = 180;
// One past entry's weight for now. `at`: when the new one is being logged
// (ms; null for another day, when the hour says nothing), `day` its day, `pl` where.
function weigh(e, { day, at, pl }) {
  const age = Math.max(0, (Date.parse(day) - Date.parse(e.d)) / 86_400_000);
  let w = 0.5 ** (age / 45);
  // The hour: only an entry logged on its own day by hand says when it happened.
  const sameDay = e.t && twDay(e.t) === e.d && !String(e.id).startsWith('inv-');
  if (at != null && sameDay) {
    const gap = Math.abs(hourOf(e.t) - hourOf(at));
    const dh = Math.min(gap, 24 - gap);
    w *= 0.25 + 1.75 * Math.exp(-(dh * dh) / 4.5);
  } else w *= 0.5;
  w *= weekend(e.d) === weekend(day) ? 1.3 : 0.8;
  if (pl && e.pl) {
    const m = placeGap(pl, e.pl);
    w *= m <= 150 ? 3 : m <= 600 ? 1.6 : 0.6;
  }
  return w;
}

// What an entry is, for counting habits: its kind, category and sub.
const what = e => `${e.k}|${e.cat}|${e.sub || ''}`;
// Logged this near another of the same day: written down together (an
// evening's catch-up), so the hour it was logged says little.
const TOGETHER = 10 * 60_000;
// Logged this soon after the last one: the same catch-up, so now's hour says little too.
const BATCH = 15 * 60_000;

// The person's habits, from their own order of logging: how often a thing
// comes twice in one day (a second lunch is rare, a second drink isn't),
// and what tends to come next after each thing logged in the same sitting
// or later that day (breakfast, then the bus; lunch, then a drink).
export function habitsOf(list) {
  const byDay = new Map();
  for (const e of list) if (e.t) byDay.set(e.d, [...(byDay.get(e.d) || []), e]);
  const days = new Map();
  const twice = new Map();
  const next = new Map();
  const after = new Map();
  for (const es of byDay.values()) {
    es.sort((x, y) => x.t - y.t);
    const seen = new Map();
    for (const e of es) seen.set(what(e), (seen.get(what(e)) || 0) + 1);
    for (const [k, n] of seen) (days.set(k, (days.get(k) || 0) + 1), n > 1 && twice.set(k, (twice.get(k) || 0) + 1));
    for (let i = 1; i < es.length; i++) {
      const [a, b] = [what(es[i - 1]), what(es[i])];
      after.set(a, (after.get(a) || 0) + 1);
      next.set(`${a}>${b}`, (next.get(`${a}>${b}`) || 0) + 1);
    }
  }
  return {
    // The chance a thing comes again on a day it already came (a little room for the unseen).
    again: k => ((twice.get(k) || 0) + 0.2) / ((days.get(k) || 0) + 1),
    // The chance `b` is the next one logged after `a` that day.
    then: (a, b) => (next.get(`${a}>${b}`) || 0) / ((after.get(a) || 0) + 1)
  };
}

// The clues: every spend and income the person logged in the last half year
// (not repeats, which come by themselves, nor automatic top-ups), each weighed
// by how much it looks like now, then by what's been logged today already:
// a thing done today counts as often as it usually comes twice, and what
// usually follows the last thing logged counts more.
export function cluesFor(books, { day, at = null, pl = '' }) {
  const from = addDays(day, -DAYS);
  const list = live(books.entries).filter(e => (e.k === 'out' || e.k === 'in') && e.cat && e.d >= from && e.d <= day && !e.auto && !String(e.id).startsWith('r-'));
  // (Logged together with another of its day: its hour says little.)
  const timed = list.filter(e => e.t).sort((x, y) => x.t - y.t);
  const together = new Set();
  for (let i = 1; i < timed.length; i++) if (timed[i].d === timed[i - 1].d && timed[i].t - timed[i - 1].t < TOGETHER) together.add(timed[i].id).add(timed[i - 1].id);
  const done = at == null ? [] : timed.filter(e => e.d === day && e.t <= at);
  const last = done.at(-1);
  // (Just after another one: a catch-up, not something happening now.)
  const now = last && at - last.t < BATCH ? null : at;
  const habits = done.length ? habitsOf(list.filter(e => e.d < day)) : null;
  const doneSet = new Set(done.map(what));
  return list.map(e => {
    let w = weigh(e, { day, at: together.has(e.id) ? null : now, pl });
    if (habits) {
      if (doneSet.has(what(e))) w *= habits.again(what(e));
      w *= 1 + 3 * habits.then(what(last), what(e));
    }
    return { e, w };
  });
}

const add = (m, key, w, extra = {}) => {
  const x = m.get(key) || { key, s: 0, n: 0, ...extra };
  x.s += w;
  x.n++;
  return m.set(key, x);
};
const best = m => [...m.values()].sort((x, y) => y.s - x.s || y.n - x.n);

// What it probably is: { k, cat, sub, s, of } (s its share of all clues), or
// null with nothing to go on. `k` keeps to one kind; else income only when it
// clearly outweighs spending (a payday), as most entries are spends.
export function guessWhat(clues, { k = '' } = {}) {
  const kinds = new Map();
  for (const { e, w } of clues) if (!k || e.k === k) add(kinds, e.k, w);
  if (!kinds.size) return null;
  const out = kinds.get('out')?.s || 0;
  const inn = kinds.get('in')?.s || 0;
  const kind = k || (inn > out * 2 && inn >= 1 ? 'in' : out ? 'out' : 'in');
  const cats = new Map();
  for (const { e, w } of clues) if (e.k === kind) add(cats, e.cat, w);
  const top = best(cats)[0];
  const all = kinds.get(kind)?.s || 0;
  return { k: kind, cat: top.key, sub: guessSubIn(clues, kind, top.key) || '', s: all ? top.s / all : 0, of: top.n };
}

// A category's likely sub from its history ('' when it's usually left without
// one; null with no history, for the caller's own guess).
export function guessSubIn(clues, k, cat) {
  const subs = new Map();
  for (const { e, w } of clues) if (e.k === k && e.cat === cat) add(subs, e.sub || '', w);
  return best(subs)[0]?.key ?? null;
}

// Ways to pay for it, likeliest first: [{ a, via, s }]. Its own sub's history
// counts most, then its category's, then anything of the kind (a little), each
// as shares, so a category paid one way keeps it even when the hour's other
// spending is paid another, and a new category still gets how the person pays now.
export function guessPay(clues, { k, cat = '', sub = '' }) {
  const tiers = [
    [1, e => e.k === k && e.cat === cat && sub && e.sub === sub],
    [0.6, e => e.k === k && e.cat === cat],
    [0.15, e => e.k === k]
  ];
  const pays = new Map();
  for (const [f, fits] of tiers) {
    const list = clues.filter(({ e }) => e.a && fits(e));
    const all = list.reduce((n, x) => n + x.w, 0);
    for (const { e, w } of list) add(pays, `${e.a}|${e.via || ''}`, (f * w) / all, { a: e.a, via: e.via || '' });
  }
  return best(pays).map(({ a, via, s }) => ({ a, via, s }));
}

// The amounts it's likely to be, likeliest first: [{ amt, n, s }], `max` of
// them: one seen twice or more, and the very likeliest even if seen once.
export function guessAmts(clues, { k, cat, sub = '' }, { max = 4 } = {}) {
  const amts = new Map();
  for (const { e, w } of clues) if (e.k === k && e.cat === cat && (!sub || e.sub === sub) && e.amt > 0) add(amts, e.amt, w);
  return best(amts)
    .filter((x, i) => i === 0 || x.n >= 2)
    .slice(0, max)
    .map(({ key, n, s }) => ({ amt: key, n, s }));
}

// What was guessed for an entry when it was opened, kept on it (`g`) to see how
// often the guesses are right: "cat|sub|a|via|amt".
export const guessStamp = ({ cat = '', sub = '', a = '', via = '', amt = 0 }) => `${cat}|${sub}|${a}|${via}|${amt || 0}`;
// How the last `n` guessed entries went: { of, what, pay, amt } (each how many were right).
export function guessScore(books, n = 50) {
  const list = live(books.entries)
    .filter(e => typeof e.g === 'string' && (e.k === 'out' || e.k === 'in'))
    .sort((x, y) => (y.t || 0) - (x.t || 0))
    .slice(0, n);
  const r = { of: list.length, what: 0, pay: 0, amt: 0 };
  for (const e of list) {
    const [cat, sub, a, via, amt] = e.g.split('|');
    if (cat === e.cat && sub === (e.sub || '')) r.what++;
    if (a === e.a && via === (e.via || '')) r.pay++;
    if (Number(amt) === e.amt) r.amt++;
  }
  return r;
}

// How the guesses would have done on the person's own books: each entry
// logged by hand guessed again from only what was logged before it, at the
// hour and place it was logged. { of, what, cat, pay, amt, chips } (how many
// right of `of`; chips: the amount among the four offered). `skip`: the
// first entries, too few to guess from.
export function guessReplay(books, { skip = 20, last = 300 } = {}) {
  const mine = live(books.entries)
    .filter(e => (e.k === 'out' || e.k === 'in') && e.cat && e.t && !e.auto && !String(e.id).startsWith('r-') && !String(e.id).startsWith('inv-'))
    .sort((x, y) => x.t - y.t);
  const r = { of: 0, what: 0, cat: 0, pay: 0, amt: 0, chips: 0 };
  const from = Math.max(skip, mine.length - last);
  for (let i = from; i < mine.length; i++) {
    const e = mine[i];
    const before = {};
    for (const x of live(books.entries)) if (x.id !== e.id && (x.t || 0) < e.t) before[x.id] = x;
    const clues = cluesFor({ entries: before }, { day: e.d, at: twDay(e.t) === e.d ? e.t : null, pl: e.pl || '' });
    const g = guessWhat(clues);
    if (!g) continue;
    r.of++;
    if (g.cat === e.cat) r.cat++;
    if (g.k === e.k && g.cat === e.cat && g.sub === (e.sub || '')) r.what++;
    const p = guessPay(clues, { k: g.k, cat: g.cat, sub: g.sub })[0];
    if (p && p.a === e.a && p.via === (e.via || '')) r.pay++;
    const amts = guessAmts(clues, { k: e.k, cat: e.cat, sub: e.sub || '' });
    if (amts[0]?.amt === e.amt) r.amt++;
    if (amts.some(x => x.amt === e.amt)) r.chips++;
  }
  return r;
}
