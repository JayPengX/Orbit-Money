// 月曆, the home: the month's spending (and its budget) on top,
// the month with each day's spending under its date, the days over the
// budget's daily share in the accent,
// (holidays and typhoon days off in red, as a Taiwan calendar has them),
// and the picked day's entries under it. A swipe across the month goes to
// the next or the last.
import { h, icons, menu } from '#kit/ui.mjs';
import { dayOffAt, myPlace } from '#kit/dayoff.mjs';
import { monthByDay, monthTotals, monthDays, shiftMonth, entriesOn, budgetState } from '../lib/books.mjs';
import { state, W, en, money, short, monthLabel, dayLabel, today } from '../shell.mjs';
import { entryRow, openEntry } from './entry.mjs';

const WEEK = en ? ['S', 'M', 'T', 'W', 'T', 'F', 'S'] : ['日', '一', '二', '三', '四', '五', '六'];

function goMonth(n, to = null) {
  state.month = to || shiftMonth(state.month, n);
  // The day picked moves with it: today in this month, else its 1st.
  state.day = today().startsWith(state.month) ? today() : `${state.month}-01`;
  render();
}
let render = () => {};
// The month label: the last year's months to jump to, this one ticked.
function pickMonth(anchor) {
  const cur = today().slice(0, 7);
  const months = Array.from({ length: 12 }, (_, i) => shiftMonth(cur, -i));
  menu(anchor, months.map(m => ({ label: monthLabel(m), icon: m === state.month ? '✓' : '', onClick: () => goMonth(0, m) })));
}

export function renderCal(box) {
  render = () => renderCal(box);
  const b = state.books;
  const ym = state.month;
  const t = monthTotals(b, ym);
  const days = monthByDay(b, ym);
  const now = today();
  const budget = budgetState(b, ym, now).find(x => !x.cat);
  const place = myPlace('work');

  // The focal point, on its card: the month's spending, a thin bar
  // for the budget with what's left under it, then income and what's left
  // over as two quiet figures (記一筆 is the round button beside the tabs).
  const hero = h('section', { class: 'q-focus mn-focus' }, [
    h('span', { class: 'q-focus-label', text: W(`${monthLabel(ym, { year: false })}支出`, `Spent in ${monthLabel(ym, { year: false })}`) }),
    h('b', { class: 'q-focus-value q-fit', text: money(t.out) }),
    budget ? h('div', { class: `q-focus-bar${budget.left < 0 ? ' over' : ''}`, role: 'progressbar', 'aria-valuenow': String(Math.round(budget.share * 100)) }, [h('i', { style: `width:${Math.min(100, budget.share * 100)}%` })]) : null,
    budget
      ? h('span', { class: 'q-focus-sub', text: budget.left >= 0 ? (budget.perDay && now.startsWith(ym) ? W(`預算還剩 ${money(budget.left)}，每天 ${money(budget.perDay)}`, `${money(budget.left)} left, ${money(budget.perDay)} a day`) : W(`預算還剩 ${money(budget.left)}`, `${money(budget.left)} left`)) : W(`超出預算 ${money(-budget.left)}`, `${money(-budget.left)} over budget`) })
      : null,
    h('div', { class: 'q-focus-figs' }, [fig(W('收入', 'Income'), money(t.in)), fig(W('結餘', 'Left'), money(t.net, { sign: true }), t.net > 0 ? 'in' : '')])
  ]);

  // The month's few big days show their amount in the accent: over twice
  // the budget's daily share (no budget: twice the daily average), and only
  // the five biggest of those, so the colour still points at something.
  const share = budget ? budget.amt / monthDays(ym) : t.out / Math.max(1, Object.keys(days).length);
  const big = Object.entries(days).filter(([, v]) => v.out > 2 * share).sort((x, y) => y[1].out - x[1].out).slice(0, 5);
  const loud = new Set(big.map(([d]) => d));

  // The month: each day's spending under its date.
  const n = monthDays(ym);
  const offset = new Date(`${ym}-01T12:00:00Z`).getUTCDay();
  const cells = [];
  for (let d = 1; d <= n; d++) {
    const day = `${ym}-${String(d).padStart(2, '0')}`;
    const v = days[day];
    const off = dayOffAt(day, place);
    const cls = ['mn-day', off && 'off', day === now && 'today', day === state.day && 'on', day > now && 'later', loud.has(day) && 'loud'].filter(Boolean).join(' ');
    const btn = h('button', { class: cls, type: 'button', 'aria-label': `${dayLabel(day)}${v?.out ? ` ${money(v.out)}` : ''}`, 'aria-pressed': String(day === state.day), 'data-day': day, onclick: () => pickDay(day) }, [
      h('b', { text: String(d) }),
      v?.out ? h('small', { class: 'num out', text: short(v.out) }) : v?.in ? h('small', { class: 'num in', text: `+${short(v.in)}` }) : h('small', { text: '' })
    ]);
    if (d === 1) btn.style.gridColumnStart = String(offset + 1);
    cells.push(btn);
  }
  const step = (dir, label) => h('button', { class: 'mn-step', type: 'button', 'aria-label': label, html: icons.chevron, onclick: () => goMonth(dir) });
  const calHead = h('div', { class: 'mn-cal-head' }, [
    h('button', { class: 'mn-month', type: 'button', onclick: e => pickMonth(e.currentTarget) }, [monthLabel(ym), h('i', { html: icons.chevron })]),
    h('span', { class: 'mn-cal-steps' }, [step(-1, W('上個月', 'Previous month')), step(1, W('下個月', 'Next month'))])
  ]);
  const grid = h('div', { class: 'mn-cal' }, [...WEEK.map((w, i) => h('span', { class: `mn-w${i === 0 || i === 6 ? ' off' : ''}`, text: w })), ...cells]);
  swipe(grid);

  // A day picked: its square and the list under the month, the rest left as it is.
  let daySec = daySection(b, place);
  const pickDay = day => {
    state.day = day;
    for (const c of grid.querySelectorAll('.mn-day')) {
      const on = c.dataset.day === day;
      c.classList.toggle('on', on);
      c.setAttribute('aria-pressed', String(on));
    }
    const next = daySection(b, place);
    daySec.replaceWith(next);
    daySec = next;
  };

  box.replaceChildren(hero, h('div', { class: 'mn-cal-card' }, [calHead, grid]), daySec);
}

// The picked day: its total and its entries, with a row to add one.
function daySection(b, place) {
  const list = entriesOn(b, state.day);
  const dayOut = list.filter(e => e.k === 'out').reduce((s, e) => s + e.amt, 0);
  const dayIn = list.filter(e => e.k === 'in').reduce((s, e) => s + e.amt, 0);
  const off = dayOffAt(state.day, place);
  const head = h('div', { class: 'mn-dayhead' }, [
    h('div', { class: 'mn-dayhead-t' }, [h('h2', { text: dayLabel(state.day) }), off && off.kind !== 'weekend' ? h('small', { class: 'mn-holiday', text: en ? off.en : off.zh }) : null]),
    h('span', { class: 'num mn-daysum' }, [dayIn ? h('em', { text: `+${money(dayIn)}` }) : null, dayOut ? h('b', { text: money(dayOut) }) : null])
  ]);
  // (One layout either way: a day with nothing has the same card, saying so.)
  const addRow = h('button', { class: 'q-ritem mn-addrow', type: 'button', onclick: () => openEntry({ day: state.day }) }, [h('span', { class: 'mn-addrow-i', html: icons.plus }), h('span', { class: 'q-ritem-text' }, [h('span', { class: 'q-ritem-title', text: list.length ? W('再記一筆', 'Add another') : W('這天還沒記帳', 'Nothing yet this day') })])]);
  const body = h('div', { class: 'q-rowcard mn-entries' }, [...list.map(e => entryRow(e)), addRow]);

  return h('section', { class: 'mn-day-sec' }, [head, body]);
}

const fig = (label, value, cls = '') => h('div', null, [h('small', { text: label }), h('b', { class: `num ${cls}`.trim(), text: value })]);

// A finger across the month: the next month (left) or the last (right).
function swipe(el) {
  let x0 = null;
  let y0 = 0;
  el.addEventListener('touchstart', e => ((x0 = e.touches[0].clientX), (y0 = e.touches[0].clientY)), { passive: true });
  el.addEventListener('touchend', e => {
    if (x0 == null) return;
    const dx = e.changedTouches[0].clientX - x0;
    const dy = e.changedTouches[0].clientY - y0;
    x0 = null;
    if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) goMonth(dx < 0 ? 1 : -1);
  });
}
