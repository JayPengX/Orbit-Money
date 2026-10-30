// 月曆, the home: the month's spending (and its budget) on a short card,
// the picked day's week (or, opened, the month) with each day's spending
// under its date, the days over the budget's daily share in the accent,
// (holidays and typhoon days off in red, as a Taiwan calendar has them),
// and the picked day's entries under it. A swipe across the month goes to
// the next or the last; the picked day's entries sit right under it.
import { h, icons, menu, tile } from '#kit/ui.mjs';
import { notifyOn } from '#kit/orbit.mjs';
import { dayOffAt, myPlace } from '#kit/dayoff.mjs';
import { monthByDay, monthTotals, monthDays, shiftMonth, entriesOn, budgetState, lines } from '../lib/books.mjs';
import { reminders } from '../lib/renew.mjs';
import { openReminder, renewNow, reminderTile, leftText, dueText } from './renew.mjs';
import { addDays } from '#kit/format.mjs';
import { state, hooks, W, en, lang, money, short, monthLabel, dayLabel, today } from '../shell.mjs';
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
  const open = calOpen();

  // The month's figures, on one short card (Jay 2026-10-30: the big card
  // and the whole month pushed the day's entries off the screen): spent
  // as the focal number, income and what's left beside it, the budget's
  // thin bar and one line under them.
  const hero = h('section', { class: 'q-focus mn-focus mn-sum' }, [
    h('div', { class: 'mn-sum-main' }, [
      h('span', { class: 'q-focus-label', text: W(`${monthLabel(ym, { year: false })}支出`, `Spent in ${monthLabel(ym, { year: false })}`) }),
      h('b', { class: 'q-focus-value q-fit', text: money(t.out) })
    ]),
    h('div', { class: 'q-focus-figs mn-sum-figs' }, [fig(W('收入', 'Income'), money(t.in)), fig(W('結餘', 'Left'), money(t.net, { sign: true }), t.net > 0 ? 'in' : '')]),
    budget ? h('div', { class: `q-focus-bar${budget.left < 0 ? ' over' : ''}`, role: 'progressbar', 'aria-valuenow': String(Math.round(budget.share * 100)) }, [h('i', { style: `width:${Math.min(100, budget.share * 100)}%` })]) : null,
    budget
      ? h('span', { class: 'q-focus-sub', text: budget.left >= 0 ? (budget.perDay && now.startsWith(ym) ? W(`預算還剩 ${money(budget.left)}，每天 ${money(budget.perDay)}`, `${money(budget.left)} left, ${money(budget.perDay)} a day`) : W(`預算還剩 ${money(budget.left)}`, `${money(budget.left)} left`)) : W(`超出預算 ${money(-budget.left)}`, `${money(-budget.left)} over budget`) })
      : null
  ]);

  // The month's few big days show their amount in the accent: over twice
  // the budget's daily share (no budget: twice the daily average), and only
  // the five biggest of those, so the colour still points at something.
  const share = budget ? budget.amt / monthDays(ym) : t.out / Math.max(1, Object.keys(days).length);
  const big = Object.entries(days).filter(([, v]) => v.out > 2 * share).sort((x, y) => y[1].out - x[1].out).slice(0, 5);
  const loud = new Set(big.map(([d]) => d));

  // Folded (the default), the calendar is the picked day's week; opened,
  // the whole month. A week can reach into the month next to it.
  const n = monthDays(ym);
  const first = addDays(state.day, -new Date(`${state.day}T12:00:00Z`).getUTCDay());
  const shown = open ? Array.from({ length: n }, (_, i) => `${ym}-${String(i + 1).padStart(2, '0')}`) : Array.from({ length: 7 }, (_, i) => addDays(first, i));
  const near = {};
  for (const m of new Set(shown.map(d => d.slice(0, 7)))) if (m !== ym) Object.assign(near, monthByDay(b, m));
  const cells = shown.map((day, i) => {
    const v = days[day] || near[day];
    const off = dayOffAt(day, place);
    const cls = ['mn-day', off && 'off', day === now && 'today', day === state.day && 'on', day > now && 'later', loud.has(day) && 'loud', !day.startsWith(ym) && 'other'].filter(Boolean).join(' ');
    const btn = h('button', { class: cls, type: 'button', 'aria-label': `${dayLabel(day)}${v?.out ? ` ${money(v.out)}` : ''}`, 'aria-pressed': String(day === state.day), 'data-day': day, onclick: () => pickDay(day) }, [
      h('b', { text: String(Number(day.slice(8))) }),
      v?.out ? h('small', { class: 'num out', text: short(v.out) }) : v?.in ? h('small', { class: 'num in', text: `+${short(v.in)}` }) : h('small', { text: '' })
    ]);
    if (open && i === 0) btn.style.gridColumnStart = String(new Date(`${ym}-01T12:00:00Z`).getUTCDay() + 1);
    return btn;
  });
  const go = dir => (open ? goMonth(dir) : goWeek(dir));
  const step = (dir, label) => h('button', { class: 'mn-step', type: 'button', 'aria-label': label, html: icons.chevron, onclick: () => go(dir) });
  const calHead = h('div', { class: 'mn-cal-head' }, [
    h('button', { class: 'mn-month', type: 'button', onclick: e => pickMonth(e.currentTarget) }, [monthLabel(ym), h('i', { html: icons.chevron })]),
    h('span', { class: 'mn-cal-steps' }, [
      state.day !== now ? h('button', { class: 'q-btn tinted small mn-today', type: 'button', text: W('今天', 'Today'), onclick: () => goMonth(0, now.slice(0, 7)) }) : null,
      step(-1, open ? W('上個月', 'Previous month') : W('上一週', 'Previous week')),
      step(1, open ? W('下個月', 'Next month') : W('下一週', 'Next week'))
    ])
  ]);
  const grid = h('div', { class: 'mn-cal' }, [...WEEK.map((w, i) => h('span', { class: `mn-w${i === 0 || i === 6 ? ' off' : ''}`, text: w })), ...cells]);
  swipe(grid, go);
  const fold = h('button', { class: `mn-fold${open ? ' open' : ''}`, type: 'button', 'aria-expanded': String(open), 'aria-label': open ? W('收起月曆', 'Show one week') : W('展開月曆', 'Show the month'), html: icons.chevron, onclick: () => (setCalOpen(!open), render()) });

  // A day picked: its square and the list under it, the rest left as it is
  // (one in the month next door shows that month).
  let daySec = daySection(b, place);
  const pickDay = day => {
    state.day = day;
    if (!day.startsWith(ym)) return ((state.month = day.slice(0, 7)), render());
    for (const c of grid.querySelectorAll('.mn-day')) {
      const on = c.dataset.day === day;
      c.classList.toggle('on', on);
      c.setAttribute('aria-pressed', String(on));
    }
    const next = daySection(b, place);
    daySec.replaceWith(next);
    daySec = next;
  };

  // The day's entries come straight after the calendar, so today's log is
  // on the screen when it opens; what's due soon follows.
  box.replaceChildren(hero, h('div', { class: `mn-cal-card${open ? '' : ' week'}` }, [calHead, grid, fold]), daySec, ...[renewals(b, now)].filter(Boolean));
}

// The calendar opened or folded, kept on this phone.
function calOpen() {
  try {
    return localStorage.getItem('money:cal-open') === '1';
  } catch {
    return false;
  }
}
function setCalOpen(on) {
  try {
    localStorage.setItem('money:cal-open', on ? '1' : '0');
  } catch {}
}
function goWeek(n) {
  state.day = addDays(state.day, 7 * n);
  state.month = state.day.slice(0, 7);
  render();
}

// 到期提醒 (Jay 2026-10-27): what runs out or renews within a week (or ran
// out this week), soonest first; a tap opens its settings. The notices are
// app.mjs's; the list is 更多 › 到期提醒.
function renewals(b, now) {
  const list = reminders(b, now).filter(x => x.left != null && x.left <= 7 && (x.left >= 0 || (!x.r.roll && x.left >= -7)));
  if (!list.length) return null;
  const rows = list.map(x => {
    const ask = !notifyOn() && x.r.on !== false && 'Notification' in globalThis;
    return h('div', { class: `q-ritem mn-row mn-renew${x.left <= 2 ? ' soon' : ''}` }, [
      reminderTile(x.r),
      h('button', { class: 'q-ritem-text mn-renew-open', type: 'button', onclick: () => openReminder(x.r.id, render) }, [h('span', { class: 'q-ritem-title', text: `${x.r.name} ${leftText(x)}` }), h('small', { text: dueText(x.r, x) })]),
      // (Notices off: turned on from here first. One renewed by hand: 續購.)
      ask
        ? h('button', { class: 'q-btn tinted small', type: 'button', text: W('提醒我', 'Remind me'), onclick: async () => (await hooks.notices?.()) && render() })
        : x.r.roll
          ? null
          : h('button', { class: 'q-btn tinted small', type: 'button', text: W('續購', 'Renew'), onclick: () => renewNow(x.r, x, openEntry) })
    ]);
  });
  return h('div', { class: 'q-rowcard mn-renews' }, rows);
}

// The picked day: its total and its entries, with a row to add one.
function daySection(b, place) {
  const list = entriesOn(b, state.day);
  // (A spend less what came back for it, with its fee: lib/books.mjs lines.)
  const day = lines(b, state.day, state.day);
  const dayOut = day.filter(l => l.k === 'out').reduce((s, l) => s + l.amt, 0);
  const dayIn = day.filter(l => l.k === 'in').reduce((s, l) => s + l.amt, 0);
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

// A finger across the calendar: the next week or month (left) or the last (right).
function swipe(el, go) {
  let x0 = null;
  let y0 = 0;
  el.addEventListener('touchstart', e => ((x0 = e.touches[0].clientX), (y0 = e.touches[0].clientY)), { passive: true });
  el.addEventListener('touchend', e => {
    if (x0 == null) return;
    const dx = e.changedTouches[0].clientX - x0;
    const dy = e.changedTouches[0].clientY - y0;
    x0 = null;
    if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) go(dx < 0 ? 1 : -1);
  });
}
