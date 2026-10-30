// The numbers behind 統計 (pure, tested): a range's spending or income cut
// every useful way. Everything goes through books.mjs `lines`, so money back,
// fees and the parts paid another way count the same as everywhere else.
// `kind` is 'out' (支出) or 'in' (收入): the two are never netted against each
// other here (Jay 2026-10-27: a high income would hide high spending).
import { addDays } from '#kit/format.mjs';
import { lines, alsoOf, live, monthDays, shiftMonth } from './books.mjs';

const of = (books, kind, from, to) => lines(books, from, to).filter(l => l.k === kind);
const sum = list => list.reduce((n, l) => n + l.amt, 0);
const desc = (a, b) => b.amt - a.amt;

// Each category, largest first, with its subs (largest first; '' for the
// ones logged with none): [{ cat, amt, subs: [{ sub, amt }] }].
export function byCat(books, kind, from, to, subParent = () => '') {
  const cats = new Map();
  for (const l of of(books, kind, from, to)) {
    const c = cats.get(l.cat) || cats.set(l.cat, { cat: l.cat, amt: 0, by: new Map() }).get(l.cat);
    c.amt += l.amt;
    const sub = l.sub && subParent(l.sub) === l.cat ? l.sub : '';
    c.by.set(sub, (c.by.get(sub) || 0) + l.amt);
  }
  return [...cats.values()]
    .filter(c => c.amt)
    .map(({ by, ...c }) => ({ ...c, subs: [...by].map(([sub, amt]) => ({ sub, amt })).filter(s => s.amt).sort(desc) }))
    .sort(desc);
}

// Which account (and way to pay on it) each NT$ left from or came into:
// [{ a, amt, ways: [{ via, amt }] }]. A part paid another way (LINE Points)
// counts for that account; a fee for the one it came from.
export function byAccount(books, kind, from, to) {
  const accts = new Map();
  const add = (a, via, amt) => {
    if (!amt) return;
    const x = accts.get(a || '') || accts.set(a || '', { a: a || '', amt: 0, by: new Map() }).get(a || '');
    x.amt += amt;
    x.by.set(via || '', (x.by.get(via || '') || 0) + amt);
  };
  for (const l of of(books, kind, from, to)) {
    const e = l.e;
    if (l.fee || l.amt < 0 || e.k !== 'out') {
      add(e.a, l.fee || e.k === 'in' ? e.via : '', l.amt);
      continue;
    }
    // (What came back comes off the main account's part first.)
    let left = l.amt;
    for (const p of alsoOf(e)) {
      const amt = Math.min(left, p.amt);
      add(p.a, p.via, amt);
      left -= amt;
    }
    add(e.a, e.via, left);
  }
  return [...accts.values()]
    .filter(x => x.amt)
    .map(({ by, ...x }) => ({ ...x, ways: [...by].map(([via, amt]) => ({ via, amt })).filter(w => w.amt).sort(desc) }))
    .sort(desc);
}

// Each category's change against the period before, largest change first:
// [{ cat, amt, before, diff }] (new and gone ones too).
export function changes(books, kind, p, prev) {
  const now = new Map(byCat(books, kind, p.from, p.to).map(c => [c.cat, c.amt]));
  const was = new Map(byCat(books, kind, prev.from, prev.to).map(c => [c.cat, c.amt]));
  return [...new Set([...now.keys(), ...was.keys()])]
    .map(cat => ({ cat, amt: now.get(cat) || 0, before: was.get(cat) || 0 }))
    .map(x => ({ ...x, diff: x.amt - x.before }))
    .filter(x => x.diff)
    .sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff) || b.amt - a.amt);
}

// A repeat's own entries (固定收支, ids r-<repeat>-<day>) against the rest.
// (統計's 不計入: an entry whose category or sub is left out; see books.mjs lines.)
const skipped = (books, e) => Boolean(books.skip?.size) && (books.skip.has(e.cat || 'other') || books.skip.has(e.sub || `${e.cat || 'other'}/-`));
export const isFixed = e => /^r-/.test(e?.id || '');
// The spending's shape: fixed and the rest, the fees, and what came back
// (退款 and friends' shares handed over, on their own days).
export function shape(books, from, to) {
  let fixed = 0;
  let fees = 0;
  let total = 0;
  for (const l of of(books, 'out', from, to)) {
    total += l.amt;
    if (l.fee) fees += l.amt;
    else if (isFixed(l.e)) fixed += l.amt;
  }
  let back = 0;
  let owed = 0;
  for (const e of live(books.entries))
    if (e.k === 'back' && e.d >= from && e.d <= to && !skipped(books, e.cat ? e : books.entries[e.of] || e)) {
      if (e.wait) owed += Number(e.amt) || 0;
      else back += Number(e.amt) || 0;
    }
  return { total, fixed, variable: total - fixed - fees, fees, back, owed };
}

// The largest single ones (a spend less what came back, its fee apart).
export const largest = (books, kind, from, to, n = 5) =>
  of(books, kind, from, to)
    .filter(l => !l.fee && l.amt > 0)
    .sort((a, b) => b.amt - a.amt || b.d.localeCompare(a.d))
    .slice(0, n);

// Where it went: the store (an invoice's seller, else the note), its visits
// and total, most first. Only places seen twice or more: a one-off says
// nothing about habits.
export const placeOf = e => String(e?.inv?.seller || e?.note || '').trim().replace(/\s+/g, ' ');
const placeKey = s => s.toLowerCase().replace(/[\s・·.\-]/g, '').replace(/(股份)?有限公司|門市|分店$/g, '');
export function places(books, kind, from, to, n = 5) {
  const by = new Map();
  for (const l of of(books, kind, from, to)) {
    if (l.fee) continue;
    const name = placeOf(l.e);
    if (!name) continue;
    const k = placeKey(name);
    const x = by.get(k) || by.set(k, { name, amt: 0, ids: new Set() }).get(k);
    x.amt += l.amt;
    x.ids.add(l.e.id);
  }
  return [...by.values()]
    .map(({ ids, ...x }) => ({ ...x, n: ids.size, ids: [...ids] }))
    .filter(x => x.amt > 0 && x.n > 1)
    .sort((a, b) => b.amt - a.amt || b.n - a.n)
    .slice(0, n);
}
export const sameplace = (a, b) => placeKey(a) === placeKey(b);

// The days of a range up to `today` (none when it hasn't started).
export function daysIn(from, to, today) {
  const end = to < today ? to : today;
  return from > end ? 0 : Math.round((Date.parse(end) - Date.parse(from)) / 86_400_000) + 1;
}

// Spending by weekday (Mon first): each one's average over the days of it
// gone, and its total. [{ wd: 0..6 (Mon..Sun), avg, amt, n }].
export function weekdays(books, from, to, today) {
  const out = Array.from({ length: 7 }, (_, wd) => ({ wd, amt: 0, n: 0, avg: 0 }));
  const end = to < today ? to : today;
  for (let d = from; d <= end; d = addDays(d, 1)) out[(new Date(`${d}T12:00:00Z`).getUTCDay() + 6) % 7].n++;
  for (const l of of(books, 'out', from, end)) out[(new Date(`${l.d}T12:00:00Z`).getUTCDay() + 6) % 7].amt += l.amt;
  for (const x of out) x.avg = x.n ? Math.round(x.amt / x.n) : 0;
  return out;
}

// A month's spending at this pace by its end: null when the month isn't
// running or too little of it is gone to say (3 days). The fixed ones count
// once (a rent paid on the 1st isn't paid again each day).
export function pace(books, ym, today) {
  if (!today.startsWith(ym)) return null;
  const gone = Number(today.slice(8));
  if (gone < 3) return null;
  const s = shape(books, `${ym}-01`, today);
  const days = monthDays(ym);
  return Math.round(s.fixed + ((s.total - s.fixed) / gone) * days);
}

// Month by month, ending at `ym`, `n` of them: [{ ym, out, in }]; with
// `cat` (and `sub`) only that one, for a category's own trend.
export function months(books, ym, n = 12, { cat = '', sub = '', kind = '' } = {}) {
  const first = shiftMonth(ym, -(n - 1));
  const list = Array.from({ length: n }, (_, i) => ({ ym: shiftMonth(first, i), out: 0, in: 0 }));
  const at = new Map(list.map(x => [x.ym, x]));
  for (const l of lines(books, `${first}-01`, `${ym}-31`)) {
    if (cat && (l.cat !== cat || (sub && l.sub !== sub))) continue;
    if (kind && l.k !== kind) continue;
    at.get(l.d.slice(0, 7))[l.k] += l.amt;
  }
  return list;
}

// The share of income kept (null with no income): what Jay sees beside 收入,
// never in place of 支出.
export const kept = (inc, out) => (inc > 0 ? (inc - out) / inc : null);

// The first day anything was logged ('' when nothing): months before it are
// left out of averages.
export const firstDay = books => live(books.entries).reduce((m, e) => (e.d && (!m || e.d < m) ? e.d : m), '');

// A list's total, for a view's own use.
export const total = (books, kind, from, to) => sum(of(books, kind, from, to));
