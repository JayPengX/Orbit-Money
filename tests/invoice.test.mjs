// 統一發票 (lib/invoice.mjs): the two QR codes, the draw, the 手機條碼's barcode.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as I from '../public/lib/invoice.mjs';

const head = 'AB12345678' + '1151020' + '1234' + '00000064' + '00000069' + '00000000' + '22555003' + 'x'.repeat(24);
const LEFT = `${head}:**********:2:3:1:茶葉蛋:1:13:可樂:1:25`;

test('the left QR: number, day (民國), random code, amounts in hex, seller, items, more to come', () => {
  assert.equal(head.length, 77);
  const inv = I.parseLeft(LEFT);
  assert.deepEqual({ ...inv, items: inv.items.length }, { no: 'AB12345678', day: '2026-10-20', rand: '1234', untaxed: 100, total: 105, buyer: '', sid: '22555003', items: 2, more: true, enc: 'utf-8' });
  assert.equal(I.parseLeft('**:a:1:2'), null);
  assert.equal(I.parseLeft('AB12345678' + '1151320' + head.slice(17)), null, 'month 13');
  const both = I.joinQr(inv, I.parseRight('**御飯糰:1:39'));
  assert.deepEqual(both.items.map(i => i.name), ['茶葉蛋', '可樂', '御飯糰']);
  assert.equal(both.more, false);
  assert.deepEqual(I.parseRight('**:御飯糰:2:39.5'), [{ name: '御飯糰', qty: 2, price: 39.5 }]);
  const b64 = `${head}:**********:1:1:2:${Buffer.from('拿鐵').toString('base64')}:1:65`;
  assert.equal(I.parseLeft(b64).items[0].name, '拿鐵');
});

test('Big5 items read in Big5', () => {
  const big5 = Uint8Array.from([...Buffer.from(`${head}:**********:1:1:0:`), 0xa4, 0xfb, 0xa5, 0xa4, ...Buffer.from(':1:13')]);
  const text = I.qrText(big5, I.qrEncoding(I.qrText(big5)));
  assert.equal(I.parseLeft(text).items[0].name, '牛奶');
  assert.equal(I.parseLeft(text).enc, 'big5');
});

test('the draw: the period, its dates, every prize level', () => {
  assert.equal(I.periodOf('2026-10-20'), '11509');
  assert.equal(I.periodOf('2026-08-31'), '11507');
  assert.deepEqual(I.periodDates('11507'), { draw: '2026-09-25', claimFrom: '2026-10-06', claimTo: '2027-01-05' });
  assert.deepEqual(I.periodDates('11511'), { draw: '2027-01-25', claimFrom: '2027-02-06', claimTo: '2027-05-05' });
  const draw = { special: '89996565', grand: '91098182', first: ['54348835', '44991397', '06595111'] };
  const at = n => I.prizeOf(`AB${n}`, draw)?.level ?? null;
  assert.equal(at('89996565'), 'special');
  assert.equal(at('91098182'), 'grand');
  assert.equal(at('54348835'), 'first');
  assert.equal(at('14348835'), 'second');
  assert.equal(at('10348835'), 'third');
  assert.equal(at('10048835'), 'fourth');
  assert.equal(at('10008835'), 'fifth');
  assert.equal(at('10000835'), 'sixth');
  assert.equal(at('10000035'), null);
  assert.equal(at('99996565'), null, 'the 特別獎 pays only all eight');
  assert.equal(I.prizeOf('AB12', draw), null);
});

test('the 手機條碼: its form, and Code 39 bars with a start and stop', () => {
  assert.ok(I.CARRIER.test('/ABC+1.-'));
  assert.ok(!I.CARRIER.test('/abc1234'));
  assert.equal(I.cleanCarrier(' abc1234 '), '/ABC1234');
  const { bars, width } = I.code39Bars('/AB');
  assert.equal(bars.length, 5 * 5);
  assert.equal(width, 5 * 16 - 1);
  assert.throws(() => I.code39Bars('a'));
  assert.match(I.code39Svg('/AB'), /^<svg/);
});
