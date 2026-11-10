// 車資記帳 (Jay 11-10, Money and Transit together): a trip Orbit Transit
// planned with a known fare, told in the family's notebook (kit family.mjs
// 'transit.ride': { id, at, name, fare, modes }), offered here as a 交通
// entry to look over and save: never added on its own (real money). From the
// trip's start for 12 hours, once a trip (passed on or saved, it's gone).

const HOLD = 12 * 3_600_000;
const LONG = /rail|thsr|train|intercity|高鐵|台鐵|客運/i;

export function rideOffer(fact, { now = Date.now(), done = [] } = {}) {
  if (!fact || typeof fact !== 'object') return null;
  const id = String(fact.id || '').slice(0, 40);
  const at = Number(fact.at);
  const fare = Math.round(Number(fact.fare));
  if (!id || !Number.isFinite(at) || !(fare > 0) || fare > 5000) return null;
  if (now < at - 30 * 60_000 || now > at + HOLD || done.includes(id)) return null;
  const modes = Array.isArray(fact.modes) ? fact.modes.map(String) : [];
  const day = new Date(at + 8 * 3_600_000).toISOString().slice(0, 10);
  return { id, amt: fare, note: String(fact.name || '').slice(0, 40), day, cat: 'transport', sub: modes.some(m => LONG.test(m)) ? 'transport:long' : 'transport:ride' };
}
