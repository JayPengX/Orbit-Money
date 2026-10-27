// 到期提醒 (Jay 2026-10-27: not just TPASS): the list of what runs out or
// renews (更多 › 到期提醒), and one reminder's sheet: how many days are left
// as its focus, then its name, start (and where that day comes from), how
// long one lasts, whether it renews itself, the category whose spend starts
// a new one, and when the phone is told. lib/renew.mjs does the dates.
import { h, icons, tile, sheet, toggle, toast, tick, menu } from '#kit/ui.mjs';
import { ask, notifyOn } from '#kit/orbit.mjs';
import { addDays } from '#kit/format.mjs';
import { put, drop } from '../lib/books.mjs';
import { reminders, standing, renewedBy, CYCLES, AT, DEFAULT_AT } from '../lib/renew.mjs';
import { catList, catOf, subOf, catName, glyph } from '../lib/cats.mjs';
import { state, hooks, W, lang, money, dayLabel, today, saved } from '../shell.mjs';

// 10/29: short, so a line of dates stays one line.
const md = d => `${Number(d.slice(5, 7))}/${Number(d.slice(8))}`;
const cycleName = (n, unit) => (unit === 'year' ? (n === 1 ? W('每年', 'Yearly') : W(`每 ${n} 年`, `Every ${n} years`)) : unit === 'month' ? (n === 1 ? W('每月', 'Monthly') : W(`每 ${n} 個月`, `Every ${n} months`)) : W(`${n} 天`, `${n} days`));
const linkName = r => (r.sub && subOf(r.sub) ? `${catName(catOf(r.cat), lang)} › ${catName(subOf(r.sub), lang)}` : r.cat ? catName(catOf(r.cat), lang) : '');
// Its tile: the category it follows, else a bell.
export const reminderTile = r => (r.cat ? tile(glyph(catOf(r.cat).icon), catOf(r.cat).color) : tile(icons.bell, '#8e8e93'));

// 「還有 28 天」 / 「就是今天」 / 「已到期」, and the date in words.
export function leftText(s) {
  if (s.left == null) return W('還沒設定開始日', 'No start day yet');
  if (s.left > 0) return W(`還有 ${s.left} 天`, `${s.left} day${s.left === 1 ? '' : 's'} left`);
  return s.left === 0 ? W('就是今天', 'Today') : W('已到期', 'Ended');
}
export const dueText = (r, s) => (!s.due ? '' : r.roll ? W(`${dayLabel(s.due, { week: false })}續訂`, `Renews ${dayLabel(s.due, { week: false })}`) : W(`${dayLabel(s.due, { week: false })}到期`, `Ends ${dayLabel(s.due, { week: false })}`));

// ---- The list ------------------------------------------------------------------------

export function openRenewals() {
  const body = h('div', { class: 'mn-rm-list' });
  const s = sheet({ title: W('到期提醒', 'Reminders'), body: [body], cls: 'mn-rm-sheet' });
  const paint = () => {
    const list = reminders(state.books, today());
    const add = h('button', { class: 'q-btn tinted block', type: 'button', onclick: () => openReminder(null, paint) }, [h('span', { html: icons.plus }), W('新增提醒', 'Add a reminder')]);
    body.replaceChildren(
      list.length
        ? h(
            'div',
            { class: 'q-rowcard' },
            list.map(x =>
              h('button', { class: 'q-ritem chevron mn-row', type: 'button', onclick: () => openReminder(x.r.id, paint) }, [
                reminderTile(x.r),
                h('span', { class: 'q-ritem-text' }, [h('span', { class: 'q-ritem-title', text: x.r.name || W('未命名', 'Untitled') }), h('small', { text: [dueText(x.r, x), x.r.on === false ? W('不提醒', 'No reminder') : ''].filter(Boolean).join(' · ') || leftText(x) })]),
                h('span', { class: `q-ritem-value num mn-rm-left${x.left != null && x.left <= 2 ? ' soon' : ''}`, text: x.left == null ? '' : x.left < 0 ? W('已到期', 'Ended') : W(`${x.left} 天`, `${x.left}d`) })
              ])
            )
          )
        : h('p', { class: 'mn-hint mn-rm-empty', text: W('TPASS、訂閱、會員、信用卡年費⋯到期前提醒你。', 'TPASS, subscriptions, memberships, card fees: told before they end.') }),
      add
    );
  };
  paint();
  return s;
}

// ---- One reminder ----------------------------------------------------------------------

// openReminder(id) one in the list, (null) a new one; done() redraws whoever opened it.
export function openReminder(id, done = () => {}) {
  const b = state.books;
  const was = id && b.renew?.[id] && !b.renew[id].del ? b.renew[id] : null;
  const now = today();
  const f = { name: was?.name || '', start: was?.start || '', n: Number(was?.n) || 30, unit: was?.unit || 'day', roll: Boolean(was?.roll), cat: was?.cat || '', sub: was?.sub || '', on: was?.on !== false, at: new Set(Array.isArray(was?.at) ? was.at : DEFAULT_AT) };
  // Where it would stand as the sheet is now (the start shown: the one in force, a spend's too).
  const st = () => standing(b, f, now);
  f.start = st().start || f.start;

  const label = h('span', { class: 'q-focus-label' });
  const big = h('b', { class: 'q-focus-value q-fit' });
  const sub = h('span', { class: 'q-focus-sub' });
  const focus = h('section', { class: 'q-focus mn-focus mn-rm-focus' }, [label, big, sub]);

  const nameIn = h('input', { class: 'mn-rm-in', type: 'text', maxlength: '20', value: f.name, placeholder: W('TPASS、Netflix⋯', 'TPASS, Netflix…'), enterkeyhint: 'done', autocomplete: 'off', 'aria-label': W('名稱', 'Name') });
  nameIn.addEventListener('input', () => ((f.name = nameIn.value), paint()));
  nameIn.addEventListener('keydown', e => e.key === 'Enter' && nameIn.blur());
  const dateIn = h('input', { class: 'mn-date', type: 'date', value: f.start, max: '2099-12-31', 'aria-label': W('開始日', 'Start day') });
  dateIn.addEventListener('change', () => ((f.start = dateIn.value), paint()));
  const startV = h('span', { class: 'q-ritem-value' });
  const startSrc = h('small');
  const cycleV = h('span', { class: 'q-ritem-value' });
  const linkV = h('span', { class: 'q-ritem-value' });
  const rollSub = h('small');
  const rollSw = toggle({ checked: f.roll, label: W('自動續訂', 'Renews itself'), onChange: on => ((f.roll = on), paint()) });
  const onSw = toggle({ checked: f.on, label: W('提醒我', 'Remind me'), onChange: on => ((f.on = on), paint()) });
  // (The times are rows of the same card, under its switch.)
  const onRow = h('div', { class: 'q-ritem mn-rm-row' }, [h('span', { class: 'q-ritem-text' }, [h('span', { class: 'q-ritem-title', text: W('提醒我', 'Remind me') })]), onSw]);
  const times = h('div', { class: 'q-rowcard mn-rm-card' });

  const text = (title, small = null) => h('span', { class: 'q-ritem-text' }, [h('span', { class: 'q-ritem-title', text: title }), small]);
  const row = (title, value, { small = null, onclick = null, cls = '' } = {}) => h(onclick ? 'button' : 'div', { class: `q-ritem mn-rm-row${onclick ? ' chevron' : ''} ${cls}`.trim(), ...(onclick ? { type: 'button', onclick } : {}) }, [text(title, small), value]);

  const pickCycle = anchor => menu(anchor, CYCLES.map(([n, unit]) => ({ label: cycleName(n, unit), icon: n === f.n && unit === f.unit ? '✓' : '', onClick: () => ((f.n = n), (f.unit = unit), paint()) })));
  // A category, then (if it has any) one of its subs: a spend logged there starts the next one.
  const pickLink = anchor =>
    menu(anchor, [
      { label: W('不跟著記帳', 'None'), icon: f.cat ? '' : '✓', onClick: () => ((f.cat = ''), (f.sub = ''), paint()) },
      ...catList('out').map(c => ({
        label: catName(c, lang),
        icon: f.cat === c.id ? '✓' : '',
        onClick: () => {
          const pick = (cat, x) => ((f.cat = cat), (f.sub = x?.id || ''), !f.name.trim() && ((f.name = catName(x || c, lang)), (nameIn.value = f.name)), paint());
          if (!c.subs.length) return pick(c.id, null);
          setTimeout(() => menu(anchor, [{ label: W(`整個${catName(c, lang)}`, `All of ${catName(c, lang)}`), icon: f.cat === c.id && !f.sub ? '✓' : '', onClick: () => pick(c.id, null) }, ...c.subs.map(x => ({ label: catName(x, lang), icon: f.sub === x.id ? '✓' : '', onClick: () => pick(c.id, x) }))]), 0);
        }
      }))
    ]);

  function paint() {
    const s = st();
    label.textContent = f.name.trim() || linkName(f) || W('新提醒', 'New reminder');
    big.textContent = s.left == null ? '—' : s.left > 0 ? W(`${s.left} 天`, `${s.left} days`) : s.left === 0 ? W('今天', 'Today') : W('已到期', 'Ended');
    sub.textContent = s.due ? dueText(f, s) : W('選好開始日就會算', 'Choose a start day');
    startV.textContent = s.start ? dayLabel(s.start, { week: false, year: s.start.slice(0, 4) !== now.slice(0, 4) }) : W('選日期', 'Choose');
    // Where the day comes from: a spend logged, or set here.
    startSrc.textContent = s.src === 'entry' ? W(`從 ${md(s.e.d)} 記的那筆（${money(s.e.amt)}）`, `From the ${md(s.e.d)} spend (${money(s.e.amt)})`) : '';
    startSrc.hidden = !startSrc.textContent;
    cycleV.textContent = cycleName(f.n, f.unit);
    linkV.textContent = linkName(f) || W('不跟著', 'None');
    rollSub.textContent = f.roll ? W('像訂閱、年費，會自己扣款', 'Like a subscription') : W('到期要自己續，像 TPASS', 'Renewed by hand, like a TPASS');
    // Each time it can tell, its day beside it; the picked ones ticked in the accent.
    times.replaceChildren(
      onRow,
      ...(!f.on ? [] : AT).map(n => {
        const on = f.at.has(n);
        const what = n === 0 ? W('當天早上', 'That morning') : W(`前 ${n} 天晚上`, `${n} day${n === 1 ? '' : 's'} before`);
        return h('button', { class: 'q-ritem mn-rm-row mn-rm-at', type: 'button', role: 'checkbox', 'aria-checked': String(on), onclick: () => (tick(), on ? f.at.delete(n) : f.at.add(n), paint()) }, [
          h('span', { class: 'mn-rm-check', html: on ? icons.check : '' }),
          text(what),
          h('span', { class: 'q-ritem-value num', text: s.due ? `${md(addDays(s.due, -n))} ${n ? '20:00' : '08:00'}` : '' })
        ]);
      }),
      // (This phone hasn't allowed notices: asked from here.)
      ...(f.on && !notifyOn() && 'Notification' in globalThis ? [h('button', { class: 'q-ritem mn-rm-row mn-rm-allow', type: 'button', onclick: async () => ((await hooks.notices?.()) ? paint() : toast(W('請到系統設定允許通知', 'Allow notices in system settings'), { tone: 'bad' })) }, [text(W('允許這支手機通知', 'Allow notices on this phone'))])] : [])
    );
  }

  const lead = was
    ? h('button', {
        class: 'q-close mn-del',
        type: 'button',
        'aria-label': W('刪除', 'Delete'),
        html: icons.trash,
        onclick: async () => {
          if (!(await ask({ title: W(`刪除「${was.name}」？`, `Delete “${was.name}”?`), body: W('記過的帳不會動。', 'Nothing logged changes.'), ok: W('刪除', 'Delete'), cancel: W('取消', 'Cancel'), danger: true, icon: 'trash' }))) return;
          drop(b, 'renew', was.id);
          s.close();
          saved();
          done();
        }
      })
    : null;
  const s = sheet({
    title: was ? W('到期提醒', 'Reminder') : W('新增提醒', 'New reminder'),
    lead,
    cls: 'mn-rm',
    body: [
      focus,
      h('div', { class: 'q-rowcard mn-rm-card' }, [
        row(W('名稱', 'Name'), nameIn, { cls: 'mn-rm-name' }),
        h('label', { class: 'q-ritem mn-rm-row chevron mn-rm-date' }, [text(W('開始日', 'Start day'), startSrc), startV, dateIn]),
        row(W('多久一次', 'Lasts'), cycleV, { onclick: e => pickCycle(e.currentTarget) }),
        row(W('自動續訂', 'Renews itself'), rollSw, { small: rollSub }),
        row(W('跟著記帳', 'Follows'), linkV, { small: h('small', { text: W('記這類就重算', 'A spend here restarts it') }), onclick: e => pickLink(e.currentTarget) })
      ]),
      times
    ],
    foot: h('div', { class: 'q-sheet-foot' }, [
      h('button', {
        class: 'q-btn primary block',
        type: 'button',
        text: W('儲存', 'Save'),
        onclick: () => {
          const name = f.name.trim() || linkName(f);
          if (!name) return toast(W('請取個名字', 'Give it a name'), { tone: 'bad' }), nameIn.focus();
          const cur = st();
          put(b, 'renew', { ...(was || {}), name, start: f.start, n: f.n, unit: f.unit, roll: f.roll, cat: f.cat, sub: f.sub, on: f.on, at: [...f.at].sort((x, y) => y - x) });
          // (A start moved later than the spend it follows: that spend began then, ridden later than bought.)
          if (cur.src === 'entry' && f.start && f.start > cur.e.d) put(b, 'entries', { ...b.entries[cur.e.id], from: f.start });
          s.close();
          saved();
          toast(W('已儲存', 'Saved'));
          done();
        }
      })
    ])
  });
  paint();
  return s;
}

// Renewed by hand (月曆's 續購): a spend to log when it follows one, else the next one starts.
export function renewNow(r, s, openEntry) {
  const day = s.left >= 0 ? renewedBy(r, s) : today();
  if (r.cat) return openEntry({ cat: r.cat, sub: r.sub, day });
  put(state.books, 'renew', { ...r, start: day });
  saved();
  toast(W(`${r.name} 已續`, `${r.name} renewed`));
}
