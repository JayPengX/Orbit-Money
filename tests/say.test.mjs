// 用說的記帳's own read (lib/say.mjs): plain "words amount" lines on the
// phone; anything that needs judgment left to the AI (null).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readSay, openMeals } from '../public/lib/say.mjs';

const read = t => readSay(t, '2026-11-10')?.map(b => [b.day, b.store, b.total, b.cat]) ?? null;

test('plain lines read on the phone, meals by their words', () => {
  assert.deepEqual(read('早餐 45 午餐 120 捷運 30'), [
    ['2026-11-10', '早餐', 45, 'food:breakfast'],
    ['2026-11-10', '午餐', 120, 'food:lunch'],
    ['2026-11-10', '捷運', 30, 'transport:ride']
  ]);
  assert.deepEqual(read('早上麥當勞 89 咖啡 50'), [
    ['2026-11-10', '麥當勞', 89, 'food:breakfast'],
    ['2026-11-10', '咖啡', 50, 'food:drink']
  ], 'a drink stays a drink after a meal');
  assert.deepEqual(read('昨天 全聯 356、星巴克 150').map(r => r[0]), ['2026-11-09', '2026-11-09']);
  assert.deepEqual(read('前天 ｕｂｅｒ ２３０元'), [['2026-11-08', 'uber', 230, 'transport:ride']], 'full-width read as narrow');
});

test('a meal that doesn’t say which is asked by the phone, not the AI', () => {
  const r = readSay('便當 110', '2026-11-10');
  assert.equal(r[0].cat, 'food');
  assert.equal(openMeals(r).length, 1);
});

test('what needs judgment goes to the AI', () => {
  for (const t of ['跟同學吃火鍋花了三百五', '午餐 120 用 line pay 付的', '媽給我零用錢 2000', '11/8 電影 320', '上週五 KTV 500', '明天要考數學', '', '退款 300'])
    assert.equal(read(t), null, t);
});
