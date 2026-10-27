// 到期提醒 (lib/renew.mjs): anything that runs out or renews, when, and when the phone is told.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as B from '../public/lib/books.mjs';
import * as R from '../public/lib/renew.mjs';

const T = Date.UTC(2026, 9, 27);

test('a cycle: days, months (the month’s last when shorter), years', () => {
  assert.equal(R.addCycle('2026-10-27', 30, 'day'), '2026-11-26');
  assert.equal(R.addCycle('2026-01-31', 1, 'month'), '2026-02-28');
  assert.equal(R.addCycle('2026-11-15', 3, 'month'), '2027-02-15');
  assert.equal(R.addCycle('2028-02-29', 1, 'year'), '2029-02-28');
});

test('runs out: its last day from its start; a spend logged in its category starts the next one', () => {
  const b = B.emptyBooks();
  B.put(b, 'renew', { id: 'tpass', name: 'TPASS', start: '2026-10-01', n: 30, unit: 'day', cat: 'transport', sub: 'transport:tpass' }, T);
  let s = R.standing(b, b.renew.tpass, '2026-10-27');
  assert.deepEqual([s.due, s.left, s.src], ['2026-10-30', 3, 'set']);
  assert.equal(R.standing(b, b.renew.tpass, '2026-11-02').left, -3);
  B.put(b, 'entries', { id: 'e', d: '2026-10-31', k: 'out', amt: 1200, cat: 'transport', sub: 'transport:tpass', a: 'cash' }, T);
  s = R.standing(b, b.renew.tpass, '2026-11-02');
  assert.deepEqual([s.due, s.src, s.e.id], ['2026-11-29', 'entry', 'e']);
  // First ridden later than bought: its own `from`.
  B.put(b, 'entries', { ...b.entries.e, from: '2026-11-03' }, T);
  assert.equal(R.standing(b, b.renew.tpass, '2026-11-02').due, '2026-12-02');
  // Another sub of the category doesn't count.
  B.put(b, 'entries', { id: 'm', d: '2026-11-20', k: 'out', amt: 30, cat: 'transport', sub: 'transport:mrt', a: 'cash' }, T);
  assert.equal(R.standing(b, b.renew.tpass, '2026-11-02').due, '2026-12-02');
  assert.equal(R.renewedBy(b.renew.tpass, { due: '2026-12-02' }), '2026-12-03');
});

test('renews by itself: the next charge on or after today; nothing set: not placed', () => {
  const b = B.emptyBooks();
  B.put(b, 'renew', { id: 'n', name: 'Claude Pro', start: '2026-08-15', n: 1, unit: 'month', roll: true }, T);
  B.put(b, 'renew', { id: 'y', name: '信用卡年費', start: '2025-12-01', n: 1, unit: 'year', roll: true }, T);
  B.put(b, 'renew', { id: 'z', name: '健身房', start: '', n: 1, unit: 'month' }, T);
  const list = R.reminders(b, '2026-10-27');
  assert.deepEqual(list.map(x => [x.r.id, x.due, x.left]), [['n', '2026-11-15', 19], ['y', '2026-12-01', 35], ['z', '', null]]);
  assert.equal(R.standing(b, b.renew.n, '2026-11-15').due, '2026-11-15');
});

test('when the phone is told: each day before at 20:00, the day itself at 08:00 (Taiwan); off: never', () => {
  const r = { id: 'x', at: [0, 3, 1] };
  const t = R.remindTimes(r, { due: '2026-11-25' });
  assert.deepEqual(t.map(x => [x.n, new Date(x.at).toISOString()]), [[3, '2026-11-22T12:00:00.000Z'], [1, '2026-11-24T12:00:00.000Z'], [0, '2026-11-25T00:00:00.000Z']]);
  assert.deepEqual(R.remindTimes({ id: 'x', on: false }, { due: '2026-11-25' }), []);
  assert.deepEqual(R.remindTimes({ id: 'x' }, { due: '' }), []);
});

test('older books: the TPASS settings on the category become the list’s TPASS; a TPASS logged makes one; once', () => {
  const b = B.emptyBooks();
  B.put(b, 'cats', { id: 'transport:tpass', days: 30, start: '2026-10-10', remind: { on: true, at: [3] }, amt: 1200 }, T);
  assert.equal(R.upgradeRenew(b, T + 1), 2);
  assert.deepEqual(b.renew.tpass && [b.renew.tpass.start, b.renew.tpass.n, b.renew.tpass.at], ['2026-10-10', 30, [3]]);
  assert.equal('days' in b.cats['transport:tpass'], false);
  assert.equal(b.cats['transport:tpass'].amt, 1200);
  assert.equal(R.upgradeRenew(b, T + 2), 0);
  // Removed: stays removed.
  B.drop(b, 'renew', 'tpass', T + 3);
  B.put(b, 'entries', { id: 'e', d: '2026-11-01', k: 'out', amt: 1200, cat: 'transport', sub: 'transport:tpass', a: 'cash' }, T);
  assert.equal(R.upgradeRenew(b, T + 4), 0);
  const c = B.emptyBooks();
  B.put(c, 'entries', { id: 'e', d: '2026-11-01', k: 'out', amt: 1200, cat: 'transport', sub: 'transport:tpass', a: 'cash' }, T);
  assert.equal(R.upgradeRenew(c, T), 1);
  assert.equal(R.standing(c, c.renew.tpass, '2026-11-02').due, '2026-11-30');
});
