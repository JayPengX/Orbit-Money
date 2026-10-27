// Orbit Money: the person's own books. Four tabs: 月曆 (each day's spending
// on a month, the day's entries), 帳戶 (cash, banks, 悠遊卡, e-wallets and
// credit cards, with the cards on them; what's counted in the 總資產),
// 統計 (where it went: by category, by day, against the budgets)
// and 更多 (purchases brought in without typing, 對獎, the 手機條碼, the
// categories, the repeats, the accounts put away, the books as a file).
//
// This file starts the app, saves and opens tabs; the screens are views/*.mjs,
// the books lib/*.mjs. Nothing here is Orbit's money: the books are the app's
// own payload on the Orbit Pass (`money`), kept on the phone too, merged with
// the Pass's copy before anything is written (the kit's pass-sync.mjs).
import * as kitUI from '#kit/ui.mjs';
import { passSync } from '#kit/pass-sync.mjs';
import { orbitSession, tabBar, topActions, installGate, watchUpdates, keepOffline, storedAccount, cachedPayload, schedulePush, setNotifyOn, enablePush } from '#kit/orbit.mjs';
import { decodeBooks, encodeBooks, mergeBooks, runRepeats, upgradeBooks, put } from './lib/books.mjs';
import { state, hooks, lang, W, today, dayLabel } from './shell.mjs';
import { useCats, upgradeCats, passes, remindTimes, catOf, subOf, catName } from './lib/cats.mjs';
import { renderCal } from './views/calendar.mjs';
import { renderAccts } from './views/accounts.mjs';
import { renderStats } from './views/stats.mjs';
import { loadDraws } from './views/invoices.mjs';
import { renderMore } from './views/more.mjs';
import { openEntry } from './views/entry.mjs';

document.documentElement.lang = lang === 'en' ? 'en' : 'zh-Hant';
const $ = id => document.getElementById(id);
const TABS = ['cal', 'accts', 'stats', 'more'];
const VIEWS = { cal: renderCal, accts: renderAccts, stats: renderStats, more: renderMore };
const TITLES = { cal: W('月曆', 'Calendar'), accts: W('帳戶', 'Accounts'), stats: W('統計', 'Stats'), more: W('更多', 'More') };
const VERSION = document.querySelector('meta[name="build-version"]')?.content || 'dev';

const q = orbitSession('money', { lang });

// ---- Saving -----------------------------------------------------------------------

// What the books looked like when each tab was drawn (render): going back to
// a tab that hasn't changed since shows it as it was, not drawn again (a tab
// switch was 100–180 ms of layout on a phone).
let stamp = 1;
const absorb = theirs => (state.books = mergeBooks(state.books, theirs));
const LOCAL_KEY = 'orbit-money.books.v1';
async function keepLocal() {
  try {
    localStorage.setItem(LOCAL_KEY, JSON.stringify({ account: storedAccount(), payload: await encodeBooks(state.books) }));
  } catch {}
}
function localCopy() {
  try {
    const kept = JSON.parse(localStorage.getItem(LOCAL_KEY) || 'null');
    return kept && kept.account === storedAccount() ? kept.payload : null;
  } catch {
    return null;
  }
}
const pass = passSync(q, {
  decode: decodeBooks,
  encode: () => encodeBooks(state.books),
  apply: theirs => {
    stamp++;
    absorb(theirs);
    keepLocal();
    quietRefresh();
  }
});
let timer = 0;
function sync({ soon = false } = {}) {
  clearTimeout(timer);
  if (soon) return (timer = setTimeout(() => sync(), 1500));
  if (!state.loaded) return Promise.resolve();
  return pass.sync();
}
document.addEventListener('visibilitychange', () => document.visibilityState === 'hidden' && sync());
hooks.changed = () => (stamp++, pass.changed(), keepLocal(), sync({ soon: true }), render(), plan());

// 到期提醒 as phone notices (kind 'renew', its switch in the Pass sheet): each
// pass at the times its own settings say (更多 › 到期提醒, lib/cats.mjs remindTimes).
function plan() {
  const now = Date.now();
  const items = passes(state.books, today()).filter(p => p.left >= 0).flatMap(p => {
    const name = catName(subOf(p.sub) || catOf(p.cat), lang);
    const last = dayLabel(p.end, { week: false });
    return remindTimes(p).map(({ n, at }) =>
      n
        ? { at, title: W(n === 1 ? `${name} 明天到期` : `${name} ${n} 天後到期`, n === 1 ? `${name} ends tomorrow` : `${name} ends in ${n} days`), body: W(`${last}是最後一天，記得續購。`, `${last} is its last day.`), tag: `renew:${p.id}:${p.end}:${n}`, kind: 'renew', hash: 'cal' }
        : { at, title: W(`${name} 今天到期`, `${name} ends today`), body: W('今天是最後一天。', 'Today is its last day.'), tag: `renew:${p.id}:${p.end}:0`, kind: 'renew', hash: 'cal' }
    );
  });
  schedulePush(q, items.filter(x => x.at > now));
}
// Notices turned on from the app (月曆's 提醒我): this phone asked, the pass's switch on.
hooks.notices = async () => {
  if (!('Notification' in globalThis)) return false;
  const p = await Notification.requestPermission().catch(() => 'denied');
  if (p !== 'granted') return false;
  setNotifyOn(true, q);
  await enablePush(q, true);
  plan();
  return true;
};
hooks.render = () => render();

// The first account every book has: cash (one fixed id, so two new phones
// don't each make one), and the repeats due by today.
function settle() {
  const b = state.books;
  let changed = false;
  if (!b.accts.cash) {
    put(b, 'accts', { id: 'cash', name: W('現金', 'Cash'), kind: 'cash', open: 0, inTotal: true, order: 0 }, 1);
    changed = true;
  }
  if (runRepeats(b, today())) changed = true;
  // (Books from before a change in what entries mean, brought up to date.)
  if (upgradeBooks(b) + upgradeCats(b)) changed = true;
  return changed;
}

// ---- Drawing ----------------------------------------------------------------------

function render({ ifChanged = false } = {}) {
  const box = $(`panel-${state.tab}`);
  if (!box) return;
  if (ifChanged && box.dataset.drawn === String(stamp)) return;
  box.dataset.drawn = String(stamp);
  useCats(state.books.cats);
  VIEWS[state.tab](box);
  if (state.tab !== TABS[0]) box.prepend(kitUI.navTitle(TITLES[state.tab]));
}
const TAB_ICONS = { cal: 'calendar', accts: 'wallet', stats: 'chart', more: 'grid' };
const tabNav = tabBar({
  tabs: TABS.map(id => ({ id, label: TITLES[id], icon: TAB_ICONS[id] })),
  onSelect: tab => showTab(tab),
  hash: id => `#${id}`,
  // 記一筆: the app's one main thing, its own button beside the tabs, on every tab.
  action: { icon: kitUI.icons.plus, label: W('記一筆', 'Add an entry'), onTap: () => (useCats(state.books.cats), openEntry({ day: state.tab === 'cal' ? state.day : today() })) }
});
function showTab(tab) {
  state.tab = tab;
  tabNav.select(tab);
  render({ ifChanged: true });
  if (tab === 'more') loadDraws().then(() => state.tab === 'more' && render());
}
const quietRefresh = () => {
  if (document.querySelector('dialog.q-sheet[open]') || document.activeElement?.tagName === 'INPUT') return;
  if (state.loaded) render();
};

window.__fxStarted = true;
const gated = installGate('money', lang);
watchUpdates({ current: VERSION, key: 'orbitMoney', cachePrefix: 'orbit-money-' });
topActions(q);

async function boot() {
  const starting = q.start();
  const mine = await decodeBooks(localCopy() || cachedPayload('money'));
  const show = () => {
    if (!state.loaded) {
      state.loaded = true;
      openFromHash(true);
    } else (stamp++, render());
    kitUI.ready(Promise.resolve());
  };
  if (mine) {
    absorb(mine);
    settle();
    show();
  }
  const first = await starting;
  await pass.first(first, { local: Boolean(mine) });
  for (const item of first?.inbox || []) absorb(await decodeBooks(item.payload));
  if (settle() || first?.inbox?.length) pass.changed();
  keepLocal();
  show();
  pass.watch();
  plan();
  await sync();
  for (const item of first?.inbox || []) q.dropInbox(item.id).catch(() => {});
}
if (!gated) boot();

// The address: a tab (#stats).
function openFromHash(start = false) {
  const hash = decodeURIComponent(location.hash.slice(1));
  // (#inv: the old 發票 tab's address, now 更多.)
  const tab = TABS.includes(hash) ? hash : hash === 'inv' ? 'more' : start ? 'cal' : null;
  if (tab) showTab(tab);
}
window.addEventListener('hashchange', () => state.loaded && openFromHash());
// A new day while the app stays open: today's repeats, and today moves on.
let lastDay = today();
setInterval(() => {
  if (today() === lastDay) return;
  if (state.day === lastDay) state.day = today();
  if (state.month === lastDay.slice(0, 7)) state.month = today().slice(0, 7);
  lastDay = today();
  stamp++;
  if (settle()) hooks.changed();
  else quietRefresh();
}, 60_000);

keepOffline();
