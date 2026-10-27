// The 載具's invoices, brought in from the file 財政部's 電子發票平台 emails
// (a person can't have an AppID, so this is the way in): picked, read
// (lib/invoice.mjs), shown as a count and a sum, then each invoice becomes a
// spending entry 'inv-<number>'. An invoice already in the books (scanned,
// imported, or imported and then deleted) is left alone, so the same file
// can come in again and again.
import { h, icons, sheet, toast, menu } from '#kit/ui.mjs';
import { live, put, autoReload } from '../lib/books.mjs';
import { parseCarrierCsv, csvText } from '../lib/invoice.mjs';
import { guessCat, guessSub, glyph } from '../lib/cats.mjs';
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
// One with no number (a receipt read from a picture): not when an entry of
// that day, amount and store is there already (the same picture read twice).
function newOnes(list) {
  const b = state.books;
  const all = live(b.entries);
  const have = new Set(all.map(e => e.inv?.no).filter(Boolean));
  const same = i => all.some(e => e.k === 'out' && e.d === i.day && e.amt === Math.round(i.total) && e.note === (shortName(i.seller) || i.items[0]?.name || ''));
  return list.filter(i => !i.void && (i.no ? !have.has(i.no) && !b.entries[idOf(i.no)] : !same(i)));
}
// Each invoice a spending entry, paid from `pay` ({ a, via }); how many.
function addInvoices(list, pay) {
  const b = state.books;
  const now = Date.now();
  const fallback = b.opt?.lastCat?.out || 'other';
  for (const [n, i] of list.entries()) {
    const seller = shortName(i.seller);
    const words = `${i.seller} ${i.items.map(x => x.name).join(' ')}`;
    const cat = guessCat(words) || fallback;
    const e = put(b, 'entries', { id: i.no ? idOf(i.no) : undefined, d: i.day, k: 'out', amt: Math.round(i.total), cat, sub: guessSub(cat, words), note: seller || i.items[0]?.name || '', a: pay.a, via: pay.via || '', to: '', inv: i.no ? { no: i.no, day: i.day, sid: i.sid || '', seller, total: i.total, items: i.items, from: i.from || 'carrier' } : null, t: now + n }, now);
    autoReload(b, e, now);
    if (i.sid && seller) state.sellers[i.sid] = i.seller;
  }
  if (list.length) b.st = Math.round(now / 1000);
  return list.length;
}

// ---- By mail ------------------------------------------------------------------------
// The account's own address (the Worker's money-mail.js), given to the 電子發票
// 平台 as the 手機條碼's email with 消費發票彙整通知 on: the platform mails the
// 載具's invoices there every week by itself, and they go straight into the
// books the next time the app opens (paid from the account last used), then
// are dropped from the box. state.mail: { address, note, got } once asked
// (note: 財政部's last mail without invoices, such as the check of the
// address; got: when invoices last came).
let mailAt = 0;
export async function checkMail({ force = false } = {}) {
  if (!force && Date.now() - mailAt < 60_000) return;
  mailAt = Date.now();
  const r = await workerJson('/money-mail', 'op=box');
  if (!r) return;
  state.mail = mailOf(r);
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
  if (state.tab === 'more') hooks.render?.();
}
export async function newAddress() {
  const r = await workerJson('/money-mail', 'op=new', { body: '{}' });
  if (r) state.mail = mailOf(r);
  return Boolean(r);
}
const mailOf = r => ({ address: r.address || '', note: r.note || null, got: r.got || null });

// Where mail-in stands, for 更多's row and the sheet: 'off' (address not
// given yet), 'check' (財政部's check of the address is here to tap), 'wait'
// (given, no invoices yet), 'on' (invoices came).
const seen = (k, v) => {
  try {
    if (v !== undefined) localStorage.setItem(`mn-mail-${k}`, v);
    return localStorage.getItem(`mn-mail-${k}`) || '';
  } catch {
    return '';
  }
};
export function mailStage(m = state.mail || {}) {
  if (m.got) return 'on';
  if (m.note?.link && seen('checked') !== String(m.note.at)) return 'check';
  return m.note || seen('given') === m.address ? 'wait' : 'off';
}
export function mailLabel(m = state.mail || {}) {
  const stage = mailStage(m);
  if (stage === 'on') return W('每週自動', 'Weekly');
  if (stage === 'check') return W('去驗證', 'Confirm');
  if (stage === 'wait') return W('等第一封信', 'Waiting');
  return W('未設定', 'Not set');
}

// The invoices to add, looked over first: a 載具 file's, or a picture's (讀圖).
export function review(list, { title = W('匯入載具發票', 'Import carrier invoices'), what = W('這個檔案的發票都記過了。', 'Every invoice in this file is already in.') } = {}) {
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
    title,
    detent: 'large',
    cls: 'mn-import',
    body: [
      h('div', { class: 'q-fig mn-facts' }, [
        h('div', {}, [h('small', { text: W('新的', 'New') }), h('b', { class: 'num', text: String(fresh.length) })]),
        h('div', {}, [h('small', { text: W('金額', 'Total') }), h('b', { class: 'num', text: money(sum) })])
      ]),
      h('p', { class: 'mn-hint', text: [from ? `${dayLabel(from, { week: false })} – ${dayLabel(to, { week: false })}` : '', skipped ? W(`${skipped} 張記過了`, `${skipped} already in`) : '', voided ? W(`${voided} 張作廢`, `${voided} voided`) : ''].filter(Boolean).join(' · ') }),
      fresh.length ? h('div', { class: 'mn-field' }, [h('span', { class: 'mn-field-l', text: W('從哪裡付', 'Paid from') }), payPill]) : null,
      fresh.length
        ? h('div', { class: 'q-rowcard mn-import-list' }, fresh.slice(-40).reverse().map(i => h('div', { class: 'q-ritem' }, [h('span', { class: 'q-ritem-text' }, [h('span', { class: 'q-ritem-title', text: shortName(i.seller) || i.items[0]?.name || i.no }), h('small', { text: `${dayLabel(i.day, { week: false })} · ${i.items.slice(0, 3).map(x => x.name).join('、') || i.no}` })]), h('span', { class: 'q-ritem-value num', text: money(i.total) })])))
        : h('p', { class: 'mn-hint', text: what })
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

// Mail-in in three taps: copy the address, give it to the 電子發票平台 (as
// the 手機條碼's email, with 消費發票彙整通知 on), tap 財政部's check when it
// lands here. The steps tick themselves off, the one button is always the
// next thing to do, and the top says where it stands, checked every 15
// seconds while the sheet is open.
export async function openMailSetup() {
  if (!state.mail?.address) await checkMail({ force: true });
  const m = () => state.mail || {};
  const status = h('div', { class: 'mn-mailstate' });
  const steps = h('ol', { class: 'mn-msteps' });
  const note = h('div');
  const foot = h('div', { class: 'q-sheet-foot' });
  const copy = () =>
    navigator.clipboard?.writeText(m().address).then(
      () => (seen('copied', m().address), toast(W('已複製地址', 'Address copied')), paint()),
      () => {}
    );
  const openPlatform = () => {
    seen('given', m().address);
    window.open(PLATFORM, '_blank', 'noopener');
    paint();
  };
  const confirm = () => {
    seen('checked', String(m().note.at));
    window.open(m().note.link, '_blank', 'noopener');
    paint();
  };
  const step = (done, now, title, extra) => h('li', { class: `mn-mstep${done ? ' done' : ''}${now ? ' now' : ''}` }, [h('span', { class: 'mn-mstep-n', 'aria-hidden': 'true' }), h('div', { class: 'mn-mstep-t' }, [h('b', { text: title }), extra])]);
  const paint = () => {
    const { address, note: n, got } = m();
    const stage = mailStage();
    const copied = seen('copied') === address;
    const given = stage !== 'off';
    status.replaceChildren(
      h('span', { class: `mn-mailstate-dot ${stage === 'on' ? 'ok' : stage === 'off' ? '' : 'wait'}`, 'aria-hidden': 'true' }),
      h('div', { class: 'mn-mailstate-t' }, [
        h('b', { text: stage === 'on' ? W('✓ 已收到', '✓ Received') : stage === 'check' ? W('財政部的驗證信到了', 'The check arrived') : given ? W('等第一封信', 'Waiting for the first mail') : W('還沒設定', 'Not set up yet') }),
        h('small', {
          text:
            stage === 'on'
              ? W(`上次 ${dayLabel(new Date(got.at + 8 * 3600_000).toISOString().slice(0, 10), { week: false })} · ${got.n} 張 · 之後每週自動`, `Last ${dayLabel(new Date(got.at + 8 * 3600_000).toISOString().slice(0, 10), { week: false })} · ${got.n} · weekly now`)
              : stage === 'check'
                ? W('點下面的「完成驗證」就好', 'Tap “Confirm” below')
                : given
                  ? W('財政部每週寄一次明細，到了會自動記好', 'The Ministry mails your invoices weekly; they’ll be added')
                  : W('設定一次，載具發票每週自動記好', 'Set it once: carrier invoices come in every week')
        })
      ])
    );
    steps.replaceChildren(
      step(copied || given, !copied && !given, W('複製你的專屬地址', 'Copy your own address'), h('button', { class: 'mn-mailbox', type: 'button', onclick: copy }, [h('span', { class: 'q-fit', text: address || W('取得地址中…', 'Getting your address…') }), h('small', { text: W('點一下複製', 'Tap to copy') })])),
      step(given, copied && !given, W('到電子發票平台貼上', 'Paste it on the e-invoice platform'), h('small', { text: W('用手機條碼登入 ›「個人化設定」：電子信箱換成這個地址，打開「消費發票彙整通知」', 'Sign in with your barcode › personal settings: set this as your email, turn on the weekly invoice summary') })),
      step(stage === 'on' || (n?.link && stage !== 'check'), stage === 'check', W('點財政部的驗證信', 'Tap the Ministry’s check'), h('small', { text: n?.link ? (n.code ? W(`驗證碼 ${n.code}`, `Code ${n.code}`) : n.subject || '') : W('驗證信會直接出現在這裡', 'It shows up right here') }))
    );
    // 財政部's other mail (a prize notice) once it's set up: shown, never lost.
    note.replaceChildren(...(stage === 'on' && n && n.at > got.at - 1 ? [h('a', { class: 'mn-mailnote', href: n.link || PLATFORM, target: '_blank', rel: 'noopener' }, [h('small', { text: W('財政部來信', 'From the Ministry') }), h('span', { text: n.subject || W('打開', 'Open') })])] : []));
    const [label, act, cls] =
      stage === 'on'
        ? [W('完成', 'Done'), () => s.close(), 'glass']
        : stage === 'check'
          ? [W('完成驗證', 'Confirm'), confirm, 'primary']
          : !copied && !given
            ? [W('複製地址', 'Copy address'), copy, 'primary']
            : [W('開啟電子發票平台', 'Open the e-invoice platform'), openPlatform, given ? 'glass' : 'primary'];
    foot.replaceChildren(h('button', { class: `q-btn ${cls} block`, type: 'button', text: label, onclick: act, disabled: address ? null : '' }));
  };
  const s = sheet({
    title: W('載具發票自動記帳', 'Carrier invoices by mail'),
    cls: 'mn-import mn-mail',
    body: [
      status,
      steps,
      note,
      h('p', { class: 'mn-hint' }, [
        W('這個地址只屬於你的 Orbit Pass，只收財政部的明細。', 'The address is your Orbit Pass’s alone and only reads the Ministry’s invoices. '),
        h('button', { class: 'mn-linkbtn', type: 'button', text: W('換一個地址', 'New address'), onclick: renew })
      ])
    ],
    foot
  });
  async function renew(e) {
    const btn = e.currentTarget;
    btn.disabled = true;
    if (await newAddress()) {
      toast(W('換好了：到電子發票平台改成新地址', 'Done: give the platform the new address'));
      paint();
    }
    btn.disabled = false;
  }
  paint();
  // While it's open: the check or the first mail may land any moment.
  const tick = setInterval(async () => {
    if (!s.el.isConnected || !s.el.open) return clearInterval(tick);
    if (document.visibilityState !== 'visible') return;
    await checkMail({ force: true });
    paint();
  }, 15_000);
}
