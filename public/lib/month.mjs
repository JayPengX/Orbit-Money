// 每月回顧 (Jay 11-10, the family's AI): in a month's first week, last
// month in a few lines. Every figure is the phone's (where the money went,
// against the month before, the place it went most); the AI writes only the
// one honest suggestion (money-month), from what the card doesn't show (Jay
// 11-10: AI saying what's on screen is for nothing): weekends against
// weekdays, the small buys, the biggest one, what inside the category that
// grew grew most (`patternOf`).
import { shiftMonth, monthDays, live, lines } from './books.mjs';
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
  return { ym, spent, before: started ? before : null, income, kept: k == null ? null : Math.round(k * 100), top, up, place, ...patternOf(books, r, p, up) };
}

// What the card doesn't show, for the AI's suggestion: a weekend day's spending
// against a weekday's, buys of NT$100 or less, the biggest one, and the sub that
// grew most inside the category that grew.
export function patternOf(books, r, p, up = null) {
  const out = lines(books, r.from, r.to).filter(l => l.k === 'out' && !l.fee && l.amt > 0);
  const wk = d => [0, 6].includes(new Date(`${d}T12:00:00Z`).getUTCDay());
  const days = { end: 0, mid: 0 };
  for (let d = r.from; d <= r.to; d = new Date(Date.parse(`${d}T12:00:00Z`) + 86_400_000).toISOString().slice(0, 10)) days[wk(d) ? 'end' : 'mid']++;
  const sumOf = ls => ls.reduce((n, l) => n + l.amt, 0);
  const end = sumOf(out.filter(l => wk(l.d)));
  const mid = sumOf(out.filter(l => !wk(l.d)));
  const small = out.filter(l => l.amt <= 100);
  const big = out.reduce((a, l) => (!a || l.amt > a.amt ? l : a), null);
  let upSub = null;
  if (up) {
    const by = (from, to) => lines(books, from, to).filter(l => l.k === 'out' && l.cat === up.cat && l.sub).reduce((m, l) => m.set(l.sub, (m.get(l.sub) || 0) + l.amt), new Map());
    const now = by(r.from, r.to), was = by(p.from, p.to);
    for (const [s, amt] of now) if (amt - (was.get(s) || 0) > (upSub?.diff || 0)) upSub = { sub: s, amt, diff: amt - (was.get(s) || 0) };
  }
  return {
    week: days.end && days.mid ? { end: Math.round(end / days.end), mid: Math.round(mid / days.mid) } : null,
    small: small.length >= 5 ? { n: small.length, amt: sumOf(small) } : null,
    big: big ? { amt: big.amt, what: String(big.e.note || '').slice(0, 16), cat: big.sub || big.cat } : null,
    upSub
  };
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
    '(The person already sees the lines above. What only these lines show:)',
    v.place ? `Went most often to ${v.place.name.slice(0, 16)}: ${v.place.n} times, ${v.place.amt}` : '',
    v.week ? `A weekend day ${v.week.end} on average, a weekday ${v.week.mid}` : '',
    v.small ? `${v.small.n} buys of 100 or less, ${v.small.amt} in all` : '',
    v.big ? `The biggest single buy: ${v.big.amt}, ${nameOf(v.big.cat, lang)}${v.big.what ? ` (${v.big.what})` : ''}` : '',
    v.upSub ? `Inside ${nameOf(v.up.cat, lang)}, ${nameOf(v.upSub.sub, lang)} grew most: up ${v.upSub.diff} to ${v.upSub.amt}` : ''
  ]
    .filter(Boolean)
    .join('\n');
}
