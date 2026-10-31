// 更多: everything that isn't the books themselves. First 拍照記帳 (any
// receipt, bill or screenshot into an entry: views/photo.mjs; Jay 2026-10-31,
// in place of the 發票 tools), then the tools as rows: the categories, 智慧帶入,
// 到期提醒, the repeats, 預算 (only while none is set: once one is, it lives in
// 統計), the accounts put away (when there are any), the books as a file.
import { h, toast, sheet, toggle, tile } from '#kit/ui.mjs';
import { live } from '../lib/books.mjs';
import { catList, catName, subOf, catOf, glyph, presetOf } from '../lib/cats.mjs';
import { reminders } from '../lib/renew.mjs';
import { guessScore, guessReplay } from '../lib/guess.mjs';
import { openRenewals } from './renew.mjs';
import { state, W, today, acctName, card, allAccounts, saved } from '../shell.mjs';
import { snap } from './photo.mjs';
import { openCats, presetName } from './cat-edit.mjs';
import { openRepeats, openClosed, repeatsOf } from './accounts.mjs';
import { openBudgets } from './stats.mjs';

export function renderMore(box) {
  // 拍照記帳 first, as a row of its own with what it reads (Jay 10-31: the
  // gold button with a caption under it floated; "ugly").
  const ways = h('section', { class: 'q-section' }, [
    h('div', { class: 'q-rowcard' }, [
      h('button', { class: 'q-ritem chevron mn-tool mn-snaprow', type: 'button', onclick: () => snap() }, [
        tile(glyph('camera'), 'var(--q-accent)'),
        h('span', { class: 'q-ritem-text' }, [h('span', { class: 'q-ritem-title', text: W('拍照記帳', 'Add from a photo') }), h('small', { text: W('收據、帳單、截圖，AI 幫你填好', 'Receipts, bills, screenshots: AI fills it in') })])
      ])
    ])
  ]);

  const reps = repeatsOf();
  const closed = allAccounts().filter(a => a.closed);
  const cats = catList('out').length + catList('in').length;
  const next = reminders(state.books, today())[0];
  const score = guessScore(state.books);
  // Each tool: its tile, what it is (or where it stands), and a number when there is one.
  const tool = (icon, color, label, sub, value, onclick) =>
    h('button', { class: 'q-ritem chevron mn-tool', type: 'button', onclick }, [
      tile(icon, color),
      h('span', { class: 'q-ritem-text' }, [h('span', { class: 'q-ritem-title', text: label }), sub ? h('small', { text: sub }) : null]),
      value ? h('span', { class: 'q-ritem-value num', text: value }) : null
    ]);
  const dueIn = next?.due ? Math.round((Date.parse(next.due) - Date.parse(today())) / 86_400_000) : null;
  const tools = h('section', { class: 'q-section' }, [
    h('div', { class: 'q-section-head q-list-head' }, [h('h2', { text: W('工具', 'Tools') })]),
    h('div', { class: 'q-rowcard' }, [
      tool(glyph('grid'), '#8e8e93', W('分類', 'Categories'), W(`範本：${presetName(presetOf(state.books))}`, `Set: ${presetName(presetOf(state.books))}`), W(`${cats} 個`, `${cats}`), () => openCats()),
      // (How often 記一筆's guesses were right, once there are a few.)
      tool(glyph('spark'), '#af52de', W('智慧帶入', 'Smart fill'), W('照你的習慣先選好分類和付款', 'Picks what you usually log'), score.of >= 5 ? W(`猜中 ${pct(score.what, score.of)}`, `${pct(score.what, score.of)} right`) : '', () => openGuessing()),
      // (TPASS, subscriptions, memberships: the soonest one.)
      tool(glyph('bell'), '#ff9500', W('到期提醒', 'Reminders'), next?.due ? `${next.r.name} ${Number(next.due.slice(5, 7))}/${Number(next.due.slice(8))}` : W('TPASS、訂閱、會員到期前提醒', 'TPASS, subscriptions, memberships'), dueIn == null ? '' : dueIn <= 0 ? W('今天', 'Today') : W(`${dueIn} 天後`, `in ${dueIn} d`), () => openRenewals()),
      // (Nothing set: no value at all; examples there read as if set. Jay 2026-10-27.)
      tool(glyph('repeat'), '#30b0c7', W('固定收支', 'Repeats'), W('房租、薪水，到日子自動記', 'Rent, pay: logged on the day'), reps.length ? W(`${reps.length} 個`, `${reps.length}`) : '', () => openRepeats()),
      live(state.books.budgets).length ? null : tool(glyph('target'), '#ff3b30', W('預算', 'Budget'), W('每月上限，統計裡看剩多少', 'A monthly cap, tracked in Stats'), '', () => openBudgets()),
      closed.length ? tool(glyph('lock'), '#8e8e93', W('已封存', 'Put away'), W('不用的帳戶', 'Accounts no longer used'), W(`${closed.length} 個`, `${closed.length}`), () => openClosed()) : null,
      tool(glyph('share'), '#0088ff', W('匯出', 'Export'), W('整本帳本存成試算表', 'All entries as a spreadsheet'), 'CSV', () => exportCsv())
    ])
  ]);
  box.replaceChildren(ways, tools);
}

const pct = (n, of) => `${Math.round((n / of) * 100)}%`;

// 智慧帶入 (Jay 2026-10-30): what 記一筆 guesses from, how often it's been
// right lately, and whether it may use where the phone is (off until turned
// on: the browser asks once; a place is kept to about 100 m, in the books only).
function openGuessing() {
  const b = state.books;
  // (Few live guesses yet: the same guesses replayed on what's been logged, so there's a number from day one.)
  const kept = guessScore(b);
  const replayed = kept.of < 10 ? guessReplay(b) : null;
  const r = replayed?.of >= 10 ? replayed : kept;
  const geo = toggle({
    checked: Boolean(b.opt?.geo),
    label: W('用所在位置', 'Use where I am'),
    onChange: on => {
      b.opt = { ...b.opt, geo: on ? 1 : 0 };
      b.st = Math.round(Date.now() / 1000);
      saved();
      // (Asked now, so the question comes from the switch, not later in 記一筆.)
      if (on) navigator.geolocation?.getCurrentPosition(() => {}, () => toast(W('手機沒有允許位置，可在設定裡打開', 'Location isn’t allowed on this phone'), { tone: 'bad' }), { maximumAge: 300_000, timeout: 15_000 });
    }
  });
  const row = (label, n) => h('div', { class: 'q-ritem mn-row' }, [h('span', { class: 'q-ritem-text' }, [h('span', { class: 'q-ritem-title', text: label })]), h('span', { class: 'q-ritem-value num', text: `${n} / ${r.of}` })]);
  sheet({
    title: W('智慧帶入', 'Smart fill'),
    cls: 'mn-guess-sheet',
    body: [
      h('p', { class: 'mn-hint', text: W('記一筆時，照你自己記過的帳：差不多這個時間、平日或週末、同一個地方常記的，先選好收支、分類和付款方式。金額放在「常用」第一個，點了才填。', 'New entries start as what you usually log at this time, on this kind of day and in this place: kind, category and way to pay picked for you. The amount waits first in Usual until you tap it.') }),
      h('div', { class: 'mn-switch-row' }, [h('span', {}, [h('b', { text: W('用所在位置', 'Use where I am') }), h('small', { text: W('只記到約 100 公尺，存在你自己的帳本裡', 'Kept to about 100 m, only in your own books') })]), geo]),
      r.of >= 1 ? h('div', { class: 'q-section-head q-list-head' }, [h('h2', { text: r === replayed ? W(`用你記過的 ${r.of} 筆重猜`, `Replayed on your last ${r.of}`) : W(`最近 ${r.of} 筆猜中`, `Right in the last ${r.of}`) })]) : null,
      r.of >= 1 ? h('div', { class: 'q-rowcard' }, [row(W('分類', 'Category'), r.what), row(W('付款方式', 'Way to pay'), r.pay), row(W('金額', 'Amount'), r.amt), ...(r.chips != null ? [row(W('金額在常用裡', 'Amount in Usual'), r.chips)] : [])]) : null
    ]
  });
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
