// 到期提醒 (Jay 2026-10-27: "you didn't have a place for me to set the
// notifications"): each kind that lasts a while (a TPASS), when the current
// one began and where that day comes from, how long it lasts, and when the
// phone is told. Opened from 月曆's row and 更多.
import { h, icons, sheet, toggle, toast, tick } from '#kit/ui.mjs';
import { notifyOn } from '#kit/orbit.mjs';
import { addDays } from '#kit/format.mjs';
import { put } from '../lib/books.mjs';
import { passes, remindOf, saveCat, subOf, catOf, catName } from '../lib/cats.mjs';
import { state, hooks, W, lang, money, dayLabel, today, saved } from '../shell.mjs';

const nameOf = id => catName(subOf(id) || catOf(id), lang);
// 10/29 (short: a line of notice times stays one line).
const md = d => `${Number(d.slice(5, 7))}/${Number(d.slice(8))}`;

// Every kind as a row (one kind: straight to it).
export function openRenewals() {
  const list = passes(state.books, today(), { all: true });
  if (list.length === 1) return openPass(list[0].id);
  const s = sheet({
    title: W('到期提醒', 'Renewal reminders'),
    body: [
      list.length
        ? h('div', { class: 'q-rowcard' }, list.map(p => h('button', { class: 'q-ritem chevron mn-row', type: 'button', onclick: () => (s.close(), openPass(p.id)) }, [h('span', { class: 'q-ritem-text' }, [h('span', { class: 'q-ritem-title', text: nameOf(p.id) }), h('small', { text: statusOf(p) })])])))
        : h('p', { class: 'mn-hint', text: W('在 分類 › 自動帶入 設定「有效天數」，就能在到期前提醒你。', 'Set “Lasts (days)” in Categories › Fill in to be reminded before it ends.') })
    ]
  });
}

// 「還有 2 天 · 10月30日到期」, or not set yet.
export function statusOf(p) {
  if (!p.end) return W('還沒設定開始日', 'No start day yet');
  const when = p.left > 0 ? W(`還有 ${p.left} 天`, `${p.left} day${p.left === 1 ? '' : 's'} left`) : p.left === 0 ? W('今天到期', 'Ends today') : W('已到期', 'Ended');
  return `${when} · ${W(`${dayLabel(p.end, { week: false })}到期`, `ends ${dayLabel(p.end, { week: false })}`)}`;
}

const REMIND = [
  [3, W('前 3 天', '3 days before')],
  [1, W('前 1 天', 'Day before')],
  [0, W('當天早上', 'That morning')]
];

export function openPass(id) {
  const b = state.books;
  const now = today();
  const cur = passes(b, now, { all: true }).find(p => p.id === id) || { id, days: 30, start: '', src: '' };
  const r = remindOf(id);
  const f = { start: cur.start || '', days: String(cur.days || 30), on: r.on, at: new Set(r.at) };
  // What it would be with the settings as they stand in the sheet.
  const draft = () => {
    const days = Math.round(Number(f.days) || 0);
    const end = f.start && days > 0 ? addDays(f.start, days - 1) : '';
    const left = end ? Math.round((Date.parse(`${end}T12:00:00Z`) - Date.parse(`${now}T12:00:00Z`)) / 86_400_000) : null;
    return { id, end, left, start: f.start, days };
  };

  const status = h('b', { class: 'mn-pass-status' });
  const source = h('small', { class: 'mn-hint mn-pass-src' });
  const dateIn = h('input', { class: 'mn-date', type: 'date', value: f.start, max: '2099-12-31', 'aria-label': W('開始日', 'Start day') });
  const dateT = h('span', { class: 'mn-pill-t' });
  dateIn.addEventListener('change', () => ((f.start = dateIn.value), paint()));
  const daysIn = h('input', { class: 'q-field num', type: 'text', inputmode: 'numeric', maxlength: '3', value: f.days, 'aria-label': W('有效天數', 'Lasts (days)') });
  daysIn.addEventListener('input', () => ((f.days = daysIn.value.replace(/[^\d]/g, '')), paint()));
  const chips = h('div', { class: 'mn-pass-chips' });
  const when = h('small', { class: 'mn-hint' });
  const allow = h('button', { class: 'q-btn tinted block', type: 'button', text: W('允許通知', 'Allow notices'), onclick: async () => ((await hooks.notices?.()) ? paint() : toast(W('請到系統設定允許通知', 'Allow notices in system settings'), { tone: 'bad' })) });
  const onSwitch = toggle({ checked: f.on, label: W('提醒我', 'Remind me'), onChange: on => ((f.on = on), paint()) });

  function paint() {
    const p = draft();
    status.textContent = statusOf(p);
    status.classList.toggle('soon', p.left != null && p.left <= 2);
    dateT.textContent = f.start ? dayLabel(f.start, { week: false, year: f.start.slice(0, 4) !== now.slice(0, 4) }) : W('選日期', 'Choose');
    // Where the day comes from: a TPASS logged, or set here.
    const e = cur.e;
    source.textContent = !f.start
      ? W('記一筆 TPASS，或在這裡選開始日。', 'Log one, or choose its start day here.')
      : e && f.start === (e.from || e.d)
        ? W(`從 ${md(e.d)} 記的 ${nameOf(id)}（${money(e.amt)}）算起`, `From the ${nameOf(id)} logged ${md(e.d)} (${money(e.amt)})`)
        : W('你設定的開始日', 'The start day you set');
    chips.hidden = !f.on;
    chips.replaceChildren(...REMIND.map(([n, label]) => h('button', { class: 'mn-subchip', type: 'button', 'aria-pressed': String(f.at.has(n)), text: label, onclick: () => (tick(), f.at.has(n) ? f.at.delete(n) : f.at.add(n), paint()) })));
    // The notices as they'll come, or why they won't.
    const times = f.on && p.end ? [...f.at].sort((a, b) => b - a).map(n => (n ? `${md(addDays(p.end, -n))} 20:00` : `${md(p.end)} 08:00`)) : [];
    when.textContent = !f.on ? W('不提醒', 'No reminder') : !p.end ? W('設好開始日就會提醒', 'Reminds once a start day is set') : times.length ? W(`通知：${times.join('、')}`, `Notices: ${times.join(', ')}`) : W('選一個提醒時間', 'Pick when');
    allow.hidden = !f.on || notifyOn() || !('Notification' in globalThis);
  }
  const field = (label, ctl) => h('div', { class: 'mn-field' }, [h('span', { class: 'mn-field-l', text: label }), ctl]);
  const s = sheet({
    title: W(`${nameOf(id)} 到期提醒`, `${nameOf(id)} reminder`),
    cls: 'mn-pass',
    body: [
      h('div', { class: 'mn-pass-head' }, [status, source]),
      h('div', { class: 'mn-form' }, [
        h('div', { class: 'mn-pass-row' }, [field(W('開始日', 'Start day'), h('label', { class: 'mn-pill mn-date-pill' }, [h('span', { html: icons.calendar }), dateT, dateIn])), field(W('有效天數', 'Lasts (days)'), daysIn)]),
        h('div', { class: 'mn-pass-switch' }, [h('span', { class: 'mn-field-l', text: W('到期前提醒我', 'Remind me before it ends') }), onSwitch]),
        chips,
        h('div', { class: 'mn-pass-when' }, [when, allow])
      ])
    ],
    foot: h('div', { class: 'q-sheet-foot' }, [
      h('button', {
        class: 'q-btn primary block',
        type: 'button',
        text: W('儲存', 'Save'),
        onclick: () => {
          const days = Math.min(400, Math.round(Number(f.days) || 0));
          if (!(days > 0)) return toast(W('請填有效天數', 'Fill in how many days'), { tone: 'bad' });
          const nowMs = Date.now();
          saveCat(b, { id, days, start: f.start || '', remind: { on: f.on, at: [...f.at].sort((a, b) => b - a) } }, nowMs);
          // (The spend it counts from begins on that day: first ridden after it was bought.)
          if (cur.e && f.start && f.start >= cur.e.d) put(b, 'entries', { ...b.entries[cur.e.id], from: f.start === cur.e.d ? '' : f.start }, nowMs);
          s.close();
          saved();
          toast(W('已儲存', 'Saved'));
        }
      })
    ])
  });
  paint();
  return s;
}

