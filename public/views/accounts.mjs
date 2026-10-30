// 帳戶: the 總資產 (what the counted accounts hold, less what the counted
// cards owe) and every account by kind with its balance; the repeats
// (固定收支) and the accounts put away open from 更多. An account opens to its balance, its month, its cards and
// entries; a credit card to its bill too.
import { h, icons, tile, sheet, toggle, toast, empty, segmented, menu } from '#kit/ui.mjs';
import { ask } from '#kit/orbit.mjs';
import { balances, worth, put, drop, dropAccount, live, adjustBy, cardBill, acctTotals, owed, touches, nextRepeat, runRepeats, ACCOUNT_KINDS, groupOf, historyOf, hasHistory, closeAccount, closeCard, moveAccount, moveCard, snapshot, restore, accountParts } from '../lib/books.mjs';
import { brandsFor, brandOf } from '../lib/brands.mjs';
import { catName, glyph, lookOf, subsOf, subOf, guessCat, guessSub } from '../lib/cats.mjs';
import { state, W, en, lang, money, dayLabel, today, saved, KINDS, kindName, acct, acctName, allAccounts, openAccounts, cardsOf, card } from '../shell.mjs';
import { entryRow, openEntry, payOptions, catTiles, subChips, subCols } from './entry.mjs';
import { acctTile, methodTile, payPic, whatTile } from './pics.mjs';

export function renderAccts(box) {
  const b = state.books;
  const bal = balances(b);
  const w = worth(b);
  const all = openAccounts();
  // The focal point, on its card: what it all comes to, then the two
  // halves of it as quiet figures.
  const hero = h('section', { class: 'q-focus' }, [
    h('span', { class: 'q-focus-label', text: W('總資產', 'Net worth') }),
    h('b', { class: 'q-focus-value q-fit', text: money(w.net) }),
    h('div', { class: 'q-focus-figs' }, [fig(W('資產', 'Assets'), money(w.assets)), fig(W('負債', 'Debts'), money(w.debts))])
  ]);
  const groups = ACCOUNT_KINDS.map(kind => {
    const list = all.filter(a => groupOf(a.kind) === kind);
    if (!list.length) return null;
    return h('section', { class: 'q-section' }, [
      h('div', { class: 'q-section-head q-list-head' }, [h('h2', { text: kindName(kind) })]),
      h('div', { class: 'q-rowcard' }, list.map(a => acctRow(a, bal[a.id] || 0)))
    ]);
  });
  const add = h('button', { class: 'q-btn tinted block mn-add', type: 'button', onclick: () => openAccountEdit(null) }, [h('span', { html: icons.plus }), W('新增帳戶', 'Add an account')]);

  box.replaceChildren(hero, ...[...groups, owedSection()].filter(Boolean), add);
}

// 朋友還沒給: a friend's share of a spend not handed over yet; a tap says
// where it went once it is (today).
function owedSection() {
  const list = owed(state.books);
  if (!list.length) return null;
  const total = list.reduce((n, x) => n + x.e.amt, 0);
  return h('section', { class: 'q-section' }, [
    h('div', { class: 'q-section-head q-list-head' }, [h('h2', { text: W('朋友還沒給', 'Friends owe you') }), h('span', { class: 'num mn-owed-total', text: money(total) })]),
    h(
      'div',
      { class: 'q-rowcard' },
      list.map(({ e, of }) =>
        h('button', { class: 'q-ritem chevron mn-row', type: 'button', onclick: ev => menu(ev.currentTarget, payOptions({ moving: true }).map(o => ({ label: W(`收到了，進 ${o.label}`, `Got it, into ${o.label}`), onClick: () => (put(state.books, 'entries', { ...e, wait: 0, a: o.a, d: today() }), saved(), toast(W(`${e.who || '朋友'} 給了 ${money(e.amt)}`, `${money(e.amt)} from ${e.who || 'a friend'}`))) }))) }, [
          tile(glyph('user'), '#0891b2'),
          h('span', { class: 'q-ritem-text' }, [h('span', { class: 'q-ritem-title', text: e.who || W('朋友', 'A friend') }), h('small', { text: [dayLabel(e.d, { week: false }), of ? of.note || of.inv?.seller || catName(subOf(of.sub) || lookOf(of), lang) : ''].filter(Boolean).join(' · ') })]),
          h('span', { class: 'q-ritem-value num mn-amt move', text: money(e.amt) })
        ])
      )
    )
  ]);
}

// 固定收支 (from 更多): each with when it's next, soonest first.
export const repeatsOf = () => live(state.books.recur).filter(r => acct(r.a));
export function openRepeats() {
  const now = today();
  const reps = repeatsOf();
  const s = sheet({
    title: W('固定收支', 'Repeats'),
    detent: reps.length > 4 ? 'large' : '',
    body: [
      reps.length
        ? h(
            'div',
            { class: 'q-rowcard' },
            reps
              .map(r => ({ r, next: nextRepeat(r, now) }))
              .sort((x, y) => (x.next || '9').localeCompare(y.next || '9'))
              .map(({ r, next }) => {
                const look = lookOf(r);
                return h('button', { class: 'q-ritem chevron mn-row', type: 'button', onclick: () => (s.close(), openRepeat(r)) }, [
                  whatTile(look, r.sub),
                  h('span', { class: 'q-ritem-text' }, [h('span', { class: 'q-ritem-title', text: r.note || (r.k === 'move' ? W('轉帳', 'Transfer') : catName(look, lang)) }), h('small', { text: [everyText(r), next ? W(`下次 ${dayLabel(next, { week: false })}`, `next ${dayLabel(next, { week: false })}`) : ''].filter(Boolean).join(' · ') })]),
                  h('span', { class: `q-ritem-value num mn-amt ${r.k}`, text: r.k === 'in' ? money(r.amt, { sign: true }) : money(r.amt) })
                ]);
              })
          )
        : h('p', { class: 'mn-hint', text: W('房租、薪水、TPASS、訂閱⋯每期自動記好。', 'Rent, pay, TPASS, subscriptions: recorded for you each time.') })
    ],
    foot: h('div', { class: 'q-sheet-foot' }, [h('button', { class: 'q-btn primary block', type: 'button', onclick: () => (s.close(), openRepeat(null)) }, [h('span', { html: icons.plus }), W('新增固定收支', 'New repeat')])])
  });
}
// Put away (封存, from 更多): their history and balance kept.
export function openClosed() {
  const bal = balances(state.books);
  const closed = allAccounts().filter(a => a.closed);
  sheet({
    title: W('已封存', 'Put away'),
    body: [closed.length ? h('div', { class: 'q-rowcard' }, closed.map(a => acctRow(a, bal[a.id] || 0))) : h('p', { class: 'mn-hint', text: W('不再用的帳戶封存後會在這裡，紀錄和餘額都留著。', 'Accounts you put away wait here, with their history and balance.') })]
  });
}

const fig = (label, value) => h('div', null, [h('small', { text: label }), h('b', { class: 'num', text: value })]);

function acctRow(a, balance) {
  const cards = cardsOf(a.id);
  // (Short: the balance needs its room on a 320 px phone.)
  const one = cards.length === 1 ? cards[0] : null;
  const sub = a.closed ? W('已封存', 'Put away') : !a.inTotal ? W('不計入總資產', 'Not in the total') : cards.length > 1 ? W(`${cards.length} 種付款方式`, `${cards.length} ways to pay`) : one ? one.name : a.kind === 'credit' && a.due ? W(`${a.due} 日繳款`, `due on the ${a.due}`) : '';
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
  const mine = live(b.entries).filter(e => touches(e).includes(id));
  const month = acctTotals(b, id, `${ym}-01`, `${ym}-31`);
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
  const cardSec = METHODS[a.kind] && !a.closed ? cardsSection(a, () => s) : null;
  // (Put away: said so, one tap from use again.)
  const closedNote = a.closed
    ? h('div', { class: 'mn-closed-note' }, [h('span', { text: W('已封存，紀錄和餘額都留著', 'Put away; history and balance kept') }), h('button', { class: 'q-btn tinted small', type: 'button', text: W('恢復使用', 'Use again'), onclick: () => (closeAccount(state.books, a.id, false), saved(), openAccount(a.id, s)) })])
    : null;
  const recent = mine.sort((x, y) => y.d.localeCompare(x.d) || (y.t || 0) - (x.t || 0)).slice(0, 40);
  const list = h('section', { class: 'q-section' }, [
    h('div', { class: 'q-section-head' }, [h('h2', { text: W('最近', 'Recent') })]),
    recent.length ? h('div', { class: 'q-rowcard' }, recent.map(e => entryRow(e, { day: true, inAcct: true }))) : h('p', { class: 'mn-hint', text: W('還沒有紀錄', 'Nothing yet') })
  ]);
  const edit = h('button', { class: 'q-btn plain small', type: 'button', text: W('編輯', 'Edit'), onclick: () => openAccountEdit(a, s) });
  const page = { title: a.name, trailing: edit, lead: h('button', { class: 'q-close', type: 'button', 'data-q-close': '', 'aria-label': W('關閉', 'Close'), text: '✕' }), detent: 'large', cls: 'mn-acct', body: [hero, closedNote, facts, actions, cardSec, list] };
  const s = host ? swapPage(host, page) : sheet(page);
}

// A sheet's page changed in place (編輯 inside an account, and back to it):
// the person stays in the one sheet, never thrown out to the tab.
function swapPage(s, { title, lead = null, trailing = null, body = [], foot = null, cls, detent = '' }) {
  const d = s.el;
  // (Each page its own height: a short form never sits in a full-height sheet.)
  if (detent) d.setAttribute('data-detent', detent);
  else d.removeAttribute('data-detent');
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
          h('button', { class: 'q-ritem chevron', type: 'button', onclick: () => editCard(a, c, host()) }, [methodTile(c.name), h('span', { class: 'q-ritem-text' }, [h('span', { class: 'q-ritem-title', text: `${c.name}${c.last4 ? ` •${c.last4}` : ''}` }), h('small', { text: methodNote(a) })])])
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
  // (Each with its own logo, two across so a name never squeezes: Jay 2026-10-27.)
  const chips = h('div', { class: 'mn-methods', role: 'radiogroup', 'aria-label': W('種類', 'Kind') });
  const paintChips = () => chips.replaceChildren(...methodsFor(a).map(m => h('button', { class: 'mn-method', type: 'button', role: 'radio', 'aria-checked': String(name.value.trim() === m), onclick: () => ((name.value = m), paintChips()) }, [methodTile(m, 28), h('span', { text: m })])));
  name.addEventListener('input', paintChips);
  paintChips();
  const back = () => openAccount(a.id, host);
  swapPage(host, {
    title: c ? c.name : W('新增付款方式', 'Add a way to pay'),
    lead: h('button', { class: 'q-close mn-back', type: 'button', 'aria-label': W('返回', 'Back'), html: icons.chevron, onclick: back }),
    cls: 'mn-acct-edit',
    body: [h('div', { class: 'mn-form' }, [chips, field(W('名稱', 'Name'), name), field(W('卡號末四碼', 'Last 4 digits'), last4)])],
    foot: h('div', { class: 'q-sheet-foot mn-foot2' }, [
      c ? h('button', { class: 'q-btn danger tinted', type: 'button', text: W('移除', 'Remove'), onclick: () => removeCard(a, c, host) }) : null,
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

// ---- Taking one out of use (Jay 2026-10-27: people change cards and accounts;
// nothing they recorded is lost by it) -------------------------------------------

const choice = (icon, color, title, sub, onclick, cls = '') => h('button', { class: `q-ritem chevron mn-choice ${cls}`.trim(), type: 'button', onclick }, [tile(icon, color), h('span', { class: 'q-ritem-text' }, [h('span', { class: 'q-ritem-title', text: title }), h('small', { text: sub })])]);
const backTo = (onclick) => h('button', { class: 'q-close mn-back', type: 'button', 'aria-label': W('返回', 'Back'), html: icons.chevron, onclick });
const countText = hist => [hist.entries ? W(`${hist.entries} 筆紀錄`, `${hist.entries} entries`) : '', hist.recur ? W(`${hist.recur} 個固定收支`, `${hist.recur} repeats`) : '', hist.cards ? W(`${hist.cards} 種付款方式`, `${hist.cards} ways to pay`) : ''].filter(Boolean).join(W('、', ', '));

// An account: with nothing on it, removed (one question); with history, the
// choice: 封存 (kept, out of the menus), 轉移 (its history and balance onto
// another: a replaced card), or removed with it all (and 復原 for a while).
async function removeAccount(a, host) {
  const b = state.books;
  const hist = historyOf(b, a.id);
  if (!hasHistory(b, a.id)) {
    if (!(await ask({ title: W(`刪除 ${a.name}？`, `Delete ${a.name}?`), body: W('它沒有任何紀錄。', 'Nothing was recorded on it.'), ok: W('刪除', 'Delete'), cancel: W('取消', 'Cancel'), danger: true, icon: 'trash' }))) return;
    dropAccount(b, a.id);
    host.close();
    return saved();
  }
  const credit = a.kind === 'credit';
  // (The same kind first: a bank for a bank.)
  const targets = openAccounts().filter(x => x.id !== a.id && (x.kind === 'credit') === credit).sort((x, y) => (y.kind === a.kind) - (x.kind === a.kind));
  swapPage(host, {
    title: W(`移除 ${a.name}`, `Remove ${a.name}`),
    lead: backTo(() => openAccountEdit(a, host)),
    cls: 'mn-acct-edit',
    body: [
      h('p', { class: 'mn-hint mn-remove-lede', text: W(`它有 ${countText(hist)}。`, `It has ${countText(hist)}.`) }),
      h('div', { class: 'q-rowcard' }, [
        a.closed ? null : choice(icons.lock, '#8e8e93', W('封存', 'Put away'), W('不在選單裡，紀錄和餘額都留著', 'Off the menus; history and balance kept'), () => (closeAccount(b, a.id), saved(), toast(W(`已封存 ${a.name}`, `${a.name} put away`)), openAccount(a.id, host))),
        targets.length ? choice(icons.exchange, '#0088ff', W('轉移到另一個帳戶', 'Move to another account'), credit ? W('換新卡：紀錄和欠款搬過去', 'A new card: its history and balance go over') : W('換帳戶：紀錄和餘額搬過去', 'A new account: its history and balance go over'), () => pickTarget(a, targets, host)) : null,
        choice(icons.trash, '#ff3b30', W('連紀錄一起刪除', 'Delete with its history'), W('可以復原一下子', 'Can be undone for a moment'), async () => {
          if (!(await ask({ title: W(`刪除 ${a.name} 和它的紀錄？`, `Delete ${a.name} and its history?`), body: W(`${countText(hist)}會一起刪除，統計也會少掉這些。`, `${countText(hist)} go, and the stats lose them.`), ok: W('刪除', 'Delete'), cancel: W('取消', 'Cancel'), danger: true, icon: 'trash' }))) return;
          const snap = snapshot(b, accountParts(b, a.id));
          dropAccount(b, a.id);
          host.close();
          saved();
          toast(W(`已刪除 ${a.name}`, `${a.name} deleted`), { ms: 6000, action: { label: W('復原', 'Undo'), onTap: () => (restore(state.books, snap), saved()) } });
        }, 'mn-danger-row')
      ].filter(Boolean))
    ]
  });
}
function pickTarget(a, targets, host) {
  swapPage(host, {
    title: W('轉移到', 'Move to'),
    lead: backTo(() => removeAccount(a, host)),
    cls: 'mn-acct-edit',
    body: [
      h('p', { class: 'mn-hint mn-remove-lede', text: W(`${a.name} 的紀錄、固定收支、付款方式和餘額都會搬到這裡，之後 ${a.name} 會移除。`, `${a.name}'s history, repeats, ways to pay and balance move here; then ${a.name} is removed.`) }),
      h('div', { class: 'q-rowcard' }, targets.map(x => h('button', { class: 'q-ritem chevron mn-row', type: 'button', onclick: async () => {
        if (!(await ask({ title: W(`搬到 ${x.name}？`, `Move to ${x.name}?`), body: W(`${a.name} 的一切都會在 ${x.name} 底下。`, `Everything on ${a.name} will be on ${x.name}.`), ok: W('轉移', 'Move'), cancel: W('取消', 'Cancel'), icon: 'exchange' }))) return;
        moveAccount(state.books, a.id, x.id);
        saved();
        toast(W(`已轉移到 ${x.name}`, `Moved to ${x.name}`));
        openAccount(x.id, host);
      } }, [acctTile(x), h('span', { class: 'q-ritem-text' }, [h('span', { class: 'q-ritem-title', text: x.name }), h('small', { text: kindName(x.kind) })])])))
    ]
  });
}
// A way to pay: with nothing on it, removed; with entries, 封存, onto another
// (a new card), or let go with its entries kept as the account's own.
function removeCard(a, c, host) {
  const b = state.books;
  const back = () => openAccount(a.id, host);
  if (!hasHistory(b, c.id)) return (drop(b, 'cards', c.id), saved(), back());
  const hist = historyOf(b, c.id);
  const others = cardsOf(a.id).filter(x => x.id !== c.id && !x.closed);
  swapPage(host, {
    title: W(`移除 ${c.name}`, `Remove ${c.name}`),
    lead: backTo(() => editCard(a, c, host)),
    cls: 'mn-acct-edit',
    body: [
      h('p', { class: 'mn-hint mn-remove-lede', text: W(`它有 ${countText(hist)}。`, `It has ${countText(hist)}.`) }),
      h('div', { class: 'q-rowcard' }, [
        c.closed ? null : choice(icons.lock, '#8e8e93', W('封存', 'Put away'), W('不在選單裡，舊紀錄照舊', 'Off the menus; old entries kept'), () => (closeCard(b, c.id), saved(), back())),
        ...others.map(x => choice(icons.exchange, '#0088ff', W(`換成 ${x.name}`, `Replace with ${x.name}`), W('紀錄改記在新的這張', 'Its entries move to this one'), () => (moveCard(b, c.id, x.id), saved(), back()))),
        choice(icons.trash, '#ff3b30', W('移除', 'Remove'), W(`紀錄留著，改記為 ${a.name}`, `Entries kept, as ${a.name} itself`), () => (moveCard(b, c.id, ''), saved(), back()), 'mn-danger-row')
      ].filter(Boolean))
    ]
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
    // (No detent: the sheet as tall as what's in it.)
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
  const f = { kind: a?.kind || 'bank', brand: a?.brand || '', name: a?.name || '', open: '', inTotal: a ? Boolean(a.inTotal) : true, pay: a?.pay || '', close: a?.close || '', due: a?.due || '', reload: { on: false, from: '', amt: '', below: '', ...(a?.reload || {}) } };
  const body = h('div', { class: 'mn-form' });
  // 自動加值 (a stored-value card's own; some have it, some don't): NT$500 under NT$100 is the usual rule, filled in to change.
  const rl = f.reload;
  const reloadAmt = h('input', { class: 'q-field num', type: 'text', inputmode: 'numeric', maxlength: '5', placeholder: '500', value: rl.amt ? String(rl.amt) : '' });
  reloadAmt.addEventListener('input', () => (rl.amt = reloadAmt.value));
  const reloadBelow = h('input', { class: 'q-field num', type: 'text', inputmode: 'numeric', maxlength: '5', placeholder: '100', value: rl.below !== '' && rl.below != null ? String(rl.below) : '' });
  reloadBelow.addEventListener('input', () => (rl.below = reloadBelow.value));
  const reloadOn = toggle({ checked: Boolean(rl.on), label: W('自動加值', 'Auto top-up'), onChange: on => ((rl.on = on), on && !rl.amt && ((rl.amt = '500'), (reloadAmt.value = '500')), on && (rl.below === '' || rl.below == null) && ((rl.below = '100'), (reloadBelow.value = '100')), paint()) });
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
      ? h('div', { class: 'mn-kinds' }, ACCOUNT_KINDS.filter(k => k !== 'cash').map(k => h('button', { class: 'q-chip', type: 'button', 'aria-pressed': String(k === f.kind), text: kindName(k), onclick: () => ((f.kind = k), (f.brand = ''), paint()) })))
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
        ? h('button', { class: 'mn-pill', type: 'button', onclick: e => menu(e.currentTarget, [{ label: W('不設定', 'None'), onClick: () => ((f.pay = ''), paint()) }, ...openAccounts().filter(x => x.kind === 'bank' && x.id !== a?.id).map(x => ({ label: x.name, icon: x.id === f.pay ? '✓' : '', onClick: () => ((f.pay = x.id), paint()) }))]) }, [h('span', { class: 'mn-pill-t', text: f.pay ? acctName(f.pay) : W('選銀行帳戶', 'Choose a bank account') }), h('i', { html: icons.chevron })])
        : null;
    // (Left empty: nobody in the books pays, a parent's card; it comes in as income. Jay 2026-10-27.)
    const reloadFrom = h('button', { class: 'mn-pill', type: 'button', onclick: e => menu(e.currentTarget, [{ label: W('不設定', 'None'), icon: rl.from ? '' : '✓', onClick: () => ((rl.from = ''), paint()) }, ...openAccounts().filter(x => x.id !== a?.id && (x.kind === 'bank' || x.kind === 'credit')).map(x => ({ label: x.name, icon: x.id === rl.from ? '✓' : '', onClick: () => ((rl.from = x.id), paint()) }))]) }, [h('span', { class: 'mn-pill-t', text: rl.from && acct(rl.from) ? acctName(rl.from) : W('不設定，算收入', 'None: counted as income') }), h('i', { html: icons.chevron })]);
    body.replaceChildren(
      ...[
        kindPick ? field(W('種類', 'Kind'), kindPick) : null,
        brandGrid ? field(f.kind === 'ticket' ? W('哪一張', 'Which card') : f.kind === 'wallet' ? W('哪一個', 'Which one') : W('銀行', 'Bank'), brandGrid) : null,
        field(W('名稱', 'Name'), nameIn),
        isNew ? field(f.kind === 'credit' ? W('目前欠款', 'Owed now') : W('目前餘額', 'Balance now'), openIn) : null,
        f.kind === 'credit' ? field(W('繳款帳戶', 'Paid from'), payPick) : null,
        f.kind === 'credit' ? h('div', { class: 'mn-two' }, [field(W('結帳日（每月）', 'Statement day'), closeIn), field(W('繳款截止日', 'Due day'), dueIn)]) : null,
        f.kind === 'ticket' || f.kind === 'wallet' ? h('div', { class: 'mn-switch-row' }, [h('span', {}, [h('b', { text: W('自動加值', 'Auto top-up') }), h('small', { text: W('餘額不足時自動加值', 'Tops up when it runs low') })]), reloadOn]) : null,
        (f.kind === 'ticket' || f.kind === 'wallet') && rl.on ? field(W('從哪裡加值', 'Topped up from'), reloadFrom) : null,
        (f.kind === 'ticket' || f.kind === 'wallet') && rl.on ? h('div', { class: 'mn-two' }, [field(W('每次加值', 'Each time'), reloadAmt), field(W('餘額低於', 'When under'), reloadBelow)]) : null,
        h('div', { class: 'mn-switch-row' }, [h('span', {}, [h('b', { text: W('計入總資產', 'Count in net worth') }), h('small', { text: W('定存、別人的錢可以關掉', 'Off for savings or others’ money') })]), counted])
      ].filter(Boolean)
    );
  }
  paint();
  const save = () => {
    const name = f.name.trim() || (f.brand ? (en ? brandOf(f.brand).en : brandOf(f.brand).zh) : kindName(f.kind));
    const day = v => Math.min(31, Math.max(0, Math.floor(Number(v) || 0))) || '';
    const rec = { ...(a || {}), kind: f.kind, brand: f.brand, name, inTotal: f.inTotal, pay: f.kind === 'credit' ? f.pay : '', close: f.kind === 'credit' ? day(f.close) : '', due: f.kind === 'credit' ? day(f.due) : '' };
    const whole = v => Math.max(0, Math.round(Number(String(v).replace(/[^\d]/g, '')) || 0));
    if (f.kind === 'ticket' || f.kind === 'wallet') {
      rec.reload = rl.on ? { on: true, from: acct(rl.from) ? rl.from : '', amt: whole(rl.amt) || 500, below: whole(rl.below) } : a?.reload ? { ...a.reload, on: false } : undefined;
    } else delete rec.reload;
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
  const remove = () => removeAccount(a, host || s);
  const page = {
    title: isNew ? W('新增帳戶', 'Add an account') : W('編輯帳戶', 'Edit account'),
    // (Inside an account: ‹ goes back to it.)
    lead: host ? h('button', { class: 'q-close mn-back', type: 'button', 'aria-label': W('返回', 'Back'), html: icons.chevron, onclick: () => openAccount(a.id, host) }) : null,
    detent: isNew ? 'large' : '',
    cls: 'mn-acct-edit',
    body: [body],
    foot: h('div', { class: 'q-sheet-foot mn-foot2' }, [a && a.id !== 'cash' ? h('button', { class: 'q-btn danger tinted', type: 'button', text: W('移除', 'Remove'), onclick: remove }) : null, h('button', { class: 'q-btn primary', type: 'button', text: W('儲存', 'Save'), onclick: save })])
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
  const f = { k: r?.k || 'out', amt: r?.amt ? String(r.amt) : '', cat: r?.cat || 'home', sub: r?.sub || '', a: r?.a || 'cash', via: r?.via || '', to: r?.to || '', every: r?.every || 'month', day: r?.day ?? Number(now.slice(8, 10)), from: r?.from || now, note: r?.note || '' };
  const body = h('div', { class: 'mn-form' });
  const amtIn = h('input', { class: 'q-field num mn-big-in', type: 'text', inputmode: 'numeric', placeholder: 'NT$', value: f.amt });
  amtIn.addEventListener('input', () => (f.amt = amtIn.value));
  const noteIn = h('input', { class: 'q-field', type: 'text', maxlength: '40', placeholder: W('例如：房租、Netflix', 'e.g. Rent, Netflix'), value: f.note });
  noteIn.addEventListener('input', () => (f.note = noteIn.value));
  // (The name says the category where it can: 「TPASS」 is 交通 · TPASS.)
  let picked = Boolean(r);
  noteIn.addEventListener('change', () => {
    if (picked || f.k === 'move') return;
    const c = f.k === 'out' ? guessCat(f.note) : '';
    if (c) f.cat = c;
    f.sub = guessSub(f.cat, f.note);
    paint();
  });
  const fromIn = h('input', { class: 'q-field', type: 'date', value: f.from });
  fromIn.addEventListener('change', () => (f.from = fromIn.value || f.from));
  const kinds = segmented(
    [
      { id: 'out', label: W('支出', 'Spend') },
      { id: 'in', label: W('收入', 'Income') },
      { id: 'move', label: W('轉帳', 'Transfer') }
    ],
    { value: f.k, onChange: k => ((f.k = k), (f.cat = k === 'in' ? 'salary' : 'home'), (f.sub = ''), paint()) }
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
      const opts = payOptions({ moving, keep: [f.a, f.via, f.to] });
      const cur = opts.find(o => o.a === f[field_] && (moving || o.via === f.via));
      return h('button', { class: 'mn-pill', type: 'button', onclick: e => menu(e.currentTarget, opts.map(o => ({ label: o.label, lead: payPic(o.a, moving ? '' : o.via, 28), onClick: () => ((f[field_] = o.a), moving || (f.via = o.via), paint()) }))) }, [cur ? payPic(cur.a, moving ? '' : cur.via, 24) : null, h('span', { class: 'mn-pill-t', text: cur?.label || W('選帳戶', 'Choose') }), h('i', { html: icons.chevron })]);
    };
    const dayCtl =
      f.every === 'week'
        ? h('div', { class: 'mn-weekdays' }, WEEKDAYS.map((w, i) => h('button', { class: 'mn-subchip', type: 'button', 'aria-pressed': String(Number(f.day) === i), text: w, onclick: () => ((f.day = i), paint()) })))
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
        // (What it is first: the name is what the list shows.)
        field(W('名稱', 'Name'), noteIn),
        field(W('金額', 'Amount'), amtIn),
        f.k !== 'move'
          ? (() => {
              const grid = h('div', { class: 'mn-cats all', role: 'radiogroup' }, catTiles(f.k, f.cat, id => ((picked = true), id !== f.cat && ((f.cat = id), (f.sub = '')), paint())));
              return field(W('分類', 'Category'), grid);
            })()
          : null,
        f.k !== 'move' && subsOf(f.cat).length ? h('div', { class: 'mn-subs', role: 'group', 'aria-label': W('細項', 'Sub-category'), style: `--n:${subCols(subsOf(f.cat).length)}` }, subChips(f.cat, f.sub, id => ((f.sub = id), paint()))) : null,
        field(f.k === 'move' ? W('從', 'From') : f.k === 'in' ? W('存入', 'Into') : W('付款方式', 'Paid with'), pick('a', f.k === 'move')),
        f.k === 'move' ? field(W('到', 'To'), pick('to', true)) : null,
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
          put(state.books, 'recur', { ...(r || {}), k: f.k, amt, cat: f.k === 'move' ? '' : f.cat, sub: f.k === 'move' ? '' : f.sub, a: f.a, via: f.k === 'move' ? '' : f.via, to: f.k === 'move' ? f.to : '', every: f.every, day: f.day, from: f.from, note: f.note.trim() });
          runRepeats(state.books, today());
          s.close();
          saved();
        }
      })
    ])
  });
}
