// What every screen shares: the state, the words, the money format, and the
// hooks app.mjs fills in (save, redraw). Screens (views/*.mjs) draw from here.
import { lang, W } from '#kit/lang.mjs';
import { money as kitMoney, num, compact, setFormatLocale, twDay } from '#kit/format.mjs';
import { emptyBooks, accounts, live } from './lib/books.mjs';
import { brandOf, logoOf } from './lib/brands.mjs';

export { lang, W };
setFormatLocale(lang);
export const en = lang === 'en';

export const today = () => twDay(Date.now());
export const state = {
  tab: 'cal',
  books: emptyBooks(),
  loaded: false,
  // 月曆: the month shown and the day picked.
  month: today().slice(0, 7),
  day: today(),
  // 統計: week | month | year, and the day it's around.
  range: 'month',
  at: today(),
  // 發票: the draws (財政部's numbers) and the names behind 統編, as read.
  draws: null,
  sellers: {}
};

// Filled in by app.mjs: changed() saves soon and redraws.
export const hooks = { changed() {}, render() {} };
export const saved = () => hooks.changed();

// NT$1,234 · −NT$50; plain: 1,234 (a calendar cell); short: 1.2萬.
export const money = (n, opts) => kitMoney(n, 'TWD', opts);
export const plain = n => num(n);
export const short = n => (Math.abs(n) >= 10000 ? compact(n) : num(n));

const WEEK = { zh: ['日', '一', '二', '三', '四', '五', '六'], en: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] };
export const weekday = day => WEEK[en ? 'en' : 'zh'][new Date(`${day}T12:00:00Z`).getUTCDay()];
// 10月27日 週二 · Tue 27 Oct; with `year`, 2026年10月27日.
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export function dayLabel(day, { year = false, week = true } = {}) {
  const [y, m, d] = day.split('-').map(Number);
  if (en) return `${week ? `${weekday(day)} ` : ''}${d} ${MONTHS[m - 1]}${year ? ` ${y}` : ''}`;
  return `${year ? `${y}年` : ''}${m}月${d}日${week ? ` 週${weekday(day)}` : ''}`;
}
export const monthLabel = (ym, { year = true } = {}) => {
  const [y, m] = ym.split('-').map(Number);
  return en ? `${MONTHS[m - 1]}${year ? ` ${y}` : ''}` : `${year ? `${y}年` : ''}${m}月`;
};

// Accounts, by kind's order then their own.
export const KINDS = {
  cash: { zh: '現金', en: 'Cash', icon: 'coin', color: '#34c759' },
  bank: { zh: '銀行帳戶', en: 'Bank accounts', icon: 'bank', color: '#0088ff' },
  ticket: { zh: '電子票證', en: 'Transit cards', icon: 'ticket', color: '#00c3d0' },
  wallet: { zh: '電子支付', en: 'E-wallets', icon: 'phone', color: '#cb30e0' },
  credit: { zh: '信用卡', en: 'Credit cards', icon: 'card', color: '#ff8d28' },
  other: { zh: '其他', en: 'Other', icon: 'wallet', color: '#8e8e93' }
};
export const kindName = k => (en ? KINDS[k]?.en : KINDS[k]?.zh) || k;
export const acct = id => {
  const a = state.books.accts[id];
  return a && !a.del ? a : null;
};
export const acctName = id => acct(id)?.name || W('已刪除的帳戶', 'Removed account');
export const card = id => {
  const c = state.books.cards[id];
  return c && !c.del ? c : null;
};
export const allAccounts = () => accounts(state.books);
export const cardsOf = id => live(state.books.cards).filter(c => c.acct === id);
// The logo of an account (its brand's), else ''.
export const logoFor = a => (a?.brand && brandOf(a.brand) ? logoOf(a.brand) : '');

// How an entry was paid: the card's name with its account, or the account's.
export function payLabel(e) {
  if (e.k === 'move') return `${acctName(e.a)} → ${acctName(e.to)}`;
  const c = e.via && card(e.via);
  return c ? `${acctName(e.a)} · ${c.name}${c.last4 ? ` •${c.last4}` : ''}` : acctName(e.a);
}
