import { test } from 'node:test';
import assert from 'node:assert/strict';
import { evenCuts, evenRows } from '../public/lib/columns.mjs';

// 統計 on Jay's iPad (2026-11-11): the first column tallest whatever the cut,
// so every cut tied on it and the first found left 預算 alone in the middle.
// Of cuts as tall, the evenest: 預算, 每一天 and 付款方式, then 最大筆支出 beside them.
test('of cuts as tall, the evenest one', () => {
  const tall = [1500, 110, 180, 330, 420];
  assert.deepEqual(evenCuts(tall, 3, 1), [1, 4, 5]);
  // (The shortest tallest column still wins first.)
  assert.deepEqual(evenCuts([300, 300, 300, 300], 2, 1), [2, 4]);
  // (`first` parts stay together at the head of the first column.)
  assert.equal(evenCuts([100, 100, 100, 100], 2, 3)[0] >= 3, true);
});

// 更多 (2026-11-11): 拍照記帳 stretched over two of three cards; every row
// full, the cards of a row one width.
test('tools fill every row evenly', () => {
  assert.deepEqual(evenRows(8, 3), { tracks: 6, spans: [2, 2, 2, 2, 2, 2, 3, 3] });
  assert.deepEqual(evenRows(9, 3), { tracks: 3, spans: Array(9).fill(1) });
  assert.deepEqual(evenRows(7, 3), { tracks: 6, spans: [2, 2, 2, 3, 3, 3, 3] });
  assert.deepEqual(evenRows(8, 2), { tracks: 2, spans: Array(8).fill(1) });
  assert.deepEqual(evenRows(0, 3), { tracks: 1, spans: [] });
});
