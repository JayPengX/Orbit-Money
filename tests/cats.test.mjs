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
  B.put(b, 'entries', { id: 'e2', d: '2026-10-02', k: 'out', amt: 90, cat: 'drink', sub: 'drink:tea', a: 'cash' }, T);
  B.put(b, 'budgets', { id: 'b-drink', cat: 'drink', amt: 1000 }, T);
  return b;
}

test('the defaults: TPASS under 交通, meals under 餐飲', () => {
  C.useCats({});
  assert.ok(C.subsOf('transport').some(s => s.zh === 'TPASS'));
  assert.deepEqual(C.subsOf('food').slice(0, 3).map(s => s.zh), ['早餐', '午餐', '晚餐']);
  assert.equal(C.subOf('transport:tpass').parent, 'transport');
  assert.equal(C.catOf('nope').id, 'other');
});

test('rename, hide and reorder are the person’s own, the built-in kept', () => {
  const b = sample();
  C.saveCat(b, { id: 'food', zh: '吃飯' }, T);
  C.saveCat(b, { id: 'pet', hidden: true }, T);
  C.moveCat(b, 'drink', -1, T);
  C.useCats(b.cats);
  const list = C.catList('out').map(c => c.id);
  assert.equal(C.catOf('food').zh, '吃飯');
  assert.ok(!list.includes('pet'));
  assert.ok(C.catList('out', { all: true }).some(c => c.id === 'pet'));
  assert.deepEqual(list.slice(0, 2), ['drink', 'food']);
  assert.equal(C.catOf('pet').zh, '寵物');
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
  assert.equal(C.removeCat(b, 'drink', T), false);
  assert.ok(C.mergeCat(b, 'drink', 'food', T + 1));
  C.useCats(b.cats);
  assert.equal(b.entries.e2.cat, 'food');
  assert.equal(b.entries.e2.sub, 'drink:tea');
  assert.equal(C.subOf('drink:tea').parent, 'food');
  assert.ok(b.budgets['b-drink'].del);
  assert.ok(!C.catList('out').some(c => c.id === 'drink'));
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
  C.mergeCat(b, 'drink', 'food', T + 1);
  undo(T + 2);
  C.useCats(b.cats);
  assert.equal(b.entries.e2.cat, 'drink');
  assert.ok(!b.budgets['b-drink'].del);
  assert.equal(C.subOf('drink:tea').parent, 'drink');
  assert.ok(C.catList('out').some(c => c.id === 'drink'));
});

test('what a pick fills in: nothing until set, a sub’s own over its category’s', () => {
  const b = sample();
  C.useCats(b.cats);
  assert.deepEqual(C.defaultsOf('transport', 'transport:youbike'), { pay: null, amt: 0, unit: 0 });
  C.saveCat(b, { id: 'transport', pay: { a: 'bank', via: '' } }, T);
  C.saveCat(b, { id: 'transport:youbike', pay: { a: 'card', via: '' }, unit: 5 }, T);
  C.saveCat(b, { id: 'transport:tpass', amt: 1200 }, T);
  C.useCats(b.cats);
  assert.deepEqual(C.defaultsOf('transport', 'transport:youbike'), { pay: { a: 'card', via: '' }, unit: 5, amt: 0 });
  assert.deepEqual(C.defaultsOf('transport', 'transport:tpass'), { pay: { a: 'bank', via: '' }, amt: 1200, unit: 0 });
  assert.deepEqual(C.defaultsOf('transport', ''), { pay: { a: 'bank', via: '' }, amt: 0, unit: 0 });
});

test('訂閱 and 遊戲 moved to 數位: entries, repeats and the person’s own changes go along; the 退款 category let go', () => {
  const b = sample();
  B.put(b, 'entries', { id: 'g', d: '2026-10-03', k: 'out', amt: 1490, cat: 'fun', sub: 'fun:games', a: 'cash' }, T);
  B.put(b, 'recur', { id: 'n', k: 'out', amt: 390, cat: 'fun', sub: 'fun:subs', a: 'cash', every: 'month', day: 5, from: '2026-10-05' }, T);
  C.saveCat(b, { id: 'fun:subs', zh: '串流', amt: 390 }, T);
  C.saveCat(b, { id: 'refund', hidden: true }, T);
  assert.equal(C.upgradeCats(b, T + 1), 5);
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

