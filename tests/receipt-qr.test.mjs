// 拍照記帳's on-phone read of a paper 電子發票's two QR codes (lib/receipt-qr.mjs):
// the spec's fields, Big5 and Base64 items, the two codes paired, and a real
// picture decoded by the vendored ZXing (no network, no AI).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import qrcode from '#kit/qrcode.mjs';
import * as Q from '../public/lib/receipt-qr.mjs';

const head = 'AB12345678' + '1151020' + '1234' + '00000064' + '00000069' + '00000000' + '22555003' + 'x'.repeat(24);
const LEFT = `${head}:**********:2:3:1:茶葉蛋:1:13:可樂:1:25`;

test('the left QR: number, day (民國), random code, amounts in hex, seller, items', () => {
  assert.equal(head.length, 77);
  const inv = Q.parseLeft(LEFT);
  assert.deepEqual({ ...inv, items: inv.items.length }, { no: 'AB12345678', day: '2026-10-20', rand: '1234', untaxed: 100, total: 105, buyer: '', sid: '22555003', items: 2, enc: 'utf-8' });
  assert.equal(Q.parseLeft('**:a:1:2'), null);
  assert.equal(Q.parseLeft('AB12345678' + '1151320' + head.slice(17)), null, 'month 13');
  assert.deepEqual(Q.parseRight('**:御飯糰:2:39.5'), [{ name: '御飯糰', qty: 2, price: 39.5 }]);
  const b64 = `${head}:**********:1:1:2:${Buffer.from('拿鐵').toString('base64')}:1:65`;
  assert.equal(Q.parseLeft(b64).items[0].name, '拿鐵');
});

test('Big5 items read in Big5', () => {
  const big5 = Uint8Array.from([...Buffer.from(`${head}:**********:1:1:0:`), 0xa4, 0xfb, 0xa5, 0xa4, ...Buffer.from(':1:13')]);
  const [inv] = Q.invoicesOf([{ bytes: big5, x: 0, y: 0 }]);
  assert.equal(inv.items[0].name, '牛奶');
  assert.equal(inv.enc, 'big5');
});

test('each left code takes the right code beside it; one invoice once', () => {
  const other = 'CD87654321' + head.slice(10);
  const got = Q.invoicesOf([
    { text: '**:御飯糰:1:39', x: 300, y: 10 },
    { text: LEFT, x: 100, y: 12 },
    { text: `${other}:**********:0:1:1:`, x: 100, y: 600 },
    { text: '**:咖啡:1:45', x: 300, y: 590 },
    { text: LEFT, x: 100, y: 12 }
  ]);
  assert.deepEqual(got.map(i => [i.no, i.items.map(x => x.name).join(',')]), [
    ['AB12345678', '茶葉蛋,可樂,御飯糰'],
    ['CD87654321', '咖啡']
  ]);
});

test('a seller by the name on its sign', () => {
  assert.equal(Q.shortSeller('統一超商股份有限公司'), '7-ELEVEN');
  assert.equal(Q.shortSeller('全家便利商店股份有限公司'), '全家');
  assert.equal(Q.shortSeller('網路家庭國際資訊股份有限公司'), '網路家庭國際資訊');
  assert.equal(Q.shortSeller('台灣大哥大股份有限公司'), '台灣大哥大');
  assert.equal(Q.shortSeller('阿明小吃店'), '阿明小吃店');
});

// A picture of a paper invoice's two codes, side by side on white (as a phone would see them).
function picture(texts, scale = 5) {
  const qrs = texts.map(t => {
    const q = qrcode(0, 'L');
    q.addData(String.fromCharCode(...Buffer.from(t, 'utf8')), 'Byte');
    q.make();
    return q;
  });
  const quiet = 4;
  const sizes = qrs.map(q => (q.getModuleCount() + 2 * quiet) * scale);
  const width = sizes.reduce((a, b) => a + b, 0);
  const height = Math.max(...sizes);
  const data = new Uint8ClampedArray(width * height * 4).fill(255);
  let ox = 0;
  qrs.forEach((q, i) => {
    const n = q.getModuleCount();
    for (let r = 0; r < n; r++)
      for (let c = 0; c < n; c++) {
        if (!q.isDark(r, c)) continue;
        for (let dy = 0; dy < scale; dy++)
          for (let dx = 0; dx < scale; dx++) {
            const p = ((r + quiet) * scale + dy) * width + ox + (c + quiet) * scale + dx;
            data[p * 4] = data[p * 4 + 1] = data[p * 4 + 2] = 0;
          }
      }
    ox += sizes[i];
  });
  return { width, height, data, colorSpace: 'srgb' };
}

test('a real picture: ZXing (vendored) finds both codes and the invoice comes out whole', async () => {
  const zx = await import('../public/vendor/zxing/reader/index.js');
  zx.setZXingModuleOverrides({ wasmBinary: readFileSync(new URL('../public/vendor/zxing/reader/zxing_reader.wasm', import.meta.url)) });
  const left = `${head}:**********:1:2:1:鮮奶茶:1:65`;
  const found = await zx.readBarcodes(picture([left, '**:蛋餅:1:40']), { formats: ['QRCode'], tryHarder: true, maxNumberOfSymbols: 12 });
  assert.equal(found.length, 2);
  const [inv] = Q.invoicesOf(found.map(r => ({ bytes: r.bytes, x: r.position.topLeft.x, y: r.position.topLeft.y })));
  assert.equal(inv.no, 'AB12345678');
  assert.equal(inv.total, 105);
  assert.deepEqual(inv.items.map(i => i.name), ['鮮奶茶', '蛋餅']);
});
