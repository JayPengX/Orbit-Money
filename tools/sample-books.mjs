// Made-up books for a preview (tools/preview.mjs money --payload <file>): a
// few accounts and a month of spending around today. Never real data.
//   node tools/sample-books.mjs > /tmp/books.txt
import { emptyBooks, put, encodeBooks, autoReload, live } from '../public/lib/books.mjs';
import { addDays } from '#kit/format.mjs';

const b = emptyBooks();
const now = Date.now();
const day = new Date(now + 8 * 3_600_000).toISOString().slice(0, 10);
const acct = (id, name, kind, open, more = {}) => put(b, 'accts', { id, name, kind, open, inTotal: true, order: Object.keys(b.accts).length, ...more }, now);
acct('cash', '現金', 'cash', 9000);
acct('a1', '玉山 薪轉', 'bank', 86000, { brand: 'esun' });
acct('a2', '悠遊卡', 'ticket', 350, { brand: 'easycard', reload: { on: true, from: 'a1', amt: 500, below: 100 } });
acct('a3', '國泰 CUBE 卡', 'credit', 0, { brand: 'cathay', pay: 'a1', close: 5, due: 20 });
acct('a4', '台新 Richart', 'bank', 120000, { brand: 'taishin', inTotal: false });
acct('a5', 'LINE Pay', 'wallet', 2000, { brand: 'linepay' });
acct('a6', 'LINE Points', 'wallet', 320, { brand: 'linepoints' });
put(b, 'cards', { id: 'c1', acct: 'a1', name: '玉山 Debit', last4: '4821' }, now);
const spend = [['food', 120, '', 'food:breakfast'], ['drink', 65, '路易莎', 'drink:coffee'], ['transport', 30, '', 'transport:mrt'], ['food', 180, '', 'food:lunch'], ['daily', 420, '全聯', 'daily:grocery'], ['shop', 990, 'Uniqlo', 'shop:clothes'], ['fun', 320, '威秀', 'fun:movie']];
let n = 0;
for (let i = 0; i < 26; i++) {
  const d = addDays(day, -i);
  for (let j = 0; j < (i % 3) + 1; j++) {
    const [cat, amt, note, sub] = spend[(i + j) % spend.length];
    const a = ['cash', 'a3', 'a2', 'a1'][(i + j) % 4];
    put(b, 'entries', { id: `e${n++}`, d, k: 'out', amt: amt + (sub === 'food:breakfast' ? (i % 2) * 14 : (i * 7) % 40), cat, sub, note, a, via: a === 'a1' ? 'c1' : '', to: '', t: now - i * 86_400_000 + j }, now);
  }
}
put(b, 'entries', { id: 'e-sal', d: addDays(day, -20), k: 'in', amt: 52000, cat: 'salary', note: '十月薪水', a: 'a1', via: '', to: '', t: now }, now);
put(b, 'entries', { id: 'inv-AB12345678', d: addDays(day, -2), k: 'out', amt: 85, cat: 'food', note: '全家便利商店', a: 'cash', via: '', to: '', inv: { no: 'AB12345678', day: addDays(day, -2), sid: '16446274', seller: '全家便利商店', total: 85, items: [{ name: '拿鐵', qty: 1, price: 55 }, { name: '茶葉蛋', qty: 1, price: 30 }] }, t: now }, now);
put(b, 'entries', { id: 'e-tpass', d: addDays(day, -27), k: 'out', amt: 1200, cat: 'transport', sub: 'transport:tpass', note: '', a: 'a1', via: 'c1', to: '', t: now }, now);
put(b, 'cats', { id: 'transport:youbike', pay: { a: 'a2', via: '' }, unit: 5 }, now);
put(b, 'budgets', { id: 'b-all', cat: '', amt: 20000 }, now);
put(b, 'budgets', { id: 'b-food', cat: 'food', amt: 6000 }, now);
put(b, 'entries', { id: 'inv-KX20418836', d: addDays(day, -9), k: 'out', amt: 149, cat: 'shop', note: '7-ELEVEN', a: 'a3', via: '', to: '', inv: { no: 'KX20418836', day: addDays(day, -9), sid: '', seller: '7-ELEVEN', total: 149, items: [{ name: '美式咖啡', qty: 1, price: 45 },{ name: '御飯糰', qty: 2, price: 52 }] }, t: now }, now);
put(b, 'entries', { id: 'inv-LM55093127', d: addDays(day, -15), k: 'out', amt: 386, cat: 'shop', note: '全聯福利中心', a: 'a3', via: '', to: '', inv: { no: 'LM55093127', day: addDays(day, -15), sid: '', seller: '全聯福利中心', total: 386, items: [{ name: '鮮奶', qty: 2, price: 93 },{ name: '吐司', qty: 1, price: 45 },{ name: '雞蛋', qty: 1, price: 155 }] }, t: now }, now);
put(b, 'entries', { id: 'inv-JQ81120554', d: addDays(day, -62), k: 'out', amt: 130, cat: 'shop', note: '路易莎咖啡', a: 'a3', via: '', to: '', inv: { no: 'JQ81120554', day: addDays(day, -62), sid: '', seller: '路易莎咖啡', total: 130, items: [{ name: '拿鐵', qty: 1, price: 80 },{ name: '可頌', qty: 1, price: 50 }] }, t: now }, now);
put(b, 'entries', { id: 'inv-VB30642978', d: addDays(day, -70), k: 'out', amt: 259, cat: 'shop', note: '屈臣氏', a: 'a3', via: '', to: '', inv: { no: 'VB30642978', day: addDays(day, -70), sid: '', seller: '屈臣氏', total: 259, items: [{ name: '洗髮精', qty: 1, price: 259 }] }, t: now }, now);
// Today: a dinner paid for three on the card (one friend paid in cash, one
// not yet), LINE Pay with points, an ATM fee, Claude Pro, a refund.
put(b, 'entries', { id: 'x-dinner', d: day, k: 'out', amt: 1680, cat: 'food', sub: 'food:out', note: '鼎泰豐', a: 'a3', via: '', to: '', t: now + 5 }, now);
put(b, 'entries', { id: 'x-f1', d: day, k: 'back', why: 'friend', who: '小明', of: 'x-dinner', amt: 560, a: 'cash', cat: 'food', sub: 'food:out', t: now + 5 }, now);
put(b, 'entries', { id: 'x-f2', d: day, k: 'back', why: 'friend', who: 'Amy', of: 'x-dinner', amt: 560, a: 'cash', wait: 1, cat: 'food', sub: 'food:out', t: now + 5 }, now);
put(b, 'entries', { id: 'x-lp', d: day, k: 'out', amt: 359, cat: 'shop', sub: 'shop:online', note: '蝦皮', a: 'a5', via: '', to: '', also: [{ a: 'a6', via: '', amt: 59 }], t: now + 4 }, now);
put(b, 'entries', { id: 'x-atm', d: day, k: 'move', amt: 3000, a: 'a1', to: 'cash', fee: 15, t: now + 3 }, now);
put(b, 'entries', { id: 'x-ai', d: addDays(day, -3), k: 'out', amt: 650, cat: 'digital', sub: 'digital:ai', note: 'Claude Pro', a: 'a3', via: '', to: '', fee: 10, t: now }, now);
put(b, 'entries', { id: 'x-ref', d: day, k: 'back', why: 'refund', of: 'e5', amt: 200, a: 'cash', cat: 'daily', sub: 'daily:grocery', t: now + 2 }, now);
// The EasyCard tops itself up from the bank, as the app does when a spend sets it off.
for (const e of live(b.entries).filter(e => e.a === 'a2').sort((x, y) => x.d.localeCompare(y.d) || x.t - y.t)) autoReload(b, e, now);
b.carrier = { code: '/ABC1234', u: now };
process.stdout.write(await encodeBooks(b));
