// The categories (lib/cats.mjs): the built-ins with their subs, the person's own
// changes, and that changing them never loses history.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as B from '../public/lib/books.mjs';
import * as C from '../public/lib/cats.mjs';

const T = Date.UTC(2026, 9, 27);
function sample() {
  const b = B.emptyBooks();
  B.put(b, 'entries', { id: 'e1', d: '2026-10-01', k: 'out', amt: 1200, cat: 'transport', sub: 'transport:tpass', a: 'cash' }, T);
  B.put(b, 'entries', { id: 'e2', d: '2026-10-02', k: 'out', amt: 90, cat: 'fun', sub: 'fun:leisure', a: 'cash' }, T);
  B.put(b, 'budgets', { id: 'b-fun', cat: 'fun', amt: 1000 }, T);
  return b;
}

test('the defaults: TPASS under 交通, meals under 餐飲', () => {
  C.useCats({});
  assert.ok(C.subsOf('transport').some(s => s.zh === 'TPASS'));
  assert.deepEqual(C.subsOf('food').map(s => s.zh), ['早餐', '午餐', '晚餐', '飲料點心']);
  assert.equal(C.catList('out').length, 12);
  assert.equal(C.subOf('transport:tpass').parent, 'transport');
  assert.equal(C.catOf('nope').id, 'other');
});

test('rename, hide and reorder are the person’s own, the built-in kept', () => {
  const b = sample();
  C.saveCat(b, { id: 'food', zh: '吃飯' }, T);
  C.saveCat(b, { id: 'family', hidden: true }, T);
  const ids = C.catList('out', { all: true }).map(c => c.id);
  const i = ids.indexOf('transport');
  [ids[i - 1], ids[i]] = [ids[i], ids[i - 1]];
  C.orderCats(b, ids, T);
  C.useCats(b.cats);
  const list = C.catList('out').map(c => c.id);
  assert.equal(C.catOf('food').zh, '吃飯');
  assert.ok(!list.includes('family'));
  assert.ok(C.catList('out', { all: true }).some(c => c.id === 'family'));
  assert.deepEqual(list.slice(0, 2), ['transport', 'food']);
  assert.equal(C.catOf('family').zh, '家人');
});

test('a new category and sub, removed while unused', () => {
  const b = sample();
  const c = C.addCat(b, { k: 'out', zh: '咖啡豆' }, T);
  const s = C.addCat(b, { k: 'out', parent: c.id, zh: '淺焙' }, T);
  C.useCats(b.cats);
  assert.equal(C.catList('out').at(-1).id, c.id);
  assert.equal(C.subsOf(c.id)[0].id, s.id);
  assert.ok(C.removeCat(b, c.id, T + 1));
  C.useCats(b.cats);
  assert.ok(!C.catList('out', { all: true }).some(x => x.id === c.id));
  assert.equal(C.subOf(s.id), null);
});

test('one with history can’t just go: merged, its entries move', () => {
  const b = sample();
  assert.equal(C.removeCat(b, 'fun', T), false);
  assert.ok(C.mergeCat(b, 'fun', 'food', T + 1));
  C.useCats(b.cats);
  assert.equal(b.entries.e2.cat, 'food');
  assert.equal(b.entries.e2.sub, 'fun:leisure');
  assert.equal(C.subOf('fun:leisure').parent, 'food');
  assert.ok(b.budgets['b-fun'].del);
  assert.ok(!C.catList('out').some(c => c.id === 'fun'));
  // A sub into its parent: the entry keeps the category, the sub let go.
  assert.ok(C.mergeCat(b, 'transport:tpass', 'transport', T + 2));
  assert.equal(b.entries.e1.cat, 'transport');
  assert.equal(b.entries.e1.sub, '');
});

test('the changes travel with the books', async () => {
  const b = sample();
  C.saveCat(b, { id: 'food', zh: '吃飯' }, T);
  const back = await B.decodeBooks(await B.encodeBooks(b));
  assert.equal(back.cats.food.zh, '吃飯');
  const m = B.mergeBooks(B.emptyBooks(), back);
  assert.equal(m.cats.food.zh, '吃飯');
});

test('a merge undone puts every record back', () => {
  const b = sample();
  const undo = C.catUndo(b);
  C.mergeCat(b, 'fun', 'food', T + 1);
  undo(T + 2);
  C.useCats(b.cats);
  assert.equal(b.entries.e2.cat, 'fun');
  assert.ok(!b.budgets['b-fun'].del);
  assert.equal(C.subOf('fun:leisure').parent, 'fun');
  assert.ok(C.catList('out').some(c => c.id === 'fun'));
});

test('what a pick fills in: nothing until set, a sub’s own over its category’s', () => {
  const b = sample();
  C.useCats(b.cats);
  assert.deepEqual(C.defaultsOf('transport', 'transport:ride'), { pay: null, amt: 0, unit: 0 });
  C.saveCat(b, { id: 'transport', pay: { a: 'bank', via: '' } }, T);
  C.saveCat(b, { id: 'transport:ride', pay: { a: 'card', via: '' }, unit: 5 }, T);
  C.saveCat(b, { id: 'transport:tpass', amt: 1200 }, T);
  C.useCats(b.cats);
  assert.deepEqual(C.defaultsOf('transport', 'transport:ride'), { pay: { a: 'card', via: '' }, unit: 5, amt: 0 });
  assert.deepEqual(C.defaultsOf('transport', 'transport:tpass'), { pay: { a: 'bank', via: '' }, amt: 1200, unit: 0 });
  assert.deepEqual(C.defaultsOf('transport', ''), { pay: { a: 'bank', via: '' }, amt: 0, unit: 0 });
});

test('訂閱 and 遊戲 moved to 數位: entries, repeats and the person’s own changes go along; the 退款 category let go', () => {
  const b = sample();
  B.put(b, 'entries', { id: 'g', d: '2026-10-03', k: 'out', amt: 1490, cat: 'fun', sub: 'fun:games', a: 'cash' }, T);
  B.put(b, 'recur', { id: 'n', k: 'out', amt: 390, cat: 'fun', sub: 'fun:subs', a: 'cash', every: 'month', day: 5, from: '2026-10-05' }, T);
  C.saveCat(b, { id: 'fun:subs', zh: '串流', amt: 390 }, T);
  C.saveCat(b, { id: 'refund', hidden: true }, T);
  b.opt = { ...b.opt, cats12: 1 };
  assert.equal(C.upgradeCats(b, T + 1), 6);
  assert.equal(b.entries.g.cat, 'digital');
  assert.equal(b.entries.g.sub, 'digital:games');
  assert.equal(b.recur.n.sub, 'digital:subs');
  assert.equal(b.cats['digital:subs'].zh, '串流');
  assert.equal(C.subOf('digital:subs').zh, '串流');
  assert.equal(b.cats['fun:subs'].del, 1);
  assert.equal(C.upgradeCats(b, T + 2), 0);
  C.useCats({});
});

test('digital things land in 數位: Claude, Cloudflare, Steam', () => {
  C.useCats({});
  assert.equal(C.guessCat('Anthropic Claude Pro'), 'digital');
  assert.equal(C.guessSub('digital', 'CLOUDFLARE'), 'digital:cloud');
  assert.equal(C.guessSub('digital', 'Steam'), 'digital:games');
  assert.equal(C.guessSub('digital', 'Claude.ai subscription'), 'digital:ai');
  assert.equal(C.guessCat('威秀影城'), 'fun');
});

test('數位 has four broad subs (Jay 2026-10-31): a project’s upkeep together, tools apart', () => {
  C.useCats({});
  assert.deepEqual(C.subsOf('digital').map(s => s.zh), ['專案維運', '工具訂閱', '影音串流', '遊戲']);
  for (const w of ['TDX 運輸資料', 'Namecheap domain', 'Vercel Pro', 'GitHub Actions']) assert.equal(C.guessSub('digital', w), 'digital:cloud', w);
  for (const w of ['iCloud+', 'ChatGPT Plus', 'App Store']) assert.equal(C.guessSub('digital', w), 'digital:ai', w);
  const b = B.emptyBooks();
  B.put(b, 'entries', { id: 'a', d: '2026-10-01', k: 'out', amt: 90, cat: 'digital', sub: 'digital:apps', note: 'Notion' }, 1);
  B.put(b, 'entries', { id: 'g', d: '2026-10-01', k: 'out', amt: 30, cat: 'digital', sub: 'digital:cloud', note: 'Google One' }, 1);
  B.put(b, 'entries', { id: 't', d: '2026-10-01', k: 'out', amt: 300, cat: 'digital', sub: 'digital:cloud', note: 'TDX' }, 1);
  b.opt = { ...b.opt, dig2: 1, cats12: 1 };
  C.upgradeCats(b, 2);
  assert.equal(b.entries.a.sub, 'digital:ai');
  assert.equal(b.entries.g.sub, 'digital:ai');
  assert.equal(b.entries.t.sub, 'digital:cloud');
});


test('the twelve (Jay 2026-11-01): what was logged under the old set moves once, nothing else changes', () => {
  const b = B.emptyBooks();
  const e = (id, cat, sub, more = {}) => B.put(b, 'entries', { id, d: '2026-10-01', k: 'out', amt: 100, cat, sub, a: 'cash', note: '', ...more }, T);
  e('lu', 'food', 'food:lunch');
  e('bf', 'food', 'food:late', { g: 'food|food:snack|cash||0' });
  e('sn', 'food', 'food:snack');
  e('tea', 'drink', 'drink:tea');
  e('dr', 'drink', '');
  e('yb', 'transport', 'transport:youbike');
  e('hsr', 'transport', 'transport:thsr');
  e('tp', 'transport', 'transport:tpass');
  e('gas', 'car', 'car:fuel');
  e('px', 'daily', 'daily:grocery');
  e('ol', 'shop', 'shop:online', { note: 'Uniqlo' });
  e('ol2', 'shop', 'shop:online', { note: '蝦皮' });
  e('pw', 'bills', '');
  e('mob', 'phone', 'phone:mobile');
  e('mv', 'fun', 'fun:ktv');
  e('tr', 'travel', 'travel:stay');
  e('ins', 'insure', '');
  e('pet', 'pet', '');
  e('den', 'health', 'health:dental');
  B.put(b, 'entries', { id: 'pz', d: '2026-10-01', k: 'in', amt: 200, cat: 'prize', a: 'cash' }, T);
  B.put(b, 'recur', { id: 'r', k: 'out', amt: 499, cat: 'phone', sub: 'phone:net', a: 'cash', every: 'month', day: 5, from: '2026-10-05' }, T);
  B.put(b, 'budgets', { id: 'bf', cat: 'food', amt: 6000 }, T);
  B.put(b, 'budgets', { id: 'bd', cat: 'drink', amt: 1500 }, T);
  B.put(b, 'budgets', { id: 'bc', cat: 'car', amt: 2000 }, T);
  C.saveCat(b, { id: 'transport:youbike', pay: { a: 'easy', via: '' }, unit: 5 }, T);
  C.saveCat(b, { id: 'home', hidden: true, order: 9 }, T);
  const mine = C.addCat(b, { k: 'out', parent: 'drink', zh: '咖啡豆' }, T);
  e('bean', 'drink', mine.id);
  b.opt = { ...b.opt, preset: 'student', picked: 1 };
  C.upgradeCats(b, T + 1);
  C.useBooksCats(b);
  const at = id => `${b.entries[id].cat} ${b.entries[id].sub}`;
  // (宵夜 is 晚餐 now; 早餐, 午餐 and 晚餐 stay themselves.)
  assert.equal(at('bf'), 'food food:dinner');
  assert.equal(at('lu'), 'food food:lunch');
  assert.equal(b.entries.bf.g, 'food|food:drink|cash||0');
  assert.equal(at('sn'), 'food food:drink');
  assert.equal(at('tea'), 'food food:drink');
  assert.equal(at('dr'), 'food food:drink');
  assert.equal(at('yb'), 'transport transport:ride');
  assert.equal(at('hsr'), 'transport transport:long');
  assert.equal(at('tp'), 'transport transport:tpass');
  assert.equal(at('gas'), 'transport transport:car');
  assert.equal(at('px'), 'shop shop:daily');
  assert.equal(at('ol'), 'shop shop:style');
  assert.equal(at('ol2'), 'shop ');
  assert.equal(at('pw'), 'home home:bills');
  assert.equal(at('mob'), 'home home:net');
  assert.equal(at('mv'), 'fun fun:leisure');
  assert.equal(at('tr'), 'fun fun:travel');
  assert.equal(at('ins'), 'health health:insure');
  assert.equal(at('pet'), 'family family:pet');
  assert.equal(at('den'), 'health health:clinic');
  assert.equal(b.entries.pz.cat, 'prize'); // 中獎 stays its own (restored 2026-11-01)
  assert.equal(b.recur.r.sub, 'home:net');
  assert.equal(b.entries.bf.amt, 100);
  // Budgets of two that became one add up; one alone just moves.
  assert.equal(B.live(b.budgets).find(x => x.cat === 'food').amt, 7500);
  assert.equal(B.live(b.budgets).find(x => x.cat === 'transport').amt, 2000);
  assert.equal(B.live(b.budgets).length, 2);
  // YouBike's card goes to 搭車, its NT$5 doesn't; the old record goes.
  assert.deepEqual(C.defaultsOf('transport', 'transport:ride'), { pay: { a: 'easy', via: '' }, amt: 0, unit: 0 });
  assert.equal(b.cats['transport:youbike'].del, 1);
  // The person's own sub goes along with its category; their entry too.
  assert.equal(C.subOf(mine.id).parent, 'food');
  assert.equal(at('bean'), `food ${mine.id}`);
  // One set: no preset, nothing of the old hides.
  assert.equal(b.opt.preset, undefined);
  assert.ok(C.catList('out').some(c => c.id === 'home'));
  assert.equal(C.upgradeCats(b, T + 2), 0);
  C.useCats({});
});

test('guesses in the twelve', () => {
  C.useCats({});
  assert.equal(C.guessCat('全聯福利中心'), 'shop');
  assert.equal(C.guessSub('shop', '全聯福利中心'), 'shop:daily');
  assert.equal(C.guessCat('台塑石化 加油站'), 'transport');
  assert.equal(C.guessSub('transport', '台塑石化 加油站'), 'transport:car');
  assert.equal(C.guessSub('transport', '台灣高鐵'), 'transport:long');
  assert.equal(C.guessCat('路易莎咖啡'), 'food');
  assert.equal(C.guessSub('food', '路易莎咖啡'), 'food:drink');
  assert.equal(C.guessSub('food', '', new Date(2026, 9, 1, 12, 30)), 'food:lunch');
  assert.equal(C.guessSub('food', '', new Date(2026, 9, 1, 7, 30)), 'food:breakfast');
  assert.equal(C.guessSub('food', '', new Date(2026, 9, 1, 19, 0)), 'food:dinner');
  assert.equal(C.guessSub('food', '', new Date(2026, 9, 1, 23, 30)), 'food:dinner');
  assert.equal(C.guessCat('中華電信'), 'home');
  assert.equal(C.guessSub('home', '中華電信'), 'home:net');
});

test('what the words say, whatever the category: 星巴克 is 飲料點心 from the first entry; never a hidden one', () => {
  C.useCats({});
  assert.equal(C.subFromWords('星巴克 拿鐵'), 'food:drink');
  assert.equal(C.subFromWords('全聯'), 'shop:daily');
  assert.equal(C.subFromWords('台灣高鐵'), 'transport:long');
  assert.equal(C.subFromWords('午餐'), '');
  assert.equal(C.subFromWords(''), '');
  const b = sample();
  C.saveCat(b, { id: 'food:drink', hidden: true }, T);
  C.useCats(b.cats);
  assert.equal(C.subFromWords('星巴克'), '');
  C.useCats({});
});

test('three meals again: what the twelve put under 三餐 goes back to the meal it was, nothing else changes', () => {
  C.useCats({});
  const T = Date.UTC(2026, 10, 1, 10);
  // The books before the twelve (the Pass's kept version) and after.
  const old = B.emptyBooks();
  const b = B.emptyBooks();
  const tw = (d, h) => Date.parse(`${d}T${String(h).padStart(2, '0')}:00:00+08:00`);
  const rows = [
    ['b1', 'food:breakfast', '2026-10-20', tw('2026-10-21', 9)],
    ['l1', 'food:lunch', '2026-10-20', tw('2026-10-20', 20)],
    ['d1', 'food:dinner', '2026-10-21', tw('2026-10-21', 8)],
    ['n1', 'food:late', '2026-10-22', tw('2026-10-23', 1)]
  ];
  for (const [id, sub, d, t] of rows) {
    B.put(old, 'entries', { id, d, k: 'out', amt: 100, cat: 'food', sub, a: 'cash', t, g: `food|${sub}|cash||0` }, T - 9e6);
    B.put(b, 'entries', { id, d, k: 'out', amt: 100, cat: 'food', sub: 'food:meals', a: 'cash', t, g: 'food|food:meals|cash||0' }, T);
  }
  // Logged after the twelve: by the hour, on its own day; logged days later: just 餐飲.
  B.put(b, 'entries', { id: 'x1', d: '2026-11-01', k: 'out', amt: 85, cat: 'food', sub: 'food:meals', a: 'cash', t: tw('2026-11-01', 12) }, T);
  B.put(b, 'entries', { id: 'x2', d: '2026-11-01', k: 'out', amt: 70, cat: 'food', sub: 'food:meals', a: 'cash', t: tw('2026-11-01', 18) }, T);
  B.put(b, 'entries', { id: 'x3', d: '2026-10-28', k: 'out', amt: 60, cat: 'food', sub: 'food:meals', a: 'cash', t: tw('2026-11-01', 18) }, T);
  B.put(b, 'entries', { id: 'cof', d: '2026-11-01', k: 'out', amt: 55, cat: 'food', sub: 'food:drink', a: 'cash', t: tw('2026-11-01', 15) }, T);
  B.put(b, 'recur', { id: 'r', k: 'out', amt: 1200, cat: 'food', sub: 'food:meals', a: 'cash', every: 'month', day: 1, from: '2026-10-01' }, T);
  B.put(old, 'recur', { id: 'r', k: 'out', amt: 1200, cat: 'food', sub: 'food:lunch', a: 'cash', every: 'month', day: 1, from: '2026-10-01' }, T - 9e6);
  C.saveCat(b, { id: 'food:meals', pay: { a: 'easy', via: '' } }, T);
  const before = JSON.parse(JSON.stringify(b));
  const sum = x => B.live(x.entries).reduce((s, e) => s + e.amt, 0);
  assert.ok(C.needsMeals(b));
  const r = C.splitMeals(b, old, T + 1);
  const sub = id => b.entries[id].sub;
  assert.deepEqual([sub('b1'), sub('l1'), sub('d1'), sub('n1')], ['food:breakfast', 'food:lunch', 'food:dinner', 'food:dinner']);
  assert.equal(b.entries.b1.g, 'food|food:breakfast|cash||0');
  assert.deepEqual([sub('x1'), sub('x2'), sub('x3'), sub('cof')], ['food:lunch', 'food:dinner', '', 'food:drink']);
  assert.equal(b.recur.r.sub, 'food:lunch');
  assert.deepEqual({ back: r.back, hour: r.hour, plain: r.plain }, { back: 5, hour: 2, plain: 1 });
  // Every record still there with the same amount, day, account and category; totals the same.
  assert.equal(B.live(b.entries).length, B.live(before.entries).length);
  assert.equal(sum(b), sum(before));
  for (const e of B.live(before.entries)) for (const k of ['amt', 'd', 'a', 'cat', 'k', 't']) assert.equal(b.entries[e.id][k], e[k]);
  // 三餐 is gone; its way to pay went to the three meals.
  assert.equal(b.cats['food:meals'].del, 1);
  C.useBooksCats(b);
  assert.deepEqual(C.defaultsOf('food', 'food:lunch').pay, { a: 'easy', via: '' });
  assert.ok(!C.subsOf('food').some(x => x.id === 'food:meals'));
  assert.ok(!C.needsMeals(b));
  // Without the old books (no Pass): by the hour alone.
  const c = B.emptyBooks();
  B.put(c, 'entries', { id: 'y', d: '2026-10-20', k: 'out', amt: 90, cat: 'food', sub: 'food:meals', a: 'cash', t: tw('2026-10-20', 7) }, T);
  C.splitMeals(c, null, T + 1);
  assert.equal(c.entries.y.sub, 'food:breakfast');
  C.useCats({});
});

test('no 聚餐 (Jay 2026-11-03): what was under it goes to its meal, nothing lost', () => {
  const b = B.emptyBooks();
  const tw = (d, hm) => Date.parse(`${d}T${hm}:00+08:00`);
  B.put(b, 'entries', { id: 'l', d: '2026-11-02', k: 'out', amt: 600, cat: 'food', sub: 'food:out', a: 'cash', note: '同學', t: tw('2026-11-02', '12:30'), g: 'food|food:out|cash||0' }, T);
  B.put(b, 'entries', { id: 'n', d: '2026-11-02', k: 'out', amt: 900, cat: 'food', sub: 'food:out', a: 'cash', t: tw('2026-11-02', '19:40') }, T);
  // Written down the next day: the hour says nothing, so 晚餐.
  B.put(b, 'entries', { id: 'x', d: '2026-11-01', k: 'out', amt: 500, cat: 'food', sub: 'food:out', a: 'cash', t: tw('2026-11-02', '09:00') }, T);
  B.put(b, 'cats', { id: 'food:out', pay: { a: 'card1', via: '' } }, T);
  B.put(b, 'cats', { id: 'food:lunch', pay: { a: 'cash', via: '' } }, T);
  C.upgradeCats(b, T + 1);
  const e = id => b.entries[id];
  assert.deepEqual(['l', 'n', 'x'].map(id => e(id).sub), ['food:lunch', 'food:dinner', 'food:dinner']);
  assert.equal(e('l').g, 'food|food:lunch|cash||0');
  assert.deepEqual(['l', 'n', 'x'].map(id => [e(id).amt, e(id).d, e(id).cat]), [[600, '2026-11-02', 'food'], [900, '2026-11-02', 'food'], [500, '2026-11-01', 'food']]);
  assert.equal(e('l').note, '同學');
  assert.ok(b.cats['food:out'].del);
  assert.equal(b.cats['food:lunch'].pay.a, 'cash');
  assert.equal(b.cats['food:dinner'].pay.a, 'card1');
  assert.ok(!C.subsOf('food').some(s => s.id === 'food:out'));
  assert.equal(C.upgradeCats(b, T + 2), 0, 'once moved, nothing more to do');
});

test('a dragged order (分類 grips) is saved as each one’s order, nothing else changed', () => {
  const b = sample();
  C.useCats(b.cats);
  const ids = C.catList('out', { all: true }).map(c => c.id);
  const moved = [ids[2], ...ids.filter(id => id !== ids[2])];
  C.orderCats(b, moved, T);
  C.useCats(b.cats);
  assert.deepEqual(C.catList('out', { all: true }).map(c => c.id), moved);
  const subs = C.subsOf('food', { all: true }).map(s => s.id).reverse();
  C.orderCats(b, subs, T);
  C.useCats(b.cats);
  assert.deepEqual(C.subsOf('food', { all: true }).map(s => s.id), subs);
  assert.equal(C.catOf('transport').zh, '交通', 'only the order changed');
});
