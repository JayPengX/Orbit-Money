// 帳戶: the 總資產 (what the counted accounts hold, less what the counted
// cards owe), every account by kind with its balance, and the repeats
// (固定收支). An account opens to its balance, its month, its cards and
// entries; a credit card to its bill too.
import { h, icons, tile, sheet, toggle, toast, empty, segmented, menu } from '#kit/ui.mjs';
import { ask } from '#kit/orbit.mjs';
import { balances, worth, put, drop, dropAccount, live, adjustBy, cardBill, totals, nextRepeat, runRepeats, ACCOUNT_KINDS, groupOf } from '../lib/books.mjs';
import { brandsFor, brandOf } from '../lib/brands.mjs';
import { catsFor, catOf, catName, glyph, lookOf } from '../lib/cats.mjs';
import { state, W, en, lang, money, dayLabel, today, saved, KINDS, kindName, acct, acctName, allAccounts, cardsOf, logoFor, card } from '../shell.mjs';
import { entryRow, openEntry, payOptions } from './entry.mjs';

// An account's picture: its brand's logo, else its kind's tile.
export function acctTile(a, size = 40) {
  const src = logoFor(a);
  const k = KINDS[a?.kind] || KINDS.other;
  if (!src) return tile(glyph(k.icon), k.color);
  const img = h('img', { src, alt: '', width: String(size), height: String(size), loading: 'lazy', decoding: 'async' });
  img.addEventListener('error', () => img.parentNode?.replaceWith(tile(glyph(k.icon), k.color)), { once: true });
  return h('span', { class: 'mn-logo', style: `--s:${size}px` }, [img]);
}

export function renderAccts(box) {
  const b = state.books;
  const bal = balances(b);
  const w = worth(b);
  const all = allAccounts();
  const hero = h('section', { class: 'q-hero-card mn-hero' }, [
    h('span', { class: 'q-hc-eyebrow', text: W('總資產', 'Net worth') }),
    h('b', { class: 'q-hc-big num q-fit', text: money(w.net) }),
    h('div', { class: 'mn-hero-figs two' }, [fig(W('資產', 'Assets'), money(w.assets)), fig(W('負債', 'Debts'), money(w.debts))])
  ]);
  const groups = ACCOUNT_KINDS.map(kind => {
    const list = all.filter(a => groupOf(a.kind) === kind);
    if (!list.length) return null;
    return h('section', { class: 'q-section' }, [
      h('div', { class: 'q-section-head' }, [h('h2', { text: kindName(kind) })]),
      h('div', { class: 'q-rowcard' }, list.map(a => acctRow(a, bal[a.id] || 0)))
    ]);
  });
  const add = h('button', { class: 'q-btn tinted block mn-add', type: 'button', onclick: () => openAccountEdit(null) }, [h('span', { html: icons.plus }), W('新增帳戶', 'Add an account')]);

  // 固定收支.
  const reps = live(b.recur).filter(r => acct(r.a));
  const now = today();
  const repSec = h('section', { class: 'q-section' }, [
    h('div', { class: 'q-section-head' }, [h('h2', { text: W('固定收支', 'Repeats') }), h('button', { type: 'button', text: W('新增', 'Add'), onclick: () => openRepeat(null) })]),
    reps.length
      ? h(
          'div',
          { class: 'q-rowcard' },
          reps
            .map(r => ({ r, next: nextRepeat(r, now) }))
            .sort((x, y) => (x.next || '9').localeCompare(y.next || '9'))
            .map(({ r, next }) => {
              const look = lookOf(r);
              return h('button', { class: 'q-ritem chevron mn-row', type: 'button', onclick: () => openRepeat(r) }, [
                tile(glyph(look.icon), look.color),
                h('span', { class: 'q-ritem-text' }, [h('span', { class: 'q-ritem-title', text: r.note || (r.k === 'move' ? W('轉帳', 'Transfer') : catName(look, lang)) }), h('small', { text: [everyText(r), next ? W(`下次 ${dayLabel(next, { week: false })}`, `next ${dayLabel(next, { week: false })}`) : ''].filter(Boolean).join(' · ') })]),
                h('span', { class: `q-ritem-value num mn-amt ${r.k}`, text: r.k === 'in' ? money(r.amt, { sign: true }) : money(r.amt) })
              ]);
            })
        )
      : h('p', { class: 'mn-hint', text: W('房租、薪水、訂閱⋯每期自動記好。', 'Rent, pay, subscriptions: recorded for you each time.') })
  ]);
  box.replaceChildren(hero, ...groups.filter(Boolean), add, repSec);
}

const fig = (label, value) => h('div', { class: 'mn-fig' }, [h('small', { text: label }), h('b', { class: 'num q-fit', text: value })]);

function acctRow(a, balance) {
  const cards = cardsOf(a.id);
  // (Short: the balance needs its room on a 320 px phone.)
  const one = cards.length === 1 ? cards[0] : null;
  const sub = !a.inTotal ? W('不計入總資產', 'Not in the total') : cards.length > 1 ? W(`${cards.length} 種付款方式`, `${cards.length} ways to pay`) : one ? one.name : a.kind === 'credit' && a.due ? W(`每月 ${a.due} 日繳款`, `due day ${a.due}`) : '';
  return h('button', { class: 'q-ritem chevron mn-row', type: 'button', onclick: () => openAccount(a.id) }, [
    acctTile(a),
    h('span', { class: 'q-ritem-text' }, [h('span', { class: 'q-ritem-title', text: a.name }), sub ? h('small', { text: sub }) : null]),
    h('span', { class: `q-ritem-value num mn-amt${balance < 0 ? ' owe' : ''}`, text: money(balance) })
  ]);
}

// ---- One account ----------------------------------------------------------------

export function openAccount(id, host = null) {
  const b = state.books;
  const a = acct(id);
  if (!a) return;
  const now = today();
  const bal = balances(b)[id] || 0;
  const ym = now.slice(0, 7);
  const mine = live(b.entries).filter(e => e.a === id || e.to === id);
  const month = totals({ ...b, entries: Object.fromEntries(mine.map(e => [e.id, e])) }, `${ym}-01`, `${ym}-31`);
  const bill = a.kind === 'credit' ? cardBill(b, a, now) : null;
  const hero = h('div', { class: 'mn-acct-hero' }, [acctTile(a, 56), h('small', { text: a.kind === 'credit' ? W('目前欠款', 'Owed now') : W('餘額', 'Balance') }), h('b', { class: 'num q-fit', text: money(a.kind === 'credit' ? -bal : bal) })]);
  const facts = h('div', { class: 'q-fig mn-facts' }, [
    h('div', {}, [h('small', { text: W('本月支出', 'Spent this month') }), h('b', { class: 'num q-fit', text: money(month.out) })]),
    bill
      ? h('div', {}, [h('small', { text: W('本期帳單', 'This bill') }), h('b', { class: 'num q-fit', text: money(bill.left) })])
      : h('div', {}, [h('small', { text: W('本月收入', 'In this month') }), h('b', { class: 'num q-fit', text: money(month.in) })]),
    bill?.due ? h('div', {}, [h('small', { text: W('繳款截止', 'Due') }), h('b', { text: dayLabel(bill.due, { week: false }) })]) : null
  ]);
  const actions = h('div', { class: 'mn-actions' }, [
    action('pencil', W('調整餘額', 'Fix balance'), () => fixBalance(a)),
    action('exchange', W('轉帳', 'Transfer'), () => (s.close(), openEntry({ kind: 'move', from: a.id }))),
    a.kind === 'credit' && a.pay && acct(a.pay) ? action('card', W('繳卡費', 'Pay bill'), () => (s.close(), payBill(a, bill))) : null
  ]);
  // (A 儲值卡 or 電子支付 is itself the way to pay.)
  const cardSec = METHODS[a.kind] ? cardsSection(a, () => s) : null;
  const recent = mine.sort((x, y) => y.d.localeCompare(x.d) || (y.t || 0) - (x.t || 0)).slice(0, 40);
  const list = h('section', { class: 'q-section' }, [
    h('div', { class: 'q-section-head' }, [h('h2', { text: W('最近', 'Recent') })]),
    recent.length ? h('div', { class: 'q-rowcard' }, recent.map(e => entryRow(e, { day: true, inAcct: true }))) : h('p', { class: 'mn-hint', text: W('還沒有紀錄', 'Nothing yet') })
  ]);
  const edit = h('button', { class: 'q-btn plain small', type: 'button', text: W('編輯', 'Edit'), onclick: () => openAccountEdit(a, s) });
  const page = { title: a.name, trailing: edit, lead: h('button', { class: 'q-close', type: 'button', 'data-q-close': '', 'aria-label': W('關閉', 'Close'), text: '✕' }), detent: 'large', cls: 'mn-acct', body: [hero, facts, actions, cardSec, list] };
  const s = host ? swapPage(host, page) : sheet(page);
}

// A sheet's page changed in place (編輯 inside an account, and back to it):
// the person stays in the one sheet, never thrown out to the tab.
function swapPage(s, { title, lead = null, trailing = null, body = [], foot = null, cls }) {
  const d = s.el;
  d.classList.remove('mn-acct', 'mn-acct-edit');
  d.classList.add(cls);
  d.classList.toggle('q-has-foot', Boolean(foot));
  const head = h('div', { class: 'q-sheet-head' }, [lead || h('span'), h('h2', {}, [title]), trailing || h('button', { class: 'q-close', type: 'button', 'data-q-close': '', 'aria-label': W('關閉', 'Close'), text: '✕' })]);
  d.replaceChildren(head, ...[].concat(body).filter(Boolean), ...(foot ? [foot] : []));
  d.scrollTop = 0;
  return s;
}
const action = (icon, label, onClick) => h('button', { class: 'mn-action', type: 'button', onclick: onClick }, [h('span', { class: 'mn-action-i', html: glyph(icon) }), h('span', { text: label })]);

// The ways to pay that sit under an account: a debit card on a bank, Apple
// Pay or LINE Pay on a credit card… Each is picked by itself when recording,
// the money still from (or owed on) this account.
const METHODS = {
  bank: ['金融卡', 'Apple Pay', 'Google Pay', 'LINE Pay', '街口支付', '全支付'],
  credit: ['實體卡', 'Apple Pay', 'Google Pay', 'Samsung Pay', 'LINE Pay', '街口支付']
};
const methodsFor = a => METHODS[a.kind] || METHODS.bank;
const methodNote = a => (a.kind === 'credit' ? W('用它付，記在這張卡', 'Charged to this card') : W('用它付，從這個帳戶扣', 'Paid from this account'));

function cardsSection(a, host) {
  const cards = cardsOf(a.id);
  return h('section', { class: 'q-section' }, [
    h('div', { class: 'q-section-head' }, [h('h2', { text: W('付款方式', 'Ways to pay') }), h('button', { type: 'button', text: W('新增', 'Add'), onclick: () => editCard(a, null, host()) })]),
    h(
      'div',
      { class: 'q-rowcard' },
      [
        a.kind === 'bank' ? h('div', { class: 'q-ritem' }, [tile(glyph('exchange'), '#8e8e93'), h('span', { class: 'q-ritem-text' }, [h('span', { class: 'q-ritem-title', text: W('轉帳／提款', 'Transfer or ATM') })])]) : null,
        ...cards.map(c =>
          h('button', { class: 'q-ritem chevron', type: 'button', onclick: () => editCard(a, c, host()) }, [tile(glyph('card'), '#0088ff'), h('span', { class: 'q-ritem-text' }, [h('span', { class: 'q-ritem-title', text: `${c.name}${c.last4 ? ` •${c.last4}` : ''}` }), h('small', { text: methodNote(a) })])])
        ),
        ...allAccounts()
          .filter(x => x.kind === 'credit' && x.pay === a.id)
          .map(x => h('div', { class: 'q-ritem' }, [acctTile(x), h('span', { class: 'q-ritem-text' }, [h('span', { class: 'q-ritem-title', text: x.name }), h('small', { text: W('信用卡：帳單從這個帳戶繳', 'Credit card: its bill is paid from here') })])])),
        // (None yet: the row that adds one says what goes here.)
        cards.length || a.kind === 'bank' ? null : h('button', { class: 'q-ritem chevron', type: 'button', onclick: () => editCard(a, null, host()) }, [tile(icons.plus, '#8e8e93'), h('span', { class: 'q-ritem-text' }, [h('span', { class: 'q-ritem-title', text: W('新增付款方式', 'Add a way to pay') }), h('small', { text: 'Apple Pay、LINE Pay…' })])])
      ].filter(Boolean)
    ),
  ]);
}

// One way to pay, in the account's own sheet (‹ back to it).
function editCard(a, c, host) {
  const name = h('input', { class: 'q-field', type: 'text', maxlength: '20', placeholder: W('名稱', 'Name'), value: c?.name || methodsFor(a)[0] });
  const last4 = h('input', { class: 'q-field', type: 'text', inputmode: 'numeric', maxlength: '4', placeholder: W('可不填', 'Optional'), value: c?.last4 || '' });
  const chips = h('div', { class: 'q-chips mn-kinds' });
  const paintChips = () => chips.replaceChildren(...methodsFor(a).map(m => h('button', { class: 'q-chip', type: 'button', 'aria-pressed': String(name.value === m), text: m, onclick: () => ((name.value = m), paintChips()) })));
  name.addEventListener('input', paintChips);
  paintChips();
  const back = () => openAccount(a.id, host);
  swapPage(host, {
    title: c ? c.name : W('新增付款方式', 'Add a way to pay'),
    lead: h('button', { class: 'q-close mn-back', type: 'button', 'aria-label': W('返回', 'Back'), html: icons.chevron, onclick: back }),
    cls: 'mn-acct-edit',
    body: [h('div', { class: 'mn-form' }, [chips, field(W('名稱', 'Name'), name), field(W('卡號末四碼', 'Last 4 digits'), last4)])],
    foot: h('div', { class: 'q-sheet-foot mn-foot2' }, [
      c ? h('button', { class: 'q-btn danger tinted', type: 'button', text: W('刪除', 'Delete'), onclick: () => (drop(state.books, 'cards', c.id), saved(), back()) }) : null,
      h('button', {
        class: 'q-btn primary',
        type: 'button',
        text: W('儲存', 'Save'),
        onclick: () => {
          put(state.books, 'cards', { ...(c || {}), acct: a.id, name: name.value.trim() || methodsFor(a)[0], last4: last4.value.replace(/\D/g, '').slice(0, 4) });
          saved();
          back();
        }
      })
    ])
  });
}

async function fixBalance(a) {
  const b = state.books;
  const now = today();
  const cur = balances(b, now)[a.id] || 0;
  const credit = a.kind === 'credit';
  const input = h('input', { class: 'q-field mn-big-in num', type: 'text', inputmode: 'numeric', value: String(credit ? -cur : cur), 'aria-label': W('實際金額', 'Actual amount') });
  const s = sheet({
    title: W('調整餘額', 'Fix balance'),
    detent: 'medium',
    body: [h('p', { class: 'mn-hint', text: credit ? W('輸入現在實際的欠款，差額記成一筆調整。', 'Type what it owes now; the difference is recorded as a fix.') : W('輸入現在實際的餘額，差額記成一筆調整。', 'Type the real balance now; the difference is recorded as a fix.') }), input],
    foot: h('div', { class: 'q-sheet-foot' }, [
      h('button', {
        class: 'q-btn primary block',
        type: 'button',
        text: W('儲存', 'Save'),
        onclick: () => {
          const v = Number(input.value.replace(/[^\d-]/g, ''));
          if (!Number.isFinite(v)) return;
          const by = adjustBy(b, a.id, credit ? -v : v, now);
          if (by) put(b, 'entries', { d: now, k: 'adj', amt: by, a: a.id, cat: '', note: '', t: Date.now() });
          s.close();
          saved();
          if (by) toast(W('餘額已調整', 'Balance fixed'));
        }
      })
    ])
  });
  setTimeout(() => input.focus(), 300);
}

const payBill = (a, bill) => openEntry({ kind: 'move', amt: bill?.left || 0, note: W('繳卡費', 'Card bill'), from: a.pay, to: a.id });

// ---- Adding or changing an account ----------------------------------------------

export function openAccountEdit(a, host = null) {
  const isNew = !a;
  const f = { kind: a?.kind || 'bank', brand: a?.brand || '', name: a?.name || '', open: '', inTotal: a ? Boolean(a.inTotal) : true, pay: a?.pay || '', close: a?.close || '', due: a?.due || '' };
  const body = h('div', { class: 'mn-form' });
  const nameIn = h('input', { class: 'q-field', type: 'text', maxlength: '24', placeholder: W('名稱', 'Name'), value: f.name });
  nameIn.addEventListener('input', () => (f.name = nameIn.value));
  const openIn = h('input', { class: 'q-field num', type: 'text', inputmode: 'numeric', placeholder: '0' });
  openIn.addEventListener('input', () => (f.open = openIn.value));
  const dayIn = (key, ph) => {
    const i = h('input', { class: 'q-field num', type: 'text', inputmode: 'numeric', maxlength: '2', placeholder: ph, value: f[key] ? String(f[key]) : '' });
    i.addEventListener('input', () => (f[key] = i.value));
    return i;
  };
  const closeIn = dayIn('close', W('例如 15', 'e.g. 15'));
  const dueIn = dayIn('due', W('例如 3', 'e.g. 3'));
  const counted = toggle({ checked: f.inTotal, label: W('計入總資產', 'Count in net worth'), onChange: on => (f.inTotal = on) });

  function paint() {
    const brands = brandsFor(f.kind);
    const kindPick = isNew
      ? h('div', { class: 'q-chips mn-kinds' }, ACCOUNT_KINDS.filter(k => k !== 'cash').map(k => h('button', { class: 'q-chip', type: 'button', 'aria-pressed': String(k === f.kind), text: kindName(k), onclick: () => ((f.kind = k), (f.brand = ''), paint()) })))
      : null;
    const brandGrid = brands.length
      ? h(
          'div',
          { class: 'mn-brands' },
          brands.map(br =>
            h('button', { class: 'mn-brand', type: 'button', 'aria-pressed': String(br.id === f.brand), onclick: () => ((f.brand = f.brand === br.id ? '' : br.id), !nameIn.value || brands.some(x => (en ? x.en : x.zh) === nameIn.value) ? ((nameIn.value = f.brand ? (en ? br.en : br.zh) + (f.kind === 'credit' ? W(' 信用卡', ' card') : '') : ''), (f.name = nameIn.value)) : 0, paint()) }, [
              acctTile({ brand: br.id, kind: f.kind }, 40),
              h('span', { text: en ? br.en : br.zh })
            ])
          )
        )
      : null;
    const payPick =
      f.kind === 'credit'
        ? h('button', { class: 'mn-pill', type: 'button', onclick: e => menu(e.currentTarget, [{ label: W('不設定', 'None'), onClick: () => ((f.pay = ''), paint()) }, ...allAccounts().filter(x => x.kind === 'bank' && x.id !== a?.id).map(x => ({ label: x.name, icon: x.id === f.pay ? '✓' : '', onClick: () => ((f.pay = x.id), paint()) }))]) }, [h('span', { class: 'mn-pill-t', text: f.pay ? acctName(f.pay) : W('選銀行帳戶', 'Choose a bank account') }), h('i', { html: icons.chevron })])
        : null;
    body.replaceChildren(
      ...[
        kindPick ? field(W('種類', 'Kind'), kindPick) : null,
        brandGrid ? field(f.kind === 'ticket' ? W('哪一張', 'Which card') : f.kind === 'wallet' ? W('哪一個', 'Which one') : W('銀行', 'Bank'), brandGrid) : null,
        field(W('名稱', 'Name'), nameIn),
        isNew ? field(f.kind === 'credit' ? W('目前欠款', 'Owed now') : W('目前餘額', 'Balance now'), openIn) : null,
        f.kind === 'credit' ? field(W('繳款帳戶', 'Paid from'), payPick) : null,
        f.kind === 'credit' ? h('div', { class: 'mn-two' }, [field(W('結帳日（每月）', 'Statement day'), closeIn), field(W('繳款截止日', 'Due day'), dueIn)]) : null,
        h('div', { class: 'mn-switch-row' }, [h('span', {}, [h('b', { text: W('計入總資產', 'Count in net worth') }), h('small', { text: W('關掉：例如定存、別人的錢、公司的卡', 'Off for savings you don’t touch, money that isn’t yours') })]), counted])
      ].filter(Boolean)
    );
  }
  paint();
  const save = () => {
    const name = f.name.trim() || (f.brand ? (en ? brandOf(f.brand).en : brandOf(f.brand).zh) : kindName(f.kind));
    const day = v => Math.min(31, Math.max(0, Math.floor(Number(v) || 0))) || '';
    const rec = { ...(a || {}), kind: f.kind, brand: f.brand, name, inTotal: f.inTotal, pay: f.kind === 'credit' ? f.pay : '', close: f.kind === 'credit' ? day(f.close) : '', due: f.kind === 'credit' ? day(f.due) : '' };
    if (isNew) {
      const v = Math.round(Number(String(f.open).replace(/[^\d.-]/g, '')) || 0);
      rec.open = f.kind === 'credit' ? -Math.abs(v) : v;
      rec.order = allAccounts().length;
    }
    const saved_ = put(state.books, 'accts', rec);
    saved();
    if (host) return openAccount(rec.id, host);
    s.close();
    if (isNew) toast(W(`已新增 ${saved_.name}`, `${saved_.name} added`));
  };
  const remove = async () => {
    if (!(await ask({ title: W(`刪除 ${a.name}？`, `Delete ${a.name}?`), body: W('它的紀錄、金融卡和固定收支會一起刪除。', 'Its entries, cards and repeats go with it.'), ok: W('刪除', 'Delete'), cancel: W('取消', 'Cancel'), danger: true, icon: 'trash' }))) return;
    dropAccount(state.books, a.id);
    s.close();
    saved();
  };
  const page = {
    title: isNew ? W('新增帳戶', 'Add an account') : W('編輯帳戶', 'Edit account'),
    // (Inside an account: ‹ goes back to it.)
    lead: host ? h('button', { class: 'q-close mn-back', type: 'button', 'aria-label': W('返回', 'Back'), html: icons.chevron, onclick: () => openAccount(a.id, host) }) : null,
    detent: 'large',
    cls: 'mn-acct-edit',
    body: [body],
    foot: h('div', { class: 'q-sheet-foot mn-foot2' }, [a && a.id !== 'cash' ? h('button', { class: 'q-btn danger tinted', type: 'button', text: W('刪除', 'Delete'), onclick: remove }) : null, h('button', { class: 'q-btn primary', type: 'button', text: W('儲存', 'Save'), onclick: save })])
  };
  const s = host ? swapPage(host, page) : sheet(page);
}
const field = (label, control) => h('label', { class: 'mn-field' }, [h('span', { class: 'mn-field-l', text: label }), control]);

// ---- A repeat ---------------------------------------------------------------------

const WEEKDAYS = en ? ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] : ['週日', '週一', '週二', '週三', '週四', '週五', '週六'];
function everyText(r) {
  if (r.every === 'week') return W(`每${WEEKDAYS[r.day]}`, `every ${WEEKDAYS[r.day]}`);
  if (r.every === 'year') {
    const [m, d] = String(r.day).split('-').map(Number);
    return W(`每年 ${m}月${d}日`, `every year, ${m}/${d}`);
  }
  return W(`每月 ${r.day} 日`, `monthly on the ${r.day}`);
}

export function openRepeat(r) {
  const now = today();
  const f = { k: r?.k || 'out', amt: r?.amt ? String(r.amt) : '', cat: r?.cat || 'home', a: r?.a || 'cash', via: r?.via || '', to: r?.to || '', every: r?.every || 'month', day: r?.day ?? Number(now.slice(8, 10)), from: r?.from || now, note: r?.note || '' };
  const body = h('div', { class: 'mn-form' });
  const amtIn = h('input', { class: 'q-field num mn-big-in', type: 'text', inputmode: 'numeric', placeholder: 'NT$', value: f.amt });
  amtIn.addEventListener('input', () => (f.amt = amtIn.value));
  const noteIn = h('input', { class: 'q-field', type: 'text', maxlength: '40', placeholder: W('名稱（例如：房租、Netflix）', 'Name (e.g. Rent, Netflix)'), value: f.note });
  noteIn.addEventListener('input', () => (f.note = noteIn.value));
  const fromIn = h('input', { class: 'q-field', type: 'date', value: f.from });
  fromIn.addEventListener('change', () => (f.from = fromIn.value || f.from));
  const kinds = segmented(
    [
      { id: 'out', label: W('支出', 'Spend') },
      { id: 'in', label: W('收入', 'Income') },
      { id: 'move', label: W('轉帳', 'Transfer') }
    ],
    { value: f.k, onChange: k => ((f.k = k), (f.cat = k === 'in' ? 'salary' : 'home'), paint()) }
  );
  const everySeg = segmented(
    [
      { id: 'month', label: W('每月', 'Monthly') },
      { id: 'week', label: W('每週', 'Weekly') },
      { id: 'year', label: W('每年', 'Yearly') }
    ],
    { value: f.every, onChange: e => ((f.every = e), (f.day = e === 'week' ? 1 : e === 'year' ? now.slice(5) : Number(now.slice(8, 10))), paint()) }
  );
  function paint() {
    const pick = (field_, moving) => {
      const opts = payOptions({ moving });
      const cur = opts.find(o => o.a === f[field_] && (moving || o.via === f.via));
      return h('button', { class: 'mn-pill', type: 'button', onclick: e => menu(e.currentTarget, opts.map(o => ({ label: o.label, onClick: () => ((f[field_] = o.a), moving || (f.via = o.via), paint()) }))) }, [h('span', { class: 'mn-pill-t', text: cur?.label || W('選帳戶', 'Choose') }), h('i', { html: icons.chevron })]);
    };
    const dayCtl =
      f.every === 'week'
        ? h('div', { class: 'q-chips' }, WEEKDAYS.map((w, i) => h('button', { class: 'q-chip', type: 'button', 'aria-pressed': String(Number(f.day) === i), text: w, onclick: () => ((f.day = i), paint()) })))
        : f.every === 'year'
          ? (() => {
              const i = h('input', { class: 'q-field', type: 'date', value: `${now.slice(0, 4)}-${f.day}` });
              i.addEventListener('change', () => i.value && (f.day = i.value.slice(5)));
              return i;
            })()
          : (() => {
              const i = h('input', { class: 'q-field num', type: 'text', inputmode: 'numeric', maxlength: '2', value: String(f.day) });
              i.addEventListener('input', () => (f.day = Math.min(31, Math.max(1, Number(i.value) || 1))));
              return i;
            })();
    body.replaceChildren(
      ...[
        kinds,
        field(W('金額', 'Amount'), amtIn),
        f.k !== 'move' ? field(W('分類', 'Category'), h('div', { class: 'q-chips mn-catchips' }, catsFor(f.k).map(c => h('button', { class: 'q-chip', type: 'button', 'aria-pressed': String(c.id === f.cat), onclick: () => ((f.cat = c.id), paint()) }, [h('i', { class: 'mn-chip-i', style: `color:${c.color}`, html: glyph(c.icon) }), catName(c, lang)])))) : null,
        field(f.k === 'move' ? W('從', 'From') : f.k === 'in' ? W('存入', 'Into') : W('付款方式', 'Paid with'), pick('a', f.k === 'move')),
        f.k === 'move' ? field(W('到', 'To'), pick('to', true)) : null,
        field(W('名稱', 'Name'), noteIn),
        field(W('多久一次', 'How often'), everySeg),
        field(f.every === 'week' ? W('星期幾', 'Day') : f.every === 'year' ? W('哪一天', 'Date') : W('每月幾號', 'Day of month'), dayCtl),
        field(W('開始', 'Starts'), fromIn)
      ].filter(Boolean)
    );
  }
  paint();
  const s = sheet({
    title: r ? W('固定收支', 'Repeat') : W('新增固定收支', 'New repeat'),
    detent: 'large',
    body: [body],
    foot: h('div', { class: 'q-sheet-foot mn-foot2' }, [
      r ? h('button', { class: 'q-btn danger tinted', type: 'button', text: W('刪除', 'Delete'), onclick: () => (drop(state.books, 'recur', r.id), s.close(), saved()) }) : null,
      h('button', {
        class: 'q-btn primary',
        type: 'button',
        text: W('儲存', 'Save'),
        onclick: () => {
          const amt = Math.round(Number(String(f.amt).replace(/[^\d.]/g, '')));
          if (!(amt > 0) || !acct(f.a) || (f.k === 'move' && (!acct(f.to) || f.to === f.a))) return toast(W('請填好金額和帳戶', 'Fill in the amount and account'), { tone: 'bad' });
          put(state.books, 'recur', { ...(r || {}), k: f.k, amt, cat: f.k === 'move' ? '' : f.cat, a: f.a, via: f.k === 'move' ? '' : f.via, to: f.k === 'move' ? f.to : '', every: f.every, day: f.day, from: f.from, note: f.note.trim() });
          runRepeats(state.books, today());
          s.close();
          saved();
        }
      })
    ])
  });
}
