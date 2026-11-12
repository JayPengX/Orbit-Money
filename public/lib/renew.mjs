// 到期提醒: anything that runs out or renews (Jay 2026-10-27: not just
// TPASS): a pass, a subscription, a membership, a card's annual fee. Pure, tested.
//
//   renew  { id: { id, name, start, n, unit, roll, cat, sub, on, at } }
//          start: the day the current one began ('' not set). n, unit: how
//          long one lasts (unit day | month | year). roll: it renews by itself
//          (a subscription: the reminder is for the next charge), else it runs
//          out and is renewed by hand (a TPASS: the reminder is for its last
//          day). cat, sub: a spend logged there starts a new one (its `from`,
//          the day it began, else its day). on, at: told or not, and how many
//          days before (0: that day). tm: the time that day is told ('HH:MM',
//          08:00: the morning); eve: the time the days before are told (18:00,
//          the evening before while still out: Jay 2026-10-27 "by 20:00 he's home, too late
//          to renew"; a TPASS renews up to 10 days ahead at a station or a store's ibon/FamiPort).
//          Both his to choose.
import { addDays } from '#kit/format.mjs';
import { live, put, monthDays } from './books.mjs';

export const UNITS = ['day', 'month', 'year'];
// The usual lengths, for the picker: [n, unit].
export const CYCLES = [[7, 'day'], [30, 'day'], [90, 'day'], [1, 'month'], [3, 'month'], [6, 'month'], [1, 'year']];
export const AT = [7, 3, 1, 0];
export const DEFAULT_AT = [1, 0];
export const DEFAULT_TM = '08:00';
export const DEFAULT_EVE = '18:00';

// `day` moved on by n days, months (the same date, the month's last when
// it's shorter) or years.
export function addCycle(day, n, unit) {
  if (unit === 'day') return addDays(day, n);
  const months = unit === 'year' ? 12 * n : n;
  const y = Number(day.slice(0, 4));
  const m = Number(day.slice(5, 7)) - 1 + months;
  const ym = `${y + Math.floor(m / 12)}-${String((m % 12) + 1).padStart(2, '0')}`;
  return `${ym}-${String(Math.min(Number(day.slice(8, 10)), monthDays(ym))).padStart(2, '0')}`;
}
const gap = (a, b) => Math.round((Date.parse(`${b}T12:00:00Z`) - Date.parse(`${a}T12:00:00Z`)) / 86_400_000);
const okDay = d => /^\d{4}-\d{2}-\d{2}$/.test(d || '');

// The latest spend that starts one (its cat, and its sub when it has one).
export function linkedSpend(books, r) {
  if (!r?.cat) return null;
  let best = null;
  for (const e of live(books.entries)) {
    if (e.k !== 'out' || e.cat !== r.cat || (r.sub && e.sub !== r.sub)) continue;
    const start = okDay(e.from) ? e.from : e.d;
    if (!best || start > best.start) best = { e, start };
  }
  return best;
}

// Where one stands today: { start, due, left, src ('set' | 'entry' | ''), e }.
// due: its last day (runs out) or its next renewal (renews by itself);
// left: days from today to due (0 that day, below 0 run out).
export function standing(books, r, today) {
  const link = linkedSpend(books, r);
  let start = okDay(r.start) ? r.start : '';
  let src = start ? 'set' : '';
  if (link && link.start > start) (start = link.start), (src = 'entry');
  const n = Math.max(1, Math.round(Number(r.n) || 0));
  const unit = UNITS.includes(r.unit) ? r.unit : 'day';
  if (!start) return { start: '', due: '', left: null, src: '', e: link?.e || null };
  let due;
  if (r.roll) {
    // (Each one counted from the start, never from the last: one begun on 1/31
    // renews on the 30th or 31st, not the 28th for ever after February.)
    let k = 1;
    due = addCycle(start, n, unit);
    for (; due < today && k < 2000; k++) due = addCycle(start, n * (k + 1), unit);
  } else due = addDays(addCycle(start, n, unit), -1);
  return { start, due, left: gap(today, due), src, e: src === 'entry' ? link.e : null };
}

// Every reminder with where it stands, soonest first (not set last).
export const reminders = (books, today) =>
  live(books.renew)
    .map(r => ({ r, ...standing(books, r, today) }))
    .sort((a, b) => (a.left ?? 1e9) - (b.left ?? 1e9) || String(a.r.name).localeCompare(String(b.r.name)));

// How many days before it's told (0 that morning), largest first.
export const atOf = r => (Array.isArray(r?.at) ? r.at : DEFAULT_AT).filter(n => AT.includes(n)).sort((a, b) => b - a);
// The time of day it's told: that day, the one set or 08:00; a day or more
// before, the one set or 18:00 (the evening before, before he's home).
const HM = /^([01]\d|2[0-3]):[0-5]\d$/;
export const tmOf = r => (HM.test(r?.tm || '') ? r.tm : DEFAULT_TM);
export const eveOf = r => (HM.test(r?.eve || '') ? r.eve : DEFAULT_EVE);
export const timeFor = (r, n) => (n > 0 ? eveOf(r) : tmOf(r));
// When the phone is told (ms): each day picked, at its time of day by the phone's own clock.
export const remindTimes = (r, s) => (r?.on === false || !s?.due ? [] : atOf(r).map(n => ({ n, day: addDays(s.due, -n), at: Date.parse(`${addDays(s.due, -n)}T${timeFor(r, n)}:00`) })));

// Renewed by hand (no spend to log): the next one starts the day after this one ends.
export const renewedBy = (r, s) => (s?.due ? (r.roll ? s.due : addDays(s.due, 1)) : '');

// ---- Older books brought up ------------------------------------------------------
// The TPASS reminder lived on the category before (days, start, remind on
// transport:tpass): it becomes the first item of the list, its start still
// following the TPASS logged. Made too for anyone who logged a TPASS. One
// fixed id, so two phones make the same one; removed, it stays removed.
export function upgradeRenew(books, now = Date.now()) {
  let n = 0;
  books.renew ||= {};
  const mine = books.cats?.['transport:tpass'];
  const had = mine && !mine.del && (mine.days != null || mine.start || mine.remind);
  const logged = live(books.entries).some(e => e.k === 'out' && e.sub === 'transport:tpass');
  if (!books.renew.tpass && (had || logged) && !(had && Number(mine.days) === 0)) {
    put(books, 'renew', { id: 'tpass', name: 'TPASS', start: okDay(mine?.start) ? mine.start : '', n: Number(mine?.days) > 0 ? Number(mine.days) : 30, unit: 'day', roll: false, cat: 'transport', sub: 'transport:tpass', on: mine?.remind?.on !== false, at: Array.isArray(mine?.remind?.at) ? mine.remind.at : DEFAULT_AT }, now);
    n++;
  }
  // (The settings on a category are gone: the list holds them now.)
  for (const c of live(books.cats))
    if ('days' in c || 'start' in c || 'remind' in c) {
      const { days, start, remind, ...rest } = c;
      put(books, 'cats', rest, now);
      n++;
    }
  return n;
}
