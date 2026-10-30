// 統計: where the money went, and where it came from, as two views that are
// never netted (Jay 2026-10-27: a high income would hide high spending).
// 支出: the total against the period before and where the month is heading;
// the spending by day (or month); the budgets; each category with its subs and
// their share of the whole; what changed most; by account and way to pay;
// fixed against the rest, fees, money back; the largest spends; the places
// most paid; the weekdays; the last six months. 收入: its total and the share
// kept, by day, by category, the accounts it came into, income against
// spending month by month, the largest. A period is a week, a month, a year
// or any dates; every row opens its entries.
import { h, icons, tile, pickSeg, sheet, toast, menu, empty } from '#kit/ui.mjs';
import { addDays } from '#kit/format.mjs';
import { lines, budgetState, monthDays, shiftMonth, put, drop, live } from '../lib/books.mjs';
import { catList, catOf, catName, subOf, glyph } from '../lib/cats.mjs';
import { byCat, byAccount, changes, shape, largest, places, sameplace, placeOf, daysIn, weekdays, pace, months, kept, firstDay, total } from '../lib/stats.mjs';
import { state, W, en, lang, money, plain, short, monthLabel, dayLabel, today, saved, acct, acctName, card } from '../shell.mjs';
import { entryRow } from './entry.mjs';
import { acctTile } from './pics.mjs';

const RANGES = () => [
  ['week', W('週', 'Week')],
  ['month', W('月', 'Month')],
  ['year', W('年', 'Year')],
  ['custom', W('自訂日期…', 'Custom dates…')]
];
const span = (from, to) => Math.round((Date.parse(to) - Date.parse(from)) / 86_400_000) + 1;

// The period around state.at: { from, to, label, step(n) → its `at`, unit ('day' | 'month'), prevName }.
export function periodOf(range, at, custom = state.custom) {
  if (range === 'week') {
    const wd = (new Date(`${at}T12:00:00Z`).getUTCDay() + 6) % 7;
    const from = addDays(at, -wd);
    const to = addDays(from, 6);
    return { from, to, label: `${dayLabel(from, { week: false })} – ${dayLabel(to, { week: false })}`, step: n => addDays(at, 7 * n), unit: 'day', prevName: W('上週', 'Last week') };
  }
  if (range === 'year') {
    const y = at.slice(0, 4);
    return { from: `${y}-01-01`, to: `${y}-12-31`, label: en ? y : `${y}年`, step: n => `${Number(y) + n}${at.slice(4)}`.replace(/-02-29$/, '-02-28'), unit: 'month', prevName: W('去年', 'Last year') };
  }
  if (range === 'custom' && custom?.from && custom?.to) {
    // (Any dates: the step moves the whole span; `at` is its first day.)
    const len = span(custom.from, custom.to);
    const from = at >= custom.from && at <= custom.to ? custom.from : at;
    const to = addDays(from, len - 1);
    const sameYear = from.slice(0, 4) === to.slice(0, 4) && from.slice(0, 4) === today().slice(0, 4);
    return { from, to, label: `${dayLabel(from, { week: false, year: !sameYear })} – ${dayLabel(to, { week: false, year: !sameYear })}`, step: n => addDays(from, len * n), unit: len > 62 ? 'month' : 'day', prevName: W('前一段', 'Before'), custom: len };
  }
  const ym = at.slice(0, 7);
  return { from: `${ym}-01`, to: `${ym}-${String(monthDays(ym)).padStart(2, '0')}`, label: monthLabel(ym), step: n => `${shiftMonth(ym, n)}-01`, unit: 'day', prevName: W('上月', 'Last month') };
}

// 不計入 (Jay 2026-10-30: "toggle certain things off and build the chart and
// number without them"): the categories tapped off, for this visit only.
// Every figure on the page is counted from B(), the books without them.
const skip = new Set();
const B = () => (skip.size ? { ...state.books, skip } : state.books);

export function renderStats(box) {
  const b = B();
  const now = today();
  const kind = state.kind === 'in' ? 'in' : 'out';
  const p = periodOf(state.range, state.at);
  const prev = periodOf(state.range, p.step(-1));
  const redraw = () => renderStats(box);

  // (The one whole-view switch; the period is picked from its own label.)
  const seg = pickSeg(
    [
      ['out', W('支出', 'Spending')],
      ['in', W('收入', 'Income')]
    ],
    kind,
    k => ((state.kind = k), redraw()),
    { cls: 'mn-range', label: W('支出或收入', 'Spending or income') }
  );
  const nav = h('div', { class: 'mn-period' }, [
    h('button', { class: 'mn-step', type: 'button', 'aria-label': W('上一期', 'Previous'), html: icons.chevron, onclick: () => ((state.at = p.step(-1)), redraw()) }),
    h('button', { class: 'mn-period-pick', type: 'button', 'aria-label': W('選期間', 'Choose the period'), onclick: e => pickRange(e.currentTarget, redraw) }, [h('b', { text: p.label }), h('i', { html: icons.chevron })]),
    h('button', { class: 'mn-step', type: 'button', 'aria-label': W('下一期', 'Next'), html: icons.chevron, disabled: p.to >= now ? true : null, onclick: () => ((state.at = p.step(1)), redraw()) })
  ]);

  const amt = total(b, kind, p.from, p.to);
  const before = total(b, kind, prev.from, prev.to);
  const parts = [seg, nav, skipRow(kind, p, redraw), hero(kind, p, prev, amt, before, now)];
  if (!amt) {
    parts.push(empty({ icon: 'chart', title: kind === 'in' ? W('這段時間沒有收入', 'No income in this period') : W('這段時間沒有支出', 'No spending in this period') }));
    if (kind === 'out' && state.range === 'month') parts.push(budgetCard(p.from.slice(0, 7), now, redraw));
    return box.replaceChildren(...parts.filter(Boolean));
  }
  // (The split first, the days after it on a short chart: Jay 2026-10-30, the
  // big chart of mostly empty days pushed the donut off the screen.)
  if (kind === 'out') {
    parts.push(catSection(kind, p, amt), trend(kind, p, now));
    if (state.range === 'month') parts.push(budgetCard(p.from.slice(0, 7), now, redraw));
    parts.push(changeSection(kind, p, prev), payCard(kind, p, amt), shapeCard(p), bigCard(kind, p), placeCard(kind, p));
    if (daysIn(p.from, p.to, now) >= 14) parts.push(weekCard(p, now));
    if (state.range === 'month') parts.push(monthsCard(p, now));
  } else {
    parts.push(catSection(kind, p, amt), trend(kind, p, now), payCard(kind, p, amt), inOutCard(p, now), bigCard(kind, p));
  }
  box.replaceChildren(...parts.filter(Boolean));
}

function pickRange(anchor, redraw) {
  menu(
    anchor,
    RANGES().map(([id, label]) => ({
      label,
      icon: state.range === id ? '✓' : '',
      onClick: () => {
        if (id === 'custom') return openCustom(redraw);
        state.range = id;
        redraw();
      }
    }))
  );
}
// Any dates: from and to (to never before from).
function openCustom(redraw) {
  const now = today();
  const c = state.custom?.from ? state.custom : { from: `${now.slice(0, 7)}-01`, to: now };
  const fromIn = h('input', { class: 'q-field', type: 'date', value: c.from, max: now, 'aria-label': W('從', 'From') });
  const toIn = h('input', { class: 'q-field', type: 'date', value: c.to, max: '2099-12-31', 'aria-label': W('到', 'To') });
  const row = (label, input) => h('label', { class: 'q-ritem' }, [h('span', { class: 'q-ritem-text' }, [h('span', { class: 'q-ritem-title', text: label })]), input]);
  const s = sheet({
    title: W('自訂期間', 'Custom period'),
    body: [h('div', { class: 'q-rowcard mn-dates' }, [row(W('從', 'From'), fromIn), row(W('到', 'To'), toIn)])],
    foot: h('div', { class: 'q-sheet-foot' }, [
      h('button', {
        class: 'q-btn primary block',
        type: 'button',
        text: W('看這段', 'Show'),
        onclick: () => {
          let [from, to] = [fromIn.value, toIn.value];
          if (!from || !to) return toast(W('選兩個日期', 'Pick both dates'), { tone: 'bad' });
          if (to < from) [from, to] = [to, from];
          state.custom = { from, to };
          state.range = 'custom';
          state.at = from;
          s.close();
          redraw();
        }
      })
    ])
  });
}

// The focal number: the view's own total. 支出: a day's average, against the
// period before, and (a month that's running) where it's heading. 收入: the
// share kept, beside it, never in place of the spending.
function hero(kind, p, prev, amt, before, now) {
  const b = B();
  const gone = daysIn(p.from, p.to, now);
  const diff = before ? (amt - before) / before : null;
  // (The period before is the first figure under it, so the change needs no words.)
  const vs = diff != null ? `${diff >= 0 ? '▲' : '▼'} ${Math.abs(Math.round(diff * 100))}%` : '';
  // (No period before when the books hadn't started: nothing to set it against.)
  const start = firstDay(b);
  const figs = before || (start && start <= prev.to) ? [fig(p.prevName, money(before))] : [];
  let sub;
  if (kind === 'out') {
    sub = [gone ? W(`平均每天 ${money(Math.round(amt / gone))}`, `${money(Math.round(amt / gone))} a day`) : '', vs];
    const ahead = state.range === 'month' ? pace(b, p.from.slice(0, 7), now) : null;
    if (ahead != null) figs.push(fig(W('照這速度月底', 'At this pace'), money(ahead)));
    else figs.push(fig(W('筆數', 'Entries'), plain(lines(b, p.from, p.to).filter(l => l.k === 'out' && !l.fee).length)));
  } else {
    sub = [vs];
    const out = total(b, 'out', p.from, p.to);
    const k = kept(amt, out);
    if (k != null) figs.push(fig(k >= 0 ? W('存下', 'Kept') : W('花超過收入', 'Spent beyond it'), k >= 0 ? `${Math.round(k * 100)}%` : money(out - amt), k >= 0 ? 'in' : ''));
  }
  sub = sub.filter(Boolean);
  // (One short card, as on 月曆: the total left, the figures beside it.)
  const name = kind === 'in' ? W('收入', 'Income') : W('支出', 'Spent');
  const off = skip.size ? byCat(state.books, kind, p.from, p.to).filter(c => skip.has(c.cat)).length : 0;
  return h('section', { class: 'q-focus mn-focus mn-sum' }, [
    h('div', { class: 'mn-sum-main' }, [
      h('span', { class: 'q-focus-label', text: off ? W(`${name}（不含 ${off} 類）`, `${name}, ${off} left out`) : name }),
      h('b', { class: 'q-focus-value q-fit', text: money(amt) })
    ]),
    figs.length ? h('div', { class: 'q-focus-figs mn-sum-figs' }, figs) : null,
    sub.length ? h('span', { class: 'q-focus-sub', text: sub.join(' · ') }) : null
  ]);
}
// The period's categories as chips: a tap leaves one out of every figure
// (crossed and grey), a tap again counts it back; 全部計入 counts them all.
function skipRow(kind, p, redraw) {
  const cats = byCat(state.books, kind, p.from, p.to);
  if (cats.length < 2 && !skip.size) return null;
  const chip = (label, on, onclick, color = '') =>
    h('button', { class: `mn-skip-chip${on ? '' : ' off'}`, type: 'button', 'aria-pressed': String(on), onclick }, [color ? h('i', { style: `background:${color}` }) : null, label]);
  const mine = cats.filter(c => skip.has(c.cat)).length;
  return h('div', { class: 'mn-skip', role: 'group', 'aria-label': W('計入的分類', 'Categories counted') }, [
    mine ? chip(W('全部計入', 'Count all'), true, () => (skip.clear(), redraw())) : null,
    ...cats.map(c => {
      const look = catOf(c.cat);
      return chip(catName(look, lang), !skip.has(c.cat), () => (skip.has(c.cat) ? skip.delete(c.cat) : skip.add(c.cat), redraw()), look.color);
    })
  ]);
}
const fig = (label, value, cls = '') => h('div', null, [h('small', { text: label }), h('b', { class: `num ${cls}`.trim(), text: value })]);
const head = (title, note = '') => h('div', { class: 'q-section-head' }, [h('h2', { text: title }), note ? h('span', { class: 'mn-sec-note', text: note }) : null]);
const section = (title, body, note = '') => h('section', { class: 'q-section' }, [head(title, note), body]);
const pct = (n, of) => (!of ? '' : n > 0 && n / of < 0.005 ? '<1%' : `${Math.round((n / of) * 100)}%`);
const share = (n, of, color = '') => h('span', { class: 'mn-share' }, [h('i', { style: `width:${of ? Math.max(2, Math.min(100, (n / of) * 100)) : 0}%${color ? `;background:${color}` : ''}` })]);
// A sub under its category (a way to pay under its account): one quiet line,
// its dot in the category's colour, the amount and its share of the whole.
const subRow = (name, amt, whole, color, onclick) =>
  h('button', { class: 'q-ritem chevron mn-row mn-subrow', type: 'button', onclick }, [
    color ? h('i', { class: 'mn-subdot', style: `background:${color}` }) : null,
    h('span', { class: 'mn-subname', text: name }),
    h('b', { class: 'num', text: money(amt) }),
    h('small', { class: 'num', text: pct(amt, whole) })
  ]);
const val = (amt, note) => h('span', { class: 'mn-catval' }, [h('b', { class: 'num', text: money(amt) }), note ? h('small', { class: 'num', text: note }) : null]);

// ---- Donuts --------------------------------------------------------------------------

// A sub's shade of its category's colour: the first the colour itself, each
// next one lighter (in the dark, nearer the card), so a ring of subs reads as
// one family and its rows' dots match.
const tint = (color, i, n) => (i && n > 1 ? `color-mix(in srgb, ${color} ${Math.round(100 - (i / (n - 1)) * 55)}%, var(--q-surface))` : color);

// A donut: rings of parts ({ k, amt, color }; an outer ring's part may carry
// `of`, the inner part it belongs to), a small gap between parts. A tap on a
// part (or on `pick(k)` from outside) names it in the middle and dims the
// rest; a tap again, or on the middle, goes back to the whole. `say(k)` is
// what the middle says: { name, amt, note } (k null = the whole).
function donut(rings, say, { size = 140, onpick = null } = {}) {
  const C = 50;
  const wrap = h('div', { class: 'mn-donut', style: `--d:${size}px` });
  const mid = h('button', { class: 'mn-donut-mid', type: 'button' });
  let picked = null;
  const svg = [`<svg viewBox="0 0 ${C * 2} ${C * 2}" aria-hidden="true"><g transform="rotate(-90 ${C} ${C})">`];
  for (const ring of rings) {
    const whole = ring.parts.reduce((n, x) => n + x.amt, 0);
    if (!whole) continue;
    const len = 2 * Math.PI * ring.r;
    const gap = ring.parts.filter(x => x.amt > 0).length > 1 ? Math.min(1.2, len / 200) : 0;
    let at = 0;
    for (const x of ring.parts) {
      const seg = (x.amt / whole) * len;
      const draw = Math.max(0.6, seg - gap);
      if (x.amt > 0) svg.push(`<circle cx="${C}" cy="${C}" r="${ring.r}" fill="none" stroke-width="${ring.w}" data-k="${x.of ?? x.k}" stroke-dasharray="${draw.toFixed(2)} ${(len - draw).toFixed(2)}" stroke-dashoffset="${(-at - (seg > gap ? gap / 2 : 0)).toFixed(2)}" style="stroke:${x.color}"></circle>`);
      at += seg;
    }
  }
  svg.push('</g></svg>');
  const art = h('div', { class: 'mn-donut-art', html: svg.join('') });
  const paint = () => {
    const t = say(picked);
    mid.replaceChildren(h('small', { text: t.name }), h('b', { class: `num${t.amt.length > 9 ? ' long' : ''}`, text: t.amt }), t.note ? h('span', { class: 'num', text: t.note }) : '');
    mid.setAttribute('aria-label', [t.name, t.amt, t.note].filter(Boolean).join(' '));
    wrap.classList.toggle('picked', picked != null);
    for (const el of art.querySelectorAll('circle')) el.classList.toggle('on', el.dataset.k === picked);
  };
  const pick = k => {
    picked = k == null || k === picked ? null : String(k);
    paint();
    onpick?.(picked);
  };
  art.addEventListener('click', e => {
    const k = e.target.closest?.('circle')?.dataset.k;
    if (k != null) pick(k);
  });
  mid.addEventListener('click', () => pick(null));
  wrap.append(art, mid);
  paint();
  wrap.pick = pick;
  return wrap;
}

// ---- Bars ----------------------------------------------------------------------------

// Bars, one series (the app's colour on the bar that's now or picked) or two
// side by side (income and spending); a tap names a bar's amount.
function bars(buckets, { now = '', top = '', two = false, cls = '', lead = null } = {}) {
  const max = Math.max(1, ...buckets.flatMap(x => (two ? [x.a, x.b] : [x.a])));
  const cap = h('small', { class: 'mn-trend-cap num', text: top });
  const many = buckets.length > 12;
  const height = v => `height:${v > 0 ? Math.max(3, (v / max) * 100) : 0}%`;
  const row = h(
    'div',
    { class: `mn-bars${many ? ' many' : ''}${two ? ' two' : ''}`, style: `--n:${buckets.length}` },
    buckets.map((x, i) =>
      h(
        'button',
        {
          class: `mn-bar-c${x.key === now ? ' now' : ''}`,
          type: 'button',
          'aria-label': x.say,
          onclick: e => {
            row.querySelector('.picked')?.classList.remove('picked');
            e.currentTarget.classList.add('picked');
            cap.textContent = x.say;
          }
        },
        [two ? h('span', { class: 'mn-bar-two' }, [h('i', { class: 'a', style: height(x.a) }), h('i', { class: 'b', style: height(x.b) })]) : h('i', { style: height(x.a) }), h('span', { text: !many || i === 0 || (i + 1) % 5 === 0 ? x.label : '' })]
      )
    )
  );
  return h('div', { class: `mn-trend ${cls}`.trim() }, [lead, row, cap]);
}
const monthKeys = (from, to) => {
  const out = [];
  for (let ym = from.slice(0, 7); ym <= to.slice(0, 7); ym = shiftMonth(ym, 1)) out.push(ym);
  return out;
};
const monthTick = ym => (en ? 'JFMAMJJASOND'[Number(ym.slice(5)) - 1] : String(Number(ym.slice(5))));

// The period's own bars: each day (each month of a year or a long span).
function trend(kind, p, now) {
  const byMonth = p.unit === 'month';
  const keys = byMonth ? monthKeys(p.from, p.to) : [];
  if (!byMonth) for (let d = p.from; d <= p.to; d = addDays(d, 1)) keys.push(d);
  const sum = Object.fromEntries(keys.map(k => [k, 0]));
  for (const l of lines(B(), p.from, p.to)) if (l.k === kind) sum[byMonth ? l.d.slice(0, 7) : l.d] += l.amt;
  const top = Math.max(0, ...Object.values(sum));
  return bars(
    keys.map(k => ({ key: k, a: sum[k], label: byMonth ? monthTick(k) : String(Number(k.slice(8))), say: `${byMonth ? monthLabel(k, { year: false }) : dayLabel(k)} · ${money(sum[k])}` })),
    { cls: 'short', now: byMonth ? now.slice(0, 7) : now, top: top ? W(`${byMonth ? '單月' : '單日'}最高 ${money(top)} · 點長條看金額`, `Top ${money(top)} · tap a bar`) : '' }
  );
}

// ---- By category ---------------------------------------------------------------------

// Every category, its subs under it, each with its share of the whole (Jay
// 2026-10-27: "types under categories and their percentage of total"). On top
// a donut (Jay 2026-10-30: the bars only show the trend, the split wants a
// pie): categories inside, their subs in their shades around them, the
// biggest named beside it; a tap on a slice or a name says its amount.
function catSection(kind, p, whole) {
  const cats = byCat(B(), kind, p.from, p.to, id => subOf(id)?.parent || '');
  const subs = c => (c.subs.length > 1 ? c.subs : []);
  const outer = [];
  for (const c of cats) {
    const col = catOf(c.cat).color;
    const list = subs(c);
    if (list.length) list.forEach((s, i) => outer.push({ k: `${c.cat}/${s.sub}`, of: c.cat, amt: s.amt, color: tint(col, i, list.length) }));
    else outer.push({ k: c.cat, of: c.cat, amt: c.amt, color: col });
  }
  const label = kind === 'in' ? W('收入', 'Income') : W('支出', 'Spending');
  const ring = donut(
    [
      { r: 37, w: 11, parts: cats.map(c => ({ k: c.cat, amt: c.amt, color: catOf(c.cat).color })) },
      { r: 46.5, w: 5, parts: outer }
    ],
    k => {
      const c = k && cats.find(x => x.cat === k);
      return c ? { name: catName(catOf(c.cat), lang), amt: money(c.amt), note: pct(c.amt, whole) } : { name: label, amt: money(whole), note: W(`${cats.length} 類`, `${cats.length} ${cats.length === 1 ? 'category' : 'categories'}`) };
    },
    { onpick: k => { for (const el of legend.children) el.setAttribute('aria-pressed', String(el.dataset.k === k)); } }
  );
  // (The five biggest by name; the rest as one line, their slices still in the ring.)
  const top = cats.length > 6 ? cats.slice(0, 5) : cats;
  const rest = cats.slice(top.length);
  const legend = h('div', { class: 'mn-donut-legend' }, [
    ...top.map(c => {
      const look = catOf(c.cat);
      return h('button', { type: 'button', 'data-k': c.cat, 'aria-pressed': 'false', onclick: () => ring.pick(c.cat) }, [h('i', { style: `background:${look.color}` }), h('span', { text: catName(look, lang) }), h('b', { class: 'num', text: pct(c.amt, whole) })]);
    }),
    rest.length ? h('div', { class: 'mn-donut-rest' }, [h('i'), h('span', { text: W(`其他 ${rest.length} 類`, `${rest.length} more`) }), h('b', { class: 'num', text: pct(rest.reduce((n, c) => n + c.amt, 0), whole) })]) : null
  ]);
  const rows = [];
  for (const c of cats) {
    const look = catOf(c.cat);
    rows.push(
      h('button', { class: 'q-ritem chevron mn-row mn-catrow', type: 'button', onclick: () => openCat(kind, c.cat, '', p) }, [
        tile(glyph(look.icon), look.color),
        h('span', { class: 'q-ritem-text' }, [h('span', { class: 'q-ritem-title', text: catName(look, lang) }), share(c.amt, whole, look.color)]),
        val(c.amt, pct(c.amt, whole))
      ])
    );
    // (Subs only when they split it: one line the same as its category says nothing.)
    subs(c).forEach((s, i, all) => rows.push(subRow(s.sub ? catName(subOf(s.sub), lang) : W('未分細項', 'Other'), s.amt, whole, tint(look.color, i, all.length), () => openCat(kind, c.cat, s.sub || '-', p))));
  }
  return section(kind === 'in' ? W('收入分類', 'By category') : W('分類', 'By category'), h('div', { class: 'q-rowcard mn-cats-card' }, [h('div', { class: 'mn-donut-row' }, [ring, legend]), ...rows]));
}

// What moved most against the period before (up to five).
function changeSection(kind, p, prev) {
  const list = changes(B(), kind, p, prev).slice(0, 5);
  if (!list.length || !total(B(), kind, prev.from, prev.to)) return null;
  return section(
    W(`比${p.prevName}`, `Against ${p.prevName.toLowerCase()}`),
    h(
      'div',
      { class: 'q-rowcard' },
      list.map(x => {
        const look = catOf(x.cat);
        const up = x.diff > 0;
        const note = x.before ? `${up ? '+' : '−'}${Math.abs(Math.round((x.diff / x.before) * 100))}%` : W('新', 'New');
        return h('button', { class: 'q-ritem chevron mn-row', type: 'button', onclick: () => openCat(kind, x.cat, '', p) }, [
          tile(glyph(look.icon), look.color),
          h('span', { class: 'q-ritem-text' }, [h('span', { class: 'q-ritem-title', text: catName(look, lang) }), h('small', { class: 'num', text: W(`${p.prevName} ${money(x.before)}`, `was ${money(x.before)}`) })]),
          h('span', { class: 'mn-catval' }, [h('b', { class: 'num', text: money(x.amt) }), h('small', { class: `num mn-diff ${up ? 'up' : 'down'}`, text: x.before ? `${up ? '▲' : '▼'} ${note.slice(1)}` : note })])
        ]);
      })
    )
  );
}

// ---- By account ----------------------------------------------------------------------

// Each account, each way to pay on it under it when there's more than one.
function payCard(kind, p, whole) {
  const list = byAccount(B(), kind, p.from, p.to);
  if (!list.length) return null;
  const rows = [];
  for (const x of list) {
    const a = acct(x.a);
    rows.push(
      h('button', { class: 'q-ritem chevron mn-row', type: 'button', onclick: () => openPay(kind, x.a, null, p) }, [
        acctTile(a || { kind: 'other' }),
        h('span', { class: 'q-ritem-text' }, [h('span', { class: 'q-ritem-title', text: x.a ? acctName(x.a) : W('沒有帳戶', 'No account') }), share(x.amt, whole)]),
        val(x.amt, pct(x.amt, whole))
      ])
    );
    if (x.ways.length > 1) for (const w of x.ways) rows.push(subRow(w.via ? card(w.via)?.name || W('已刪除', 'Removed') : W('帳戶扣款', 'Direct'), w.amt, whole, '', () => openPay(kind, x.a, w.via, p)));
  }
  return section(kind === 'in' ? W('入帳帳戶', 'Into') : W('付款方式', 'Paid with'), h('div', { class: 'q-rowcard' }, rows));
}

// ---- The spending's shape --------------------------------------------------------------

// Fixed (固定收支) against the rest, the fees, and what came back.
function shapeCard(p) {
  const s = shape(B(), p.from, p.to);
  if (!s.fixed && !s.fees && !s.back && !s.owed) return null;
  const cells = [
    ['fixed', W('固定', 'Fixed'), money(s.fixed), pct(s.fixed, s.total)],
    ['var', W('變動', 'Day to day'), money(s.variable), pct(s.variable, s.total)],
    s.fees ? ['fee', W('手續費', 'Fees'), money(s.fees), pct(s.fees, s.total)] : null,
    s.back || s.owed ? ['', W('退回・分攤', 'Money back'), money(s.back), s.owed ? W(`待收 ${money(s.owed)}`, `${money(s.owed)} owed`) : ''] : null
  ].filter(Boolean);
  // (A small donut: fixed, day to day and fees, each its share; a tap names one.)
  const names = { fixed: W('固定', 'Fixed'), var: W('變動', 'Day to day'), fee: W('手續費', 'Fees') };
  const amts = { fixed: s.fixed, var: s.variable, fee: s.fees };
  const ring = donut(
    [{ r: 41, w: 10, parts: ['fixed', 'var', 'fee'].map(k => ({ k, amt: amts[k], color: `var(--mn-${k})` })) }],
    k => (k ? { name: names[k], amt: money(amts[k]), note: pct(amts[k], s.total) } : { name: W('支出', 'Spending'), amt: money(s.total), note: '' }),
    { size: 112 }
  );
  return section(
    W('支出組成', 'Spending makeup'),
    h('div', { class: 'mn-shape' }, [
      ring,
      h(
        'div',
        { class: 'mn-shape-grid' },
        cells.map(([dot, label, v, note]) => h('div', null, [h('small', null, [dot ? h('i', { class: dot }) : null, label]), h('b', { class: 'num', text: v }), note ? h('span', { class: 'num', text: note }) : null]))
      )
    ])
  );
}

// The largest single ones.
function bigCard(kind, p) {
  const list = largest(B(), kind, p.from, p.to);
  if (list.length < 2) return null;
  return section(kind === 'in' ? W('最大筆收入', 'Largest') : W('最大筆支出', 'Largest spends'), h('div', { class: 'q-rowcard' }, list.map(l => entryRow(l.e, { line: l, inCat: true }))));
}

// The places paid most (a store seen twice or more).
function placeCard(kind, p) {
  const list = places(B(), kind, p.from, p.to);
  if (!list.length) return null;
  return section(
    W('常去的店', 'Places'),
    h(
      'div',
      { class: 'q-rowcard' },
      list.map(x => {
        const e = B().entries[x.ids[0]];
        const look = catOf(e?.cat);
        return h('button', { class: 'q-ritem chevron mn-row', type: 'button', onclick: () => openPlace(kind, x.name, p) }, [
          tile(glyph(look.icon), look.color),
          h('span', { class: 'q-ritem-text' }, [h('span', { class: 'q-ritem-title', text: x.name }), h('small', { class: 'num', text: W(`平均 ${plain(Math.round(x.amt / x.n))}`, `${plain(Math.round(x.amt / x.n))} each`) })]),
          val(x.amt, W(`${x.n} 次`, `${x.n}×`))
        ]);
      })
    )
  );
}

// Which weekdays cost most (the average of each over the days of it gone).
function weekCard(p, now) {
  const list = weekdays(B(), p.from, p.to, now);
  const names = en ? ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] : ['一', '二', '三', '四', '五', '六', '日'];
  const topAt = list.reduce((m, x) => (x.avg > list[m].avg ? x.wd : m), 0);
  if (!list[topAt].avg) return null;
  return section(
    W('星期幾花最多', 'By weekday'),
    bars(
      list.map(x => ({ key: x.wd, a: x.avg, label: names[x.wd], say: W(`週${names[x.wd]} 平均 ${money(x.avg)}`, `${names[x.wd]} · ${money(x.avg)} on average`) })),
      { now: topAt, top: W(`週${names[topAt]}平均最多，${money(list[topAt].avg)}`, `${names[topAt]} costs most: ${money(list[topAt].avg)} on average`), cls: 'short' }
    )
  );
}

// The last six months' spending, this one lit, with their average.
function monthsCard(p, now) {
  const ym = p.to.slice(0, 7) > now.slice(0, 7) ? now.slice(0, 7) : p.to.slice(0, 7);
  const start = firstDay(B()).slice(0, 7);
  const list = months(B(), ym, 6).filter(x => !start || x.ym >= start);
  if (list.length < 2) return null;
  const done = list.filter(x => x.ym < now.slice(0, 7));
  const avg = done.length ? Math.round(done.reduce((n, x) => n + x.out, 0) / done.length) : 0;
  return section(
    W('近幾個月', 'Recent months'),
    bars(
      list.map(x => ({ key: x.ym, a: x.out, label: monthTick(x.ym), say: `${monthLabel(x.ym)} · ${money(x.out)}` })),
      { now: ym, top: avg ? W(`過去每月平均 ${money(avg)}`, `${money(avg)} a month before this`) : '', cls: 'short' }
    )
  );
}

// Income against spending, month by month (the last six), and the share kept.
function inOutCard(p, now) {
  const ym = p.to.slice(0, 7) > now.slice(0, 7) ? now.slice(0, 7) : p.to.slice(0, 7);
  const start = firstDay(B()).slice(0, 7);
  const list = months(B(), ym, 6).filter(x => !start || x.ym >= start);
  if (!list.length) return null;
  const inc = list.reduce((n, x) => n + x.in, 0);
  const out = list.reduce((n, x) => n + x.out, 0);
  const k = kept(inc, out);
  return section(
    W('收入與支出', 'Income and spending'),
    bars(
      list.map(x => ({ key: x.ym, a: x.in, b: x.out, label: monthTick(x.ym), say: W(`${monthLabel(x.ym)} 收入 ${short(x.in)} · 支出 ${short(x.out)}`, `${monthLabel(x.ym)} in ${short(x.in)} · out ${short(x.out)}`) })),
      {
        now: ym,
        two: true,
        cls: 'short',
        lead: h('div', { class: 'mn-legend' }, [h('span', null, [h('i', { class: 'a' }), W('收入', 'Income')]), h('span', null, [h('i', { class: 'b' }), W('支出', 'Spending')])]),
        top: k != null ? (k >= 0 ? W(`這幾個月存下 ${Math.round(k * 100)}%`, `${Math.round(k * 100)}% kept over these months`) : W(`這幾個月花超過收入 ${money(out - inc)}`, `${money(out - inc)} more spent than earned`)) : ''
      }
    )
  );
}

// ---- Drilling down -------------------------------------------------------------------

const newest = (a, b) => b.d.localeCompare(a.d) || (b.e.t || 0) - (a.e.t || 0);

// A category's (or one sub's: `sub`, '-' for none) entries: its last twelve
// months as bars, its subs (each its share, tapped to show only its own;
// tapped again for all), then the entries.
function openCat(kind, cat, sub, p) {
  const c = catOf(cat);
  const subKey = l => (subOf(l.sub)?.parent === cat ? l.sub : '');
  const mine = lines(B(), p.from, p.to).filter(l => l.k === kind && l.cat === cat);
  const list = mine.sort(newest);
  const whole = mine.reduce((n, l) => n + l.amt, 0);
  const by = new Map();
  for (const l of mine) by.set(subKey(l), (by.get(subKey(l)) || 0) + l.amt);
  let only = sub ? (sub === '-' ? '' : sub) : null;
  const rows = h('div', { class: 'q-rowcard' });
  const paint = () => rows.replaceChildren(...list.filter(l => only === null || subKey(l) === only).map(l => entryRow(l.e, { day: true, inCat: true, line: l })));
  const parts = [...by].sort((a, b) => b[1] - a[1]);
  const color = k => tint(c.color, parts.findIndex(x => x[0] === k), parts.length);
  // (Its subs as a donut too; a tap on a slice shows only that sub's entries.)
  const setOnly = k => {
    only = k;
    for (const el of split.children) el.setAttribute('aria-pressed', String(only !== null && el.dataset.k === only));
    paint();
  };
  const ring =
    parts.length > 1
      ? donut(
          [{ r: 40, w: 12, parts: parts.map(([k, amt]) => ({ k, amt, color: color(k) })) }],
          k => (k != null ? { name: k ? catName(subOf(k), lang) : W('未分細項', 'Other'), amt: money(by.get(k) || 0), note: pct(by.get(k) || 0, whole) } : { name: catName(c, lang), amt: money(whole), note: W(`${parts.length} 項`, `${parts.length} kinds`) }),
          { size: 150, onpick: k => setOnly(k) }
        )
      : null;
  const split =
    parts.length > 1
      ? h(
          'div',
          { class: 'q-rowcard mn-subsplit' },
          parts.map(([k, amt]) =>
            h(
              'button',
              {
                class: 'q-ritem mn-row mn-catrow',
                type: 'button',
                'data-k': k,
                'aria-pressed': String(only === k),
                onclick: () => ring.pick(k)
              },
              [h('span', { class: 'q-ritem-text' }, [h('span', { class: 'q-ritem-title', text: k ? catName(subOf(k), lang) : W('未分細項', 'Other') }), share(amt, whole, color(k))]), val(amt, pct(amt, whole))]
            )
          )
        )
      : null;
  // (Its months: the period's last month and the eleven before, from when the books start.)
  const ym = p.to.slice(0, 7) > today().slice(0, 7) ? today().slice(0, 7) : p.to.slice(0, 7);
  const start = firstDay(B()).slice(0, 7);
  const ms = months(B(), ym, 12, { cat, sub: sub && sub !== '-' ? sub : '', kind }).filter(x => !start || x.ym >= start);
  const done = ms.filter(x => x.ym < today().slice(0, 7));
  const avg = done.length ? Math.round(done.reduce((n, x) => n + x[kind], 0) / done.length) : 0;
  // (Only when it has a trend to show: two months or more with some.)
  const chart = ms.filter(x => x[kind]).length > 1 ? bars(ms.map(x => ({ key: x.ym, a: x[kind], label: monthTick(x.ym), say: `${monthLabel(x.ym)} · ${money(x[kind])}` })), { now: ym, top: avg ? W(`每月平均 ${money(avg)}`, `${money(avg)} a month on average`) : '', cls: 'short mn-in-sheet' }) : null;
  paint();
  if (ring && only !== null) ring.pick(only);
  const title = sub && sub !== '-' ? `${catName(c, lang)} › ${catName(subOf(sub), lang)}` : catName(c, lang);
  sheet({ title, subtitle: `${p.label} · ${money(only === null ? whole : by.get(only) || 0)}`, detent: 'large', body: [chart, ring ? h('div', { class: 'mn-donut-sheet' }, [ring]) : null, split, rows] });
}

// An account's (or one way to pay's) entries in the period.
function openPay(kind, a, via, p) {
  const list = lines(B(), p.from, p.to)
    .filter(l => l.k === kind && (l.e.a === a || (l.e.also || []).some(x => x.a === a)) && (via == null || (l.e.a === a && (l.e.via || '') === via)))
    .sort(newest);
  const sum = byAccount(B(), kind, p.from, p.to).find(x => x.a === a);
  const amt = via == null ? sum?.amt || 0 : sum?.ways.find(w => w.via === via)?.amt || 0;
  const name = via ? card(via)?.name || '' : a ? acctName(a) : W('沒有帳戶', 'No account');
  sheet({ title: name, subtitle: `${p.label} · ${money(amt)}`, detent: 'large', body: [h('div', { class: 'q-rowcard' }, list.map(l => entryRow(l.e, { day: true, inAcct: true, line: l })))] });
}

// A place's entries in the period.
function openPlace(kind, name, p) {
  const list = lines(B(), p.from, p.to)
    .filter(l => l.k === kind && !l.fee && sameplace(placeOf(l.e), name))
    .sort(newest);
  sheet({ title: name, subtitle: `${p.label} · ${money(list.reduce((n, l) => n + l.amt, 0))}`, detent: 'large', body: [h('div', { class: 'q-rowcard' }, list.map(l => entryRow(l.e, { day: true, line: l })))] });
}

// ---- Budgets ----------------------------------------------------------------------

function budgetCard(ym, now, redraw) {
  const list = budgetState(state.books, ym, now);
  const edit = h('button', { type: 'button', text: W('編輯', 'Edit'), onclick: () => openBudgets(redraw) });
  // (None set: nothing here; 預算 waits in 更多 until there's one. Jay 2026-10-27: "I don't use it and it's bothering me".)
  if (!list.length) return null;
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
          c ? tile(glyph(c.icon), c.color) : tile(glyph('target'), '#8e8e93'),
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

export function openBudgets(redraw = () => {}) {
  const b = state.books;
  const have = Object.fromEntries(live(b.budgets).map(x => [x.cat, x]));
  const rows = [{ cat: '', name: W('每月總預算', 'Monthly budget'), icon: 'target', color: '#8e8e93' }, ...catList('out').map(c => ({ cat: c.id, name: catName(c, lang), icon: c.icon, color: c.color }))];
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
