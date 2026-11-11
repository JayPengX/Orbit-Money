// Orbit Money's own switches in the kit's 測試工具 (hidden until unlocked:
// Orbit Pass › seven taps on 除錯紀錄). Each is read where that state is
// decided, as globalThis.ORBIT_TEST?.flags?.<name>; the kit's clock, place and
// network switches work here as everywhere. Real money: a switch changes only
// what is shown or read, never what is saved, and sends nothing new.
//   moneyRead 'cap' | 'fail': 拍照記帳's AI read used up for the day / failing (views/photo.mjs send)
//   moneyAiCap: 用說的記帳 and 問我的帳 answer "used up for the day" (views/say.mjs, ask.mjs)
//   moneyBudget 'low' | 'over': 月曆's card with a budget almost gone / over (views/calendar.mjs)
//   moneyTpass: a TPASS on its last day on 月曆 (shown only; 續購 opens 記一筆 unsaved)
//   moneyRide: 剛剛的車資，記一筆？ from a Transit trip (opens 記一筆 unsaved)
//   moneyNoticeDenied: notices refused on this phone (月曆's 提醒我, 到期提醒)
//   moneyGeoDenied: location refused (更多 › 智慧帶入 › 用所在位置)
const T = (zh, en) => (/^zh/i.test(document.documentElement.lang || 'zh') ? zh : en);
const app = 'money';
(globalThis.ORBIT_TEST_TOOLS ||= []).push(
  {
    app,
    title: T('拍照記帳：AI 讀圖', 'From a photo: the AI read'),
    sub: T('用完今天的次數，或讀不出來（電子發票 QR 照常）', 'Used up for today, or failing (e-invoice QR codes still read)'),
    flag: 'moneyRead',
    options: [
      { id: 'cap', label: T('用完了', 'Used up') },
      { id: 'fail', label: T('讀不出來', 'Fails') }
    ]
  },
  { app, title: T('AI 次數用完', 'AI used up'), sub: T('用說的記帳、問我的帳回答今天用完了', 'Say it and Ask my books answer “used up today”'), flag: 'moneyAiCap' },
  {
    app,
    title: T('月曆的預算', 'Budget on 月曆'),
    sub: T('只換這個月的卡片，不存預算；配合時間跳到月底', 'Only this month’s card; nothing saved. Pair with the clock for the last day'),
    flag: 'moneyBudget',
    options: [
      { id: 'low', label: T('快用完', 'Almost gone') },
      { id: 'over', label: T('超出', 'Over') }
    ]
  },
  { app, title: T('TPASS 最後一天', 'TPASS, last day'), sub: T('月曆上的到期提醒（只顯示，不存）', 'The reminder on 月曆 (shown only, never saved)'), flag: 'moneyTpass' },
  { app, title: T('車資記帳', 'Log a ride'), sub: T('「剛剛的車資，記一筆？」：記一筆只打開，不會自己存', '“Log that ride?”: Log it only opens the sheet'), flag: 'moneyRide' },
  { app, title: T('通知被拒', 'Notices refused'), sub: T('像這支手機不允許通知', 'As if this phone refused notices'), flag: 'moneyNoticeDenied' },
  { app, title: T('位置被拒', 'Location refused'), sub: T('更多 › 智慧帶入 › 用所在位置', 'More › Smart fill › Use location'), flag: 'moneyGeoDenied' }
);

// 月曆's budget as budgetState gives it (lib/books.mjs), made up for the card
// only: almost gone (8% left) or over (15%), from what this month really spent.
export function testBudget(kind, out, days, gone) {
  const spent = out > 0 ? out : 9200;
  const amt = Math.max(100, Math.round(spent / (kind === 'over' ? 1.15 : 0.92)));
  const left = amt - spent;
  const rest = days - gone + 1;
  return { id: 'test', cat: '', amt, spent, left, share: spent / amt, pace: (spent / amt) / (gone / days), perDay: Math.max(0, Math.floor(left / rest)), test: true };
}

// A TPASS on its last day, as reminders() gives one (lib/renew.mjs).
export const testTpass = now => ({ r: { id: '', name: 'TPASS', n: 30, unit: 'day', roll: false, cat: 'transport', sub: 'transport:tpass', on: true }, start: now, due: now, left: 0, src: 'set', e: null, test: true });

// A trip Transit planned a few minutes ago, as the family's notebook tells it.
export const testRide = () => ({ id: `test-${new Date().toISOString().slice(0, 13)}`, at: Date.now() - 5 * 60_000, fare: 35, name: T('台北車站 → 市政府', 'Taipei Main → City Hall'), modes: ['metro'] });
