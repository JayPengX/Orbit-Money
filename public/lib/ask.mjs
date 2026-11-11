// 問我的帳 (Jay 11-10, the family's AI): the app adds up the person's own
// entries into tables, each with an id (three months by category, by how it
// was paid, the top categories by their subs, income, places, the largest,
// against last month, this week and last, the budget); the AI (money-ask)
// only picks the tables that answer and writes one short line, every number
// one of theirs. The app draws those tables from its own numbers as rows
// and bars, never the AI's paragraph (Jay 11-10: "the response should never
// be a plain text"). Each number whole NT$, no commas. Nothing here is sent
// until the person asks.
import { addDays } from '#kit/format.mjs';
import { shiftMonth, monthDays, live, lines, alsoOf } from './books.mjs';
import { byCat, changes, places, largest, total } from './stats.mjs';
import { catOf, subOf, catName } from './cats.mjs';

const nameOf = (id, lang) => {
  const c = subOf(id) || catOf(id);
  return c ? catName(c, lang) : id;
};
// Monday of a day's week.
const mondayOf = day => addDays(day, -((new Date(`${day}T12:00:00Z`).getUTCDay() + 6) % 7));

// How a spend was paid, by the card used (its name and last digits) or the
// account: [{ key, label, amt, n }], largest first. A part paid another way
// (also: LINE Points, a gift card) counts under that way.
export function byPay(books, from, to, lang = 'zh') {
  const by = new Map();
  const nameOf_ = (a, via) => {
    const c = via && books.cards?.[via];
    const acct = books.accts?.[a];
    const an = acct && !acct.del ? acct.name || '' : '';
    if (c && !c.del) return c.last4 ? `${c.name} •${c.last4}` : `${an} ${c.name}`.trim();
    return an || (lang === 'en' ? 'Removed account' : '已刪除的帳戶');
  };
  const add = (a, via, amt, id) => {
    const k = `${a}|${via || ''}`;
    const x = by.get(k) || by.set(k, { key: k, label: nameOf_(a, via), amt: 0, ids: new Set() }).get(k);
    x.amt += amt;
    x.ids.add(id);
  };
  for (const l of lines(books, from, to)) {
    if (l.k !== 'out' || l.amt <= 0) continue;
    const e = l.e;
    if (l.fee || e.k !== 'out') {
      add(e.a, e.via, l.amt, e.id);
      continue;
    }
    const parts = alsoOf(e);
    let rest = l.amt;
    for (const p of parts) {
      const amt = Math.min(rest, p.amt);
      if (amt > 0) add(p.a, p.via, amt, e.id);
      rest -= amt;
    }
    if (rest > 0) add(e.a, e.via, rest, e.id);
  }
  return [...by.values()].map(({ ids, ...x }) => ({ ...x, n: ids.size })).sort((a, b) => b.amt - a.amt);
}

const W_ = (lang, zh, en) => (lang === 'en' ? en : zh);
const monthName = (m, lang) => (lang === 'en' ? new Date(`${m}-15T12:00:00Z`).toLocaleString('en-US', { month: 'short', timeZone: 'UTC' }) : `${Number(m.slice(5))}月`);

// The tables the answer is drawn from: { id: { title, rows: [{ label, amt, n?, was? }] } }, in order.
export function askTables(books, today, { lang = 'zh', months = 3 } = {}) {
  const t = {};
  const put = (id, title, rows) => rows.length && (t[id] = { title, rows });
  const ym = today.slice(0, 7);
  const first = live(books.entries).reduce((m, e) => (e.d && (!m || e.d < m) ? e.d : m), '');
  const spent = [];
  for (let i = 0; i < months; i++) {
    const m = shiftMonth(ym, -i);
    const from = `${m}-01`;
    const to = i ? `${m}-${String(monthDays(m)).padStart(2, '0')}` : today;
    if (first && to < first) break;
    const mn = monthName(m, lang) + (i ? '' : W_(lang, '（到今天）', ' (so far)'));
    const out = total(books, 'out', from, to);
    spent.push({ label: mn, amt: out, got: total(books, 'in', from, to) });
    const cats = byCat(books, 'out', from, to, id => subOf(id)?.parent || '').slice(0, 8);
    put(`cat${i}`, W_(lang, `${mn}花在哪`, `${mn}: by category`), cats.map(c => ({ label: nameOf(c.cat, lang), amt: c.amt, id: c.cat })));
    put(`pay${i}`, W_(lang, `${mn}怎麼付的`, `${mn}: how it was paid`), byPay(books, from, to, lang).slice(0, 8).map(p => ({ label: p.label, amt: p.amt, n: p.n, pay: p.key })));
    if (i === 0) {
      for (const c of cats.slice(0, 3)) {
        const subs = c.subs.filter(x => x.sub).slice(0, 6);
        if (subs.length >= 2) put(`sub0.${c.cat}`, W_(lang, `${mn}${nameOf(c.cat, lang)}裡`, `${mn}: inside ${nameOf(c.cat, lang)}`), subs.map(x => ({ label: nameOf(x.sub, lang), amt: x.amt, id: x.sub })));
      }
      put('inc0', W_(lang, `${mn}收入`, `${mn}: income`), byCat(books, 'in', from, to).slice(0, 5).map(c => ({ label: nameOf(c.cat, lang), amt: c.amt, id: c.cat })));
      put('place0', W_(lang, `${mn}常去的地方`, `${mn}: places`), places(books, 'out', from, to, 6).map(p => ({ label: p.name.slice(0, 16), amt: p.amt, n: p.n, pic: '📍' })));
      put('big0', W_(lang, `${mn}最大筆`, `${mn}: largest`), largest(books, 'out', from, to, 4).map(l => ({ label: `${Number(l.d.slice(5, 7))}/${Number(l.d.slice(8))} ${(l.e.note || nameOf(l.cat, lang)).slice(0, 16)}`, amt: l.amt, id: l.e.sub || l.cat })));
    }
  }
  if (spent.length > 1) put('months', W_(lang, '每月支出', 'Spent by month'), spent.map(({ label, amt }) => ({ label, amt, pic: '📅' })));
  // This month against last month to the same day of the month (a fair
  // comparison partway through), category by category.
  const day = Number(today.slice(8, 10));
  const last = shiftMonth(ym, -1);
  const lastTo = `${last}-${String(Math.min(day, monthDays(last))).padStart(2, '0')}`;
  put('vs', W_(lang, `比上個月同期（到 ${Number(lastTo.slice(5, 7))}/${Number(lastTo.slice(8))}）`, `Against last month to the same day`), changes(books, 'out', { from: `${ym}-01`, to: today }, { from: `${last}-01`, to: lastTo }).slice(0, 6).map(c => ({ label: nameOf(c.cat, lang), amt: c.amt, was: c.before, id: c.cat })));
  const mon = mondayOf(today);
  put('week', W_(lang, '這週和上週', 'This week and last'), [
    { label: W_(lang, '這週', 'This week'), amt: total(books, 'out', mon, today), pic: '🗓️' },
    { label: W_(lang, '上週', 'Last week'), amt: total(books, 'out', addDays(mon, -7), addDays(mon, -1)), pic: '🗓️' }
  ]);
  const b = live(books.budgets).find(x => !x.cat);
  if (b) {
    const used = total(books, 'out', `${ym}-01`, today);
    put('budget', W_(lang, '這個月的預算', 'This month’s budget'), [
      { label: W_(lang, '預算', 'Budget'), amt: Number(b.amt), pic: '🎯' },
      { label: W_(lang, '已花', 'Spent'), amt: used, pic: '💸' },
      { label: W_(lang, '還剩', 'Left'), amt: Number(b.amt) - used, pic: '👛' }
    ]);
  }
  return { tables: t, spent, first };
}

// The facts the AI is told: the tables by id, each number once.
export function booksFacts(books, today, { lang = 'zh', months = 3 } = {}) {
  const { tables, spent, first } = askTables(books, today, { lang, months });
  const out = [`Today: ${today}. Amounts are NT$.`];
  if (first) out.push(`Book starts: ${first}`);
  if (spent[0]) out.push(`Income this month: ${spent[0].got}`);
  for (const [id, x] of Object.entries(tables)) out.push(`[${id}] ${x.title}: ${x.rows.map(r => `${r.label} ${r.amt}${r.n ? ` (${r.n} times)` : ''}${r.was != null ? ` (was ${r.was})` : ''}`).join('; ')}`);
  return out.join('\n').slice(0, 4800);
}
