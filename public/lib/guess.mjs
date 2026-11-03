// 記一筆's guesses (Jay 2026-10-30: "a guess of everything"): what a new
// entry probably is, from the person's own entries (nothing of theirs made
// up): spend or income, the category and its sub, the way to pay, and the
// amounts it's likely to be. Each past entry is a clue, weighed by how much
// it looks like now: logged near this time of day, on the same kind of day
// (weekday or weekend), near here (when the person lets the app use where
// they are), lately, and once an amount is typed, how near its amount is.
// Until there's enough of their own (Jay 2026-11-03: "if we rely solely on
// user behavior they need to use like months"), what most people log at
// that hour, on that kind of day and for that amount (`COMMON`) comes in
// too, fading as their own entries grow. The amount is never filled in from
// a guess, only offered: a tap fills it. Pure, tested (tests/guess.test.mjs).
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
// What most people here log, for a new person's first guesses: how often
// (a week), the hours on a weekday and at the weekend (when a thing written
// down later probably happened too), and its usual amount with how far
// amounts stray from it (log-normal: 0.4 is about ×1.5 either way). Not
// anyone's books: a person's own entries soon outweigh it (`PRIOR`).
// [kind, sub (or the category, for one without subs), a week, weekday hours, weekend hours, amount, spread]
const C = (k, what, week, wd, we, amt, spread) => [what, { k, cat: what.split(':')[0], sub: what.includes(':') ? what : '', week, wd, we, amt, spread }];
export const COMMON = Object.fromEntries([
  C('out', 'food:breakfast', 5, [7.5], [9.5], 60, 0.4),
  C('out', 'food:lunch', 5.5, [12.4], [12.8], 110, 0.4),
  C('out', 'food:dinner', 5, [18.8], [18.8], 130, 0.5),
  C('out', 'food:drink', 4, [15.5, 10.5], [15], 55, 0.4),
  C('out', 'transport:ride', 4, [8.2, 18.2], [], 25, 0.5),
  C('out', 'transport:car', 0.5, [8, 18], [11, 17], 300, 0.7),
  C('out', 'transport:long', 0.15, [17], [10, 17], 700, 0.6),
  C('out', 'transport:tpass', 0.23, [9], [11], 1000, 0.35),
  C('out', 'shop:daily', 1.3, [19.5], [11, 16], 220, 0.9),
  C('out', 'shop:style', 0.25, [20], [15], 800, 0.7),
  C('out', 'shop:tech', 0.07, [20], [15], 2500, 1),
  C('out', 'fun:leisure', 0.35, [20], [15, 20], 350, 0.7),
  C('out', 'fun:sport', 0.15, [19], [10], 150, 0.8),
  C('out', 'home:rent', 0.23, [10], [11], 10000, 0.5),
  C('out', 'home:bills', 0.25, [20], [11], 800, 0.6),
  C('out', 'home:net', 0.23, [20], [11], 600, 0.5),
  C('out', 'digital:subs', 0.25, [21], [21], 300, 0.6),
  C('out', 'health:clinic', 0.15, [10, 15, 19], [10], 200, 0.6),
  C('out', 'health:meds', 0.15, [12, 19], [15], 200, 0.7),
  C('out', 'social:gift', 0.08, [20], [15], 800, 0.8),
  C('in', 'salary', 0.23, [10], [11], 40000, 0.5),
  C('in', 'allowance', 0.25, [20], [20], 1000, 0.8),
  C('in', 'side', 0.08, [20], [20], 3000, 1)
]);
// The hour most people have a meal, for one written down later (weekday's).
// (Meals only: their order through a day is everyone's; replayed, the rest's hours did worse.)
const USUAL = Object.fromEntries(Object.entries(COMMON).filter(([k]) => k.startsWith('food:')).map(([k, x]) => [k, x.wd[0]]));
// How much what most people do counts in all, before the person has any of
// their own (about a few entries' worth: their own soon outweigh it).
const PRIOR = 10;
const WEEK = Object.values(COMMON).reduce((n, x) => n + x.week, 0);
// How likely an amount is for a thing usually `amt`, `spread` apart (1 at it,
// never quite 0: people pay odd amounts).
const amtNear = (a, amt, spread) => (a > 0 && amt > 0 ? 0.01 + 0.99 * Math.exp(-(Math.log(a / amt) ** 2) / (2 * spread * spread)) : 1);
// One of the person's own: an amount this near theirs (the same, 1; double, about a tenth).
const OWN_SPREAD = 0.3;

// What an entry is, for counting habits: its kind, category and sub.
const what = e => `${e.k}|${e.cat}|${e.sub || ''}`;
// Logged this near another of the same day: written down together (an
// evening's catch-up), so the hour it was logged says little.
const TOGETHER = 10 * 60_000;
// Logged this soon after the last one: the same catch-up, so now's hour says little too.
const BATCH = 15 * 60_000;
// (After midnight still belongs to the evening before.)
const dayHour = h => (h < 4 ? h + 24 : h);

// How near an hour is to the one wanted: 2 there, falling to 0.25 far off
// (0.5 when the hour isn't known).
// `now`: the hour it's being logged (logged as it happens); `after`: the
// hour of the last thing written down for the day (a catch-up, in the day's
// order: the next is soon after it, rarely before); `night`: the share of
// the person's days written down at night (the first one logged late may be
// the day's first, not now's). `hs`: the hours it happens at (the bus both
// ways): the nearest counts.
function near(hs, { now = null, after = null, night = 0 }) {
  if (!hs?.length) return 0.5;
  const next = (h, from) => {
    const gap = dayHour(h) - dayHour(from);
    return gap < -0.5 ? 0.25 : 0.25 + 1.75 * Math.exp(-Math.max(gap, 0) / 4);
  };
  const one = h => {
    if (now == null) return after != null ? next(h, after) : 0.5;
    const gap = Math.abs(h - now);
    const dh = Math.min(gap, 24 - gap);
    const here = 0.25 + 1.75 * Math.exp(-(dh * dh) / 2.5);
    return night ? (1 - night) * here + night * next(h, 5) : here;
  };
  return Math.max(...hs.map(one));
}

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

// The share of the person's days whose first entry was written down at night
// or later (a little room both ways for the unseen).
function nightShare(timed, day) {
  const first = new Map();
  for (const e of timed) if (e.d < day && !first.has(e.d)) first.set(e.d, e.t);
  let n = 0;
  for (const [d, t] of first) if (twDay(t) !== d || hourOf(t) >= 20) n++;
  return (n + 0.5) / (first.size + 2);
}

// The clues: every spend and income the person logged in the last half year
// (not repeats, which come by themselves, nor automatic top-ups), each weighed
// by how much it looks like now: lately, the same kind of day, near here,
// and the hour. The hour is when it happened: when it was logged if it was
// logged then, else when the person usually does that (or most people do:
// breakfast in the morning). Logged as it happens, the hour wanted is now;
// in a catch-up (just after another, or for an earlier day) it's soon after
// the last one written down for the day, as people go through a day in its
// order; nothing written down yet for an earlier day, the day's start. Then
// what's been logged for the day already: a thing done counts as often as
// it usually comes twice, and what usually follows the last one counts more.
// With little history, what most people log at the hour comes in too, worth
// about one entry (`PRIOR`), so a first week isn't all one category.
export function cluesFor(books, { day, at = null, pl = '', amt = 0 }) {
  const from = addDays(day, -DAYS);
  const list = live(books.entries).filter(e => (e.k === 'out' || e.k === 'in') && e.cat && e.d >= from && e.d <= day && !e.auto && !String(e.id).startsWith('r-'));
  // (Logged together with another of its day: its hour says little.)
  const timed = list.filter(e => e.t).sort((x, y) => x.t - y.t);
  const together = new Set();
  for (let i = 1; i < timed.length; i++) if (timed[i].d === timed[i - 1].d && timed[i].t - timed[i - 1].t < TOGETHER) together.add(timed[i].id).add(timed[i - 1].id);
  // When each happened: logged as it happened, else when the person (or most people) usually does it.
  const asIt = e => e.t && !together.has(e.id) && twDay(e.t) === e.d && !String(e.id).startsWith('inv-');
  const hours = new Map();
  for (const e of list) if (asIt(e)) hours.set(what(e), [...(hours.get(what(e)) || []), hourOf(e.t)]);
  const usual = k => (hours.get(k)?.length >= 2 ? hours.get(k) : USUAL[k.split('|')[2]] ? [USUAL[k.split('|')[2]]] : null);
  const hourIs = e => (asIt(e) ? [hourOf(e.t)] : usual(what(e)));
  // What's been written down for the day already, in order (for an earlier day: all of it).
  const done = timed.filter(e => e.d === day && (at == null || e.t <= at));
  const last = done.at(-1);
  const catchUp = at == null || (last && at - last.t < BATCH);
  // (Late, nothing yet for the day: maybe the day's catch-up starting, as often as the person's days start late.)
  const late = !catchUp && !last && (hourOf(at) >= 20 || hourOf(at) < 4);
  // (Where a catch-up has got to: each one written down for the day at its
  // hour, or the first of its usual hours from where the day was.)
  let sofar = 5;
  for (const e of done) sofar = (hourIs(e) || []).filter(h => dayHour(h) >= dayHour(sofar) - 0.5).sort((x, y) => dayHour(x) - dayHour(y))[0] ?? sofar;
  const want = catchUp ? { after: sofar } : { now: hourOf(at), night: late ? nightShare(timed, day) : 0 };
  const habits = done.length ? habitsOf(list.filter(e => e.d < day)) : null;
  const doneSet = new Set(done.map(what));
  // Once a month on about this day (pay, rent, a bill): two months or more of it
  // within a day of today's date, and not much more often than that.
  const dom = d => Number(d.slice(8));
  const nearDom = d => Math.abs(dom(d) - dom(day)) <= 1;
  const months = new Map();
  const count = new Map();
  for (const e of list) {
    count.set(what(e), (count.get(what(e)) || 0) + 1);
    if (nearDom(e.d) && e.d.slice(0, 7) !== day.slice(0, 7)) months.set(what(e), new Set([...(months.get(what(e)) || []), e.d.slice(0, 7)]));
  }
  const monthly = new Set([...months].filter(([k, m]) => m.size >= 2 && count.get(k) <= m.size * 2).map(([k]) => k));
  const end = e => {
    let w = 0.5 ** (Math.max(0, (Date.parse(day) - Date.parse(e.d)) / 86_400_000) / 45);
    if (monthly.has(what(e)) && nearDom(e.d) && !doneSet.has(what(e))) w *= 10;
    w *= weekend(e.d) === weekend(day) ? 1.3 : 0.8;
    if (pl && e.pl) {
      const m = placeGap(pl, e.pl);
      w *= m <= 150 ? 3 : m <= 600 ? 1.6 : 0.6;
    }
    if (habits) {
      if (doneSet.has(what(e))) w *= habits.again(what(e));
      w *= 1 + 3 * habits.then(what(last), what(e));
    }
    return w;
  };
  // (An amount typed: the clues of about that amount count most.)
  const byAmt = e => (amt > 0 ? amtNear(amt, e.amt, OWN_SPREAD) : 1);
  const clues = list.map(e => ({ e, w: end(e) * near(hourIs(e), want) * byAmt(e) }));
  // What most people log: at this hour, on this kind of day, for this amount,
  // worth less the more the person has of their own.
  const fade = PRIOR / (1 + list.length / 8);
  const we = weekend(day);
  for (const [key, x] of Object.entries(COMMON)) {
    const e = { k: x.k, cat: x.cat, sub: x.sub, d: day, id: `usual:${key}` };
    if (doneSet.has(what(e))) continue;
    const hs = we ? x.we : x.wd;
    // (Not done on that kind of day at all, a weekend's commute: a trace.)
    const when = hs.length ? near(hs, want) : 0.1;
    clues.push({ e, w: fade * (x.week / WEEK) * when * (amt > 0 ? amtNear(amt, x.amt, x.spread) : 1), usual: true });
  }
  return clues;
}

const add = (m, key, w, extra = {}) => {
  const x = m.get(key) || { key, s: 0, n: 0, ...extra };
  x.s += w;
  x.n++;
  return m.set(key, x);
};
const best = m => [...m.values()].sort((x, y) => y.s - x.s || y.n - x.n);

// What it probably is: { k, cat, sub, s, of } (s its share of all clues), or
// null with nothing to go on. `k` keeps to one kind; else income only when
// its likeliest one clearly outweighs the likeliest spend (a payday), as most
// entries are spends.
export function guessWhat(clues, { k = '' } = {}) {
  const kinds = new Map();
  const whats = new Map();
  for (const { e, w } of clues) if (!k || e.k === k) add(kinds, e.k, w), add(whats, what(e), w, { k: e.k });
  if (!kinds.size) return null;
  const top = kk => best(new Map([...whats].filter(([, x]) => x.k === kk)))[0]?.s || 0;
  const out = top('out');
  const inn = top('in');
  const kind = k || (inn > out * 1.5 && inn >= 1 ? 'in' : out ? 'out' : 'in');
  const cats = new Map();
  for (const { e, w } of clues) if (e.k === kind) add(cats, e.cat, w);
  const lead = best(cats)[0];
  const all = kinds.get(kind)?.s || 0;
  return { k: kind, cat: lead.key, sub: guessSubIn(clues, kind, lead.key) || '', s: all ? lead.s / all : 0, of: lead.n };
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

// 記一筆 opened blank: what it starts on, { k, cat, sub, a, via }. The
// person's own set decides what can be offered: `shown(k, id)` (a hidden
// category isn't), `first(k)` the kind's first, `lastCat` the last one used
// per kind, `mealSub(cat, at)` the meal by the hour for a category with no
// history (lib/cats.mjs guessSub). The one guess 記一筆 and the replay share.
export function guessNew(clues, { at = null, lastCat = {}, shown = () => true, first = () => '', mealSub = () => '' } = {}) {
  const g = guessWhat(clues);
  const k = g && shown(g.k, g.cat) ? g.k : 'out';
  const c = guessWhat(clues, { k });
  const cat = (c && shown(k, c.cat) && c.cat) || (lastCat[k] && shown(k, lastCat[k]) && lastCat[k]) || first(k);
  const usual = guessSubIn(clues, k, cat);
  const sub = usual !== null ? usual : mealSub(cat, at) || '';
  const p = guessPay(clues, { k, cat, sub })[0];
  return { k, cat, sub, a: p?.a || '', via: p?.via || '' };
}

// What was guessed for an entry when it was opened, kept on it (`g`) to see how
// often the guesses are right: "cat|sub|a|via|amt|model". `MODEL` goes up when
// the way of guessing changes, so the count is of the guesses made now.
export const MODEL = '3';
export const guessStamp = ({ cat = '', sub = '', a = '', via = '', amt = 0 }) => `${cat}|${sub}|${a}|${via}|${amt || 0}|${MODEL}`;
// How the last `n` guessed entries went: { of, what, pay, amt } (each how many were right).
export function guessScore(books, n = 50) {
  const list = live(books.entries)
    .filter(e => typeof e.g === 'string' && e.g.split('|')[5] === MODEL && (e.k === 'out' || e.k === 'in'))
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
// logged by hand guessed again as 記一筆 would have guessed it opening blank
// (guessNew, `opts` as there), from only what was logged before it, at the
// hour and place it was logged, from the very first. { of, what, cat, pay,
// amt, chips } (how many right of `of`; chips: the amount among the four offered).
export function guessReplay(books, { last = 300, ...opts } = {}) {
  const all = live(books.entries).sort((x, y) => (x.t || 0) - (y.t || 0));
  const mine = all.filter(e => (e.k === 'out' || e.k === 'in') && e.cat && e.t && !e.auto && !String(e.id).startsWith('r-') && !String(e.id).startsWith('inv-'));
  const r = { of: 0, what: 0, cat: 0, pay: 0, amt: 0, chips: 0 };
  const lastCat = {};
  const from = Math.max(0, mine.length - last);
  for (let i = 0; i < mine.length; i++) {
    const e = mine[i];
    if (i >= from) {
      const before = {};
      for (const x of all) if (x.id !== e.id && (x.t || 0) < e.t) before[x.id] = x;
      const at = twDay(e.t) === e.d ? e.t : null;
      const clues = cluesFor({ entries: before }, { day: e.d, at, pl: e.pl || '' });
      const g = guessNew(clues, { ...opts, at, lastCat });
      r.of++;
      if (g.k === e.k && g.cat === e.cat) r.cat++;
      if (g.k === e.k && g.cat === e.cat && g.sub === (e.sub || '')) r.what++;
      if (g.a === e.a && g.via === (e.via || '')) r.pay++;
      const amts = guessAmts(clues, { k: e.k, cat: e.cat, sub: e.sub || '' });
      if (amts[0]?.amt === e.amt) r.amt++;
      if (amts.some(x => x.amt === e.amt)) r.chips++;
    }
    lastCat[e.k] = e.cat;
  }
  return r;
}

// A transfer's likely accounts, likeliest first: [{ a, to, s, amts }] from the
// person's own transfers of the last half year (not the automatic top-ups),
// by how recent; `amts` the amounts that pair has had twice or more,
// likeliest first (the 悠遊卡's usual NT$500).
export function guessMove(books, { day }) {
  const from = addDays(day, -DAYS);
  const pairs = new Map();
  for (const e of live(books.entries)) {
    if (e.k !== 'move' || e.auto || !e.a || !e.to || e.d < from || e.d > day) continue;
    const w = 0.5 ** (Math.max(0, (Date.parse(day) - Date.parse(e.d)) / 86_400_000) / 45);
    const x = add(pairs, `${e.a}>${e.to}`, w, { a: e.a, to: e.to, amts: new Map() }).get(`${e.a}>${e.to}`);
    add(x.amts, e.amt, w);
  }
  return best(pairs).map(({ a, to, s, amts }) => ({ a, to, s, amts: best(amts).filter(x => x.n >= 2).slice(0, 4).map(x => x.key) }));
}
