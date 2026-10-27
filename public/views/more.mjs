// 更多: everything that isn't the books themselves (Jay 2026-10-27: 發票 is
// one feature, so the tab holds them all). First the ways purchases come in
// without typing (a paper invoice scanned, a picture read, the 載具 file, the
// mail-in), any prize to claim, then the tools as tiles: 對獎, the 手機條碼,
// the categories, the repeats, the accounts put away, the books as a file.
import { h, icons, tile, toast } from '#kit/ui.mjs';
import { live } from '../lib/books.mjs';
import { catList, catName, subOf, catOf, glyph } from '../lib/cats.mjs';
import { state, W, money, today, acctName, card, allAccounts } from '../shell.mjs';
import { scanInvoice, invoiceState, wonCard, openInvoices, openBarcode } from './invoices.mjs';
import { importCarrier, openMailSetup } from './carrier-import.mjs';
import { readPicture } from './read.mjs';
import { openCats } from './cat-edit.mjs';
import { openRepeats, openClosed, repeatsOf } from './accounts.mjs';

export function renderMore(box) {
  const month = today().slice(0, 7);
  const brought = live(state.books.entries).filter(e => e.inv?.no && e.d.startsWith(month));
  const mailOn = Boolean(state.mail?.address);
  const way = (glyphName, label, onclick) => h('button', { class: 'mn-way', type: 'button', onclick }, [h('span', { html: glyph(glyphName) }), label]);
  const hero = h('section', { class: 'q-hero-card mn-hero mn-inhero' }, [
    h('span', { class: 'q-hc-eyebrow' }, [h('span', { html: glyph('receipt') }), W('帶入消費，不用打字', 'Bring purchases in')]),
    brought.length
      ? h('span', { class: 'mn-in-stat' }, [h('b', { class: 'num', text: W(`${brought.length} 張發票`, `${brought.length} invoices`) }), h('small', { text: W(`這個月帶入 · ${money(brought.reduce((t, e) => t + (e.inv.total ?? e.amt), 0))}`, `this month · ${money(brought.reduce((t, e) => t + (e.inv.total ?? e.amt), 0))}`) })])
      : h('span', { class: 'mn-in-stat' }, [h('b', { text: W('店家、金額、品項', 'Store, total, items') }), h('small', { text: W('自動填好，記下前先看過', 'filled in for you to check') })]),
    h('button', { class: 'mn-hero-cta', type: 'button', onclick: () => scanInvoice() }, [h('span', { html: glyph('scan') }), W('掃描紙本發票', 'Scan a paper invoice')]),
    h('div', { class: `mn-ways n${mailOn ? 3 : 2}` }, [
      way('camera', W('截圖・收據', 'Screenshot'), () => readPicture()),
      way('receipt', W('載具檔案', 'Carrier file'), () => importCarrier()),
      mailOn ? way('mail', W('信箱匯入', 'By mail'), () => openMailSetup()) : null
    ]),
    state.mail?.confirm ? h('span', { class: 'mn-hero-tag', text: W(`Gmail 確認碼 ${state.mail.confirm.code}`, `Gmail code ${state.mail.confirm.code}`) }) : null
  ]);

  const inv = invoiceState();
  const won = inv.won.length ? h('section', { class: 'q-section' }, [h('div', { class: 'q-section-head' }, [h('h2', { text: W('中獎了', 'Winners') })]), wonCard(inv.won)]) : null;

  const carrier = state.books.carrier?.code || '';
  const reps = repeatsOf();
  const closed = allAccounts().filter(a => a.closed);
  const cats = catList('out').length + catList('in').length;
  const tool = (icon, color, label, sub, onclick) => h('button', { class: 'mn-tool', type: 'button', onclick }, [tile(icon, color), h('b', { text: label }), h('small', { text: sub })]);
  const tools = h('section', { class: 'q-section' }, [
    h('div', { class: 'q-section-head' }, [h('h2', { text: W('工具', 'Tools') })]),
    h('div', { class: 'mn-tools' }, [
      tool(icons.trophy, '#f59e0b', W('發票對獎', 'Invoices'), inv.count ? W(`${inv.count} 張`, `${inv.count}`) : W('自動對獎', 'Auto-checked'), () => openInvoices()),
      tool(glyph('barcode'), '#3a3a3c', W('手機條碼', 'Barcode'), carrier || W('未設定', 'Not set'), () => openBarcode()),
      tool(icons.list, '#6155f5', W('分類', 'Categories'), W(`${cats} 個`, `${cats}`), () => openCats()),
      tool(glyph('repeat'), '#0088ff', W('固定收支', 'Repeats'), reps.length ? W(`${reps.length} 個`, `${reps.length}`) : W('房租、TPASS', 'Rent, TPASS'), () => openRepeats()),
      tool(icons.lock, '#8e8e93', W('已封存', 'Put away'), closed.length ? W(`${closed.length} 個帳戶`, `${closed.length}`) : W('沒有', 'None'), () => openClosed()),
      tool(icons.share, '#34c759', W('匯出', 'Export'), 'CSV', () => exportCsv())
    ])
  ]);
  box.replaceChildren(hero, ...(won ? [won] : []), tools);
}

// The books as a spreadsheet: every entry, oldest first (shared on a phone, saved elsewhere).
async function exportCsv() {
  const KIND = { out: W('支出', 'Spend'), in: W('收入', 'Income'), move: W('轉帳', 'Transfer'), adj: W('調整餘額', 'Balance fix') };
  const q = v => (/[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v ?? ''));
  const rows = live(state.books.entries)
    .sort((a, b) => a.d.localeCompare(b.d) || (a.t || 0) - (b.t || 0))
    .map(e => [e.d, KIND[e.k] || e.k, e.k === 'out' || e.k === 'in' ? catName(catOf(e.cat), 'zh') : '', subOf(e.sub) ? catName(subOf(e.sub), 'zh') : '', e.k === 'out' ? -e.amt : e.amt, acctName(e.a), e.k === 'move' ? acctName(e.to) : card(e.via)?.name || '', e.note || '', e.inv?.no || '']);
  const head = W('日期,種類,分類,細項,金額,帳戶,轉入／付款方式,備註,發票號碼', 'Date,Kind,Category,Sub,Amount,Account,To / paid with,Note,Invoice');
  const text = `﻿${[head, ...rows.map(r => r.map(q).join(','))].join('\n')}\n`;
  const name = `orbit-money-${today()}.csv`;
  const file = new File([text], name, { type: 'text/csv' });
  try {
    if (navigator.canShare?.({ files: [file] })) return await navigator.share({ files: [file], title: name });
  } catch (e) {
    if (e?.name === 'AbortError') return;
  }
  const a = h('a', { href: URL.createObjectURL(file), download: name });
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  toast(W(`匯出 ${rows.length} 筆`, `${rows.length} entries exported`));
}
