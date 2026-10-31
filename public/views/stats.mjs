// 統計: where the money went, and where it came from, as two views that are
// never netted (Jay 2026-10-27: a high income would hide high spending), on
// one page (Jay 2026-10-30): the scale (週 月 年 自訂) on top, the card with
// the period picked and its periods as bars to tap, then that period's
// categories (each opens with its own bars on the scale), what changed, the
// budget, what paid, each day, the largest, places, weekdays and the makeup.
// 篩選 leaves categories or subs out of every figure.
import { h, icons, tile, pickSeg, sheet, toast, menu, empty, toggle } from '#kit/ui.mjs';
import { addDays } from '#kit/format.mjs';
import { lines, budgetState, monthDays, shiftMonth, put, drop, live } from '../lib/books.mjs';
import { catList, catOf, catName, subOf, glyph } from '../lib/cats.mjs';
import { byCat, byAccount, changes, shape, largest, places, sameplace, placeOf, daysIn, weekdays, pace, months, kept, firstDay, total, trendOf, periodKey } from '../lib/stats.mjs';
import { state, W, en, lang, money, plain, short, monthLabel, dayLabel, today, saved, acct, acctName, card } from '../shell.mjs';
import { entryRow } from './entry.mjs';
import { acctTile } from './pics.mjs';

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

// 篩選 (Jay 2026-10-30: "toggle certain things off and build the chart and
// number without them… it also should work down to sub type"): the
// categories and subs turned off, for this visit only. Every figure on the
// page is counted from B(), the books without them. A sub is left out by its
// id, a category's entries with none by `<cat>/-`.
const skip = new Set();
const B = () => (skip.size ? { ...state.books, skip } : state.books);
const offKey = s => s.sub || `${s.cat}/-`;

// ---- The page --------------------------------------------------------------------------
// One page that reads top down (Jay 2026-10-30: the five kinds felt "weird
// and forced"; good money apps do it this way): the scale (週 月 年 自訂) is
// the main control; the card shows the period picked, its total and how it
// compares, and the periods before it as bars: a tap on one picks it (swipe
// back for older ones). Everything under the card is that period: its
// categories (a tap opens one, with its own bars on the same scale), what
// changed, the budget, what paid, each day, and the habits. 支出 and 收入 are
// two views, never netted; 篩選 leaves categories or subs out of all of it.
export function renderStats(box) {
  const now = today();
  const kind = state.kind === 'in' ? 'in' : 'out';
  if (!['week', 'month', 'year', 'custom'].includes(state.range) || (state.range === 'custom' && !state.custom)) state.range = 'month';
  const p = periodOf(state.range, state.at);
  const prev = periodOf(state.range, p.step(-1));
  const redraw = () => renderStats(box);

  const scale = pickSeg(
    [
      ['week', W('週', 'Week')],
      ['month', W('月', 'Month')],
      ['year', W('年', 'Year')],
      ['custom', W('自訂', 'Dates')]
    ],
    state.range,
    r => (r === 'custom' ? openCustom(redraw) : ((state.range = r), (state.barEnd = null), (state.at = state.at > now ? now : state.at), redraw())),
    { cls: 'mn-range', label: W('期間', 'Period') }
  );
  const kinds = pickSeg(
    [
      ['out', W('支出', 'Spending')],
      ['in', W('收入', 'Income')]
    ],
    kind,
    k => ((state.kind = k), redraw()),
    { chips: true, cls: 'mn-kind', label: W('支出或收入', 'Spending or income') }
  );
  const filter = h('button', { class: `mn-filter${skip.size ? ' on' : ''}`, type: 'button', 'aria-label': W('篩選分類', 'Filter categories'), onclick: () => openFilter(kind, p, redraw) }, [
    h('i', { html: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M4 7h16M7 12h10M10 17h4"/></svg>' }),
    skip.size ? W(`不含 ${skip.size} 項`, `${skip.size} off`) : W('篩選', 'Filter')
  ]);
  const bar = h('div', { class: 'mn-toolbar' }, [kinds, filter]);

  const amt = total(B(), kind, p.from, p.to);
  const parts = [scale, bar, hero(kind, p, prev, amt, now, redraw)];
  if (!amt) {
    parts.push(empty({ icon: 'chart', title: kind === 'in' ? W('這段時間沒有收入', 'No income in this period') : W('這段時間沒有支出', 'No spending in this period'), body: skip.size ? W('有些分類被篩掉了', 'Some categories are filtered out') : '' }));
    if (kind === 'out' && state.range === 'month') parts.push(budgetCard(p.from.slice(0, 7), now, redraw));
    return box.replaceChildren(...parts.filter(Boolean));
  }
  if (kind === 'out') {
    parts.push(catSection(kind, p, amt), changeSection(kind, p, prev));
    if (state.range === 'month') parts.push(budgetCard(p.from.slice(0, 7), now, redraw));
    parts.push(payCard(kind, p, amt), dayCard(kind, p, now), bigCard(kind, p), placeCard(kind, p));
    if (daysIn(p.from, p.to, now) >= 14) parts.push(weekCard(p, now));
    parts.push(shapeCard(p));
  } else {
    parts.push(catSection(kind, p, amt), dayCard(kind, p, now), payCard(kind, p, amt), inOutCard(p, now), bigCard(kind, p));
  }
  box.replaceChildren(...parts.filter(Boolean));
}

// Any dates: from and to (to never before from). Closed without picking,
// the page goes back to the scale it had.
function openCustom(redraw) {
  const now = today();
  const c = state.custom?.from ? state.custom : { from: `${now.slice(0, 7)}-01`, to: now };
  const fromIn = h('input', { class: 'q-field', type: 'date', value: c.from, max: now, 'aria-label': W('從', 'From') });
  const toIn = h('input', { class: 'q-field', type: 'date', value: c.to, max: '2099-12-31', 'aria-label': W('到', 'To') });
  const row = (label, input) => h('label', { class: 'q-ritem' }, [h('span', { class: 'q-ritem-text' }, [h('span', { class: 'q-ritem-title', text: label })]), input]);
  const s = sheet({
    title: W('自訂期間', 'Custom period'),
    onClose: redraw,
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
        }
      })
    ])
  });
}

// The scale's periods for the card's bars: twelve (fewer when the books are
// newer, but six at least), ending now unless moved back with ‹ or a swipe,
// and always holding the period picked. { unit, from, to, older, newer }.
const keyStart = (unit, k) => (unit === 'year' ? `${k}-01-01` : unit === 'month' ? `${k}-01` : k);
const keyStep = (unit, k, n) => (unit === 'year' ? String(Number(k) + n) : unit === 'month' ? shiftMonth(k, n) : addDays(k, 7 * n));
function windowOf(range, p, now) {
  const unit = range === 'week' ? 'week' : range === 'year' ? 'year' : 'month';
  const nowKey = periodKey(unit, now);
  const firstKey = periodKey(unit, firstDay(state.books) || now);
  const on = periodKey(unit, p.from);
  let end = periodKey(unit, state.barEnd && state.barEnd < now ? state.barEnd : now);
  if (on > end) end = on > nowKey ? nowKey : on;
  if (on < keyStep(unit, end, -11)) end = keyStep(unit, on, 11) > nowKey ? nowKey : keyStep(unit, on, 11);
  let start = keyStep(unit, end, -11);
  const least = keyStep(unit, end, -5);
  if (start < firstKey) start = firstKey < least ? firstKey : least;
  const to = keyStep(unit, end, 1) > nowKey ? now : addDays(keyStart(unit, keyStep(unit, end, 1)), -1);
  return { unit, from: keyStart(unit, start), to, start, end, older: firstKey < start, newer: end < nowKey };
}

// The card: the period, its total, against the one before and (a month that's
// running) where it's heading; under it the bars of the periods, the picked
// one lit, the average of the finished ones as a dashed line.
function hero(kind, p, prev, amt, now, redraw) {
  const b = B();
  const before = total(b, kind, prev.from, prev.to);
  const gone = daysIn(p.from, p.to, now);
  const start = firstDay(state.books);
  const name = kind === 'in' ? W('收入', 'income') : W('支出', 'spent');
  // (Beside the total, as 月曆's card: against the period before, a day's
  // average and where a running month is heading; the value is the line's
  // own, so it reads at a glance, Jay 2026-10-31.)
  const figs = [];
  if (before || (start && start <= prev.to)) {
    const diff = before ? Math.round(((amt - before) / before) * 100) : null;
    figs.push(diff == null ? fig(W(`比${p.prevName}`, `vs ${p.prevName.toLowerCase()}`), W('新', 'New')) : fig(W(`比${p.prevName}`, `vs ${p.prevName.toLowerCase()}`), `${diff >= 0 ? '▲' : '▼'}${Math.abs(diff)}%`));
  }
  if (kind === 'out') {
    // (A running month's heading first; else a day's average.)
    const end = state.range === 'month' ? pace(b, p.from.slice(0, 7), now) : null;
    if (end != null && end !== amt) figs.push(fig(W('照這速度月底', 'By month end'), money(end)));
    else if (gone > 1) figs.push(fig(W('平均每天', 'A day'), money(Math.round(amt / gone))));
  } else {
    const k = kept(amt, total(b, 'out', p.from, p.to));
    if (k != null) figs.push(fig(W('存下', 'Kept'), k >= 0 ? `${Math.round(k * 100)}%` : W('花超過', 'Over'), k >= 0 ? 'in' : ''));
  }
  const label = state.range === 'custom'
    ? h('button', { class: 'q-focus-label mn-hero-pick', type: 'button', onclick: () => openCustom(redraw) }, [`${p.label} ${name}`, h('i', { html: icons.chevron })])
    : h('span', { class: 'q-focus-label', text: W(`${p.label}${name}`, `${p.label} · ${name}`) });
  return h('section', { class: 'q-focus mn-focus mn-sum mn-hero' }, [
    h('div', { class: 'mn-sum-main' }, [label, h('b', { class: 'q-focus-value q-fit', text: money(amt) })]),
    figs.length ? h('div', { class: 'q-focus-figs mn-sum-figs' }, figs.slice(0, 2)) : null,
    state.range === 'custom' ? null : periodBars(kind, p, now, redraw)
  ]);
}

// The periods as bars in the card, the newest at the right; a tap picks one.
function periodBars(kind, p, now, redraw) {
  const w = windowOf(state.range, p, now);
  const list = trendOf(B(), kind, w.from, w.to, w.unit);
  // (One period with anything in it compares with nothing: no chart, Jay 2026-10-31.)
  if (list.filter(x => x.amt > 0).length < 2 && !w.older) return null;
  const cur = periodKey(w.unit, now);
  const on = periodKey(w.unit, p.from);
  const max = Math.max(1, ...list.map(x => x.amt));
  const done = list.filter(x => x.key < cur && x.key >= periodKey(w.unit, firstDay(state.books) || now));
  const avg = done.length ? done.reduce((n, x) => n + x.amt, 0) / done.length : 0;
  const tick = k => (w.unit === 'year' ? k : w.unit === 'month' ? (en ? MONTHS3[Number(k.slice(5)) - 1] : `${Number(k.slice(5))}月`) : `${Number(k.slice(5, 7))}/${Number(k.slice(8))}`);
  const say = x => `${w.unit === 'year' ? (en ? x.key : `${x.key}年`) : w.unit === 'month' ? monthLabel(x.key) : W(`${dayLabel(x.key, { week: false })}那週`, `Week of ${dayLabel(x.key, { week: false })}`)} · ${money(x.amt)}`;
  // (Every label when they fit; else every other month, every third week.)
  const every = list.length <= 7 ? 1 : w.unit === 'week' ? 3 : w.unit === 'month' ? 2 : 1;
  const cols = list.map((x, i) =>
    h('button', { class: `mn-pbar${x.key === on ? ' on' : ''}${x.key === cur ? ' now' : ''}`, type: 'button', 'aria-label': say(x), 'aria-pressed': String(x.key === on), onclick: () => {
      state.at = x.key === cur ? now : keyStart(w.unit, x.key);
      state.barEnd = keyStart(w.unit, w.end);
      redraw();
    } }, [h('span', { class: 'mn-pbar-col' }, [h('i', { style: `height:${x.amt > 0 ? Math.max(4, (x.amt / max) * 100) : 0}%` })]), h('small', { text: (list.length - 1 - i) % every ? '' : tick(x.key) })])
  );
  const row = h('div', { class: 'mn-pbars', style: `--n:${list.length}` }, [
    ...cols,
    avg ? h('span', { class: 'mn-pbar-avg', style: `bottom:calc(16px + (100% - 16px) * ${(avg / max).toFixed(3)})` }, [h('small', { class: 'num', text: W(`平均 ${short(Math.round(avg))}`, `avg ${short(Math.round(avg))}`) })]) : null
  ]);
  // (Older ones: ‹ or a swipe to the right moves the bars back six and picks the
  // newest of them; › forward.)
  const move = n => {
    if ((n < 0 && !w.older) || (n > 0 && !w.newer)) return;
    // (The newest of the moved bars is picked, so the page shows what's in view.)
    const end = keyStep(w.unit, w.end, n * 6);
    state.at = end === periodKey(w.unit, now) ? now : keyStart(w.unit, end);
    state.barEnd = state.at;
    redraw();
  };
  let x0 = null;
  row.addEventListener('touchstart', e => (x0 = e.touches[0].clientX), { passive: true });
  row.addEventListener('touchend', e => {
    const dx = x0 == null ? 0 : e.changedTouches[0].clientX - x0;
    x0 = null;
    if (Math.abs(dx) > 50) move(dx > 0 ? -1 : 1);
  });
  const arrow = (n, ok, label) => h('button', { class: `mn-pbars-step${n < 0 ? ' back' : ''}`, type: 'button', 'aria-label': label, disabled: ok ? null : true, html: icons.chevron, onclick: () => move(n) });
  return h('div', { class: 'mn-pbars-box' }, [h('div', { class: 'mn-pbars-row' }, [arrow(-1, w.older, W('更早', 'Earlier')), row, arrow(1, w.newer, W('較近', 'Later'))])]);
}

// 篩選: every category of the card's span and its subs, each with a switch;
// the page behind recounts at once. A category off greys its subs.
function openFilter(kind, p, redraw) {
  const now = today();
  const w = state.range === 'custom' ? p : windowOf(state.range, p, now);
  const cats = byCat(state.books, kind, w.from, state.range === 'custom' ? p.to : now, id => subOf(id)?.parent || '');
  if (!cats.length) return toast(W('這段時間沒有可篩的分類', 'Nothing to filter here'));
  const groups = cats.map(c => {
    const look = catOf(c.cat);
    const g = h('div', { class: `mn-filter-group${skip.has(c.cat) ? ' off' : ''}` });
    const row = (name, key, icon, sub = false) =>
      h('div', { class: `q-ritem mn-row${sub ? ' mn-skip-sub' : ''}` }, [
        icon,
        h('span', { class: 'q-ritem-text' }, [h('span', { class: 'q-ritem-title', text: name })]),
        toggle({ checked: !skip.has(key), label: name, onChange: on => (on ? skip.delete(key) : skip.add(key), sub || g.classList.toggle('off', !on), redraw()) })
      ]);
    g.append(row(catName(look, lang), c.cat, tile(glyph(look.icon), look.color)));
    if (c.subs.length > 1) c.subs.forEach((x, i, all) => g.append(row(x.sub ? catName(subOf(x.sub), lang) : W('未分細項', 'Other'), offKey({ cat: c.cat, sub: x.sub }), h('i', { class: 'mn-subdot', style: `background:${tint(look.color, i, all.length)}` }), true)));
    return g;
  });
  const s = sheet({
    title: W('篩選', 'Filter'),
    subtitle: W('關掉的不算進任何數字和圖', 'What is off is left out of every figure'),
    detent: 'large',
    lead: skip.size ? h('button', { class: 'q-btn tinted small mn-filter-all', type: 'button', text: W('全部計入', 'Count all'), onclick: () => (skip.clear(), redraw(), s.close()) }) : null,
    body: [h('div', { class: 'q-rowcard mn-filter-list' }, groups)]
  });
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
const MONTHS3 = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const monthTick = ym => (en ? 'JFMAMJJASOND'[Number(ym.slice(5)) - 1] : String(Number(ym.slice(5))));

// Inside the period: each day (each month of a year or a long span).
function dayCard(kind, p, now) {
  const byMonth = p.unit === 'month';
  const keys = byMonth ? monthKeys(p.from, p.to) : [];
  if (!byMonth) for (let d = p.from; d <= p.to; d = addDays(d, 1)) keys.push(d);
  const sum = Object.fromEntries(keys.map(k => [k, 0]));
  for (const l of lines(B(), p.from, p.to)) if (l.k === kind) sum[byMonth ? l.d.slice(0, 7) : l.d] += l.amt;
  const top = Math.max(0, ...Object.values(sum));
  if (keys.length < 2) return null;
  return section(
    byMonth ? W('每個月', 'Each month') : W('每一天', 'Each day'),
    bars(
      keys.map(k => ({ key: k, a: sum[k], label: byMonth ? monthTick(k) : String(Number(k.slice(8))), say: `${byMonth ? monthLabel(k, { year: false }) : dayLabel(k)} · ${money(sum[k])}` })),
      { cls: 'short', now: byMonth ? now.slice(0, 7) : now, top: top ? W(`${byMonth ? '單月' : '單日'}最高 ${money(top)} · 點長條看金額`, `Top ${money(top)} · tap a bar`) : '' }
    )
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
    { size: 120, onpick: k => { for (const el of legend.children) el.setAttribute('aria-pressed', String(el.dataset.k === k)); } }
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
function inOutCard(p, now, n = 6) {
  const ym = p.to.slice(0, 7) > now.slice(0, 7) ? now.slice(0, 7) : p.to.slice(0, 7);
  const start = firstDay(B()).slice(0, 7);
  const list = months(B(), ym, n).filter(x => !start || x.ym >= start);
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
  // (Its own bars on the page's scale, from when the books start; the
  // period picked lit. Only when it has a trend: two periods or more with some.)
  const now = today();
  const w = state.range === 'custom' ? null : windowOf(state.range, p, now);
  let chart = null;
  if (w) {
    const subKeyOk = l => !sub || (sub === '-' ? !subKey(l) : l.sub === sub);
    const list = trendOf(B(), kind, w.from, w.to, w.unit, l => l.cat === cat && subKeyOk(l)).filter(x => x.key >= periodKey(w.unit, firstDay(state.books) || now));
    const cur = periodKey(w.unit, now);
    const done = list.filter(x => x.key < cur);
    const avg = done.length ? Math.round(done.reduce((n, x) => n + x.amt, 0) / done.length) : 0;
    const name = k => (w.unit === 'year' ? (en ? k : `${k}年`) : w.unit === 'month' ? monthLabel(k) : W(`${dayLabel(k, { week: false })}那週`, `Week of ${dayLabel(k, { week: false })}`));
    const unitName = { week: W('每週', 'a week'), month: W('每月', 'a month'), year: W('每年', 'a year') }[w.unit];
    if (list.filter(x => x.amt).length > 1)
      chart = bars(list.slice(-12).map(x => ({ key: x.key, a: x.amt, label: w.unit === 'year' ? x.key : w.unit === 'month' ? monthTick(x.key) : `${Number(x.key.slice(8))}`, say: `${name(x.key)} · ${money(x.amt)}` })), { now: periodKey(w.unit, p.from), top: avg ? W(`${unitName}平均 ${money(avg)}`, `${money(avg)} ${unitName} on average`) : '', cls: 'short mn-in-sheet' });
  }
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
