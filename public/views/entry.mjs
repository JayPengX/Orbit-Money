// One entry: its row (in every list), and the sheet that adds or changes it:
// spending, income or a transfer; the amount on the app's own keypad (+ and −
// add up as you type); the category; how it was paid; the day; a note; the
// 發票 it came from. A scanned 發票 opens it filled in.
import { h, icons, tile, segmented, sheet, menu, toast, tick } from '#kit/ui.mjs';
import { ask } from '#kit/orbit.mjs';
import { put, drop, live } from '../lib/books.mjs';
import { catsFor, catOf, catName, glyph, lookOf, subsOf, subOf, guessSub } from '../lib/cats.mjs';
import { state, W, en, lang, money, dayLabel, today, saved, acct, card, allAccounts, openAccounts, cardsOf, payLabel, kindName } from '../shell.mjs';

// ---- A row ----------------------------------------------------------------------

export function entryRow(e, { day = false, inAcct = false, inCat = false } = {}) {
  const look = lookOf(e);
  const fine = subOf(e.sub);
  // (Inside a category's own list: only its sub.)
  const what = fine ? catName(fine, lang) : inCat ? '' : catName(look, lang);
  const title = e.note || e.inv?.seller || (e.k === 'move' ? W('轉帳', 'Transfer') : e.k === 'adj' ? W('調整餘額', 'Balance fix') : what || catName(look, lang));
  // (The category under a note or a store, so a row always says what it was.)
  const named = e.note || e.inv?.seller;
  const sub = [day ? dayLabel(e.d, { week: false }) : '', named && e.k !== 'move' && e.k !== 'adj' ? what : '', inAcct ? state.books.cards?.[e.via]?.name || '' : inCat ? '' : payLabel(e)].filter(Boolean).join(' · ');
  const sign = e.k === 'in' ? 'in' : e.k === 'out' ? 'out' : 'move';
  const amt = e.k === 'in' ? money(e.amt, { sign: true }) : e.k === 'adj' ? money(e.amt, { sign: true }) : money(e.amt);
  return h('button', { class: 'q-ritem chevron mn-row', type: 'button', onclick: () => openEntry({ entry: e }) }, [
    tile(glyph(look.icon), look.color),
    h('span', { class: 'q-ritem-text' }, [h('span', { class: 'q-ritem-title', text: title }), h('small', {}, [sub, e.inv ? h('i', { class: 'mn-inv-mark', 'aria-label': W('有發票', 'Has invoice'), html: glyph('receipt') }) : null])]),
    h('span', { class: `q-ritem-value num mn-amt ${sign}`, text: amt })
  ]);
}

// ---- How it's paid ------------------------------------------------------------------

// Every way to pay: each account (a bank by 轉帳), and each debit card on a bank.
// (Put-away accounts and ways to pay only when `keep` names them: what an
// entry being changed already uses; `all` for finding a label.)
export function payOptions({ moving = false, keep = [], all = false } = {}) {
  const out = [];
  const shown = r => all || !r.closed || keep.includes(r.id);
  for (const a of allAccounts()) {
    if (!shown(a)) continue;
    out.push({ a: a.id, via: '', label: a.name, sub: kindName(a.kind) });
    if (!moving) for (const c of cardsOf(a.id).filter(shown)) out.push({ a: a.id, via: c.id, label: `${a.name} · ${c.name}${c.last4 ? ` •${c.last4}` : ''}`, sub: kindName(a.kind) });
  }
  return out;
}
const payOf = (a, via) => payOptions({ all: true }).find(o => o.a === a && o.via === (via || '')) || null;
export function lastPay() {
  const p = state.books.opt?.lastPay;
  return (p && acct(p.a) && !acct(p.a).closed && !card(p.via)?.closed && payOf(p.a, p.via)) || payOf('cash', '') || payOptions()[0] || null;
}

// The categories as tiles (two rows across, the picked one lit): the entry
// sheet's and a repeat's, one look.
export function catTiles(kind, cur, onPick) {
  return catsFor(kind).map(c => h('button', { class: 'mn-cat', type: 'button', role: 'radio', 'data-cat': c.id, 'aria-checked': String(c.id === cur), onclick: () => (tick(), onPick(c.id)) }, [tile(glyph(c.icon), c.color), h('span', { text: catName(c, lang) })]));
}

// A category's subs as chips under the tiles: one lit, tapped again to let go
// ('' none). Empty when the category has none.
export function subChips(cat, cur, onPick) {
  return subsOf(cat).map(x => h('button', { class: 'mn-subchip', type: 'button', 'aria-pressed': String(x.id === cur), 'data-sub': x.id, onclick: () => (tick(), onPick(x.id === cur ? '' : x.id)) }, catName(x, lang)));
}

// ---- The keypad's sum ---------------------------------------------------------------

// '120+35-5' → 150 (whole NT$; an unfinished '+' at the end is ignored).
export function sumOf(expr) {
  const parts = String(expr).replace(/[+−-]$/, '').match(/[+−-]?\d+/g) || [];
  return parts.reduce((s, p) => s + (p[0] === '−' || p[0] === '-' ? -1 : 1) * Number(p.replace(/^[+−-]/, '')), 0);
}

// ---- The sheet ----------------------------------------------------------------------

// openEntry({ entry }) to change one; { day, kind, inv, amt, note, cat } to add one.
export function openEntry({ entry = null, day = today(), kind = 'out', inv = null, amt = 0, note = '', from = '', to = '', cat = '' } = {}) {
  const b = state.books;
  const was = entry ? b.entries[entry.id] : null;
  const opt = b.opt || {};
  const pay0 = was ? { a: was.a, via: was.via || '' } : from && acct(from) ? { a: from, via: '' } : lastPay() || { a: 'cash', via: '' };
  const f = {
    k: was?.k === 'adj' ? 'adj' : was?.k || kind,
    expr: String(was?.amt || amt || ''),
    cat: was?.cat || cat || opt.lastCat?.[was?.k || kind] || (kind === 'in' ? 'salary' : 'food'),
    sub: '',
    a: pay0.a,
    via: pay0.via,
    to: was?.to || (acct(to) ? to : ''),
    d: was?.d || day,
    note: was?.note ?? note,
    inv: was?.inv || inv
  };
  // The sub: the entry's own, or what the note or the store or the hour says.
  const fresh = !was && day === today();
  const guess = () => guessSub(f.cat, `${note} ${inv?.seller || ''} ${(inv?.items || []).map(i => i.name).join(' ')}`, fresh ? new Date() : null);
  f.sub = was ? was.sub || '' : guess();
  if (f.k === 'move' && !f.to) f.to = openAccounts().find(x => x.id !== f.a)?.id || '';

  const amountEl = h('b', { class: 'num mn-amount-v' });
  const exprEl = h('small', { class: 'num mn-amount-x' });
  const catTile = h('span', { class: 'mn-amount-tile' });
  const amountRow = h('div', { class: 'mn-amount' }, [catTile, h('div', { class: 'mn-amount-n' }, [exprEl, amountEl])]);
  // (.q-kb-hide: behind the keys while the note is typed, so the sheet fits above them.)
  const cats = h('div', { class: 'mn-cats q-kb-hide', role: 'radiogroup', 'aria-label': W('分類', 'Category') });
  const subs = h('div', { class: 'mn-subs q-kb-hide', role: 'group', 'aria-label': W('細項', 'Sub-category') });
  const moveRow = h('div', { class: 'mn-move' });
  const payBtn = h('button', { class: 'mn-pill', type: 'button', onclick: e => pickPay(e.currentTarget) });
  const dateIn = h('input', { class: 'mn-date', type: 'date', value: f.d, max: '2099-12-31', 'aria-label': W('日期', 'Date') });
  const dateBtn = h('label', { class: 'mn-pill mn-date-pill' }, [h('span', { html: icons.calendar }), h('span', { class: 'mn-date-t' }), dateIn]);
  dateIn.addEventListener('change', () => dateIn.value && ((f.d = dateIn.value), paint()));
  const noteIn = h('input', { class: 'q-field mn-note', type: 'text', placeholder: W('備註', 'Note'), maxlength: '60', enterkeyhint: 'done', autocomplete: 'off', value: f.note });
  noteIn.addEventListener('input', () => (f.note = noteIn.value));
  noteIn.addEventListener('keydown', e => e.key === 'Enter' && noteIn.blur());
  const invRow = h('div', { class: 'mn-invrow' });
  const pills = h('div', { class: 'mn-pills' }, [payBtn, dateBtn]);

  const kinds = segmented(
    [
      { id: 'out', label: W('支出', 'Spend') },
      { id: 'in', label: W('收入', 'Income') },
      { id: 'move', label: W('轉帳', 'Transfer') }
    ],
    {
      value: f.k === 'adj' ? 'out' : f.k,
      label: W('種類', 'Kind'),
      onChange: k => {
        f.k = k;
        if (k !== 'move') (f.cat = opt.lastCat?.[k] || (k === 'in' ? 'salary' : 'food')), (f.sub = guess());
        if (k === 'move') {
          f.via = '';
          if (!f.to || f.to === f.a) f.to = openAccounts().find(x => x.id !== f.a)?.id || '';
        }
        paint();
      }
    }
  );

  // The amount alone (each key): the rest of the sheet left as it is, so typing stays quick.
  function paintAmount() {
    const sum = sumOf(f.expr);
    amountEl.textContent = money(Math.max(0, sum));
    exprEl.textContent = /[+−-]/.test(f.expr.slice(1)) ? f.expr : '';
    save.disabled = !(sum > 0) || (f.k === 'move' && (!f.to || f.to === f.a));
  }
  // A category picked: its tile and the ticks, the grid not drawn again.
  function paintCat() {
    catTile.replaceChildren(tile(glyph(catOf(f.cat).icon), catOf(f.cat).color));
    for (const el of cats.children) el.setAttribute('aria-checked', String(el.dataset.cat === f.cat));
    paintSubs();
  }
  function paintSubs() {
    const list = cats.hidden ? [] : subChips(f.cat, f.sub, id => ((f.sub = id), paintSubs()));
    subs.hidden = !list.length;
    subs.replaceChildren(...list);
    subs.querySelector('[aria-pressed="true"]')?.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
  }
  let catsKind = '';
  function paint() {
    paintAmount();
    const look = f.k === 'move' ? lookOf({ k: 'move' }) : catOf(f.cat);
    catTile.replaceChildren(tile(glyph(look.icon), look.color));
    amountRow.classList.toggle('in', f.k === 'in');
    cats.hidden = f.k === 'move' || f.k === 'adj';
    moveRow.hidden = f.k !== 'move';
    payBtn.hidden = f.k === 'move';
    if (!cats.hidden && catsKind !== f.k) {
      catsKind = f.k;
      cats.replaceChildren(...catTiles(f.k, f.cat, id => (id !== f.cat && ((f.cat = id), (f.sub = guess())), paintCat())));
      paintSubs();
      requestAnimationFrame(() => cats.querySelector('[aria-checked="true"]')?.scrollIntoView?.({ block: 'nearest', inline: 'nearest' }));
    } else if (!cats.hidden) paintCat();
    else paintSubs();
    if (!moveRow.hidden) moveRow.replaceChildren(acctPick('a', W('從', 'From')), h('span', { class: 'mn-move-arrow', html: icons.chevron }), acctPick('to', W('到', 'To')));
    const p = payOf(f.a, f.via);
    payBtn.replaceChildren(h('span', { html: glyph(p?.via ? 'card' : 'wallet') }), h('span', { class: 'mn-pill-t', text: p?.label || W('付款方式', 'Paid with') }), h('i', { html: icons.chevron }));
    dateBtn.querySelector('.mn-date-t').textContent = f.d === today() ? W('今天', 'Today') : dayLabel(f.d, { week: false, year: f.d.slice(0, 4) !== today().slice(0, 4) });
    invRow.hidden = !f.inv;
    if (f.inv) invRow.replaceChildren(h('button', { class: 'mn-invbtn', type: 'button', onclick: () => import('./invoices.mjs').then(m => m.openInvoice(f.inv)) }, [h('span', { html: glyph('receipt') }), h('span', { text: `${f.inv.no.slice(0, 2)}-${f.inv.no.slice(2)}${f.inv.items?.length ? W(` · ${f.inv.items.length} 項`, ` · ${f.inv.items.length} items`) : ''}` }), h('i', { html: icons.chevron })]));
  }
  function acctPick(field, label) {
    const a = acct(f[field]);
    return h('button', { class: 'mn-pill mn-move-pick', type: 'button', onclick: e => pickAcct(e.currentTarget, field) }, [h('small', { text: label }), h('span', { class: 'mn-pill-t', text: a?.name || W('選帳戶', 'Choose') })]);
  }
  function pickAcct(anchor, field) {
    menu(anchor, payOptions({ moving: true, keep: [f.a, f.to] }).map(o => ({ label: o.label, icon: o.a === f[field] ? '✓' : '', onClick: () => ((f[field] = o.a), paint()) })));
  }
  function pickPay(anchor) {
    menu(anchor, payOptions({ keep: [f.a, f.via] }).map(o => ({ label: o.label, icon: o.a === f.a && o.via === f.via ? '✓' : '', onClick: () => ((f.a = o.a), (f.via = o.via), paint()) })));
  }

  // The keypad.
  const press = k => {
    tick();
    if (k === 'back') f.expr = f.expr.slice(0, -1);
    else if (k === 'clear') f.expr = '';
    else if (k === '+' || k === '−') f.expr = f.expr ? f.expr.replace(/[+−]$/, '') + k : '';
    else {
      const last = f.expr.split(/[+−]/).pop();
      if (last.length >= 9 || (last === '0' && k !== '+')) return;
      if (!last && k === '00') return;
      f.expr += k;
    }
    paintAmount();
  };
  const KEYS = ['7', '8', '9', 'back', '4', '5', '6', '−', '1', '2', '3', '+', 'clear', '0', '00'];
  const keyLabel = { back: '⌫', clear: 'C' };
  const save = h('button', { class: 'mn-key save', type: 'button', onclick: () => commit(), text: W('儲存', 'Save') });
  const pad = h('div', { class: 'mn-pad' }, [...KEYS.map(k => h('button', { class: `mn-key${/\d/.test(k) ? '' : ' op'}`, type: 'button', 'aria-label': k === 'back' ? W('刪除', 'Delete') : k, text: keyLabel[k] || k, onclick: () => press(k) })), save]);

  async function commit() {
    const sum = sumOf(f.expr);
    if (!(sum > 0)) return;
    if (f.inv && !was) {
      const dup = live(b.entries).find(e => e.inv?.no === f.inv.no);
      if (dup && !(await ask({ title: W('這張發票記過了', 'Already recorded'), body: `${dayLabel(dup.d)} · ${money(dup.amt)}`, ok: W('再記一次', 'Record again'), cancel: W('取消', 'Cancel'), icon: 'ticket' }))) return;
    }
    const now = Date.now();
    const rec = {
      ...(was || {}),
      d: f.d,
      k: f.k,
      amt: f.k === 'adj' ? (was.amt < 0 ? -sum : sum) : sum,
      cat: f.k === 'move' || f.k === 'adj' ? '' : f.cat,
      sub: f.k === 'move' || f.k === 'adj' ? '' : f.sub,
      note: f.note.trim(),
      a: f.a,
      via: f.k === 'move' ? '' : f.via,
      to: f.k === 'move' ? f.to : '',
      inv: f.inv || null,
      t: was?.t || now
    };
    put(b, 'entries', rec, now);
    if (f.k !== 'move' && f.k !== 'adj') {
      b.opt = { ...b.opt, lastPay: { a: f.a, via: f.via }, lastCat: { ...(b.opt?.lastCat || {}), [f.k]: f.cat } };
      b.st = Math.round(now / 1000);
    }
    state.day = f.d;
    state.month = f.d.slice(0, 7);
    s.close();
    toast(was ? W('已更新', 'Updated') : W('記好了', 'Saved'));
    saved();
  }

  const lead = was
    ? h('button', {
        class: 'q-close mn-del',
        type: 'button',
        'aria-label': W('刪除', 'Delete'),
        html: icons.trash,
        onclick: async () => {
          if (!(await ask({ title: W('刪除這筆？', 'Delete this entry?'), body: `${money(Math.abs(was.amt))} · ${dayLabel(was.d)}`, ok: W('刪除', 'Delete'), cancel: W('取消', 'Cancel'), danger: true, icon: 'trash' }))) return;
          drop(b, 'entries', was.id);
          s.close();
          saved();
        }
      })
    : null;
  const s = sheet({
    title: was ? W('編輯', 'Edit') : W('記一筆', 'New entry'),
    lead,
    detent: 'large',
    cls: 'mn-entry',
    body: [f.k === 'adj' ? null : (kinds.classList.add('q-kb-hide'), kinds), amountRow, cats, subs, moveRow, pills, noteIn, invRow],
    foot: pad
  });
  paint();
  return s;
}
