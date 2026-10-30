// One entry: its row (in every list), and the sheet that adds or changes it:
// spending, income or a transfer; the amount (a real field: tap the number,
// the iPhone's own keys come up); the category; how it was paid; the day; a
// note; the 發票 it came from; a fee, a part paid another way (LINE Points), a
// friend's share. A scanned 發票 opens it filled in. A 退款 has its own small sheet.
import { h, icons, tile, segmented, sheet, menu, toast, tick } from '#kit/ui.mjs';
import { ask } from '#kit/orbit.mjs';
import { put, drop, live, usualFor, autoReload, alsoOf, feeOf, backsFor, newId, FEE } from '../lib/books.mjs';
import { catsFor, shownCat, catOf, catName, glyph, lookOf, subsOf, subOf, guessSub, defaultsOf, saveCat } from '../lib/cats.mjs';
import { state, W, en, lang, money, plain, dayLabel, today, saved, acct, acctName, card, allAccounts, openAccounts, cardsOf, payLabel, kindName } from '../shell.mjs';
import { payPic, whatTile } from './pics.mjs';
import { cluesFor, guessWhat, guessSubIn, guessPay, guessAmts, guessStamp, cellOf } from '../lib/guess.mjs';

// ---- A row ----------------------------------------------------------------------

// What a row calls an entry: its note, its store, else what it was.
export function titleOf(e) {
  const look = lookOf(e);
  const fine = subOf(e.sub);
  return e.note || e.inv?.seller || (e.auto === 'reload' ? W('自動加值', 'Auto top-up') : e.k === 'move' ? W('轉帳', 'Transfer') : e.k === 'adj' ? W('調整餘額', 'Balance fix') : catName(fine || look, lang));
}

// `line`: one of lib/books.mjs lines (a category's list): its amount, a fee as 手續費.
export function entryRow(e, { day = false, inAcct = false, inCat = false, line = null } = {}) {
  if (e.k === 'back') return backRow(e, { day });
  const look = line?.fee ? catOf(FEE.cat) : lookOf(e);
  const fine = subOf(line ? line.sub : e.sub);
  // (Inside a category's own list: only its sub.)
  const what = fine ? catName(fine, lang) : inCat ? '' : catName(look, lang);
  const fee = line ? 0 : feeOf(e);
  // (A transfer's fee in its title: an ATM withdrawal's NT$15.)
  const title = e.k === 'move' && fee && !e.note ? W(`轉帳 · 手續費 ${plain(fee)}`, `Transfer · fee ${plain(fee)}`) : titleOf(e);
  // (The category under a note or a store, so a row always says what it was.)
  const named = e.note || e.inv?.seller || line?.fee;
  // What came back for it, and its fee, in a few words.
  const got = e.k === 'out' ? backsFor(state.books, e.id).reduce((n, x) => n + x.amt, 0) : 0;
  // (Said instead of how it was paid, so the line stays one line.)
  const extra = [got ? W(`退回 ${money(got)}`, `${money(got)} back`) : '', fee && e.k === 'out' ? W(`手續費 ${money(fee)}`, `fee ${money(fee)}`) : ''].filter(Boolean);
  const paid = extra.length ? extra.join(' · ') : inAcct ? state.books.cards?.[e.via]?.name || '' : inCat ? '' : payLabel(e);
  const sub = [day ? dayLabel(e.d, { week: false }) : '', line?.fee || (named && e.k !== 'move' && e.k !== 'adj' && !e.also?.length && !extra.length) ? what : '', paid].filter(Boolean).join(' · ');
  const sign = e.k === 'in' ? 'in' : e.k === 'out' ? 'out' : 'move';
  // (A spend: what it came to, less what came back, its fee with it.)
  const cost = line ? line.amt : e.k === 'out' ? Math.max(0, e.amt - got) + fee : e.amt;
  const amt = e.k === 'in' ? money(e.amt, { sign: true }) : e.k === 'adj' ? money(e.amt, { sign: true }) : money(cost);
  return h('button', { class: 'q-ritem chevron mn-row', type: 'button', onclick: () => openEntry({ entry: e }) }, [
    whatTile(look, line?.fee ? '' : fine?.id),
    h('span', { class: 'q-ritem-text' }, [h('span', { class: 'q-ritem-title', text: title }), h('small', {}, [sub, e.inv ? h('i', { class: 'mn-inv-mark', 'aria-label': W('有發票', 'Has invoice'), html: glyph('receipt') }) : null])]),
    h('span', { class: `q-ritem-value num mn-amt ${sign}`, text: amt })
  ]);
}

// Money back: a 退款 (opens its own sheet) or a friend's share (opens the spend).
function backRow(e, { day = false } = {}) {
  const of = state.books.entries[e.of];
  const spend = of && !of.del ? of : null;
  const friend = e.why === 'friend';
  const title = friend ? W(`${e.who || '朋友'} 分攤`, `${e.who || 'A friend'}’s share`) : W('退款', 'Refund');
  const sub = [day ? dayLabel(e.d, { week: false }) : '', spend ? titleOf(spend) : '', e.wait ? W('還沒給', 'Not yet') : acctName(e.a)].filter(Boolean).join(' · ');
  return h('button', { class: 'q-ritem chevron mn-row', type: 'button', onclick: () => (friend && spend ? openEntry({ entry: spend }) : openRefund({ back: e })) }, [
    tile(glyph('swap'), '#0891b2'),
    h('span', { class: 'q-ritem-text' }, [h('span', { class: 'q-ritem-title', text: title }), h('small', { text: sub })]),
    h('span', { class: 'q-ritem-value num mn-amt move', text: `+${money(e.amt)}` })
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

// The categories as tiles, all in view five across (Jay 2026-10-27: pages
// to swipe hid half of them and cut their names), the picked one lit: the
// entry sheet's and a repeat's, one look.
export function catTiles(kind, cur, onPick) {
  // (An older entry's category the set doesn't show stays in view while it's picked.)
  const list = catsFor(kind);
  if (cur && !list.some(c => c.id === cur) && catOf(cur).id === cur && catOf(cur).k === kind) list.push(catOf(cur));
  return list.map(c => h('button', { class: 'mn-cat', type: 'button', role: 'radio', 'data-cat': c.id, 'aria-checked': String(c.id === cur), onclick: () => (tick(), onPick(c.id)) }, [tile(glyph(c.icon), c.color), h('span', { text: catName(c, lang) })]));
}

// A category's subs as chips under the tiles: one lit, tapped again to let go
// ('' none). Empty when the category has none.
// (Their grid's columns: whole rows where the count allows, 6 as 3 + 3, never 4 + 2.)
export const subCols = n => (n <= 4 ? Math.max(n, 1) : n % 4 === 0 ? 4 : n % 3 === 0 ? 3 : 4);
export function subChips(cat, cur, onPick) {
  return subsOf(cat).map(x => h('button', { class: 'mn-subchip', type: 'button', 'aria-pressed': String(x.id === cur), 'data-sub': x.id, onclick: () => (tick(), onPick(x.id === cur ? '' : x.id)) }, catName(x, lang)));
}

// ---- The sheet ----------------------------------------------------------------------

// openEntry({ entry }) to change one; { day, kind, inv, amt, note, cat } to add one.
export function openEntry({ entry = null, day = today(), kind = '', inv = null, amt = 0, note = '', from = '', to = '', cat = '', sub = '' } = {}) {
  const b = state.books;
  const was = entry ? b.entries[entry.id] : null;
  const opt = b.opt || {};
  // What a new one probably is (lib/guess.mjs, Jay 2026-10-30: "a guess of
  // everything"): the person's own entries most like now, by the hour (a new
  // one for today), the kind of day, and where they are (when allowed, 更多 ›
  // 智慧帶入). Kind, category, sub and way to pay are picked; the amount only
  // offered, first among 常用 (a tap fills it).
  const fresh = !was && day === today();
  const ctx = { day: was?.d || day, at: fresh ? Date.now() : null, pl: '' };
  let clues = cluesFor(b, ctx);
  // (Blank: the + alone, nothing handed in, so all of it is the guess's.)
  const blank = !was && !cat && !amt && !inv && !note && !from;
  const pay0 = was ? { a: was.a, via: was.via || '' } : from && acct(from) ? { a: from, via: '' } : lastPay() || { a: 'cash', via: '' };
  const f = {
    k: was?.k === 'adj' ? 'adj' : was?.k || kind || 'out',
    // (The amount as typed: digits, '' for none.)
    amt: String(was ? Math.abs(was.amt) : amt || ''),
    cat: was?.cat || cat || '',
    sub: '',
    a: pay0.a,
    via: pay0.via,
    to: was?.to || (acct(to) ? to : ''),
    d: was?.d || day,
    note: was?.note ?? note,
    inv: was?.inv || inv,
    // (auto: the amount is a category's default, so another pick may change it; a key typed keeps it.)
    auto: false,
    // A fee (shown once added), a part paid another way, friends' shares.
    fee: was?.fee ? String(was.fee) : '',
    feeOn: Boolean(was?.fee),
    also: alsoOf(was)[0] ? { ...alsoOf(was)[0], amt: String(alsoOf(was)[0].amt) } : null,
    friends: (was ? backsFor(b, was.id) : []).filter(x => x.why === 'friend').map(x => ({ id: x.id, who: x.who || '', amt: String(x.amt), a: x.a || 'cash', wait: Boolean(x.wait), d: x.d, was: x }))
  };
  const refunds = was ? backsFor(b, was.id).filter(x => x.why !== 'friend') : [];
  const shown = (k, id) => catsFor(k).some(c => c.id === id);
  // A kind's likeliest category: the guess's, else the last one used, else the first.
  const catFor = k => {
    const g = guessWhat(clues, { k });
    return (g && shown(k, g.cat) && g.cat) || (shown(k, opt.lastCat?.[k]) && opt.lastCat[k]) || shownCat(k);
  };
  // The sub: what the note or the store says, else what the category usually
  // has at this hour here, else (餐飲 with no history) the meal by the hour.
  const words = `${note} ${inv?.seller || ''} ${(inv?.items || []).map(i => i.name).join(' ')}`;
  const guess = () => {
    const said = guessSub(f.cat, words);
    if (said) return said;
    const usual = guessSubIn(clues, f.k, f.cat);
    if (usual !== null) return subsOf(f.cat).some(x => x.id === usual) ? usual : '';
    return guessSub(f.cat, '', fresh ? new Date() : null);
  };
  // The way to pay: the one most used for it at times like this, until the person picks one.
  const usable = p => p && acct(p.a) && !acct(p.a).closed && (!p.via || (card(p.via) && !card(p.via).closed));
  let payPicked = Boolean(was || from);
  function guessPayFor() {
    if (payPicked || (f.k !== 'out' && f.k !== 'in')) return;
    const p = guessPay(clues, { k: f.k, cat: f.cat, sub: f.sub }).find(usable);
    if (p) (f.a = p.a), (f.via = p.via);
  }

  // A category's own way to pay and amount (set in 分類), filled in when it's
  // picked; anything typed or chosen after stays.
  function applyDefaults({ pay = true } = {}) {
    if (f.k !== 'out' && f.k !== 'in') return;
    const d = defaultsOf(f.cat, f.sub);
    if (pay && usable(d.pay)) (f.a = d.pay.a), (f.via = d.pay.via || '');
    if (!f.auto && f.amt) return;
    const v = d.amt || d.unit;
    f.amt = v ? String(v) : f.auto ? '' : f.amt;
    f.auto = Boolean(v);
  }
  // Everything guessed at once (on opening, and again once where is known,
  // while nothing's been touched). `stamp`: what was guessed, kept on the entry (`g`).
  let touched = false;
  let stamp = '';
  function guessAll() {
    if (blank) {
      const g = guessWhat(clues);
      f.k = kind || (g && shown(g.k, g.cat) ? g.k : 'out');
    }
    if (!was && !cat) f.cat = catFor(f.k);
    if (!was) f.sub = sub && subOf(sub)?.parent === f.cat ? sub : guess();
    if (!was) guessPayFor();
    if (!was && !amt) applyDefaults({ pay: !from });
    if (blank) stamp = guessStamp({ cat: f.cat, sub: f.sub, a: f.a, via: f.via, amt: f.auto ? Number(f.amt) : guessAmts(clues, f)[0]?.amt });
  }
  if (was) f.sub = was.sub || '';
  guessAll();
  if (f.k === 'move' && !f.to) f.to = openAccounts().find(x => x.id !== f.a)?.id || '';

  // The amount: tapped, the iPhone's number keys (Jay 2026-10-27: he taps
  // the number, as anyone would; no keypad of our own, RULEBOOK §2). The
  // field is as wide as what's in it (a hidden copy sizes it), so NT$ sits
  // right beside the digits. Beside it, what it goes under: the category's
  // tile and name, a tap on them puts the keys away to show the categories.
  const amountIn = h('input', { class: 'num mn-amount-in', type: 'text', inputmode: 'numeric', pattern: '[0-9]*', enterkeyhint: 'done', autocomplete: 'off', placeholder: '0', 'aria-label': W('金額', 'Amount') });
  const sizer = h('span', { class: 'num mn-amount-size', 'aria-hidden': 'true' });
  amountIn.addEventListener('input', () => {
    f.amt = amountIn.value.replace(/\D/g, '').replace(/^0+/, '').slice(0, 9);
    f.auto = false;
    touched = true;
    paintAmount();
  });
  amountIn.addEventListener('keydown', e => e.key === 'Enter' && amountIn.blur());
  amountIn.addEventListener('focus', () => requestAnimationFrame(() => amountIn.setSelectionRange?.(amountIn.value.length, amountIn.value.length)));
  const catTile = h('span', { class: 'mn-amount-tile' });
  const catText = h('span', { class: 'mn-amount-cat' });
  const amountRow = h('div', { class: 'mn-amount' }, [
    h('button', { class: 'mn-amount-what', type: 'button', onclick: () => amountIn.blur() }, [catTile, catText]),
    h('label', { class: 'mn-amount-n' }, [h('span', { class: 'mn-amount-cur', text: 'NT$' }), h('span', { class: 'mn-amount-box' }, [sizer, amountIn])])
  ]);
  // (.q-kb-hide: behind the keys while the note is typed, so the sheet fits above them.)
  const cats = h('div', { class: 'mn-cats q-kb-hide', role: 'radiogroup', 'aria-label': W('分類', 'Category') });
  const subs = h('div', { class: 'mn-subs q-kb-hide', role: 'group', 'aria-label': W('細項', 'Sub-category') });
  // NT$5 × 1–6: a category priced by the unit (YouBike's half hours); with the
  // amount's keys up too, a tap instead of typing.
  const unitRow = h('div', { class: 'mn-units' });
  const moveRow = h('div', { class: 'mn-move' });
  const payBtn = h('button', { class: 'mn-pill', type: 'button', onclick: e => pickPay(e.currentTarget) });
  const dateIn = h('input', { class: 'mn-date', type: 'date', value: f.d, max: '2099-12-31', 'aria-label': W('日期', 'Date') });
  const dateBtn = h('label', { class: 'mn-pill mn-date-pill' }, [h('span', { html: icons.calendar }), h('span', { class: 'mn-date-t' }), dateIn]);
  dateIn.addEventListener('change', () => dateIn.value && ((f.d = dateIn.value), paint()));
  const noteIn = h('input', { class: 'q-field mn-note', type: 'text', placeholder: W('備註', 'Note'), maxlength: '60', enterkeyhint: 'done', autocomplete: 'off', value: f.note });
  noteIn.addEventListener('input', () => (f.note = noteIn.value));
  noteIn.addEventListener('keydown', e => e.key === 'Enter' && noteIn.blur());
  const invRow = h('div', { class: 'mn-invrow q-kb-hide' });
  const pills = h('div', { class: 'mn-pills' }, [payBtn, dateBtn]);
  // 手續費, 另付, 朋友分攤, 退款: one button beside the note, each a row under it once added.
  const moreBtn = h('button', { class: 'mn-pill mn-more', type: 'button', 'aria-label': W('手續費、分攤、退款', 'Fee, split, refund'), html: icons.plus, onclick: e => pickMore(e.currentTarget) });
  const noteRow = h('div', { class: 'mn-noterow q-kb-hide' }, [noteIn, moreBtn]);
  const extras = h('div', { class: 'mn-extras q-kb-hide' });

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
        touched = true;
        if (k !== 'move') (f.cat = catFor(k)), (f.sub = guess()), guessPayFor(), applyDefaults();
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
    const sum = Number(f.amt) || 0;
    const shown = sum ? plain(sum) : '';
    if (amountIn.value !== shown) amountIn.value = shown;
    sizer.textContent = shown || '0';
    save.disabled = !(sum > 0) || (f.k === 'move' && (!f.to || f.to === f.a));
    paintUnits();
  }
  // Under the subs, one row of quick amounts: a category priced by the unit
  // (NT$5 × 1, 2, 3…), else the amounts it's usually been (常用), likeliest
  // for now first (lib/guess.mjs; the first lit as the guess), each a tap.
  let usualKey = '';
  let usual = null;
  function paintUnits() {
    const on = f.k === 'out' || f.k === 'in';
    const unit = on ? defaultsOf(f.cat, f.sub).unit : 0;
    const key = `${f.k}|${f.cat}|${f.sub}`;
    if (on && !unit && key !== usualKey) (usualKey = key), (usual = guessAmts(clues, f));
    const amts = !on || unit ? [] : usual || [];
    unitRow.hidden = !unit && !amts.length;
    if (unitRow.hidden) return;
    const sum = Number(f.amt) || 0;
    const chip = (text, v, cls = '') => h('button', { class: `mn-subchip num${cls}`, type: 'button', 'aria-pressed': String(sum === v), text, onclick: () => (tick(), (f.amt = String(v)), (f.auto = false), (touched = true), paintAmount()) });
    unitRow.classList.toggle('usual', !unit);
    unitRow.replaceChildren(...(unit ? [h('span', { class: 'mn-units-l num', text: `${money(unit)} ×` }), ...[1, 2, 3, 4, 6, 8].map(n => chip(String(n), unit * n))] : [h('span', { class: 'mn-units-l', text: W('常用 NT$', 'Usual NT$') }), ...amts.map((x, i) => chip(plain(x.amt), x.amt, i || sum ? '' : ' guess'))]));
  }
  // A category picked: its tile and the ticks, the grid not drawn again.
  function paintCat() {
    paintWhat();
    for (const el of cats.children) el.setAttribute('aria-checked', String(el.dataset.cat === f.cat));
    paintSubs();
  }
  // What the amount goes under, beside it: the sub when one's picked (宵夜, TPASS), else the category.
  function paintWhat() {
    const look = f.k === 'move' || f.k === 'adj' ? lookOf({ k: f.k }) : catOf(f.cat);
    const fine = f.k === 'out' || f.k === 'in' ? subOf(f.sub) : null;
    catTile.replaceChildren(whatTile(look, fine?.id, 44));
    catText.textContent = f.k === 'move' ? W('轉帳', 'Transfer') : f.k === 'adj' ? W('調整餘額', 'Balance fix') : catName(fine || look, lang);
  }
  function paintSubs() {
    const list = cats.hidden ? [] : subChips(f.cat, f.sub, id => ((touched = true), (f.sub = id), guessPayFor(), applyDefaults(), paintAmount(), paintPay(), paintSubs(), paintWhat()));
    subs.hidden = !list.length;
    subs.style.setProperty('--n', subCols(list.length));
    subs.replaceChildren(...list);
  }
  let catsKind = '';
  function paint() {
    paintAmount();
    paintWhat();
    amountRow.classList.toggle('in', f.k === 'in');
    cats.hidden = f.k === 'move' || f.k === 'adj';
    moveRow.hidden = f.k !== 'move';
    payBtn.hidden = f.k === 'move';
    moreBtn.hidden = f.k !== 'out' && f.k !== 'move';
    noteRow.classList.toggle('solo', moreBtn.hidden);
    paintExtras();
    if (!cats.hidden && catsKind !== f.k) {
      catsKind = f.k;
      cats.replaceChildren(...catTiles(f.k, f.cat, id => ((touched = true), id !== f.cat && ((f.cat = id), (f.sub = guess()), guessPayFor(), applyDefaults(), paintAmount(), paintPay()), paintCat())));
      paintSubs();
    } else if (!cats.hidden) paintCat();
    else paintSubs();
    if (!moveRow.hidden) moveRow.replaceChildren(acctPick('a', W('從', 'From')), h('span', { class: 'mn-move-arrow', html: icons.chevron }), acctPick('to', W('到', 'To')));
    paintPay();
    dateBtn.querySelector('.mn-date-t').textContent = f.d === today() ? W('今天', 'Today') : dayLabel(f.d, { week: false, year: f.d.slice(0, 4) !== today().slice(0, 4) });
    invRow.hidden = !f.inv;
    if (f.inv) invRow.replaceChildren(h('button', { class: 'mn-invbtn', type: 'button', onclick: () => import('./invoices.mjs').then(m => m.openInvoice(f.inv)) }, [h('span', { html: glyph('receipt') }), h('span', { text: `${f.inv.no.slice(0, 2)}-${f.inv.no.slice(2)}${f.inv.items?.length ? W(` · ${f.inv.items.length} 項`, ` · ${f.inv.items.length} item${f.inv.items.length === 1 ? '' : 's'}`) : ''}` }), h('i', { html: icons.chevron })]));
  }
  function paintPay() {
    const p = payOf(f.a, f.via);
    payBtn.replaceChildren(p ? payPic(p.a, p.via, 24) : h('span', { html: glyph('wallet') }), h('span', { class: 'mn-pill-t', text: p?.label || W('付款方式', 'Paid with') }), h('i', { html: icons.chevron }));
  }
  function acctPick(field, label) {
    const a = acct(f[field]);
    return h('button', { class: 'mn-pill mn-move-pick', type: 'button', onclick: e => pickAcct(e.currentTarget, field) }, [h('small', { text: label }), h('span', { class: 'mn-pill-t', text: a?.name || W('選帳戶', 'Choose') })]);
  }
  function pickAcct(anchor, field) {
    menu(anchor, payOptions({ moving: true, keep: [f.a, f.to] }).map(o => ({ label: o.label, lead: payPic(o.a, '', 28), icon: o.a === f[field] ? '✓' : '', onClick: () => ((f[field] = o.a), paint()) })));
  }
  function pickPay(anchor) {
    menu(anchor, payOptions({ keep: [f.a, f.via] }).map(o => ({ label: o.label, lead: payPic(o.a, o.via, 28), icon: o.a === f.a && o.via === f.via ? '✓' : '', onClick: () => ((payPicked = touched = true), (f.a = o.a), (f.via = o.via), paint()) })));
  }

  // ---- The rows under the pills ----
  function pickMore(anchor) {
    const out = f.k === 'out';
    menu(anchor, [
      !f.feeOn ? { label: W('手續費', 'Fee'), onClick: () => ((f.feeOn = true), paintExtras(), focusLast('.mn-x-fee input')) } : null,
      out && !f.also ? { label: W('另一種付款（點數、禮券）', 'Paid partly another way'), onClick: () => ((f.also = { a: openAccounts().find(x => x.id !== f.a && x.kind === 'wallet')?.id || openAccounts().find(x => x.id !== f.a)?.id || f.a, via: '', amt: '' }), paintExtras(), focusLast('.mn-x-also input')) } : null,
      out ? { label: W('朋友分攤', 'A friend’s share'), onClick: () => (f.friends.push({ who: '', amt: '', a: 'cash', wait: false }), paintExtras(), focusLast('.mn-x-friend input')) } : null,
      out && was ? { label: W('退款', 'Refund'), onClick: () => (s.close(), openRefund({ of: was })) } : null
    ].filter(Boolean));
  }
  const focusLast = sel => requestAnimationFrame(() => [...extras.querySelectorAll(sel)].pop()?.focus());
  const numIn = (value, onInput, label) => {
    const i = h('input', { class: 'q-field num mn-xin', type: 'text', inputmode: 'numeric', maxlength: '7', placeholder: 'NT$', value, 'aria-label': label, enterkeyhint: 'done' });
    i.addEventListener('input', () => onInput(i.value));
    i.addEventListener('keydown', e => e.key === 'Enter' && i.blur());
    return i;
  };
  const xBtn = (label, onTap) => h('button', { class: 'mn-x-del', type: 'button', 'aria-label': label, text: '✕', onclick: () => (tick(), onTap(), paintExtras()) });
  function paintExtras() {
    const rows = [];
    const on = f.k === 'out' || f.k === 'move';
    if (on && f.feeOn) {
      // (A credit card abroad: most banks charge 1.5% of it; a tap fills that in.)
      const sum = Number(f.amt) || 0;
      const fx = f.k === 'out' && acct(f.a)?.kind === 'credit' && sum > 0 ? Math.round(sum * 0.015) : 0;
      const feeIn = numIn(f.fee, v => (f.fee = v), W('手續費', 'Fee'));
      rows.push(h('div', { class: 'mn-xrow mn-x-fee' }, [h('span', { class: 'mn-x-l', text: W('手續費', 'Fee') }), feeIn, fx ? h('button', { class: 'mn-subchip num', type: 'button', text: W('海外 1.5%', 'Abroad 1.5%'), 'aria-label': W(`海外交易手續費 1.5%：${money(fx)}`, `Foreign fee 1.5%: ${money(fx)}`), onclick: () => (tick(), (f.fee = String(fx)), (feeIn.value = f.fee)) }) : h('span'), xBtn(W('移除手續費', 'Remove fee'), () => ((f.feeOn = false), (f.fee = '')))]));
    }
    if (f.k === 'out' && f.also) {
      const pick = h('button', { class: 'mn-pill', type: 'button', onclick: e => menu(e.currentTarget, payOptions({ keep: [f.also.a, f.also.via] }).map(o => ({ label: o.label, lead: payPic(o.a, o.via, 28), icon: o.a === f.also.a && o.via === f.also.via ? '✓' : '', onClick: () => ((f.also.a = o.a), (f.also.via = o.via), paintExtras()) }))) }, [h('span', { class: 'mn-pill-t', text: payOf(f.also.a, f.also.via)?.label || W('選帳戶', 'Choose') }), h('i', { html: icons.chevron })]);
      rows.push(h('div', { class: 'mn-xrow mn-x-also' }, [h('span', { class: 'mn-x-l', text: W('另付', 'Also') }), pick, numIn(f.also.amt, v => (f.also.amt = v), W('這部分的金額', 'This part')), xBtn(W('移除', 'Remove'), () => (f.also = null))]));
    }
    if (f.k === 'out')
      f.friends.forEach((fr, i) => {
        const who = h('input', { class: 'q-field mn-xin mn-x-who', type: 'text', maxlength: '12', placeholder: W('朋友', 'Friend'), value: fr.who, enterkeyhint: 'done', autocomplete: 'off', 'aria-label': W('誰', 'Who') });
        who.addEventListener('input', () => (fr.who = who.value));
        const into = h('button', { class: 'mn-pill', type: 'button', onclick: e => menu(e.currentTarget, [{ label: W('還沒給', 'Not yet'), icon: fr.wait ? '✓' : '', onClick: () => ((fr.wait = true), paintExtras()) }, ...payOptions({ moving: true, keep: [fr.a] }).map(o => ({ label: W(`給了，收進 ${o.label}`, `Paid into ${o.label}`), icon: !fr.wait && o.a === fr.a ? '✓' : '', onClick: () => ((fr.wait = false), (fr.a = o.a), paintExtras()) }))]) }, [h('span', { class: 'mn-pill-t', text: fr.wait ? W('還沒給', 'Not yet') : acctName(fr.a) }), h('i', { html: icons.chevron })]);
        rows.push(h('div', { class: 'mn-xrow mn-x-friend' }, [who, numIn(fr.amt, v => (fr.amt = v), W('他的部分', 'Their part')), into, xBtn(W('移除', 'Remove'), () => f.friends.splice(i, 1))]));
      });
    // (退款 already logged: each opens its own sheet.)
    for (const r of f.k === 'out' ? refunds : [])
      rows.push(h('button', { class: 'q-ritem chevron mn-xrow mn-x-refund', type: 'button', onclick: () => (s.close(), openRefund({ back: r })) }, [h('span', { class: 'q-ritem-text' }, [h('span', { class: 'q-ritem-title', text: W(`退款 ${money(r.amt)}`, `Refund ${money(r.amt)}`) }), h('small', { text: `${dayLabel(r.d, { week: false })} · ${acctName(r.a)}` })])]));
    extras.hidden = !rows.length;
    extras.replaceChildren(...rows);
  }

  const save = h('button', { class: 'q-btn primary block', type: 'button', onclick: () => commit(), text: W('儲存', 'Save') });

  async function commit() {
    const sum = Number(f.amt) || 0;
    if (!(sum > 0)) return;
    const whole = v => Math.max(0, Math.round(Number(String(v ?? '').replace(/[^\d]/g, '')) || 0));
    const shares = f.k === 'out' ? f.friends.map(fr => ({ ...fr, n: whole(fr.amt) })).filter(fr => fr.n > 0) : [];
    const alsoAmt = f.k === 'out' && f.also ? whole(f.also.amt) : 0;
    if (shares.reduce((n, fr) => n + fr.n, 0) + alsoAmt > sum) return toast(W('分攤和另付加起來超過金額了', 'The shares come to more than the amount'), { tone: 'bad' });
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
      fee: (f.k === 'out' || f.k === 'move') && f.feeOn ? whole(f.fee) : 0,
      also: alsoAmt && f.also.a ? [{ a: f.also.a, via: f.also.via || '', amt: alsoAmt }] : null,
      t: was?.t || now
    };
    // (A new one: where it was logged, when allowed, and what was guessed for it.)
    if (!was && ctx.pl) rec.pl = ctx.pl;
    if (!was && stamp) rec.g = stamp;
    if (!rec.fee) delete rec.fee;
    if (!rec.also) delete rec.also;
    const kept = put(b, 'entries', rec, now);
    // Friends' shares: money back for it (their cash moves a balance once handed over).
    const keep = new Set();
    for (const fr of shares) {
      const id = fr.id || newId(now);
      keep.add(id);
      const received = !fr.wait && fr.was && !fr.was.wait;
      put(b, 'entries', { id, d: received ? fr.d : f.d, k: 'back', why: 'friend', who: fr.who.trim(), of: kept.id, amt: fr.n, a: fr.a || 'cash', wait: fr.wait ? 1 : 0, cat: rec.cat, sub: rec.sub, t: now }, now);
    }
    // (No longer a spend: nothing can come back for it.)
    for (const x of backsFor(b, kept.id)) if (x.why === 'friend' ? !keep.has(x.id) : f.k !== 'out') drop(b, 'entries', x.id, now);
    const reloaded = autoReload(b, kept, now);
    if (f.k !== 'move' && f.k !== 'adj') {
      b.opt = { ...b.opt, lastPay: { a: f.a, via: f.via }, lastCat: { ...(b.opt?.lastCat || {}), [f.k]: f.cat } };
      b.st = Math.round(now / 1000);
    }
    state.day = f.d;
    state.month = f.d.slice(0, 7);
    s.close();
    if (reloaded) return toast(W(`${acct(f.a)?.name} 自動加值 ${money(reloaded)}`, `${acct(f.a)?.name} topped up ${money(reloaded)}`)), saved();
    if (!was && (f.k === 'out' || f.k === 'in') && suggest(rec)) return saved();
    toast(was ? W('已更新', 'Updated') : W('記好了', 'Saved'));
    saved();
  }

  // A new entry that's the usual again (the same amount, or the same way to
  // pay, most times lately): offered once as the category's own default.
  function suggest(rec) {
    const id = rec.sub || rec.cat;
    const own = b.cats?.[id] && !b.cats[id].del ? b.cats[id] : {};
    const asked = b.opt?.asked || {};
    const u = usualFor(b, { k: rec.k, cat: rec.cat, sub: rec.sub }, today());
    const name = catName(subOf(rec.sub) || catOf(rec.cat), lang);
    const amtHit = !(own.amt > 0 || own.unit > 0) && !asked[`${id}|amt`] && u.amts[0]?.amt === rec.amt && u.amts[0].n >= 4 && u.amts[0].n / u.of >= 0.5;
    const payHit = !own.pay?.a && !asked[`${id}|pay`] && u.pay && u.pay.a === rec.a && u.pay.via === (rec.via || '') && u.pay.n >= 4 && u.pay.n / u.of >= 0.8;
    if (!amtHit && !payHit) return false;
    const what = amtHit ? 'amt' : 'pay';
    b.opt = { ...b.opt, asked: { ...asked, [`${id}|${what}`]: 1 } };
    b.st = Math.round(Date.now() / 1000);
    const text = amtHit ? W(`${name} 常是 ${money(rec.amt)}`, `${name} is often ${money(rec.amt)}`) : W(`${name} 常用 ${payOf(rec.a, rec.via)?.label || ''}`, `${name} is usually ${payOf(rec.a, rec.via)?.label || ''}`);
    toast(text, { ms: 7000, action: { label: W('設為預設', 'Make default'), onTap: () => (saveCat(b, amtHit ? { id, amt: rec.amt, unit: 0 } : { id, pay: { a: rec.a, via: rec.via || '' } }), saved(), toast(W(`下次選 ${name} 會自動帶入`, `Filled in next time you pick ${name}`))) } });
    return true;
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
          for (const r of live(b.entries)) if (r.for === was.id || r.of === was.id) drop(b, 'entries', r.id);
          s.close();
          saved();
        }
      })
    : null;
  const s = sheet({
    title: was ? W('編輯', 'Edit') : W('記一筆', 'New entry'),
    lead,
    cls: 'mn-entry',
    body: [f.k === 'adj' ? null : (kinds.classList.add('q-kb-hide'), kinds), amountRow, cats, subs, unitRow, moveRow, pills, noteRow, extras, invRow],
    foot: h('div', { class: 'q-sheet-foot' }, [save])
  });
  paint();
  // Where the phone is (更多 › 智慧帶入 on): the guesses again with it, unless something's been picked by then.
  if (fresh && opt.geo && navigator.geolocation)
    navigator.geolocation.getCurrentPosition(
      p => {
        ctx.pl = cellOf(p.coords.latitude, p.coords.longitude);
        if (!ctx.pl || !s.el.isConnected) return;
        clues = cluesFor(b, ctx);
        usualKey = '';
        if (!touched) guessAll(), (catsKind = ''), paint();
        else paintUnits();
      },
      () => {},
      { maximumAge: 300_000, timeout: 8000 }
    );
  return s;
}

// ---- 退款 ---------------------------------------------------------------------------

// Money back for a spend, all of it or part (Jay 2026-10-27: not income; it
// comes off the spend): how much, the account it went back to (the spend's,
// at first), the day. openRefund({ of: spend }) a new one, ({ back }) one logged.
export function openRefund({ of = null, back = null } = {}) {
  const b = state.books;
  const src = b.entries[back ? back.of : of?.id];
  const spend = src && !src.del ? src : null;
  const others = spend ? backsFor(b, spend.id).filter(x => x.id !== back?.id).reduce((n, x) => n + x.amt, 0) : 0;
  const left = spend ? Math.max(0, spend.amt - others) : Infinity;
  const f = { amt: String(back?.amt || (Number.isFinite(left) ? left : '') || ''), a: back?.a || spend?.a || 'cash', d: back?.d || today() };
  const amtIn = h('input', { class: 'q-field num mn-big-in', type: 'text', inputmode: 'numeric', maxlength: '7', placeholder: 'NT$', value: f.amt, 'aria-label': W('退多少', 'Amount back') });
  amtIn.addEventListener('input', () => (f.amt = amtIn.value));
  const all = Number.isFinite(left) && left > 0 ? h('button', { class: 'mn-subchip num', type: 'button', text: W(`全額 ${money(left)}`, `All ${money(left)}`), onclick: () => (tick(), (f.amt = String(left)), (amtIn.value = f.amt)) }) : null;
  const into = h('button', { class: 'mn-pill', type: 'button' });
  const paintInto = () => into.replaceChildren(h('span', { html: glyph('wallet') }), h('span', { class: 'mn-pill-t', text: acctName(f.a) }), h('i', { html: icons.chevron }));
  into.onclick = e => menu(e.currentTarget, payOptions({ moving: true, keep: [f.a] }).map(o => ({ label: o.label, icon: o.a === f.a ? '✓' : '', onClick: () => ((f.a = o.a), paintInto()) })));
  paintInto();
  const dateIn = h('input', { class: 'mn-date', type: 'date', value: f.d, max: '2099-12-31', 'aria-label': W('日期', 'Date') });
  const dateT = h('span', { class: 'mn-date-t' });
  const paintDate = () => (dateT.textContent = f.d === today() ? W('今天', 'Today') : dayLabel(f.d, { week: false }));
  dateIn.addEventListener('change', () => dateIn.value && ((f.d = dateIn.value), paintDate()));
  paintDate();
  const field = (label, ctl) => h('div', { class: 'mn-field' }, [h('span', { class: 'mn-field-l', text: label }), ctl]);
  const what = spend ? `${titleOf(spend)} · ${money(spend.amt)}` : '';
  const lead = back
    ? h('button', {
        class: 'q-close mn-del',
        type: 'button',
        'aria-label': W('刪除', 'Delete'),
        html: icons.trash,
        onclick: async () => {
          if (!(await ask({ title: W('刪除這筆退款？', 'Delete this refund?'), body: money(back.amt), ok: W('刪除', 'Delete'), cancel: W('取消', 'Cancel'), danger: true, icon: 'trash' }))) return;
          drop(b, 'entries', back.id);
          s.close();
          saved();
        }
      })
    : null;
  const s = sheet({
    title: W('退款', 'Refund'),
    subtitle: what,
    lead,
    cls: 'mn-refund',
    body: [h('div', { class: 'mn-form' }, [field(W('退回金額', 'Amount back'), h('div', { class: 'mn-refund-amt' }, [amtIn, all])), field(W('退到', 'Back to'), into), field(W('日期', 'Date'), h('label', { class: 'mn-pill mn-date-pill' }, [h('span', { html: icons.calendar }), dateT, dateIn]))])],
    foot: h('div', { class: 'q-sheet-foot' }, [
      h('button', {
        class: 'q-btn primary block',
        type: 'button',
        text: W('儲存', 'Save'),
        onclick: () => {
          const amt = Math.round(Number(String(f.amt).replace(/[^\d]/g, '')) || 0);
          if (!(amt > 0)) return toast(W('請填金額', 'Fill in the amount'), { tone: 'bad' });
          if (amt > left) return toast(W(`最多退 ${money(left)}`, `At most ${money(left)}`), { tone: 'bad' });
          const now = Date.now();
          put(b, 'entries', { ...(back || {}), d: f.d, k: 'back', why: 'refund', of: spend?.id || back?.of || '', amt, a: f.a, cat: spend?.cat || back?.cat || 'other', sub: spend?.sub || back?.sub || '', t: back?.t || now }, now);
          s.close();
          toast(back ? W('已更新', 'Updated') : W(`退款 ${money(amt)} 記好了`, `Refund of ${money(amt)} saved`));
          saved();
        }
      })
    ])
  });
  return s;
}
