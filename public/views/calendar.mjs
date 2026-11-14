// 月曆, the home: the month's spending (and its budget) on a short card,
// the picked day's week (or, opened, the month) with each day's spending
// under its date, the days over the budget's daily share in the accent,
// (holidays and typhoon days off in red, as a Taiwan calendar has them),
// and the picked day's entries under it. A swipe across the month goes to
// the next or the last; the picked day's entries sit right under it.
import { h, icons, menu, tile, toast } from '#kit/ui.mjs';
import { notifyOn } from '#kit/orbit.mjs';
import { dayOffAt, myPlace } from '#kit/dayoff.mjs';
import { monthByDay, monthTotals, monthDays, shiftMonth, entriesOn, budgetState, monthLeft, lines } from '../lib/books.mjs';
import { reminders } from '../lib/renew.mjs';
import { openReminder, renewNow, reminderTile, leftText, dueText } from './renew.mjs';
import { addDays } from '#kit/format.mjs';
import { state, hooks, W, en, lang, money, short, monthLabel, dayLabel, today, columns, columnsHere } from '../shell.mjs';
import { entryRow, openEntry } from './entry.mjs';
import { reviewMonth, reviewOf, reviewFacts } from '../lib/month.mjs';
import { rideOffer } from '../lib/ride.mjs';
import { catName, catOf, subOf, glyph } from '../lib/cats.mjs';
import { testBudget, testTpass, testRide } from '../testing.mjs';

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
  const tb = globalThis.ORBIT_TEST?.flags?.moneyBudget;
  const budget = tb && now.startsWith(ym) ? testBudget(tb, t.out, monthDays(ym), Number(now.slice(8, 10))) : budgetState(b, ym, now).find(x => !x.cat);
  const place = myPlace('work');
  // (Beside the day's entries on a tablet or a computer, the whole month
  // always: there's height for it. A phone on its side keeps the week.)
  const roomy = columnsHere() > 1 && globalThis.innerHeight > 600;
  const open = roomy || calOpen();

  // The month's figures, on one short card (Jay 2026-10-30: the big card
  // and the whole month pushed the day's entries off the screen). With a
  // budget this month, what's left to spend is the focal number (leftCard);
  // otherwise what was spent, income and what's left beside it, the budget's
  // thin bar and one line under them.
  const hero = leftCard(t, budget, ym, now) || h('section', { class: 'q-focus mn-focus mn-sum' }, [
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
  const step = (dir, label) => h('button', { class: `mn-step${dir < 0 ? ' back' : ''}`, type: 'button', 'aria-label': label, html: icons.chevron, onclick: () => go(dir) });
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
  const fold = roomy ? null : h('button', { class: `mn-fold${open ? ' open' : ''}`, type: 'button', 'aria-expanded': String(open), 'aria-label': open ? W('收起月曆', 'Show one week') : W('展開月曆', 'Show the month'), html: icons.chevron, onclick: () => (setCalOpen(!open), render()) });

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
  // (Wide: the month on the left, the day it opens on the right, a list
  // beside what it opens.)
  const calCard = h('div', { class: `mn-cal-card${open ? '' : ' week'}${roomy ? ' roomy' : ''}` }, [calHead, grid, fold]);
  box.replaceChildren(...columns([[hero, calCard], [rideCard(), daySec, reviewCard(b, now), renewals(b, now)]]));
}

// 每月回顧 (Jay 11-10): in a month's first week, on this month's page, last
// month in a few of the phone's own figures and one suggestion the AI writes
// from them (money-month, asked once a month and kept on this phone); ✕ puts
// it away until next month.
const REVIEW = ym => `money:review.v1:${ym}`;
const kept = key => {
  try {
    return JSON.parse(localStorage.getItem(key) || 'null');
  } catch {
    return null;
  }
};
const keep = (key, v) => {
  try {
    localStorage.setItem(key, JSON.stringify(v));
  } catch {}
};
// 車資記帳 (Jay 11-10, Money and Transit): a trip Orbit Transit planned with
// its fare (the family's notebook), offered as a 交通 entry: 記一筆 opens
// 記一筆 filled in for the person to look over and save; 不用 passes it on.
// Never saved on its own (real money).
let family = null;
import('#kit/family.mjs')
  .then(f => {
    family = f;
    if (f.heard?.('transit', 'ride')) hooks.render?.();
  })
  .catch(() => {});
const RIDES = 'money:rides.v1';
const ridesDone = () => (Array.isArray(kept(RIDES)) ? kept(RIDES) : []);
const rideDone = id => keep(RIDES, [id, ...ridesDone().filter(x => x !== id)].slice(0, 20));
function rideCard() {
  const r = rideOffer(globalThis.ORBIT_TEST?.flags?.moneyRide ? testRide() : family?.heard?.('transit', 'ride'), { done: ridesDone() });
  if (!r) return null;
  const c = subOf(r.sub) || catOf(r.cat);
  const pic = tile(glyph(c?.icon || catOf(r.cat)?.icon || 'bus'), catOf(r.cat)?.color || '#0088ff');
  return h('section', { class: 'q-section mn-ride' }, [
    h('div', { class: 'q-rowcard' }, [
      h('div', { class: 'q-ritem mn-ride-row' }, [
        pic,
        h('span', { class: 'q-ritem-text' }, [h('span', { class: 'q-ritem-title', text: W('剛剛的車資，記一筆？', 'Log that ride?') }), h('small', { text: [r.note, W('估的票價', 'est. fare')].filter(Boolean).join(' · ') })]),
        h('span', { class: 'q-ritem-value num', text: money(r.amt) })
      ]),
      h('div', { class: 'mn-ride-acts' }, [
        h('button', { class: 'q-btn small mn-ride-no', type: 'button', text: W('不用', 'No thanks'), onclick: () => (rideDone(r.id), render()) }),
        h('button', { class: 'q-btn tinted small', type: 'button', text: W('記一筆', 'Log it'), onclick: () => (rideDone(r.id), openEntry({ day: r.day, kind: 'out', amt: r.amt, note: r.note, cat: r.cat, sub: r.sub }), render()) })
      ])
    ])
  ]);
}
let askingTip = '';
function reviewCard(b, now) {
  const ym = reviewMonth(now);
  if (!ym || state.month !== now.slice(0, 7) || kept(`${REVIEW(ym)}:x`)) return null;
  const v = reviewOf(b, ym);
  if (!v) return null;
  const name = id => catName(catOf(id) || subOf(id) || { zh: id }, lang);
  const prev = monthLabel(shiftMonth(ym, -1), { year: false });
  const row = (label, value, sub = '') => h('div', { class: 'q-ritem mn-review-row' }, [h('span', { class: 'q-ritem-text' }, [h('span', { class: 'q-ritem-title', text: label }), sub ? h('small', { text: sub }) : null]), h('span', { class: 'q-ritem-value num', text: value })]);
  const tipBox = h('div', { class: 'mn-review-tip', 'aria-live': 'polite' });
  const saved = kept(REVIEW(ym));
  // (The AI writes the figures as given, 12169: shown as the app writes money, 12,169.)
  const showTip = tip => (tipBox.removeAttribute('data-ai-only'), tipBox).replaceChildren(h('span', { class: 'q-ai-mark', 'aria-hidden': 'true', html: icons.ai || icons.spark || '' }), h('span', { text: tip.replace(/\d{4,}/g, n => (/^(19|20)\d\d$/.test(n) ? n : Number(n).toLocaleString('en-US'))) }));
  // (The AI's tip on a tap (Jay 11-14: "make AI feature like this a button to click like we do in
  // orbit law, never spend a penny on AI on things user didn't interact with"), kept on the phone after.)
  const ask = () => {
    if (askingTip === ym) return;
    askingTip = ym;
    tipBox.replaceChildren(h('span', { class: 'q-ai-mark', 'aria-hidden': 'true', html: icons.ai || icons.spark || '' }), h('span', { class: 'mn-review-wait', text: W('想一下…', 'Thinking…') }));
    import('#kit/ai.mjs')
      .then(ai => ai.aiCall('money-month', { facts: reviewFacts(v, lang), lang: en ? 'en' : 'zh' }).then(r => ({ r, ai })))
      .then(({ r, ai }) => {
        askingTip = '';
        if (!r?.out?.tip) return void (tipBox.isConnected && tipButton(ai.aiSays(r?.error)));
        keep(REVIEW(ym), { tip: r.out.tip, at: Date.now() });
        if (tipBox.isConnected) showTip(r.out.tip);
      })
      .catch(() => ((askingTip = ''), tipButton(W('AI 現在沒有回應，再試一次。', 'AI didn’t answer. Try again.'))));
  };
  const tipButton = (note = '') =>
    (tipBox.setAttribute('data-ai-only', ''), tipBox).replaceChildren(
      ...[
        h('button', { type: 'button', class: 'q-ai-tap', onclick: ask }, [h('span', { class: 'q-ai-mark', 'aria-hidden': 'true', html: icons.ai || icons.spark || '' }), h('span', { text: W('這個月怎麼調整', 'What to change this month') })]),
        note ? h('small', { class: 'mn-review-note', text: note }) : null
      ].filter(Boolean)
    );
  if (saved?.tip) showTip(saved.tip);
  else tipButton();
  const diff = v.before != null ? v.spent - v.before : null;
  return h('section', { class: 'q-section mn-review' }, [
    h('div', { class: 'q-section-head q-shd' }, [
      h('h2', { text: W(`${monthLabel(ym, { year: false })}回顧`, `${monthLabel(ym, { year: false })} in review`) }),
      h('button', { class: 'q-sh-more mn-review-x', type: 'button', text: W('收起', 'Hide'), onclick: () => (keep(`${REVIEW(ym)}:x`, 1), render()) })
    ]),
    h('div', { class: 'q-rowcard' }, [
      row(W('支出', 'Spent'), money(v.spent), diff == null || !diff ? '' : diff > 0 ? W(`比${prev}多 ${money(diff)}`, `${money(diff)} more than ${prev}`) : W(`比${prev}少 ${money(-diff)}`, `${money(-diff)} less than ${prev}`)),
      v.top ? row(W('花最多', 'Most on'), money(v.top.amt), name(v.top.cat)) : null,
      v.up ? row(W('漲最多', 'Up most'), `+${money(v.up.diff)}`, name(v.up.cat)) : null,
      v.income ? row(W('收入', 'Income'), money(v.income), v.kept != null && v.kept > 0 ? W(`存下 ${v.kept}%`, `${v.kept}% kept`) : '') : null,
      tipBox
    ])
  ]);
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
  const list = (globalThis.ORBIT_TEST?.flags?.moneyTpass ? [testTpass(now)] : []).concat(reminders(b, now)).filter(x => x.left != null && x.left <= 7 && (x.left >= 0 || (!x.r.roll && x.left >= -7)));
  if (!list.length) return null;
  const rows = list.map(x => {
    const ask = (!notifyOn() || globalThis.ORBIT_TEST?.flags?.moneyNoticeDenied) && x.r.on !== false && 'Notification' in globalThis;
    return h('div', { class: `q-ritem mn-row mn-renew${x.left <= 2 ? ' soon' : ''}` }, [
      reminderTile(x.r),
      h('button', { class: 'q-ritem-text mn-renew-open', type: 'button', onclick: () => (x.test ? toast(W('測試用的 TPASS，沒有存', 'A test TPASS, not saved')) : openReminder(x.r.id, render)) }, [h('span', { class: 'q-ritem-title', text: `${x.r.name} ${leftText(x)}` }), h('small', { text: dueText(x.r, x) })]),
      // (Notices off: turned on from here first. One renewed by hand: 續購.)
      ask
        ? h('button', { class: 'q-btn tinted small', type: 'button', text: W('提醒我', 'Remind me'), onclick: async () => ((await hooks.notices?.()) ? render() : toast(W('請到系統設定允許通知', 'Allow notices in system settings'), { tone: 'bad' })) })
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
  const addRow = h('button', { class: 'q-ritem q-add mn-addrow', type: 'button', onclick: () => openEntry({ day: state.day }) }, [h('span', { class: 'q-add-i mn-addrow-i', html: icons.plus }), h('span', { class: 'q-ritem-text' }, [h('span', { class: 'q-ritem-title', text: list.length ? W('再記一筆', 'Add another') : W('這天還沒記帳', 'Nothing yet this day') })])]);
  const body = h('div', { class: 'q-rowcard mn-entries' }, [...list.map(e => entryRow(e)), addRow]);

  return h('section', { class: 'mn-day-sec' }, [head, body]);
}

const fig = (label, value, cls = '') => h('div', null, [h('small', { text: label }), h('b', { class: `num ${cls}`.trim(), text: value })]);

// With a budget, this month's card answers what it's opened for, how much
// can still be spent (Orbit's own look, Jay 2026-11-03; Orbit-Core DESIGN
// §11): that's the big number, what it is a day and how many days it has to
// last under it, and what's spent beside it (with income when there is any,
// else the budget). The bar is what's spent, its mark where the month is
// today: past the mark, spending is ahead of the month (books.mjs monthLeft).
function leftCard(t, budget, ym, now) {
  const l = monthLeft(budget, ym, now);
  if (!l) return null;
  const month = monthLabel(ym, { year: false });
  const spent = Math.round(l.spent * 100);
  const gone = Math.round(l.month * 100);
  return h('section', { class: 'q-focus mn-focus mn-sum mn-left' }, [
    h('div', { class: 'mn-sum-main' }, [
      h('span', { class: 'q-focus-label', text: l.over ? W(`${month}超出預算`, `Over budget in ${month}`) : W(`${month}還能花`, `Left to spend in ${month}`) }),
      h('b', { class: `q-focus-value q-fit${l.over ? ' over' : ''}`, text: money(l.big) })
    ]),
    h('div', { class: 'q-focus-figs mn-sum-figs' }, [fig(W('已花', 'Spent'), money(t.out)), t.in > 0 ? fig(W('收入', 'Income'), money(t.in)) : fig(W('預算', 'Budget'), money(budget.amt))]),
    h('div', { class: 'mn-meter', role: 'progressbar', 'aria-valuenow': String(spent), 'aria-label': W(`已花預算 ${spent}%，這個月過了 ${gone}%`, `${spent}% of the budget spent, ${gone}% of the month gone`) }, [
      h('div', { class: `q-focus-bar${l.over ? ' over' : ''}` }, [h('i', { style: `width:${Math.min(100, l.spent * 100)}%` })]),
      h('i', { class: 'mn-pace', style: `left:${l.month * 100}%` })
    ]),
    h('span', { class: 'q-focus-sub', text: l.over ? W(`預算 ${money(budget.amt)}，還有 ${l.daysLeft} 天`, `Budget ${money(budget.amt)}, ${l.daysLeft} days to go`) : W(`每天 ${money(l.perDay)}，還有 ${l.daysLeft} 天`, `${money(l.perDay)} a day for ${l.daysLeft} days`) })
  ]);
}

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
