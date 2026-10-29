// The books: accounts, the cards on them, entries, budgets and repeats, and
// what they add up to. Pure (no DOM), so it's tested directly.
//
// Every record has an id and `u` (when it was last changed, ms); a removed
// one stays as `{ id, u, del: 1 }` for a while so another device's copy can't
// bring it back. Two copies are one by taking, for each id, the one changed
// last (mergeBooks).
//
//   accts    { id: { id, name, kind, open, inTotal, brand?, pay?, close?, due?, order } }
//            kind: cash | bank | credit | ticket (儲值卡: 悠遊卡, 一卡通…) |
//            wallet (電子支付: 悠遊付, LINE Pay…); other, from before, shows as wallet.
//            open: the balance when it was added (a credit card's: what it owed, negative).
//            inTotal: counted in the 總資產. brand: a logo key (brands.mjs).
//            reload: a stored-value card's 自動加值 { on, from, amt, below } (autoReload;
//            from '': nobody in the books pays, the balance just goes up).
//            A credit card's pay: the account its bill is paid from; close / due: its
//            statement and payment days of the month. closed: when it was put
//            away (封存): out of every picker, its entries and balance kept.
//   cards    { id: { id, acct, name, last4, closed? } } ways to pay under an account (a
//            debit card, Apple Pay or LINE Pay on a card…): they spend
//            straight from their bank account.
//   entries  { id: { id, d, k, amt, cat, sub, note, a, via, to, inv, rec, fee, also } }
//            sub: the finer kind under cat ('' none; lib/cats.mjs).
//            d: the day, 'YYYY-MM-DD'. k: out | in | move | adj (a balance set by
//            hand) | back (money back for a spend: a 退款, or a friend's share).
//            amt: whole NT$, > 0 (adj: the change, either sign). a: the account it's
//            paid from or into; via: the card used (a debit card's id); to: a move's
//            other account. inv: the 發票 it came from ({ no, sid, seller, items }).
//            auto: 'reload' a card's 自動加值, for: the spend that set it off.
//            rec: the repeat that made it.
//            fee: a 手續費 on a spend or a move (ATM, 境外交易), paid from `a` too,
//            counted as spending under 稅費 › 手續費 (FEE).
//            also: [{ a, via, amt }] the part of a spend paid another way (LINE
//            Points, a gift card); `a` pays the rest.
//            back: of: the spend it comes off (its spending shrinks, on its own
//            day); why: refund | friend; who: the friend; wait: 1 a friend's share
//            not handed over yet (no balance moves until it is).
//   budgets  { id: { id, cat ('' for everything), amt } } a month's limit.
//   recur    { id: { id, k, amt, cat, sub, a, via, to, note, every, day, from } } every:
//            month | week | year; day: the month's day (1–31, the last when the
//            month is shorter), the weekday (0 Sunday) or 'MM-DD'; from: the first day.
//   cats     { id: { id, k, parent, zh, icon, color, order, hidden, into } } the
//            person's own categories and changes to the built-in ones (lib/cats.mjs).
//   renew    { id: { id, name, start, n, unit, roll, cat, sub, on, at } } 到期提醒 (lib/renew.mjs).
//   carrier  { code, u } the 手機條碼 (載具).

import { addDays } from '#kit/format.mjs';

export const COLLECTIONS = ['accts', 'cards', 'entries', 'budgets', 'recur', 'cats', 'renew'];
// Removed records are kept this long (a device away longer than this can't
// bring one back: by then its copy is older than the removal).
export const KEEP_GONE_MS = 120 * 86_400_000;
// Five kinds, no 其他 (Jay 2026-10-27: fewer; 悠遊卡 is a card, only 悠遊付 is
// digital); an old 其他 shows with 電子支付.
export const ACCOUNT_KINDS = ['cash', 'bank', 'credit', 'ticket', 'wallet'];
export const groupOf = kind => (ACCOUNT_KINDS.includes(kind) ? kind : 'wallet');

export const emptyBooks = () => ({ accts: {}, cards: {}, entries: {}, budgets: {}, recur: {}, cats: {}, renew: {}, carrier: null, st: 0, opt: {} });

let seq = 0;
export const newId = (now = Date.now()) => `${now.toString(36)}${(seq++ % 1296).toString(36).padStart(2, '0')}${Math.random().toString(36).slice(2, 6)}`;

// The live records of a collection (not removed), in their order.
export const live = col => Object.values(col || {}).filter(r => r && !r.del);
export const accounts = books => live(books.accts).sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || String(a.id).localeCompare(String(b.id)));

// ---- Changing ---------------------------------------------------------------------

// A record put in (new or changed), dated now.
export function put(books, col, rec, now = Date.now()) {
  const id = rec.id || newId(now);
  books[col][id] = { ...rec, id, u: now };
  return books[col][id];
}
// A record removed: what's left is its id and when.
export function drop(books, col, id, now = Date.now()) {
  if (books[col]?.[id]) books[col][id] = { id, u: now, del: 1 };
}
// ---- Put away, moved over, removed (Jay 2026-10-27: people change cards and
// accounts all the time; history is never lost by it) ----------------------------

// What an account or a way to pay has on it: entries, repeats, ways to pay.
export function historyOf(books, id) {
  return {
    entries: live(books.entries).filter(e => touches(e).includes(id) || e.via === id || alsoOf(e).some(p => p.via === id)).length,
    recur: live(books.recur).filter(r => r.a === id || r.to === id || r.via === id).length,
    cards: live(books.cards).filter(c => c.acct === id).length
  };
}
export const hasHistory = (books, id) => Object.values(historyOf(books, id)).some(Boolean);

// 封存 (or back): out of the pickers, everything it has kept. Its repeats stop.
export function closeAccount(books, id, closed = true, now = Date.now()) {
  const a = books.accts[id];
  if (!a || a.del) return;
  put(books, 'accts', { ...a, closed: closed ? now : 0 }, now);
  if (closed) for (const r of live(books.recur)) if (r.a === id || r.to === id) drop(books, 'recur', r.id, now);
}
export function closeCard(books, id, closed = true, now = Date.now()) {
  const c = books.cards[id];
  if (c && !c.del) put(books, 'cards', { ...c, closed: closed ? now : 0 }, now);
}
export const isOpen = r => Boolean(r && !r.del && !r.closed);

// 轉移: everything on `from` now on `to` (an old card replaced, an account
// moved banks): its entries (a move between the two drops, it moved nothing),
// repeats, ways to pay, the cards paid from it, and its opening balance, so
// every total stays the same. Then `from` is removed.
export function moveAccount(books, from, to, now = Date.now()) {
  const a = books.accts[from];
  const b = books.accts[to];
  if (!a || a.del || !b || b.del || from === to) return;
  const swap = id => (id === from ? to : id);
  for (const e of live(books.entries)) {
    if (!touches(e).includes(from)) continue;
    const next = { ...e, a: swap(e.a), to: e.to ? swap(e.to) : e.to, ...(e.also ? { also: e.also.map(p => ({ ...p, a: swap(p.a) })) } : {}) };
    if (next.k === 'move' && next.a === next.to) drop(books, 'entries', e.id, now);
    else put(books, 'entries', next, now);
  }
  for (const r of live(books.recur)) {
    if (r.a !== from && r.to !== from) continue;
    const next = { ...r, a: swap(r.a), to: r.to ? swap(r.to) : r.to };
    if (next.k === 'move' && next.a === next.to) drop(books, 'recur', r.id, now);
    else put(books, 'recur', next, now);
  }
  for (const c of live(books.cards)) if (c.acct === from) put(books, 'cards', { ...c, acct: to }, now);
  for (const x of live(books.accts)) if (x.pay === from) put(books, 'accts', { ...x, pay: to === x.id ? '' : to }, now);
  put(books, 'accts', { ...books.accts[to], open: (Number(b.open) || 0) + (Number(a.open) || 0) }, now);
  drop(books, 'accts', from, now);
}
// A way to pay replaced: its entries and repeats on `to` (another on the
// same account), or on the account itself (to ''). Then it's removed.
export function moveCard(books, from, to = '', now = Date.now()) {
  const c = books.cards[from];
  if (!c || c.del || from === to) return;
  const t = to && books.cards[to];
  for (const col of ['entries', 'recur'])
    for (const e of live(books[col])) {
      if (e.via === from) put(books, col, { ...e, via: to, a: t && !t.del ? t.acct : e.a }, now);
      else if (e.also?.some(p => p.via === from)) put(books, col, { ...e, also: e.also.map(p => (p.via === from ? { ...p, via: to, a: t && !t.del ? t.acct : p.a } : p)) }, now);
    }
  drop(books, 'cards', from, now);
}

// The records a removal will take, kept to put back (復原).
export function snapshot(books, ids) {
  const out = {};
  for (const col of COLLECTIONS) for (const id of ids[col] || []) if (books[col][id] && !books[col][id].del) (out[col] ||= []).push({ ...books[col][id] });
  return out;
}
export function restore(books, snap, now = Date.now()) {
  for (const [col, recs] of Object.entries(snap)) for (const r of recs) put(books, col, r, now);
}
// What dropAccount takes, by collection (for a snapshot).
export function accountParts(books, id) {
  return {
    accts: [id, ...live(books.accts).filter(a => a.pay === id).map(a => a.id)],
    cards: live(books.cards).filter(c => c.acct === id).map(c => c.id),
    recur: live(books.recur).filter(r => r.a === id || r.to === id).map(r => r.id),
    entries: live(books.entries).filter(e => touches(e).includes(id)).map(e => e.id)
  };
}

// An account removed with what hangs on it: its cards, its repeats, and its
// entries (a move to or from it as well: one side would be missing).
export function dropAccount(books, id, now = Date.now()) {
  drop(books, 'accts', id, now);
  for (const c of live(books.cards)) if (c.acct === id) drop(books, 'cards', c.id, now);
  for (const r of live(books.recur)) if (r.a === id || r.to === id) drop(books, 'recur', r.id, now);
  for (const e of live(books.entries)) if (touches(e).includes(id)) drop(books, 'entries', e.id, now);
  for (const a of live(books.accts)) if (a.pay === id) put(books, 'accts', { ...a, pay: '' }, now);
}

// ---- Balances ----------------------------------------------------------------------

// The other ways a spend was paid (each > 0, together never more than it).
export function alsoOf(e) {
  let left = e?.k === 'out' ? Number(e.amt) || 0 : 0;
  const out = [];
  for (const p of Array.isArray(e?.also) ? e.also : []) {
    const amt = Math.min(left, Math.round(Number(p?.amt) || 0));
    if (!p?.a || !(amt > 0)) continue;
    out.push({ a: p.a, via: p.via || '', amt });
    left -= amt;
  }
  return out;
}
export const feeOf = e => (e && (e.k === 'out' || e.k === 'move') ? Math.max(0, Math.round(Number(e.fee) || 0)) : 0);
// Every account an entry moves.
export const touches = e => [...new Set([e.a, e.to, ...alsoOf(e).map(p => p.a)].filter(Boolean))];

// What one entry does to one account (NT$, signed).
export function effect(e, id) {
  if (!e || e.del) return 0;
  const amt = Number(e.amt) || 0;
  if (e.k === 'adj' || e.k === 'in') return e.a === id ? amt : 0;
  if (e.k === 'back') return e.a === id && !e.wait ? amt : 0;
  if (e.k === 'out') {
    const also = alsoOf(e);
    let x = e.a === id ? -(amt - also.reduce((s, p) => s + p.amt, 0) + feeOf(e)) : 0;
    for (const p of also) if (p.a === id) x -= p.amt;
    return x;
  }
  if (e.k === 'move') return (e.to === id ? amt : 0) - (e.a === id ? amt + feeOf(e) : 0);
  return 0;
}
// Every account's balance up to and including `upto` ('YYYY-MM-DD', every day if not given).
export function balances(books, upto = '') {
  const out = {};
  for (const a of accounts(books)) out[a.id] = Number(a.open) || 0;
  for (const e of live(books.entries)) {
    if (upto && e.d > upto) continue;
    for (const id of touches(e)) if (id in out) out[id] += effect(e, id);
  }
  return out;
}
// The 總資產: what the counted accounts hold, what the counted cards owe, and the two together.
export function worth(books, upto = '') {
  const bal = balances(books, upto);
  let assets = 0;
  let debts = 0;
  for (const a of accounts(books)) {
    if (!a.inTotal) continue;
    const b = bal[a.id] || 0;
    if (b >= 0) assets += b;
    else debts -= b;
  }
  return { assets, debts, net: assets - debts };
}
// The amount to set an account to `target`: the adj entry's amt (0: nothing to do).
export const adjustBy = (books, id, target, upto = '') => Math.round(Number(target) - (balances(books, upto)[id] || 0));

// ---- Days and months ---------------------------------------------------------------

// Days in a month, 'YYYY-MM'.
export const monthDays = ym => new Date(Date.UTC(Number(ym.slice(0, 4)), Number(ym.slice(5, 7)), 0)).getUTCDate();
export const shiftMonth = (ym, n) => {
  const t = new Date(Date.UTC(Number(ym.slice(0, 4)), Number(ym.slice(5, 7)) - 1 + n, 1));
  return t.toISOString().slice(0, 7);
};
// What counts as spending and income in totals: out and in. A move between
// one's own accounts is neither, nor is a balance set by hand; paying a credit
// card bill (a move) isn't spending again either: the card's buys were.
// Money back (a 退款, a friend's share) isn't income: it comes off its spend
// (Jay 2026-10-27). A fee is spending of its own, under 稅費 › 手續費.
export const FEE = { cat: 'tax', sub: 'tax:fee' };
// What's come back for each spend (id → NT$).
export function backs(books) {
  const out = new Map();
  for (const e of live(books.entries)) if (e.k === 'back' && e.of) out.set(e.of, (out.get(e.of) || 0) + (Number(e.amt) || 0));
  return out;
}
// What a spend came to after what came back (never below 0).
export const netOf = (e, back) => Math.max(0, (Number(e.amt) || 0) - (back.get(e.id) || 0));
// The spending and income from `from` to `to` (either '' open), each a line
// { e, d, k: 'out' | 'in', cat, sub, amt }: a spend less what came back for
// it, its fee as a line of its own, an income. Money back for a spend that
// isn't in the books (from before, 退款 logged as income) comes off its own day.
export function lines(books, from = '', to = '') {
  const back = backs(books);
  const inRange = d => (!from || d >= from) && (!to || d <= to);
  const out = [];
  for (const e of live(books.entries)) {
    if (!inRange(e.d)) continue;
    const amt = Number(e.amt) || 0;
    if (e.k === 'out') {
      const net = netOf(e, back);
      if (net) out.push({ e, d: e.d, k: 'out', cat: e.cat || 'other', sub: e.sub || '', amt: net });
    } else if (e.k === 'in') out.push({ e, d: e.d, k: 'in', cat: e.cat || 'otherin', sub: e.sub || '', amt });
    else if (e.k === 'back' && !(e.of && books.entries[e.of] && !books.entries[e.of].del)) out.push({ e, d: e.d, k: 'out', cat: e.cat || 'other', sub: e.sub || '', amt: -amt });
    const fee = feeOf(e);
    if (fee) out.push({ e, d: e.d, k: 'out', cat: FEE.cat, sub: FEE.sub, amt: fee, fee: true });
  }
  return out;
}

// The entries of a day, a month, or a range of days, newest made first.
export const entriesOn = (books, day) => live(books.entries).filter(e => e.d === day).sort((a, b) => (b.t || b.u || 0) - (a.t || a.u || 0));
export const entriesIn = (books, from, to) => live(books.entries).filter(e => e.d >= from && e.d <= to);

// Each day of a month: { out, in } (whole NT$).
export function monthByDay(books, ym) {
  const days = {};
  for (const e of live(books.entries)) if (e.d?.startsWith(ym)) (days[e.d] ||= { out: 0, in: 0, n: 0 }).n++;
  for (const l of lines(books, `${ym}-01`, `${ym}-31`)) days[l.d][l.k] += l.amt;
  return days;
}
// A range's totals: spent, earned, and the spending by category (largest first).
export function totals(books, from, to) {
  let out = 0;
  let inc = 0;
  const cats = {};
  const incCats = {};
  for (const l of lines(books, from, to)) {
    if (l.k === 'out') {
      out += l.amt;
      cats[l.cat] = (cats[l.cat] || 0) + l.amt;
    } else {
      inc += l.amt;
      incCats[l.cat] = (incCats[l.cat] || 0) + l.amt;
    }
  }
  const sorted = o => Object.entries(o).sort((a, b) => b[1] - a[1]).map(([cat, amt]) => ({ cat, amt }));
  return { out, in: inc, net: inc - out, cats: sorted(cats), incCats: sorted(incCats) };
}
export const monthTotals = (books, ym) => totals(books, `${ym}-01`, `${ym}-${String(monthDays(ym)).padStart(2, '0')}`);

// One account's spending and income over a range: what left it for spends
// and fees, less what came back into it; what came in as income.
export function acctTotals(books, id, from, to) {
  let out = 0;
  let inc = 0;
  for (const e of entriesIn(books, from, to)) {
    const x = effect(e, id);
    if (e.k === 'out' || e.k === 'back') out -= x;
    else if (e.k === 'move' && e.a === id) out += feeOf(e);
    else if (e.k === 'in') inc += x;
  }
  return { out: Math.max(0, out), in: inc };
}

// ---- Budgets -----------------------------------------------------------------------

// Each budget for a month: how much of it is spent, and how fast against the
// days gone (pace: the spending as a share of the budget, over the share of the
// month gone; > 1 ahead of it). `today` places a month that's running.
export function budgetState(books, ym, today) {
  const t = monthTotals(books, ym);
  const byCat = Object.fromEntries(t.cats.map(c => [c.cat, c.amt]));
  const days = monthDays(ym);
  const gone = today?.startsWith(ym) ? Number(today.slice(8, 10)) : today && today < `${ym}-01` ? 0 : days;
  return live(books.budgets)
    .filter(b => b.amt > 0)
    .map(b => {
      const spent = b.cat ? byCat[b.cat] || 0 : t.out;
      const share = spent / b.amt;
      return { ...b, spent, left: b.amt - spent, share, pace: gone ? share / (gone / days) : 0, perDay: gone < days ? Math.max(0, Math.floor((b.amt - spent) / (days - gone + (today?.startsWith(ym) ? 1 : 0)))) : 0 };
    })
    .sort((a, b) => (a.cat ? 1 : 0) - (b.cat ? 1 : 0) || b.share - a.share);
}

// ---- Repeats -----------------------------------------------------------------------

// The days a repeat falls on from `from` to `to` (both 'YYYY-MM-DD', inclusive).
export function repeatDays(r, from, to) {
  const out = [];
  const start = r.from > from ? r.from : from;
  if (!start || start > to) return out;
  if (r.every === 'week') {
    let d = start;
    const wd = new Date(`${d}T12:00:00Z`).getUTCDay();
    d = addDays(d, (Number(r.day) - wd + 7) % 7);
    for (; d <= to; d = addDays(d, 7)) out.push(d);
    return out;
  }
  if (r.every === 'year') {
    const [mm, dd] = String(r.day || '01-01').split('-').map(Number);
    for (let y = Number(start.slice(0, 4)); y <= Number(to.slice(0, 4)); y++) {
      const ym = `${y}-${String(mm).padStart(2, '0')}`;
      const d = `${ym}-${String(Math.min(dd, monthDays(ym))).padStart(2, '0')}`;
      if (d >= start && d <= to) out.push(d);
    }
    return out;
  }
  for (let ym = start.slice(0, 7); ym <= to.slice(0, 7); ym = shiftMonth(ym, 1)) {
    const d = `${ym}-${String(Math.min(Number(r.day) || 1, monthDays(ym))).padStart(2, '0')}`;
    if (d >= start && d <= to) out.push(d);
  }
  return out;
}
// The entries a repeat makes, each id fixed by the repeat and the day: two
// devices make the same entry, and one removed by hand stays removed.
export const repeatEntryId = (r, day) => `r-${r.id}-${day}`;
// Every repeat's entries due up to `today` that aren't in the books yet (made
// or removed). Returns how many were added.
export function runRepeats(books, today, now = Date.now()) {
  let n = 0;
  for (const r of live(books.recur)) {
    if (!books.accts[r.a] || books.accts[r.a].del) continue;
    for (const d of repeatDays(r, r.from, today)) {
      const id = repeatEntryId(r, d);
      if (books.entries[id]) continue;
      put(books, 'entries', { id, d, k: r.k, amt: r.amt, cat: r.k === 'move' ? '' : r.cat, sub: r.k === 'move' ? '' : r.sub || '', note: r.note || '', a: r.a, via: r.via || '', to: r.k === 'move' ? r.to : '', rec: r.id, t: now }, now);
      n++;
    }
  }
  return n;
}
// The next day a repeat falls on, on or after `today`.
export const nextRepeat = (r, today) => repeatDays(r, today, addDays(today, 400))[0] || '';

// ---- Credit cards ------------------------------------------------------------------

// A credit card's statement: what was bought between the last two closing
// days (the bill), when it's due, and what's been paid since it closed.
export function cardBill(books, card, today) {
  const close = Math.min(Math.max(Number(card.close) || 0, 1), 31);
  if (!card.close) return null;
  const dayIn = ym => `${ym}-${String(Math.min(close, monthDays(ym))).padStart(2, '0')}`;
  let ym = today.slice(0, 7);
  if (dayIn(ym) >= today) ym = shiftMonth(ym, -1);
  const closed = dayIn(ym);
  const opened = addDays(dayIn(shiftMonth(ym, -1)), 1);
  let bill = 0;
  let paid = 0;
  for (const e of live(books.entries)) {
    // (Money back onto the card in the statement comes off it.)
    const x = effect(e, card.id);
    if (e.d >= opened && e.d <= closed && (x < 0 || e.k === 'back')) bill -= x;
    if (e.d > closed && e.k === 'move' && e.to === card.id) paid += e.amt;
  }
  bill = Math.max(0, bill);
  const dueDay = Number(card.due) || 0;
  let due = '';
  if (dueDay) {
    let dm = ym;
    do dm = shiftMonth(dm, 1);
    while (`${dm}-${String(Math.min(dueDay, monthDays(dm))).padStart(2, '0')}` <= closed);
    due = `${dm}-${String(Math.min(dueDay, monthDays(dm))).padStart(2, '0')}`;
  }
  return { closed, opened, bill, paid, left: Math.max(0, bill - paid), due };
}

// ---- 自動加值 -------------------------------------------------------------------------

// A stored-value card that reloads itself (悠遊卡, 一卡通, icash: a.reload
// { on, from, amt, below }, the person's own settings; the usual rule is
// NT$500 when the balance is under NT$100 or short of the fare): a spend that
// sets it off brings its reload in as a transfer from the account behind it,
// on the same day, tied to the spend (`for`), so both balances stay right.
// Run again when the spend changes; its old reload goes first. → the amount reloaded.
export function autoReload(books, e, now = Date.now()) {
  for (const r of live(books.entries)) if (r.for === e.id) drop(books, 'entries', r.id, now);
  const a = books.accts[e.a];
  const r = a?.reload;
  // (No account behind it, left empty: paid by someone not in the books, a
  // parent's card (Jay 2026-10-27): it comes in as income, under 自動加值, Jay 2026-10-29.)
  const outside = !r?.from || !books.accts[r.from] || books.accts[r.from].del;
  if (!e || e.del || e.k !== 'out' || !r?.on || !(r.amt > 0) || r.from === a.id) return 0;
  const bal = balances(books, e.d)[a.id];
  if (bal + e.amt >= (Number(r.below) || 0) && bal >= 0) return 0;
  let n = 1;
  while (bal + n * r.amt < 0 && n < 20) n++;
  const base = { id: `${e.id}-r`, d: e.d, amt: n * r.amt, via: '', auto: 'reload', for: e.id, t: (e.t || now) - 1 };
  put(books, 'entries', outside ? { ...base, k: 'in', cat: 'topup', sub: '', note: '', a: a.id, to: '' } : { ...base, k: 'move', cat: '', note: '', a: r.from, to: a.id }, now);
  return n * r.amt;
}

// ---- What's usual ------------------------------------------------------------------

// A category's (or a sub's) usual amounts and way to pay, from the last 120
// days of the person's own entries (Jay 2026-10-27: breakfast is often NT$34,
// the bread): amounts seen at least twice, most often first (the newer of two
// as often); the way to pay used most, with how many of how many. Only ever
// offered, never filled in by itself.
export function usualFor(books, { k, cat, sub = '' }, today, { days = 120, max = 4 } = {}) {
  const from = addDays(today, -days);
  const list = live(books.entries)
    .filter(e => e.k === k && e.cat === cat && (!sub || e.sub === sub) && e.d >= from && e.d <= today)
    .sort((a, b) => b.d.localeCompare(a.d) || (b.t || 0) - (a.t || 0));
  const amts = new Map();
  const pays = new Map();
  list.forEach((e, i) => {
    const x = amts.get(e.amt) || { amt: e.amt, n: 0, last: i };
    x.n++;
    amts.set(e.amt, x);
    const key = `${e.a}|${e.via || ''}`;
    pays.set(key, (pays.get(key) || 0) + 1);
  });
  const top = [...pays].sort((a, b) => b[1] - a[1])[0];
  return {
    of: list.length,
    amts: [...amts.values()].filter(x => x.n >= 2).sort((a, b) => b.n - a.n || a.last - b.last).slice(0, max).map(x => ({ amt: x.amt, n: x.n })),
    pay: top ? { a: top[0].split('|')[0], via: top[0].split('|')[1], n: top[1] } : null,
    last: list.slice(0, 6)
  };
}

// ---- Merging and saving ------------------------------------------------------------

// Two copies made one: each record the one changed last; the settings the newer
// copy's (st, seconds); removals older than KEEP_GONE_MS let go.
export function mergeBooks(mine, theirs, now = Date.now()) {
  if (!theirs) return mine;
  const out = emptyBooks();
  for (const col of COLLECTIONS) {
    const a = mine?.[col] || {};
    const b = theirs?.[col] || {};
    for (const id of new Set([...Object.keys(a), ...Object.keys(b)])) {
      const x = a[id];
      const y = b[id];
      const r = !x ? y : !y ? x : (y.u || 0) > (x.u || 0) ? y : x;
      if (r && !(r.del && now - (r.u || 0) > KEEP_GONE_MS)) out[col][id] = r;
    }
  }
  const newer = (theirs.st || 0) > (mine?.st || 0) ? theirs : mine || theirs;
  out.st = newer.st || 0;
  out.opt = { ...(newer.opt || {}) };
  out.carrier = !mine?.carrier ? theirs.carrier || null : !theirs.carrier ? mine.carrier : (theirs.carrier.u || 0) > (mine.carrier.u || 0) ? theirs.carrier : mine.carrier;
  return out;
}

// The books as JSON for saving, and back (a copy that isn't the books is null:
// never saved over).
export const packBooks = books => ({ v: 1, ...Object.fromEntries(COLLECTIONS.map(c => [c, books[c] || {}])), carrier: books.carrier || null, st: books.st || 0, opt: books.opt || {} });
export function unpackBooks(x) {
  if (!x || x.v !== 1 || typeof x.accts !== 'object' || typeof x.entries !== 'object') return null;
  const b = emptyBooks();
  for (const c of COLLECTIONS) b[c] = x[c] && typeof x[c] === 'object' ? x[c] : {};
  b.carrier = x.carrier || null;
  b.st = Number(x.st) || 0;
  b.opt = x.opt && typeof x.opt === 'object' ? x.opt : {};
  return b;
}

async function gzipB64(text) {
  const stream = new Blob([text]).stream().pipeThrough(new CompressionStream('gzip'));
  const bytes = new Uint8Array(await new Response(stream).arrayBuffer());
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}
async function gunzipB64(b64) {
  const bytes = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
  return new Response(stream).text();
}
// The Pass's payload: 'm1:' + gzip (base64) of packBooks.
export const encodeBooks = async books => `m1:${await gzipB64(JSON.stringify(packBooks(books)))}`;
export async function decodeBooks(payload) {
  if (typeof payload !== 'string' || !payload.startsWith('m1:')) return null;
  try {
    return unpackBooks(JSON.parse(await gunzipB64(payload.slice(3))));
  } catch {
    return null;
  }
}

// ---- A 載具's invoices against what was logged by hand ----------------------------
// A purchase typed in that day has no invoice number, so a 載具 file or the
// monthly mail would add it again. Each invoice is matched first to an
// unclaimed spending entry of the same amount on its day (else the day after,
// else the day before: logged late or early); a match just gets the invoice
// (for 對獎 and the items), and only the rest are offered as new.
// → { attach: [[entryId, invoice]], fresh: [invoice] }, invoices already in left out.
export function matchInvoices(books, list) {
  const all = live(books.entries);
  const have = new Set(all.map(e => e.inv?.no).filter(Boolean));
  const free = all.filter(e => e.k === 'out' && !e.inv?.no);
  const used = new Set();
  const attach = [];
  const fresh = [];
  for (const i of list) {
    if (i.void || (i.no && (have.has(i.no) || books.entries[`inv-${i.no}`]))) continue;
    const amt = Math.round(i.total);
    const on = day => free.find(e => !used.has(e.id) && e.d === day && e.amt === amt);
    const e = on(i.day) || on(addDays(i.day, 1)) || on(addDays(i.day, -1));
    if (e && i.no) {
      used.add(e.id);
      attach.push([e.id, i]);
    } else if (!e) fresh.push(i);
  }
  return { attach, fresh };
}

// ---- Money back --------------------------------------------------------------------

// A friend's share not handed over yet: { e (the back), of (its spend) }, oldest first.
export const owed = books =>
  live(books.entries)
    .filter(e => e.k === 'back' && e.wait)
    .sort((a, b) => a.d.localeCompare(b.d))
    .map(e => ({ e, of: books.entries[e.of] && !books.entries[e.of].del ? books.entries[e.of] : null }));
// What's come back for one spend, each back entry.
export const backsFor = (books, id) => live(books.entries).filter(e => e.k === 'back' && e.of === id);

// ---- Older books brought up to date (on every open; nothing done twice) ------------

// 退款 logged as income (its income category went 2026-10-27: money back
// comes off what it was for) becomes money back for the spend it most likely
// was: in the 90 days before it, at least its amount; the same amount, then
// the same account, then the latest first. None: money back on its own day.
// A 自動加值 nobody in the books paid for (an adj, before) becomes income,
// under 自動加值 (Jay 2026-10-29: not 其他), as does a 其他 income that is one:
// the app's own, or logged by hand with 加值 / top up in its note.
// → how many entries changed.
const TOPUP = /加值|儲值|top.?up|reload/i;
export function upgradeBooks(books, now = Date.now()) {
  let n = 0;
  const all = live(books.entries);
  const back = backs(books);
  for (const e of all.sort((a, b) => a.d.localeCompare(b.d))) {
    if ((e.k === 'adj' && e.auto === 'reload') || (e.k === 'in' && e.cat === 'otherin' && (e.auto === 'reload' || TOPUP.test(e.note || '')))) {
      put(books, 'entries', { ...e, k: 'in', cat: 'topup', sub: '' }, now);
      n++;
    } else if (e.k === 'in' && e.cat === 'refund') {
      const from = addDays(e.d, -90);
      const score = x => (x.amt === e.amt ? 2 : 0) + (x.a === e.a ? 1 : 0);
      const best = all
        .filter(x => x.k === 'out' && x.d <= e.d && x.d >= from && netOf(x, back) >= e.amt)
        .sort((x, y) => score(y) - score(x) || y.d.localeCompare(x.d))[0];
      put(books, 'entries', { ...e, k: 'back', why: 'refund', of: best?.id || '', cat: best?.cat || 'other', sub: best?.sub || '' }, now);
      if (best) back.set(best.id, (back.get(best.id) || 0) + e.amt);
      n++;
    }
  }
  for (const r of live(books.recur)) if (r.k === 'in' && r.cat === 'refund') put(books, 'recur', { ...r, cat: 'otherin', sub: '' }, now), n++;
  return n;
}
