import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rideOffer } from '../public/lib/ride.mjs';

const at = Date.parse('2026-11-11T07:20:00+08:00');
const fact = { id: 't1', at, name: '新竹 → 竹北', fare: 30, modes: ['bus'] };

test('a planned trip with its fare, offered as a 交通 entry for 12 hours', () => {
  assert.deepEqual(rideOffer(fact, { now: at + 3_600_000 }), { id: 't1', amt: 30, note: '新竹 → 竹北', day: '2026-11-11', cat: 'transport', sub: 'transport:ride' });
  assert.equal(rideOffer({ ...fact, modes: ['bus', 'rail'] }, { now: at }).sub, 'transport:long');
  assert.equal(rideOffer(fact, { now: at + 13 * 3_600_000 }), null, 'too long ago');
  assert.equal(rideOffer(fact, { now: at + 60_000, done: ['t1'] }), null, 'passed on or saved');
});

test('nothing made up: no fare, a nonsense one, no id', () => {
  assert.equal(rideOffer({ ...fact, fare: 0 }, { now: at }), null);
  assert.equal(rideOffer({ ...fact, fare: 'x' }, { now: at }), null);
  assert.equal(rideOffer({ ...fact, id: '' }, { now: at }), null);
  assert.equal(rideOffer(null), null);
});
