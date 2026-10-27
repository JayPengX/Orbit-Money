// 統計: where the money went in a week, a month or a year. The total against
// the period before; the budgets (a month); the spending by day (or month);
// each category's share, largest first (one opens its entries); the income.
import { h, icons, tile, pickSeg, sheet, toast } from '#kit/ui.mjs';
import { addDays } from '#kit/format.mjs';
import { totals, entriesIn, budgetState, monthDays, shiftMonth, put, drop, live } from '../lib/books.mjs';
import { catList, catOf, catName, subOf, glyph } from '../lib/cats.mjs';
import { state, W, en, lang, money, plain, monthLabel, dayLabel, today, saved } from '../shell.mjs';
import { entryRow } from './entry.mjs';

// The period around state.at: { from, to, label, prev (its own from), unit ('day' | 'month') }.
export function periodOf(range, at) {
  if (range === 'week') {
    const wd = (new Date(`${at}T12:00:00Z`).getUTCDay() + 6) % 7;
    const from = addDays(at, -wd);
    const to = addDays(from, 6);
    return { from, to, label: `${dayLabel(from, { week: false })} – ${dayLabel(to, { week: false })}`, step: n => addDays(at, 7 * n), unit: 'day' };
  }
  if (range === 'year') {
    const y = at.slice(0, 4);
    return { from: `${y}-01-01`, to: `${y}-12-31`, label: en ? y : `${y}年`, step: n => `${Number(y) + n}${at.slice(4)}`.replace(/-02-29$/, '-02-28'), unit: 'month' };
  }
  const ym = at.slice(0, 7);
  return { from: `${ym}-01`, to: `${ym}-${String(monthDays(ym)).padStart(2, '0')}`, label: monthLabel(ym), step: n => `${shiftMonth(ym, n)}-01`, unit: 'day' };
}

export function renderStats(box) {
  const b = state.books;
  const now = today();
  const p = periodOf(state.range, state.at);
  const prevP = periodOf(state.range, p.step(-1));
  const t = totals(b, p.from, p.to);
  const before = totals(b, prevP.from, prevP.to);
  const redraw = () => renderStats(box);

  const seg = pickSeg(
    [
      ['week', W('週', 'Week')],
      ['month', W('月', 'Month')],
      ['year', W('年', 'Year')]
    ],
    state.range,
    r => ((state.range = r), redraw()),
    { cls: 'mn-range', label: W('期間', 'Period') }
  );
  const nav = h('div', { class: 'mn-period' }, [
    h('button', { class: 'mn-step', type: 'button', 'aria-label': W('上一期', 'Previous'), html: icons.chevron, onclick: () => ((state.at = p.step(-1)), redraw()) }),
    h('b', { text: p.label }),
    h('button', { class: 'mn-step', type: 'button', 'aria-label': W('下一期', 'Next'), html: icons.chevron, disabled: p.to >= now ? true : null, onclick: () => ((state.at = p.step(1)), redraw()) })
  ]);

  // The days (or months) counted so far, for the average.
  const end = p.to < now ? p.to : now;
  const daysGone = p.from > now ? 0 : Math.round((Date.parse(end) - Date.parse(p.from)) / 86_400_000) + 1;
  const diff = before.out ? (t.out - before.out) / before.out : null;
  const hero = h('section', { class: 'q-hero-card mn-hero' }, [
    h('span', { class: 'q-hc-eyebrow', text: W('支出', 'Spent') }),
    h('b', { class: 'q-hc-big num q-fit', text: money(t.out) }),
    h('div', { class: 'mn-hero-tags' }, [
      daysGone ? h('span', { class: 'mn-hero-tag', text: W(`平均每天 ${money(Math.round(t.out / daysGone))}`, `${money(Math.round(t.out / daysGone))} a day`) }) : null,
      diff != null ? h('span', { class: 'mn-hero-tag', text: `${diff >= 0 ? '▲' : '▼'} ${Math.abs(Math.round(diff * 100))}% ${W(state.range === 'week' ? '比上週' : state.range === 'year' ? '比去年' : '比上月', state.range === 'week' ? 'vs last week' : state.range === 'year' ? 'vs last year' : 'vs last month')}` }) : null
    ]),
    // (The chart in the card itself: seen whole on the first screen, never a scroll away.)
    trend(p, now),
    h('div', { class: 'mn-hero-figs two' }, [fig(W('收入', 'Income'), money(t.in)), fig(W('結餘', 'Left'), money(t.net, { sign: true }))])
  ]);

  const parts = [seg, nav, hero];
  if (state.range === 'month') parts.push(budgetCard(p.from.slice(0, 7), now, redraw));
  if (t.cats.length) parts.push(catSection(W('分類', 'By category'), t.cats, t.out, p));
  if (t.incCats.length) parts.push(catSection(W('收入', 'Income'), t.incCats, t.in, p));
  if (!t.out && !t.in) parts.push(h('p', { class: 'mn-hint', text: W('這段時間還沒有紀錄。', 'Nothing recorded in this period.') }));
  box.replaceChildren(...parts);
}
const fig = (label, value) => h('div', { class: 'mn-fig' }, [h('small', { text: label }), h('b', { class: 'num q-fit', text: value })]);

// Bars: each day of the week or month, each month of the year. One series,
// the app's colour; today's bar marked; a tap names the bar's day and amount.
function trend(p, now) {
  const buckets = [];
  if (p.unit === 'month') for (let m = 1; m <= 12; m++) buckets.push({ key: `${p.from.slice(0, 4)}-${String(m).padStart(2, '0')}`, label: en ? 'JFMAMJJASOND'[m - 1] : String(m) });
  else for (let d = p.from; d <= p.to; d = addDays(d, 1)) buckets.push({ key: d, label: String(Number(d.slice(8))) });
  const sum = Object.fromEntries(buckets.map(x => [x.key, 0]));
  for (const e of entriesIn(state.books, p.from, p.to)) if (e.k === 'out') sum[p.unit === 'month' ? e.d.slice(0, 7) : e.d] += e.amt;
  const max = Math.max(1, ...Object.values(sum));
  const top = max === 1 && !Object.values(sum).some(Boolean) ? 0 : max;
  const cap = h('small', { class: 'mn-trend-cap num', text: W(`${p.unit === 'month' ? '單月' : '單日'}最高 ${money(top)} · 點長條看金額`, `Top ${money(top)} · tap a bar`) });
  const many = buckets.length > 12;
  const bars = h(
    'div',
    { class: `mn-bars${many ? ' many' : ''}`, style: `--n:${buckets.length}` },
    buckets.map((x, i) => {
      const v = sum[x.key];
      const isNow = p.unit === 'month' ? now.startsWith(x.key) : x.key === now;
      const showLabel = !many || i === 0 || (i + 1) % 5 === 0;
      return h(
        'button',
        {
          class: `mn-bar-c${isNow ? ' now' : ''}`,
          type: 'button',
          'aria-label': `${p.unit === 'month' ? monthLabel(x.key, { year: false }) : dayLabel(x.key, { week: false })} ${money(v)}`,
          onclick: e => {
            bars.querySelector('.picked')?.classList.remove('picked');
            e.currentTarget.classList.add('picked');
            cap.textContent = `${p.unit === 'month' ? monthLabel(x.key, { year: false }) : dayLabel(x.key)} · ${money(v)}`;
          }
        },
        [h('i', { style: `height:${v ? Math.max(3, (v / max) * 100) : 0}%` }), h('span', { text: showLabel ? x.label : '' })]
      );
    })
  );
  return h('div', { class: 'mn-trend' }, [bars, cap]);
}

function catSection(title, cats, total, p) {
  return h('section', { class: 'q-section' }, [
    h('div', { class: 'q-section-head' }, [h('h2', { text: title })]),
    h(
      'div',
      { class: 'q-rowcard' },
      cats.map(({ cat, amt }) => {
        const c = catOf(cat);
        const share = total ? amt / total : 0;
        return h('button', { class: 'q-ritem chevron mn-row mn-catrow', type: 'button', onclick: () => openCat(cat, p) }, [
          tile(glyph(c.icon), c.color),
          h('span', { class: 'q-ritem-text' }, [h('span', { class: 'q-ritem-title', text: catName(c, lang) }), h('span', { class: 'mn-share' }, [h('i', { style: `width:${Math.max(2, share * 100)}%;background:${c.color}` })])]),
          h('span', { class: 'mn-catval' }, [h('b', { class: 'num', text: money(amt) }), h('small', { class: 'num', text: `${Math.round(share * 100)}%` })])
        ]);
      })
    )
  ]);
}

// A category's entries, its subs first (each its share, tapped to show only
// its own; tapped again for all).
function openCat(cat, p) {
  const c = catOf(cat);
  const list = entriesIn(state.books, p.from, p.to)
    .filter(e => (e.k === 'out' || e.k === 'in') && (e.cat || 'other') === cat)
    .sort((a, b) => b.d.localeCompare(a.d) || (b.t || 0) - (a.t || 0));
  const total = list.reduce((n, e) => n + e.amt, 0);
  const by = new Map();
  for (const e of list) {
    const k = subOf(e.sub)?.parent === cat ? e.sub : '';
    by.set(k, (by.get(k) || 0) + e.amt);
  }
  const rows = h('div', { class: 'q-rowcard' });
  let only = null;
  const paint = () => rows.replaceChildren(...list.filter(e => only === null || (subOf(e.sub)?.parent === cat ? e.sub : '') === only).map(e => entryRow(e, { day: true, inCat: true })));
  const parts = [...by].sort((a, b) => b[1] - a[1]);
  const split =
    parts.length > 1
      ? h(
          'div',
          { class: 'q-rowcard mn-subsplit' },
          parts.map(([k, amt]) =>
            h('button', { class: 'q-ritem mn-row mn-catrow', type: 'button', 'aria-pressed': 'false', onclick: e => {
              only = only === k ? null : k;
              for (const el of e.currentTarget.parentNode.children) el.setAttribute('aria-pressed', String(el === e.currentTarget && only !== null));
              paint();
            } }, [
              h('span', { class: 'q-ritem-text' }, [h('span', { class: 'q-ritem-title', text: k ? catName(subOf(k), lang) : W('未分細項', 'No sub-category') }), h('span', { class: 'mn-share' }, [h('i', { style: `width:${Math.max(2, (amt / total) * 100)}%;background:${c.color}` })])]),
              h('span', { class: 'mn-catval' }, [h('b', { class: 'num', text: money(amt) }), h('small', { class: 'num', text: `${Math.round((amt / total) * 100)}%` })])
            ])
          )
        )
      : null;
  paint();
  sheet({ title: catName(c, lang), subtitle: money(total), body: [split, rows] });
}

// ---- Budgets ----------------------------------------------------------------------

function budgetCard(ym, now, redraw) {
  const list = budgetState(state.books, ym, now);
  const edit = h('button', { type: 'button', text: list.length ? W('編輯', 'Edit') : W('設定', 'Set'), onclick: () => openBudgets(redraw) });
  if (!list.length) return h('section', { class: 'q-section' }, [h('div', { class: 'q-section-head' }, [h('h2', { text: W('預算', 'Budget') }), edit]), h('p', { class: 'mn-hint', text: W('每月花多少、每類花多少，設好就能看還剩多少、一天能花多少。', 'Set a monthly limit, overall or by category, to see what’s left and what you can spend a day.') })]);
  return h('section', { class: 'q-section' }, [
    h('div', { class: 'q-section-head' }, [h('h2', { text: W('預算', 'Budget') }), edit]),
    h(
      'div',
      { class: 'q-rowcard' },
      list.map(x => {
        const c = x.cat ? catOf(x.cat) : null;
        const over = x.left < 0;
        const ahead = !over && x.pace > 1.05;
        return h('div', { class: 'q-ritem mn-budget' }, [
          c ? tile(glyph(c.icon), c.color) : tile(glyph('target'), 'var(--q-accent)'),
          h('span', { class: 'q-ritem-text' }, [
            h('span', { class: 'q-ritem-title', text: c ? catName(c, lang) : W('每月總預算', 'Monthly budget') }),
            h('span', { class: `mn-share${over ? ' over' : ahead ? ' ahead' : ''}` }, [h('i', { style: `width:${Math.min(100, Math.max(2, x.share * 100))}%` })]),
            h('small', { text: over ? W(`超出 ${money(-x.left)}`, `${money(-x.left)} over`) : x.perDay && now.startsWith(ym) ? W(`每天可花 ${money(x.perDay)}`, `${money(x.perDay)} a day`) : W(`剩 ${money(x.left)}`, `${money(x.left)} left`) })
          ]),
          h('span', { class: 'mn-catval' }, [h('b', { class: 'num', text: money(x.spent) }), h('small', { class: 'num', text: `/ ${plain(x.amt)}` })])
        ]);
      })
    )
  ]);
}

function openBudgets(redraw) {
  const b = state.books;
  const have = Object.fromEntries(live(b.budgets).map(x => [x.cat, x]));
  const rows = [{ cat: '', name: W('每月總預算', 'Monthly budget'), icon: 'target', color: 'var(--q-accent)' }, ...catList('out').map(c => ({ cat: c.id, name: catName(c, lang), icon: c.icon, color: c.color }))];
  const inputs = new Map();
  const body = h(
    'div',
    { class: 'q-rowcard mn-budget-edit' },
    rows.map(r => {
      const i = h('input', { class: 'q-field num', type: 'text', inputmode: 'numeric', placeholder: W('不設', 'None'), value: have[r.cat]?.amt ? String(have[r.cat].amt) : '', 'aria-label': r.name });
      inputs.set(r.cat, i);
      return h('label', { class: 'q-ritem' }, [tile(glyph(r.icon), r.color), h('span', { class: 'q-ritem-text' }, [h('span', { class: 'q-ritem-title', text: r.name })]), i]);
    })
  );
  const s = sheet({
    title: W('每月預算', 'Monthly budgets'),
    detent: 'large',
    body: [body],
    foot: h('div', { class: 'q-sheet-foot' }, [
      h('button', {
        class: 'q-btn primary block',
        type: 'button',
        text: W('儲存', 'Save'),
        onclick: () => {
          for (const [cat, i] of inputs) {
            const amt = Math.round(Number(i.value.replace(/[^\d.]/g, '')) || 0);
            const was = have[cat];
            if (amt > 0 && amt !== was?.amt) put(b, 'budgets', { id: was?.id || `b-${cat || 'all'}`, cat, amt });
            else if (!amt && was) drop(b, 'budgets', was.id);
          }
          s.close();
          saved();
          toast(W('預算已更新', 'Budgets saved'));
          redraw();
        }
      })
    ])
  });
}
