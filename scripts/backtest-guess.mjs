// How often 記一筆's first guess is right (lib/guess.mjs guessNew), measured
// the way 更多 › 智慧帶入 counts it on a phone: every entry guessed as the
// sheet opened (from only what was logged before it, at the hour it was
// logged), category and sub both right. Made-up people with made-up habits
// (never anyone's real books), from their very first entry, because the
// first weeks are where a new person judges it.
//
//   TZ=Asia/Taipei node scripts/backtest-guess.mjs                 # this tree
//   TZ=Asia/Taipei node scripts/backtest-guess.mjs --against HEAD  # that commit's guess.mjs too
//   … --why                                                        # the commonest misses
//   … --typed                                                      # once the amount is typed
import { execFileSync } from 'node:child_process';
import { writeFileSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { emptyBooks, put, live } from '../public/lib/books.mjs';
import { guessSub, useCats } from '../public/lib/cats.mjs';

useCats({});
const DAY = 86_400_000;
const at = (d, h) => Date.parse(`${d}T00:00:00+08:00`) + h * 3_600_000;
const addDays = (d, n) => new Date(Date.parse(`${d}T00:00:00Z`) + n * DAY).toISOString().slice(0, 10);
const weekend = d => [0, 6].includes(new Date(`${d}T00:00:00Z`).getUTCDay());

// A seeded random (the same people every run).
function rng(seed) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32);
}

// A habit: [chance, from hour, to hour, cat, sub, amounts, pay, kind].
const H = (p, h0, h1, cat, sub, amts, a, k = 'out') => ({ p, h0, h1, cat, sub, amts, a, k });
const PEOPLE = {
  // A high-school student in 新竹: breakfast shop, the bus or YouBike, lunch, a drink after school, dinner.
  student: {
    live: 0.6, night: 0.3,
    weekday: [H(0.85, 6.6, 7.4, 'food', 'food:breakfast', [45, 55, 60, 70], 'cash'), H(0.5, 7.0, 7.4, 'transport', 'transport:ride', [15], 'ez'), H(0.7, 12.0, 12.6, 'food', 'food:lunch', [80, 95, 110], 'cash'), H(0.45, 15.5, 17.5, 'food', 'food:drink', [50, 60, 75], 'linepay'), H(0.5, 17.0, 17.6, 'transport', 'transport:ride', [15, 10], 'ez'), H(0.5, 18.0, 19.5, 'food', 'food:dinner', [90, 120, 150], 'cash'), H(0.1, 19.5, 22, 'shop', 'shop:daily', [39, 89, 129], 'linepay'), H(0.06, 20, 23, 'digital', 'digital:games', [150, 300], 'cc'), H(0.05, 16, 19, 'learn', 'learn:books', [280, 350], 'cash')],
    weekendDay: [H(0.6, 9.5, 11, 'food', 'food:breakfast', [70, 90], 'cash'), H(0.5, 12, 13.5, 'food', 'food:lunch', [120, 160], 'cash'), H(0.5, 14, 17, 'food', 'food:drink', [55, 75], 'linepay'), H(0.3, 13, 18, 'fun', 'fun:leisure', [200, 350], 'linepay'), H(0.2, 14, 18, 'shop', 'shop:style', [390, 590], 'linepay'), H(0.3, 18, 20, 'food', 'food:out', [250, 400], 'cash'), H(0.4, 13, 19, 'transport', 'transport:ride', [15, 20], 'ez')],
    monthly: [[1, 9.0, 'transport', 'transport:tpass', 799, 'bank']],
    weekly: [[0, 20.0, 'allowance', '', 1500, 'cash', 'in']]
  },
  // An office worker in 台北: MRT both ways, coffee, lunch on LINE Pay, groceries on the card at the weekend.
  office: {
    live: 0.8, night: 0.2,
    weekday: [H(0.6, 7.8, 8.4, 'food', 'food:breakfast', [65, 85], 'linepay'), H(0.9, 8.2, 8.6, 'transport', 'transport:ride', [25, 30], 'ez'), H(0.6, 9.5, 10.5, 'food', 'food:drink', [55, 65], 'linepay'), H(0.95, 12.0, 12.8, 'food', 'food:lunch', [120, 150, 180], 'linepay'), H(0.9, 18.3, 19.0, 'transport', 'transport:ride', [25, 30], 'ez'), H(0.7, 19.0, 20.5, 'food', 'food:dinner', [100, 160], 'cash'), H(0.12, 20, 23, 'shop', 'shop:daily', [199, 399], 'cc')],
    weekendDay: [H(0.6, 10, 12, 'shop', 'shop:daily', [600, 900, 1200], 'cc'), H(0.6, 12, 14, 'food', 'food:lunch', [180, 250], 'cc'), H(0.4, 14, 20, 'fun', 'fun:leisure', [300, 600], 'cc'), H(0.4, 18, 20.5, 'food', 'food:out', [500, 800], 'cc'), H(0.3, 15, 17, 'food', 'food:drink', [60, 80], 'linepay')],
    monthly: [[5, 10.0, 'salary', '', 52000, 'bank', 'in'], [10, 21.0, 'home', 'home:bills', 800, 'bank'], [15, 21.0, 'digital', 'digital:subs', 390, 'cc']],
    weekly: []
  },
  // A nurse on night shifts in 台中: meals at odd hours, a taxi home, the convenience store, a scooter.
  nurse: {
    live: 0.7, night: 0.1,
    weekday: [H(0.7, 17.5, 18.5, 'food', 'food:breakfast', [70, 90], 'cash'), H(0.6, 18.5, 19.2, 'transport', 'transport:car', [100, 150], 'cash'), H(0.75, 0.5, 1.5, 'food', 'food:lunch', [100, 130], 'linepay'), H(0.6, 3, 4.5, 'food', 'food:drink', [45, 65], 'linepay'), H(0.5, 7.5, 8.5, 'food', 'food:dinner', [90, 140], 'cash'), H(0.35, 8, 9, 'shop', 'shop:daily', [89, 159, 239], 'linepay')],
    weekendDay: [H(0.6, 11, 13, 'food', 'food:lunch', [150, 220], 'cc'), H(0.3, 14, 18, 'shop', 'shop:style', [690, 990], 'cc'), H(0.5, 18, 20, 'food', 'food:dinner', [200, 350], 'cc'), H(0.3, 10, 17, 'health', 'health:meds', [180, 260], 'cash')],
    monthly: [[25, 9.5, 'salary', '', 48000, 'bank', 'in'], [5, 20.0, 'home', 'home:rent', 9500, 'bank']],
    weekly: []
  },
  // A parent in 高雄: groceries most days, the kids' things, the car, nothing on a bus.
  parent: {
    live: 0.5, night: 0.4,
    weekday: [H(0.5, 7.0, 7.6, 'food', 'food:breakfast', [120, 160, 200], 'cash'), H(0.7, 9.5, 11, 'shop', 'shop:daily', [180, 350, 520], 'cc'), H(0.5, 12, 13, 'food', 'food:lunch', [90, 120], 'cash'), H(0.4, 16, 17.5, 'family', 'family:kids', [150, 300, 600], 'cc'), H(0.3, 17, 18, 'transport', 'transport:car', [600, 900], 'cc'), H(0.5, 18, 19.5, 'food', 'food:dinner', [250, 400], 'cash')],
    weekendDay: [H(0.6, 10, 12, 'shop', 'shop:daily', [1200, 1800, 2500], 'cc'), H(0.5, 12, 14, 'food', 'food:out', [800, 1200], 'cc'), H(0.4, 14, 18, 'fun', 'fun:leisure', [300, 600], 'cc'), H(0.3, 15, 17, 'family', 'family:kids', [300, 500], 'cc')],
    monthly: [[10, 21.0, 'home', 'home:bills', 1600, 'bank'], [10, 21.1, 'home', 'home:net', 999, 'cc'], [5, 10.0, 'salary', '', 56000, 'bank', 'in']],
    weekly: []
  },
  // The student's habits, written down mostly at night or the next morning.
  'night logger': {
    live: 0.2, night: 0.7,
    get weekday() { return PEOPLE.student.weekday; },
    get weekendDay() { return PEOPLE.student.weekendDay; },
    monthly: [[1, 9.0, 'transport', 'transport:tpass', 799, 'bank']],
    weekly: [[0, 20.0, 'allowance', '', 1500, 'cash', 'in']]
  }
};

// Their books over `days` from `start`: each thing done, logged at once (live),
// that night in one go, or the next morning (for the day before).
function booksOf(who, { start = '2026-09-01', days = 60, seed = 7 } = {}) {
  const p = PEOPLE[who];
  const r = rng(seed);
  const pick = list => list[Math.floor(r() * list.length)];
  const b = emptyBooks();
  let n = 0;
  for (let i = 0; i < days; i++) {
    const d = addDays(start, i);
    const dow = new Date(`${d}T00:00:00Z`).getUTCDay();
    const done = [];
    for (const x of weekend(d) ? p.weekendDay : p.weekday) if (r() < x.p) done.push({ ...x, h: x.h0 + r() * (x.h1 - x.h0), amt: pick(x.amts) });
    for (const [dom, h, cat, sub, amt, a, k = 'out'] of p.monthly) if (Number(d.slice(8)) === dom) done.push({ h, cat, sub, amt, a, k });
    for (const [wd, h, cat, sub, amt, a, k = 'out'] of p.weekly) if (dow === wd) done.push({ h, cat, sub, amt, a, k });
    done.sort((x, y) => x.h - y.h);
    const way = r();
    const night = 21.5 + r() * 1.5;
    done.forEach((x, j) => {
      // (Live: a few minutes after; at night: one after another; the next morning: for yesterday.)
      const t = way < p.live ? at(d, x.h + (2 + r() * 15) / 60) : way < p.live + p.night ? at(d, Math.max(night, x.h + 0.2) + j * 0.03) : at(addDays(d, 1), 7.6 + j * 0.03);
      put(b, 'entries', { id: `e${n++}`, d, k: x.k, cat: x.cat, sub: x.sub, amt: x.amt, a: x.a, via: '', t }, t);
    });
  }
  return b;
}

// (A guess.mjs from before guessNew: the same steps 記一筆 took then.)
const newOf = G =>
  G.guessNew ||
  ((clues, { at = null, lastCat = {}, first = () => '', mealSub = () => '' }) => {
    const k = G.guessWhat(clues)?.k || 'out';
    const cat = G.guessWhat(clues, { k })?.cat || lastCat[k] || first(k);
    const usual = G.guessSubIn(clues, k, cat);
    const sub = usual !== null ? usual : mealSub(cat, at) || '';
    const p = G.guessPay(clues, { k, cat, sub })[0];
    return { k, cat, sub, a: p?.a || '', via: p?.via || '' };
  });

// Each entry guessed as its sheet opened, from what came before it.
// `typed`: the guess once the amount is typed (as 記一筆 guesses again then), else as the sheet opens.
function score(G, b, misses = null, typed = false) {
  const mine = live(b.entries).sort((x, y) => x.t - y.t);
  const first = mine[0] ? Date.parse(`${mine[0].d}T00:00:00+08:00`) : 0;
  const out = { week1: { of: 0, what: 0, cat: 0, pay: 0 }, weeks2to4: { of: 0, what: 0, cat: 0, pay: 0 }, after: { of: 0, what: 0, cat: 0, pay: 0 }, all: { of: 0, what: 0, cat: 0, pay: 0 } };
  const lastCat = {};
  const before = { entries: {} };
  for (const e of mine) {
    const sameDay = new Date(e.t + 8 * 3_600_000).toISOString().slice(0, 10) === e.d;
    const ctx = { day: e.d, at: sameDay ? e.t : null, pl: '', ...(typed ? { amt: e.amt } : {}) };
    const clues = G.cluesFor(before, ctx);
    const g = newOf(G)(clues, { at: ctx.at, lastCat, first: k => (k === 'in' ? 'salary' : 'food'), mealSub: (cat, t) => guessSub(cat, '', t == null ? null : new Date(t)) });
    const week = Math.floor((Date.parse(`${e.d}T00:00:00+08:00`) - first) / (7 * DAY));
    for (const key of ['all', week < 1 ? 'week1' : week < 4 ? 'weeks2to4' : 'after']) {
      const s = out[key];
      s.of++;
      if (g.k === e.k && g.cat === e.cat) s.cat++;
      if (g.k === e.k && g.cat === e.cat && g.sub === (e.sub || '')) s.what++;
      if (g.a === e.a && g.via === (e.via || '')) s.pay++;
    }
    if (misses && !(g.k === e.k && g.cat === e.cat && g.sub === (e.sub || ''))) {
      const key = `${ctx.at == null ? 'for a day before' : 'that day'}: ${e.sub || e.cat} → ${g.sub || g.cat}`;
      misses.set(key, (misses.get(key) || 0) + 1);
    }
    lastCat[e.k] = e.cat;
    before.entries[e.id] = e;
  }
  return out;
}

const pct = (n, of) => (of ? `${Math.round((n / of) * 100)}%` : '–');
async function load(ref) {
  if (!ref) return import('../public/lib/guess.mjs');
  const src = execFileSync('git', ['show', `${ref}:public/lib/guess.mjs`], { encoding: 'utf8' });
  const tmp = fileURLToPath(new URL(`../public/lib/.guess-${process.pid}.mjs`, import.meta.url));
  writeFileSync(tmp, src);
  try {
    return await import(tmp);
  } finally {
    rmSync(tmp, { force: true });
  }
}

const args = process.argv.slice(2);
const why = args.includes('--why');
// --typed: each guess once its amount is typed (an older guess.mjs ignores it: the same as opening).
const typed = args.includes('--typed');
const against = args.includes('--against') ? args[args.indexOf('--against') + 1] : null;
const runs = [['now', await load(null)], ...(against ? [[against, await load(against)]] : [])];
const seeds = [7, 11, 23, 42, 99];
console.log(`category + sub right (category alone, way to pay), ${typed ? 'once the amount is typed' : 'as 記一筆 opens'}, averaged over 5 runs of 60 days each`);
for (const who of Object.keys(PEOPLE)) {
  console.log(`\n${who}`);
  for (const [name, G] of runs.reverse()) {
    const sum = {};
    const misses = why ? new Map() : null;
    for (const seed of seeds) {
      const r = score(G, booksOf(who, { seed }), misses, typed);
      for (const [k, v] of Object.entries(r)) for (const [m, n] of Object.entries(v)) ((sum[k] ||= {})[m] = (sum[k][m] || 0) + n);
    }
    const line = ['week1', 'weeks2to4', 'after', 'all'].map(k => `${k} ${pct(sum[k].what, sum[k].of)} (${pct(sum[k].cat, sum[k].of)}, ${pct(sum[k].pay, sum[k].of)})`).join(' · ');
    console.log(`  ${name.padEnd(8)} ${line}`);
    if (misses) for (const [k, n] of [...misses].sort((x, y) => y[1] - x[1]).slice(0, 12)) console.log(`      ${String(n).padStart(4)}  ${k}`);
  }
  runs.reverse();
}
