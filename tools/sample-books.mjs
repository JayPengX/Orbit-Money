// Made-up books for a preview (tools/preview.mjs money --payload <file>): a
// few accounts and a month of spending around today. Never real data.
//   node tools/sample-books.mjs > /tmp/books.txt
import { emptyBooks, put, encodeBooks } from '../public/lib/books.mjs';
import { addDays } from '#kit/format.mjs';

const b = emptyBooks();
const now = Date.now();
const day = new Date(now + 8 * 3_600_000).toISOString().slice(0, 10);
const acct = (id, name, kind, open, more = {}) => put(b, 'accts', { id, name, kind, open, inTotal: true, order: Object.keys(b.accts).length, ...more }, now);
acct('cash', '現金', 'cash', 2400);
acct('a1', '玉山 薪轉', 'bank', 86000, { brand: 'esun' });
acct('a2', '悠遊卡', 'ticket', 350, { brand: 'easycard' });
acct('a3', '國泰 CUBE 卡', 'credit', 0, { brand: 'cathay', pay: 'a1', close: 5, due: 20 });
acct('a4', '台新 Richart', 'bank', 120000, { brand: 'taishin', inTotal: false });
acct('a5', 'LINE Pay', 'wallet', 0, { brand: 'linepay' });
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
put(b, 'entries', { id: 'e-tpass', d: addDays(day, -12), k: 'out', amt: 1200, cat: 'transport', sub: 'transport:tpass', note: '', a: 'a1', via: 'c1', to: '', t: now }, now);
put(b, 'cats', { id: 'transport:youbike', pay: { a: 'a2', via: '' }, unit: 5 }, now);
put(b, 'budgets', { id: 'b-all', cat: '', amt: 20000 }, now);
put(b, 'budgets', { id: 'b-food', cat: 'food', amt: 6000 }, now);
b.carrier = { code: '/ABC1234', u: now };
process.stdout.write(await encodeBooks(b));
