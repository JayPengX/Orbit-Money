// The 載具's invoices, brought in from the file 財政部's 電子發票平台 emails
// (a person can't have an AppID, so this is the way in): picked, read
// (lib/invoice.mjs), shown as a count and a sum, then each invoice becomes a
// spending entry 'inv-<number>'. An invoice already in the books (scanned,
// imported, or imported and then deleted) is left alone, so the same file
// can come in again and again.
import { h, icons, sheet, toast, menu } from '#kit/ui.mjs';
import { live, put } from '../lib/books.mjs';
import { parseCarrierCsv, csvText } from '../lib/invoice.mjs';
import { guessCat, glyph } from '../lib/cats.mjs';
import { workerJson } from '#kit/orbit.mjs';
import { state, hooks, W, money, dayLabel, saved } from '../shell.mjs';
import { payOptions, lastPay } from './entry.mjs';
import { shortName } from './invoices.mjs';

const PLATFORM = 'https://www.einvoice.nat.gov.tw/';
const idOf = no => `inv-${no}`;

export function importCarrier() {
  const file = h('input', { type: 'file', accept: '.csv,.txt,text/csv,text/plain', hidden: '' });
  const s = sheet({
    title: W('匯入載具發票', 'Import carrier invoices'),
    detent: 'medium',
    cls: 'mn-import',
    body: [
      h('ol', { class: 'mn-steps' }, [
        h('li', {}, [W('到財政部電子發票平台登入手機條碼', 'Sign in with your barcode on the e-invoice platform'), ' ', h('a', { href: PLATFORM, target: '_blank', rel: 'noopener', text: W('開啟', 'Open') })]),
        h('li', { text: W('「個人」›「查詢消費發票」選月份，按「匯出」寄到信箱', '“Personal” › “Invoices”, pick the months, “Export” to your email') }),
        h('li', { text: W('把信裡的 CSV 存到檔案，回來這裡選它', 'Save the CSV from the email to Files and pick it here') })
      ]),
      h('p', { class: 'mn-hint', text: W('記過的發票不會重複記，同一個檔案匯入幾次都可以。', 'Invoices already in your books are skipped, so a file can come in again.') }),
      file
    ],
    foot: h('div', { class: 'q-sheet-foot' }, [h('button', { class: 'q-btn primary', type: 'button', onclick: () => file.click() }, [h('span', { html: glyph('receipt') }), W('選擇檔案', 'Choose the file')])])
  });
  file.addEventListener('change', async () => {
    const f = file.files?.[0];
    file.value = '';
    if (!f) return;
    let list = [];
    try {
      list = parseCarrierCsv(csvText(new Uint8Array(await f.arrayBuffer())));
    } catch {}
    if (!list.length) return toast(W('這個檔案裡沒有發票', 'No invoices in that file'), { tone: 'bad' });
    s.close();
    review(list);
  });
}

// The invoices not in the books yet (nor voided, nor imported and deleted).
function newOnes(list) {
  const b = state.books;
  const have = new Set(live(b.entries).map(e => e.inv?.no).filter(Boolean));
  return list.filter(i => !i.void && !have.has(i.no) && !b.entries[idOf(i.no)]);
}
// Each invoice a spending entry, paid from `pay` ({ a, via }); how many.
function addInvoices(list, pay) {
  const b = state.books;
  const now = Date.now();
  const fallback = b.opt?.lastCat?.out || 'other';
  for (const [n, i] of list.entries()) {
    const seller = shortName(i.seller);
    put(b, 'entries', { id: idOf(i.no), d: i.day, k: 'out', amt: Math.round(i.total), cat: guessCat(`${i.seller} ${i.items.map(x => x.name).join(' ')}`) || fallback, note: seller || i.items[0]?.name || '', a: pay.a, via: pay.via || '', to: '', inv: { no: i.no, day: i.day, sid: i.sid, seller, total: i.total, items: i.items, from: 'carrier' }, t: now + n }, now);
    if (i.sid && seller) state.sellers[i.sid] = i.seller;
  }
  if (list.length) b.st = Math.round(now / 1000);
  return list.length;
}

// ---- By mail ------------------------------------------------------------------------
// The account's own address (the Worker's money-mail.js): the export forwarded
// there is waiting the next time the app opens, and goes straight into the
// books (paid from the account last used), then is dropped from the box.
// state.mail: { address, confirm } once asked; address '' while the family has
// no mail domain yet.
let mailAt = 0;
export async function checkMail({ force = false } = {}) {
  if (!force && Date.now() - mailAt < 60_000) return;
  mailAt = Date.now();
  const r = await workerJson('/money-mail', 'op=box');
  if (!r) return;
  state.mail = { address: r.address || '', confirm: r.confirm || null };
  const items = Array.isArray(r.items) ? r.items : [];
  if (items.length) {
    const fresh = newOnes(items);
    const pay = lastPay();
    if (fresh.length) {
      addInvoices(fresh, { a: pay?.a || 'cash', via: pay?.via || '' });
      toast(W(`載具匯入 ${fresh.length} 筆`, `${fresh.length} carrier invoices added`));
      saved();
    }
    await workerJson('/money-mail', 'op=took', { body: JSON.stringify({ upto: Math.max(...items.map(i => i.at || 0)) }) });
  }
  if (state.tab === 'inv') hooks.render?.();
}
export async function newAddress() {
  const r = await workerJson('/money-mail', 'op=new', { body: '{}' });
  if (r) state.mail = { address: r.address || '', confirm: r.confirm || null };
  return Boolean(r);
}

function review(list) {
  const fresh = newOnes(list);
  const voided = list.filter(i => i.void).length;
  const pay = lastPay();
  const f = { a: pay?.a || 'cash', via: pay?.via || '' };
  const sum = fresh.reduce((t, i) => t + i.total, 0);
  const from = fresh[0]?.day;
  const to = fresh.at(-1)?.day;
  const payPill = h('button', { class: 'mn-pill', type: 'button' });
  const paintPay = () => payPill.replaceChildren(h('span', { class: 'mn-pill-t', text: payOptions().find(o => o.a === f.a && o.via === f.via)?.label || W('選帳戶', 'Choose') }), h('i', { html: icons.chevron }));
  payPill.onclick = e => menu(e.currentTarget, payOptions().map(o => ({ label: o.label, icon: o.a === f.a && o.via === f.via ? '✓' : '', onClick: () => ((f.a = o.a), (f.via = o.via), paintPay()) })));
  paintPay();
  const skipped = list.length - fresh.length - voided;
  const s = sheet({
    title: W('匯入載具發票', 'Import carrier invoices'),
    detent: 'large',
    cls: 'mn-import',
    body: [
      h('div', { class: 'q-fig mn-facts' }, [
        h('div', {}, [h('small', { text: W('新發票', 'New') }), h('b', { class: 'num', text: String(fresh.length) })]),
        h('div', {}, [h('small', { text: W('金額', 'Total') }), h('b', { class: 'num', text: money(sum) })])
      ]),
      h('p', { class: 'mn-hint', text: [from ? `${dayLabel(from, { week: false })} – ${dayLabel(to, { week: false })}` : '', skipped ? W(`${skipped} 張記過了`, `${skipped} already in`) : '', voided ? W(`${voided} 張作廢`, `${voided} voided`) : ''].filter(Boolean).join(' · ') }),
      fresh.length ? h('div', { class: 'mn-field' }, [h('span', { class: 'mn-field-l', text: W('從哪裡付', 'Paid from') }), payPill]) : null,
      fresh.length
        ? h('div', { class: 'q-rowcard mn-import-list' }, fresh.slice(-40).reverse().map(i => h('div', { class: 'q-ritem' }, [h('span', { class: 'q-ritem-text' }, [h('span', { class: 'q-ritem-title', text: shortName(i.seller) || i.items[0]?.name || i.no }), h('small', { text: `${dayLabel(i.day, { week: false })} · ${i.items.slice(0, 3).map(x => x.name).join('、') || i.no}` })]), h('span', { class: 'q-ritem-value num', text: money(i.total) })])))
        : h('p', { class: 'mn-hint', text: W('這個檔案的發票都記過了。', 'Every invoice in this file is already in.') })
    ],
    foot: fresh.length
      ? h('div', { class: 'q-sheet-foot' }, [
          h('button', {
            class: 'q-btn primary',
            type: 'button',
            text: W(`記下 ${fresh.length} 筆`, `Add ${fresh.length}`),
            onclick: () => {
              addInvoices(fresh, f);
              s.close();
              toast(W(`記好 ${fresh.length} 筆`, `${fresh.length} added`));
              saved();
            }
          })
        ])
      : null
  });
}

// The address and how to send to it: a Gmail filter forwards each export.
export function openMailSetup() {
  const m = state.mail || {};
  const copy = () => navigator.clipboard?.writeText(m.address).then(() => toast(W('已複製', 'Copied')), () => {});
  sheet({
    title: W('信箱自動匯入', 'Import by mail'),
    detent: 'large',
    cls: 'mn-import',
    body: [
      h('button', { class: 'mn-mailbox', type: 'button', onclick: copy }, [h('b', { text: m.address }), h('small', { text: W('點一下複製', 'Tap to copy') })]),
      m.confirm ? h('div', { class: 'mn-confirm' }, [h('small', { text: W('Gmail 確認碼', 'Gmail confirmation code') }), h('b', { class: 'num', text: m.confirm.code })]) : null,
      h('ol', { class: 'mn-steps' }, [
        h('li', { text: W('Gmail（電腦版）›「設定」›「轉寄和 POP/IMAP」›「新增轉寄地址」，貼上這個地址', 'Gmail (computer) › Settings › Forwarding › Add a forwarding address: paste this one') }),
        h('li', { text: W('Gmail 會寄確認碼過來：確認碼會出現在這裡', 'Gmail sends a code to confirm: it shows up here') }),
        h('li', { text: W('建立篩選器：寄件者含「einvoice」，動作選「轉寄到」這個地址', 'Make a filter: from contains “einvoice”, forward to this address') }),
        h('li', { text: W('之後在電子發票平台按「匯出」，打開 Orbit Money 就記好了', 'From then on, export on the e-invoice platform and open Orbit Money: it’s in') })
      ]),
      h('p', { class: 'mn-hint', text: W('只收財政部的明細檔；這個地址只屬於你的 Orbit Pass。地址外流的話可以換一個。', 'Only the Ministry’s export is read, and the address is your Orbit Pass’s alone. If it leaks, get a new one.') })
    ],
    foot: h('div', { class: 'q-sheet-foot mn-foot2' }, [
      h('button', {
        class: 'q-btn glass',
        type: 'button',
        text: W('換一個地址', 'New address'),
        onclick: async e => {
          const btn = e.currentTarget;
          btn.disabled = true;
          if (await newAddress()) {
            document.querySelector('dialog.mn-import')?.close();
            toast(W('換好了：記得更新 Gmail 的轉寄', 'Done: update your Gmail forwarding'));
            openMailSetup();
          } else btn.disabled = false;
        }
      }),
      h('button', { class: 'q-btn primary', type: 'button', text: W('複製地址', 'Copy address'), onclick: copy })
    ])
  });
}
