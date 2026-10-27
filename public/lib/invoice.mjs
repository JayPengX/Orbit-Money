// 統一發票: the two QR codes on a paper 電子發票證明聯, its prize in a draw,
// and the 手機條碼 (載具) as the barcode a cashier scans. Pure, tested directly.
//
// The left QR (財政部's 電子發票證明聯 spec): 77 characters, then ':'-separated
//   0–9 字軌號碼 · 10–16 民國 yyyMMdd · 17–20 隨機碼 · 21–28 銷售額 (hex) ·
//   29–36 總計額 (hex) · 37–44 買方統編 · 45–52 賣方統編 · 53–76 加密驗證
//   :自行使用區:品目筆數:總筆數:中文編碼 (0 Big5, 1 UTF-8, 2 Base64):品名:數量:單價:…
// The right QR: '**' and more 品名:數量:單價.

const HEAD = /^([A-Z]{2}\d{8})(\d{7})(\d{4})([0-9a-fA-F]{8})([0-9a-fA-F]{8})(\d{8})(\d{8})/;

// QR bytes as text: the header is ASCII, the items in the invoice's own
// encoding (Big5 on many tills).
export function qrText(bytes, enc = 'utf-8') {
  if (typeof bytes === 'string') return bytes;
  try {
    return new TextDecoder(enc === 'big5' ? 'big5' : 'utf-8', { fatal: false }).decode(bytes instanceof Uint8Array ? bytes : Uint8Array.from(bytes));
  } catch {
    return new TextDecoder().decode(Uint8Array.from(bytes));
  }
}
// The encoding a left QR says its items are in ('big5' | 'utf-8' | 'base64').
export function qrEncoding(text) {
  const p = String(text).split(':');
  return { 0: 'big5', 1: 'utf-8', 2: 'base64' }[p[4]] || 'utf-8';
}
const utf8FromB64 = s => {
  try {
    return new TextDecoder().decode(Uint8Array.from(atob(s), c => c.charCodeAt(0)));
  } catch {
    return s;
  }
};
// name:qty:price triples → [{ name, qty, price }].
function itemsOf(parts, base64) {
  const out = [];
  for (let i = 0; i + 2 < parts.length; i += 3) {
    const name = (base64 ? utf8FromB64(parts[i]) : parts[i]).trim();
    const qty = Number(parts[i + 1]);
    const price = Number(parts[i + 2]);
    if (!name || !Number.isFinite(qty) || !Number.isFinite(price)) continue;
    out.push({ name, qty, price });
  }
  return out;
}

// Is it a left QR? (a right one starts with '**')
export const isLeft = text => HEAD.test(String(text || ''));
export const isRight = text => String(text || '').startsWith('**');

// A left QR's invoice: { no, day, rand, total, untaxed, buyer, sid, items, more }
// (more: items to come in the right QR). null if it isn't one.
export function parseLeft(text) {
  const s = String(text || '');
  const m = HEAD.exec(s);
  if (!m) return null;
  const roc = m[2];
  const y = Number(roc.slice(0, 3)) + 1911;
  const day = `${y}-${roc.slice(3, 5)}-${roc.slice(5, 7)}`;
  if (!/^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.test(day)) return null;
  const parts = s.slice(77).split(':');
  // parts[0] is what's left of the 77 (nothing), then 自行使用區, 筆數, 總筆數, 編碼.
  const enc = { 0: 'big5', 1: 'utf-8', 2: 'base64' }[parts[4]] || 'utf-8';
  const items = itemsOf(parts.slice(5), enc === 'base64');
  const inQr = Number(parts[2]);
  const all = Number(parts[3]);
  return {
    no: m[1],
    day,
    rand: m[3],
    untaxed: parseInt(m[4], 16),
    total: parseInt(m[5], 16),
    buyer: m[6] === '00000000' ? '' : m[6],
    sid: m[7],
    items,
    more: Number.isFinite(all) && Number.isFinite(inQr) ? all > items.length : false,
    enc
  };
}
// A right QR's items.
export function parseRight(text, enc = 'utf-8') {
  const s = String(text || '');
  if (!isRight(s)) return [];
  return itemsOf(s.slice(2).replace(/^:/, '').split(':'), enc === 'base64');
}
// The two read together: the left's invoice with the right's items after its own.
export const joinQr = (left, rightItems = []) => (left ? { ...left, items: [...left.items, ...rightItems], more: false } : null);

// ---- The draw --------------------------------------------------------------------

// The draw an invoice's day is in: '11507' (民國 year, the period's first, odd month).
export function periodOf(day) {
  const y = Number(day.slice(0, 4)) - 1911;
  const m = Number(day.slice(5, 7));
  return `${String(y).padStart(3, '0')}${String(m % 2 ? m : m - 1).padStart(2, '0')}`;
}
// When a period's numbers come out (the 25th after it ends) and the last day
// to claim (three months on: the 5th of the month after that).
export function periodDates(period) {
  const y = Number(period.slice(0, 3)) + 1911;
  const m = Number(period.slice(3, 5));
  const at = (yy, mm, dd) => {
    const t = new Date(Date.UTC(yy, mm - 1, dd));
    return t.toISOString().slice(0, 10);
  };
  return { draw: at(y, m + 2, 25), claimFrom: at(y, m + 3, 6), claimTo: at(y, m + 6, 5) };
}
// The prizes, as 財政部 pays them (NT$).
export const PRIZES = { special: 10_000_000, grand: 2_000_000, first: 200_000, second: 40_000, third: 10_000, fourth: 4_000, fifth: 1_000, sixth: 200 };
// An invoice's prize in its draw: { level, amt } or null. no: 'AB12345678'.
export function prizeOf(no, draw) {
  if (!draw || !/^[A-Z]{2}\d{8}$/.test(no || '')) return null;
  const n = no.slice(2);
  if (n === draw.special) return { level: 'special', amt: PRIZES.special };
  if (n === draw.grand) return { level: 'grand', amt: PRIZES.grand };
  const levels = ['first', 'second', 'third', 'fourth', 'fifth', 'sixth'];
  let best = null;
  for (const f of draw.first || []) {
    for (let k = 0; k < 6; k++) {
      if (n.slice(k) === f.slice(k)) {
        if (!best || k < levels.indexOf(best)) best = levels[k];
        break;
      }
    }
  }
  return best ? { level: best, amt: PRIZES[best] } : null;
}

// ---- 手機條碼 (載具) ----------------------------------------------------------------

// A 手機條碼: '/' and seven of 0–9, A–Z, '.', '-', '+'.
export const CARRIER = /^\/[0-9A-Z.+-]{7}$/;
export const cleanCarrier = s => String(s || '').trim().toUpperCase().replace(/^([^/])/, '/$1');

// Code 39 (what every Taiwan till reads off a 手機條碼): each character's nine
// elements, bar and space alternating, 1 for wide.
const C39 = {
  0: '000110100', 1: '100100001', 2: '001100001', 3: '101100000', 4: '000110001', 5: '100110000', 6: '001110000', 7: '000100101', 8: '100100100', 9: '001100100',
  A: '100001001', B: '001001001', C: '101001000', D: '000011001', E: '100011000', F: '001011000', G: '000001101', H: '100001100', I: '001001100', J: '000011100',
  K: '100000011', L: '001000011', M: '101000010', N: '000010011', O: '100010010', P: '001010010', Q: '000000111', R: '100000110', S: '001000110', T: '000010110',
  U: '110000001', V: '011000001', W: '111000000', X: '010010001', Y: '110010000', Z: '011010000', '-': '010000101', '.': '110000100', ' ': '011000100',
  '*': '010010100', $: '010101000', '/': '010100010', '+': '010001010', '%': '000101010'
};
// The bars as [x, width] runs in narrow units (wide = 3), from `*code*`.
export function code39Bars(code) {
  const bars = [];
  let x = 0;
  for (const ch of `*${code}*`) {
    const p = C39[ch];
    if (!p) throw new Error(`code39: ${ch}`);
    for (let i = 0; i < 9; i++) {
      const w = p[i] === '1' ? 3 : 1;
      if (i % 2 === 0) bars.push([x, w]);
      x += w;
    }
    x += 1;
  }
  return { bars, width: x - 1 };
}
// The barcode as SVG (black bars on a white strip: a scanner needs the contrast, dark mode or not).
export function code39Svg(code, { height = 70 } = {}) {
  const { bars, width } = code39Bars(code);
  const quiet = 10;
  const w = width + quiet * 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${height}" preserveAspectRatio="none" role="img" aria-label="${code}"><rect width="${w}" height="${height}" fill="#fff"/>${bars.map(([x, bw]) => `<rect x="${x + quiet}" y="0" width="${bw}" height="${height}" fill="#000"/>`).join('')}</svg>`;
}

// The 載具's own list (財政部's CSV export): the kit's, since the Worker reads
// the same file when it comes in by mail.
export { parseCarrierCsv, csvText, csvDay } from '#kit/carrier-csv.mjs';
