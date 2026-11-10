// 問我的帳 (Jay 11-10, the family's AI): the app adds up the person's own
// entries; the AI only finds the answer in these facts and says it (the
// Worker's money-ask: every number it writes must be one of them). Lean on
// purpose: three months, each by category (food by meal), the places seen
// twice or more, the largest, the change from the month before, this week
// and last; each number written once, whole NT$, no commas. Nothing here
// is sent until the person asks.
import { addDays } from '#kit/format.mjs';
import { shiftMonth, monthDays, live } from './books.mjs';
import { byCat, changes, places, largest, total } from './stats.mjs';
import { catOf, subOf, catName } from './cats.mjs';

const nameOf = (id, lang) => {
  const c = subOf(id) || catOf(id);
  return c ? catName(c, lang) : id;
};
// Monday of a day's week.
const mondayOf = day => addDays(day, -((new Date(`${day}T12:00:00Z`).getUTCDay() + 6) % 7));

export function booksFacts(books, today, { lang = 'zh', months = 3 } = {}) {
  const ym = today.slice(0, 7);
  const out = [`Today: ${today}. Amounts are NT$.`];
  const first = live(books.entries).reduce((m, e) => (e.d && (!m || e.d < m) ? e.d : m), '');
  if (first) out.push(`Book starts: ${first}`);
  for (let i = 0; i < months; i++) {
    const m = shiftMonth(ym, -i);
    const from = `${m}-01`;
    const to = i ? `${m}-${String(monthDays(m)).padStart(2, '0')}` : today;
    if (first && to < first) break;
    const spent = total(books, 'out', from, to);
    const got = total(books, 'in', from, to);
    const head = `${m}${i ? '' : ` (to ${today})`}: spent ${spent}, income ${got}`;
    const cats = byCat(books, 'out', from, to, id => subOf(id)?.parent || '').slice(0, 8);
    const catText = cats.map(c => {
      const subs = c.subs.filter(s => s.sub).slice(0, 4).map(s => `${nameOf(s.sub, lang)} ${s.amt}`);
      return `${nameOf(c.cat, lang)} ${c.amt}${subs.length ? ` (${subs.join(', ')})` : ''}`;
    });
    out.push(head, `  spent by category: ${catText.join('; ') || 'none'}`);
    const inc = byCat(books, 'in', from, to).slice(0, 4);
    if (inc.length) out.push(`  income by category: ${inc.map(c => `${nameOf(c.cat, lang)} ${c.amt}`).join('; ')}`);
    if (i === 0) {
      const where = places(books, 'out', from, to, 6);
      if (where.length) out.push(`  places seen twice or more: ${where.map(p => `${p.name.slice(0, 16)} ${p.amt} (${p.n} times)`).join('; ')}`);
      const big = largest(books, 'out', from, to, 3);
      if (big.length) out.push(`  largest: ${big.map(l => `${l.d.slice(5)} ${(l.e.note || nameOf(l.cat, lang)).slice(0, 16)} ${l.amt}`).join('; ')}`);
    }
  }
  // This month against last month to the same day of the month (a fair
  // comparison partway through), category by category.
  const day = Number(today.slice(8, 10));
  const last = shiftMonth(ym, -1);
  const lastTo = `${last}-${String(Math.min(day, monthDays(last))).padStart(2, '0')}`;
  const diff = changes(books, 'out', { from: `${ym}-01`, to: today }, { from: `${last}-01`, to: lastTo }).slice(0, 6);
  const sameDay = total(books, 'out', `${last}-01`, lastTo);
  out.push(`Last month to the same day (${lastTo}): spent ${sameDay}`);
  if (diff.length) out.push(`Change from last month to the same day, by category: ${diff.map(c => `${nameOf(c.cat, lang)} ${c.diff > 0 ? 'more' : 'less'} ${Math.abs(c.diff)} (${c.before} → ${c.amt})`).join('; ')}`);
  const mon = mondayOf(today);
  out.push(`This week (from ${mon}): spent ${total(books, 'out', mon, today)}; last week: ${total(books, 'out', addDays(mon, -7), addDays(mon, -1))}`);
  const b = live(books.budgets).find(x => !x.cat);
  if (b) out.push(`Monthly budget: ${b.amt}, left this month ${Number(b.amt) - total(books, 'out', `${ym}-01`, today)}`);
  return out.join('\n').slice(0, 4800);
}
