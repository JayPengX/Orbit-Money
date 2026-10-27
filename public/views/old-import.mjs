// Another app's books (lib/oldbooks.mjs: 天天記帳's CSV) brought in as past
// history, from the 帳戶 tab: picked, shown as a count, a span and what it
// holds, then added; taken out again in one tap. Never a balance.
import { h, sheet, toast } from '#kit/ui.mjs';
import { ask } from '#kit/orbit.mjs';
import { live, put, drop } from '../lib/books.mjs';
import { tiantianEntries, isTiantian, SOURCE } from '../lib/oldbooks.mjs';
import { csvText } from '../lib/invoice.mjs';
import { glyph } from '../lib/cats.mjs';
import { state, W, money, dayLabel, saved } from '../shell.mjs';
import { shortName } from './invoices.mjs';

const imported = () => live(state.books.entries).filter(e => e.src === SOURCE);

// The section at the foot of 帳戶.
export function oldSection() {
  const have = imported();
  return h('section', { class: 'q-section' }, [
    h('div', { class: 'q-section-head' }, [h('h2', { text: W('舊資料', 'Old books') })]),
    have.length
      ? h('div', { class: 'q-rowcard' }, [
          h('div', { class: 'q-ritem' }, [
            h('span', { class: 'q-ritem-text' }, [h('span', { class: 'q-ritem-title', text: W(`${SOURCE} ${have.length} 筆`, `${SOURCE}: ${have.length}`) }), h('small', { text: W('只當歷史，不影響餘額', 'History only, never a balance') })]),
            h('button', { class: 'q-btn plain small danger', type: 'button', text: W('移除', 'Remove'), onclick: () => removeOld(have.length) })
          ])
        ])
      : h('button', { class: 'q-btn glass mn-oldbtn', type: 'button', onclick: () => pickOld() }, [h('span', { html: glyph('receipt') }), W('從天天記帳匯入', 'Import from 天天記帳')])
  ]);
}

function pickOld() {
  const file = h('input', { type: 'file', accept: '.csv,text/csv,text/plain', hidden: '' });
  document.body.append(file);
  file.addEventListener('change', async () => {
    const f = file.files?.[0];
    file.remove();
    if (!f) return;
    let text = '';
    try {
      text = csvText(new Uint8Array(await f.arrayBuffer()));
    } catch {}
    const list = isTiantian(text) ? tiantianEntries(text, { shorten: shortName }) : [];
    if (!list.length) return toast(W('這不是天天記帳匯出的檔案', 'That isn’t a 天天記帳 export'), { tone: 'bad' });
    review(list);
  });
  file.click();
}

function review(list) {
  const b = state.books;
  // (One removed before comes back: importing again is asking for it.)
  const fresh = list.filter(e => !b.entries[e.id] || b.entries[e.id].del);
  const out = fresh.filter(e => e.k === 'out').reduce((t, e) => t + e.amt, 0);
  const inc = fresh.filter(e => e.k === 'in').reduce((t, e) => t + e.amt, 0);
  const invs = fresh.filter(e => e.inv).length;
  const s = sheet({
    title: W('匯入舊資料', 'Import old books'),
    detent: 'medium',
    cls: 'mn-import',
    body: [
      h('div', { class: 'q-fig mn-facts' }, [
        h('div', {}, [h('small', { text: W('筆數', 'Entries') }), h('b', { class: 'num', text: String(fresh.length) })]),
        h('div', {}, [h('small', { text: W('支出', 'Spent') }), h('b', { class: 'num q-fit', text: money(out) })]),
        h('div', {}, [h('small', { text: W('收入', 'Income') }), h('b', { class: 'num q-fit', text: money(inc) })])
      ]),
      h('p', { class: 'mn-hint', text: fresh.length ? `${dayLabel(fresh[0].d, { week: false, year: true })} – ${dayLabel(fresh.at(-1).d, { week: false, year: true })} · ${W(`${invs} 張發票`, `${invs} invoices`)}` : W('這個檔案都匯入過了。', 'This file is already in.') }),
      h('p', { class: 'mn-hint', text: W('只當歷史：月曆和統計看得到，發票會對獎，但不算進任何帳戶的餘額。帳戶從你開始記的那天，用當天的真實餘額新增。', 'History only: it shows in the calendar and stats and its invoices are checked, but no account’s balance counts it. Add your accounts with their real balances on the day you start.') })
    ],
    foot: fresh.length
      ? h('div', { class: 'q-sheet-foot' }, [
          h('button', {
            class: 'q-btn primary',
            type: 'button',
            text: W(`匯入 ${fresh.length} 筆`, `Import ${fresh.length}`),
            onclick: () => {
              const now = Date.now();
              for (const [n, e] of fresh.entries()) put(b, 'entries', { ...e, t: now - (fresh.length - n) }, now);
              b.st = Math.round(now / 1000);
              s.close();
              toast(W(`匯入了 ${fresh.length} 筆`, `${fresh.length} imported`));
              saved();
            }
          })
        ])
      : null
  });
}

async function removeOld(n) {
  if (!(await ask({ title: W(`移除 ${n} 筆舊資料？`, `Remove ${n} old entries?`), body: W('只移除匯入的歷史，你自己記的不受影響。', 'Only the imported history goes; what you added stays.'), ok: W('移除', 'Remove'), cancel: W('取消', 'Cancel'), danger: true, icon: 'trash' }))) return;
  const now = Date.now();
  for (const e of imported()) drop(state.books, 'entries', e.id, now);
  toast(W('已移除', 'Removed'));
  saved();
}
