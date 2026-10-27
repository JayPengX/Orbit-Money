// 更多: everything that isn't the books themselves (Jay 2026-10-27: 發票 is
// one feature, so the tab holds them all). First the ways purchases come in
// without typing (a paper invoice scanned, a picture read, the 載具 file),
// any prize to claim, then the tools as rows: 對獎, the 手機條碼, the categories, the repeats, 預算 (only while none is set:
// once one is, it lives in 統計), the accounts put away (when there are any), the books as a file.
import { h, toast } from '#kit/ui.mjs';
import { live } from '../lib/books.mjs';
import { catList, catName, subOf, catOf, glyph, passes } from '../lib/cats.mjs';
import { openRenewals } from './renew.mjs';
import { state, W, lang, today, dayLabel, acctName, card, allAccounts } from '../shell.mjs';
import { scanInvoice, invoiceState, wonCard, openInvoices, openBarcode } from './invoices.mjs';
import { importCarrier } from './carrier-import.mjs';
import { readPicture } from './read.mjs';
import { openCats } from './cat-edit.mjs';
import { openRepeats, openClosed, repeatsOf } from './accounts.mjs';
import { openBudgets } from './stats.mjs';

export function renderMore(box) {
  const way = (glyphName, label, onclick) => h('button', { class: 'q-ritem chevron mn-row', type: 'button', onclick }, [h('span', { class: 'mn-addrow-i mn-quiet', html: glyph(glyphName) }), h('span', { class: 'q-ritem-text' }, [h('span', { class: 'q-ritem-title', text: label })])]);
  // Bringing purchases in without typing: a plain section like the tools
  // below (Jay 10-27: no display headline), the scan button, then the other ways.
  const ways = h('section', { class: 'q-section' }, [
    h('div', { class: 'q-section-head q-list-head' }, [h('h2', { text: W('帶入消費', 'Bring purchases in') })]),
    h('button', { class: 'q-btn primary block mn-scanbtn', type: 'button', onclick: () => scanInvoice() }, [h('span', { class: 'mn-btn-glyph', html: glyph('scan') }), W('掃描紙本發票', 'Scan a paper invoice')]),
    h('div', { class: 'q-rowcard mn-ways' }, [
      way('camera', W('截圖・收據', 'Screenshot'), () => readPicture()),
      way('receipt', W('載具檔案', 'Carrier file'), () => importCarrier())
    ])
  ]);

  const inv = invoiceState();
  const won = inv.won.length ? h('section', { class: 'q-section' }, [h('div', { class: 'q-section-head' }, [h('h2', { text: W('中獎了', 'Winners') })]), wonCard(inv.won)]) : null;

  const carrier = state.books.carrier?.code || '';
  const reps = repeatsOf();
  const closed = allAccounts().filter(a => a.closed);
  const cats = catList('out').length + catList('in').length;
  const pass = passes(state.books, today(), { all: true })[0];
  const tool = (label, value, onclick) => h('button', { class: 'q-ritem chevron mn-row', type: 'button', onclick }, [h('span', { class: 'q-ritem-text' }, [h('span', { class: 'q-ritem-title', text: label })]), h('span', { class: 'q-ritem-value num', text: value })]);
  const tools = h('section', { class: 'q-section' }, [
    h('div', { class: 'q-section-head q-list-head' }, [h('h2', { text: W('工具', 'Tools') })]),
    h('div', { class: 'q-rowcard' }, [
      tool(W('發票對獎', 'Invoices'), inv.count ? W(`${inv.count} 張`, `${inv.count}`) : W('自動對獎', 'Auto-checked'), () => openInvoices()),
      tool(W('手機條碼', 'Barcode'), carrier || W('未設定', 'Not set'), () => openBarcode()),
      tool(W('分類', 'Categories'), W(`${cats} 個`, `${cats}`), () => openCats()),
      // (TPASS and anything else that lasts a while: when it ends, when to be told.)
      tool(W('到期提醒', 'Renewals'), pass ? `${catName(subOf(pass.sub) || catOf(pass.cat), lang)} ${pass.end ? dayLabel(pass.end, { week: false }) : W('未設定', 'not set')}` : '', () => openRenewals()),
      // (Nothing set: no value at all; examples there read as if set. Jay 2026-10-27.)
      tool(W('固定收支', 'Repeats'), reps.length ? W(`${reps.length} 個`, `${reps.length}`) : '', () => openRepeats()),
      live(state.books.budgets).length ? null : tool(W('預算', 'Budget'), '', () => openBudgets()),
      closed.length ? tool(W('已封存', 'Put away'), W(`${closed.length} 個帳戶`, `${closed.length}`), () => openClosed()) : null,
      tool(W('匯出', 'Export'), 'CSV', () => exportCsv())
    ])
  ]);
  box.replaceChildren(...(won ? [won] : []), ways, tools);
}

// The books as a spreadsheet: every entry, oldest first (shared on a phone, saved elsewhere).
async function exportCsv() {
  const KIND = { out: W('支出', 'Spend'), in: W('收入', 'Income'), move: W('轉帳', 'Transfer'), adj: W('調整餘額', 'Balance fix'), back: W('退款', 'Refund') };
  const kindOf = e => (e.k === 'back' && e.why === 'friend' ? W(`${e.who || '朋友'}分攤`, `${e.who || 'Friend'}’s share`) : KIND[e.k] || e.k);
  // (Another way a spend was paid: 「LINE Points 50」.)
  const also = e => (Array.isArray(e.also) ? e.also.map(p => `${acctName(p.a)} ${p.amt}`).join(' ') : '');
  const q = v => (/[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v ?? ''));
  const rows = live(state.books.entries)
    .sort((a, b) => a.d.localeCompare(b.d) || (a.t || 0) - (b.t || 0))
    .map(e => [e.d, kindOf(e), e.k === 'out' || e.k === 'in' || e.k === 'back' ? catName(catOf(e.cat), 'zh') : '', subOf(e.sub) ? catName(subOf(e.sub), 'zh') : '', e.k === 'out' ? -e.amt : e.amt, e.k === 'back' && e.wait ? W('還沒給', 'Not yet') : acctName(e.a), e.k === 'move' ? acctName(e.to) : card(e.via)?.name || '', e.fee ? -e.fee : '', also(e), e.note || '', e.inv?.no || '']);
  const head = W('日期,種類,分類,細項,金額,帳戶,轉入／付款方式,手續費,另付,備註,發票號碼', 'Date,Kind,Category,Sub,Amount,Account,To / paid with,Fee,Also paid with,Note,Invoice');
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
