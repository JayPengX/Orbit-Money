import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { NETWORKS, networkLogo, netOfCard } from '../public/lib/networks.mjs';

test('every network has its mark', () => {
  for (const n of NETWORKS) assert.ok(existsSync(new URL(`../public/${networkLogo(n.id).slice(2)}`, import.meta.url)), n.id);
  assert.equal(networkLogo('nope'), '');
});

test('a card is on its own network, else its credit card’s', () => {
  const credit = { kind: 'credit', net: 'jcb' };
  assert.equal(netOfCard({ net: 'visa' }, credit), 'visa');
  assert.equal(netOfCard({ name: 'Apple Pay' }, credit), 'jcb');
  assert.equal(netOfCard({ name: '金融卡' }, { kind: 'bank', net: 'visa' }), '');
  assert.equal(netOfCard({ net: 'bogus' }, { kind: 'bank' }), '');
  assert.equal(netOfCard(null, credit), 'jcb');
});
