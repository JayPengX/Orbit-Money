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
  b.opt = { ...b.opt, dig2: 1 };
  C.upgradeCats(b, 2);
  assert.equal(b.entries.a.sub, 'digital:ai');
  assert.equal(b.entries.g.sub, 'digital:ai');
  assert.equal(b.entries.t.sub, 'digital:cloud');
});


test('presets: a slimmer set for a kind of person, nothing logged moves, a change becomes the person’s own', () => {
  const b = sample();
  C.saveCat(b, { id: 'pet', hidden: true }, T);
  assert.equal(C.presetOf(b), 'mine');
  C.usePreset(b, 'student');
  assert.equal(C.presetOf(b), 'student');
  const out = C.catList('out').map(c => c.id);
  assert.ok(out.includes('learn') && out.includes('transport') && out.includes('daily') && out.includes('health') && !out.includes('home') && !out.includes('kids'));
  assert.ok(C.subsOf('daily').some(s => s.zh === '文具'));
  assert.equal(out.length, 11);
  assert.ok(!C.subsOf('transport').some(s => s.id === 'transport:taxi'));
  assert.deepEqual(C.catList('in').map(c => c.id).slice(0, 2), ['allowance', 'redenv']);
  // A hidden one still names its history, and the person's own record is untouched.
  assert.equal(C.catOf('home').id, 'home');
  assert.equal(b.cats.pet.hidden, true);
  assert.equal(b.cats.home, undefined);
  assert.equal(b.entries.e1.cat, 'transport');
  // A new entry's default skips what the set hides; a guess too.
  assert.equal(C.shownCat('in', 'salary'), 'allowance');
  assert.equal(C.guessCat('全聯福利中心'), 'daily');
  assert.equal(C.guessSub('daily', '小明文具店'), 'daily:stationery');
  assert.equal(C.guessCat('台塑石化 加油站'), '');
  // Back to 「我的」: their own set, exactly.
  C.usePreset(b, 'mine');
  assert.equal(C.presetOf(b), 'mine');
  assert.ok(C.catList('out').some(c => c.id === 'home') && !C.catList('out').some(c => c.id === 'pet'));
  // A change under a preset writes the preset down as theirs first.
  C.usePreset(b, 'worker');
  assert.ok(C.ownPreset(b, T + 1));
  C.saveCat(b, { id: 'learn', hidden: false }, T + 1);
  C.useBooksCats(b);
  assert.equal(C.presetOf(b), 'mine');
  const mine = C.catList('out').map(c => c.id);
  assert.ok(mine.includes('learn') && mine.includes('bills') && !mine.includes('insure') && !mine.includes('kids') && !mine.includes('pet'));
  assert.equal(C.ownPreset(b, T + 2), false);
  C.useCats({});
});

test('presets: new books show everything until one is picked', () => {
  const b = B.emptyBooks();
  assert.equal(C.presetOf(b), 'all');
  C.usePreset(b, 'family');
  assert.ok(C.catList('out').some(c => c.id === 'kids'));
  assert.equal(C.presetCats(b, 'all', 'out').length, C.OUT.length);
  assert.ok(C.catList('out').length < C.OUT.length);
  C.useCats({});
});

test('presets: the student set keeps 零用錢 first, also once it is the person’s own', () => {
  const b = B.emptyBooks();
  C.usePreset(b, 'student');
  assert.equal(C.catList('in')[0].id, 'allowance');
  C.ownPreset(b, T);
  C.useBooksCats(b);
  assert.equal(C.catList('in')[0].id, 'allowance');
  assert.equal(C.catList('out').length, Object.keys(C.PRESETS[0].out).length);
  C.useCats({});
});
