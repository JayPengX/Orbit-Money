// 月曆: the month's spending and income on top, each day's spending in its
// square (holidays and typhoon days off in red, as a Taiwan calendar has
// them), and the picked day's entries under it. A swipe across the month
// goes to the next or the last.
import { h, icons, empty } from '#kit/ui.mjs';
import { dayOffAt, myPlace } from '#kit/dayoff.mjs';
import { monthByDay, monthTotals, monthDays, shiftMonth, entriesOn, budgetState } from '../lib/books.mjs';
import { state, W, en, money, short, monthLabel, dayLabel, today } from '../shell.mjs';
import { entryRow, openEntry } from './entry.mjs';

const WEEK = en ? ['S', 'M', 'T', 'W', 'T', 'F', 'S'] : ['日', '一', '二', '三', '四', '五', '六'];

function goMonth(n) {
  state.month = shiftMonth(state.month, n);
  // The day picked moves with it: today in this month, else its 1st.
  state.day = today().startsWith(state.month) ? today() : `${state.month}-01`;
  render();
}
let render = () => {};

export function renderCal(box) {
  render = () => renderCal(box);
  const b = state.books;
  const ym = state.month;
  const t = monthTotals(b, ym);
  const days = monthByDay(b, ym);
  const now = today();
  const budget = budgetState(b, ym, now).find(x => !x.cat);
  const place = myPlace('work');

  const nav = (dir, label) => h('button', { class: 'mn-step', type: 'button', 'aria-label': label, html: icons.chevron, onclick: () => goMonth(dir) });
  const hero = h('section', { class: 'q-hero-card mn-hero' }, [
    h('div', { class: 'mn-hero-top' }, [
      nav(-1, W('上個月', 'Previous month')),
      h('button', { class: 'mn-month', type: 'button', text: monthLabel(ym), onclick: () => !now.startsWith(ym) && ((state.month = now.slice(0, 7)), (state.day = now), render()) }),
      nav(1, W('下個月', 'Next month'))
    ]),
    fig(W('支出', 'Spent'), money(t.out), 'big'),
    h('div', { class: 'mn-hero-figs two' }, [fig(W('收入', 'Income'), money(t.in)), fig(W('結餘', 'Left'), money(t.net, { sign: true }))]),
    budget
      ? h('div', { class: 'mn-hero-budget' }, [
          h('div', { class: 'mn-bar', role: 'progressbar', 'aria-valuenow': String(Math.round(budget.share * 100)) }, [h('i', { style: `width:${Math.min(100, budget.share * 100)}%` })]),
          h('small', { text: budget.left >= 0 ? W(`預算還剩 ${money(budget.left)}`, `${money(budget.left)} left of budget`) : W(`超出預算 ${money(-budget.left)}`, `${money(-budget.left)} over budget`) })
        ])
      : null
  ]);

  // The month's squares.
  const n = monthDays(ym);
  const offset = new Date(`${ym}-01T12:00:00Z`).getUTCDay();
  const cells = [];
  for (let d = 1; d <= n; d++) {
    const day = `${ym}-${String(d).padStart(2, '0')}`;
    const v = days[day];
    const off = dayOffAt(day, place);
    const cls = ['mn-day', off && 'off', day === now && 'today', day === state.day && 'on', day > now && 'later'].filter(Boolean).join(' ');
    const btn = h('button', { class: cls, type: 'button', 'aria-label': `${dayLabel(day)}${v?.out ? ` ${money(v.out)}` : ''}`, 'aria-pressed': String(day === state.day), onclick: () => ((state.day = day), render()) }, [
      h('b', { text: String(d) }),
      v?.out ? h('small', { class: 'num out', text: short(v.out) }) : v?.in ? h('small', { class: 'num in', text: `+${short(v.in)}` }) : null
    ]);
    if (d === 1) btn.style.gridColumnStart = String(offset + 1);
    cells.push(btn);
  }
  const grid = h('div', { class: 'mn-cal' }, [...WEEK.map((w, i) => h('span', { class: `mn-w${i === 0 || i === 6 ? ' off' : ''}`, text: w })), ...cells]);
  swipe(grid);

  // The day.
  const list = entriesOn(b, state.day);
  const dayOut = list.filter(e => e.k === 'out').reduce((s, e) => s + e.amt, 0);
  const dayIn = list.filter(e => e.k === 'in').reduce((s, e) => s + e.amt, 0);
  const off = dayOffAt(state.day, place);
  const head = h('div', { class: 'mn-dayhead' }, [
    h('div', {}, [h('h2', { text: dayLabel(state.day) }), off && off.kind !== 'weekend' ? h('small', { class: 'mn-holiday', text: en ? off.en : off.zh }) : null]),
    h('span', { class: 'num mn-daysum' }, [dayIn ? h('em', { text: `+${money(dayIn)}` }) : null, dayOut ? h('b', { text: money(dayOut) }) : null])
  ]);
  const body = list.length
    ? h('div', { class: 'q-rowcard mn-entries' }, list.map(e => entryRow(e)))
    : empty({ icon: 'list', title: W('這天沒有記帳', 'Nothing on this day'), action: { label: W('記一筆', 'Add one'), onTap: () => openEntry({ day: state.day }) } });

  box.replaceChildren(hero, h('div', { class: 'mn-cal-card' }, [grid]), h('section', { class: 'mn-day-sec' }, [head, body]));
}

const fig = (label, value, cls = '') => h('div', { class: `mn-fig ${cls}`.trim() }, [h('small', { text: label }), h('b', { class: 'num q-fit', text: value })]);

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
