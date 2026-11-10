// 每月回顧 (Jay 11-10, the family's AI): in a month's first week, last
// month in a few lines. Every figure is the phone's (where the money went,
// against the month before, the place it went most); the AI writes only the
// one honest suggestion (money-month), from those same figures.
import { shiftMonth, monthDays, live } from './books.mjs';
import { byCat, changes, places, total, kept } from './stats.mjs';
import { catOf, subOf, catName } from './cats.mjs';

const range = ym => ({ from: `${ym}-01`, to: `${ym}-${String(monthDays(ym)).padStart(2, '0')}` });
const nameOf = (id, lang) => {
  const c = subOf(id) || catOf(id);
  return c ? catName(c, lang) : id;
};

// The month before `today`'s, shown in the first 7 days of a month when it
// has spending; null otherwise.
export function reviewMonth(today) {
  return Number(today.slice(8, 10)) <= 7 ? shiftMonth(today.slice(0, 7), -1) : null;
}

export function reviewOf(books, ym) {
  const r = range(ym);
  const p = range(shiftMonth(ym, -1));
  const spent = total(books, 'out', r.from, r.to);
  if (!spent) return null;
  const before = total(books, 'out', p.from, p.to);
  const started = live(books.entries).some(e => e.d && e.d <= p.to);
  const income = total(books, 'in', r.from, r.to);
  const top = byCat(books, 'out', r.from, r.to)[0] || null;
  const up = started ? changes(books, 'out', r, p).find(c => c.diff > 0) || null : null;
  const place = places(books, 'out', r.from, r.to, 1)[0] || null;
  const k = kept(income, spent);
  return { ym, spent, before: started ? before : null, income, kept: k == null ? null : Math.round(k * 100), top, up, place };
}

// The figures as the AI is told them (each once, whole NT$, no commas).
export function reviewFacts(v, lang = 'zh') {
  if (!v) return '';
  return [
    `Month: ${v.ym}. Amounts are NT$.`,
    `Spent ${v.spent}${v.before != null ? `; the month before ${v.before}` : ''}`,
    v.income ? `Income ${v.income}${v.kept > 0 ? `; kept ${v.kept}% of it` : '; spent more than that'}` : 'No income logged',
    v.top ? `Most went to ${nameOf(v.top.cat, lang)}: ${v.top.amt}` : '',
    v.up ? `Up most on the month before: ${nameOf(v.up.cat, lang)} ${v.up.before} → ${v.up.amt} (more ${v.up.diff})` : '',
    v.place ? `Went most often to ${v.place.name.slice(0, 16)}: ${v.place.n} times, ${v.place.amt}` : ''
  ]
    .filter(Boolean)
    .join('\n');
}
