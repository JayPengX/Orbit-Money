// A paper 電子發票's two QR codes, read on the phone from the same picture
// 拍照記帳 takes (Jay 2026-11-10: "All yes", after 2026-10-31's no 發票
// features: nothing to tap or see, only a faster, exact read): the number,
// the day, the total and the items as the till printed them, with no AI
// call and no network but the seller's name. A picture with none (an app's
// screenshot, a bill, a price tag) still goes to the AI as before.
//
// The left QR (財政部's 電子發票證明聯 spec, ver 1.9): 77 characters, then ':'-separated
//   0–9 字軌號碼 · 10–16 民國 yyyMMdd · 17–20 隨機碼 · 21–28 銷售額 (hex) ·
//   29–36 總計額 (hex) · 37–44 買方統編 · 45–52 賣方統編 · 53–76 加密驗證
//   :自行使用區:品目筆數:總筆數:中文編碼 (0 Big5, 1 UTF-8, 2 Base64):品名:數量:單價:…
// The right QR: '**' and more 品名:數量:單價.
// Decoding: ZXing (zxing-cpp built to WebAssembly, `vendor/zxing`, MIT),
// loaded only when a picture is read; iPhone's Safari has no barcode reader
// of its own (no BarcodeDetector).

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
export const qrEncoding = text => ({ 0: 'big5', 1: 'utf-8', 2: 'base64' })[String(text).slice(77).split(':')[4]] || 'utf-8';
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

export const isLeft = text => HEAD.test(String(text || ''));
export const isRight = text => String(text || '').startsWith('**');

// A left QR's invoice: { no, day, rand, total, untaxed, buyer, sid, items, enc }, or null.
export function parseLeft(text) {
  const s = String(text || '');
  const m = HEAD.exec(s);
  if (!m) return null;
  const roc = m[2];
  const day = `${Number(roc.slice(0, 3)) + 1911}-${roc.slice(3, 5)}-${roc.slice(5, 7)}`;
  if (!/^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.test(day)) return null;
  const parts = s.slice(77).split(':');
  const enc = { 0: 'big5', 1: 'utf-8', 2: 'base64' }[parts[4]] || 'utf-8';
  return {
    no: m[1],
    day,
    rand: m[3],
    untaxed: parseInt(m[4], 16),
    total: parseInt(m[5], 16),
    buyer: m[6] === '00000000' ? '' : m[6],
    sid: m[7],
    items: itemsOf(parts.slice(5), enc === 'base64'),
    enc
  };
}
export function parseRight(text, enc = 'utf-8') {
  const s = String(text || '');
  return isRight(s) ? itemsOf(s.slice(2).replace(/^:/, '').split(':'), enc === 'base64') : [];
}

// Every invoice among a picture's QR codes ([{ bytes | text, x, y }]): each
// left with the right beside it (its items after the left's own), the same
// invoice twice (two pictures of it, a repeat read) once.
export function invoicesOf(codes) {
  const rows = codes.map(c => {
    const raw = c.bytes ? qrText(c.bytes) : String(c.text || '');
    return { ...c, raw, left: isLeft(raw), right: isRight(raw) };
  });
  const rights = rows.filter(r => r.right);
  const out = [];
  for (const l of rows.filter(r => r.left)) {
    const text = l.bytes ? qrText(l.bytes, qrEncoding(l.raw)) : l.raw;
    const inv = parseLeft(text);
    if (!inv || out.some(x => x.no === inv.no)) continue;
    // The right QR: the nearest one to its right, about level with it.
    const r = rights.filter(x => x.x > l.x && Math.abs(x.y - l.y) < Math.max(40, (x.x - l.x) * 0.5)).sort((a, b) => a.x - l.x - (b.x - l.x))[0];
    if (r) {
      rights.splice(rights.indexOf(r), 1);
      inv.items.push(...parseRight(r.bytes ? qrText(r.bytes, inv.enc) : r.raw, inv.enc));
    }
    out.push(inv);
  }
  return out;
}

// A seller's registered name as people say it: the company form off
// ("股份有限公司"…), the chains by the name on their signs.
const CHAINS = [
  [/^統一超商/, '7-ELEVEN'],
  [/^全家便利商店/, '全家'],
  [/^萊爾富/, '萊爾富'],
  [/^來來超商/, 'OK 超商'],
  [/^全聯實業/, '全聯'],
  [/^統一星巴克/, '星巴克'],
  [/^家福/, '家樂福'],
  [/^好市多/, 'Costco'],
  [/^台灣麥當勞|^和德昌/, '麥當勞'],
  [/^富胖達/, 'foodpanda'],
  [/^優食台灣/, 'Uber Eats'],
  [/^路易莎/, '路易莎'],
  [/^寶雅/, '寶雅'],
  [/^台灣屈臣氏|^屈臣氏/, '屈臣氏'],
  [/^康是美|^統一藥品/, '康是美'],
  [/^美廉社|^三商家購/, '美廉社']
];
export function shortSeller(name) {
  const n = String(name || '').trim();
  for (const [re, short] of CHAINS) if (re.test(n)) return short;
  return n
    .replace(/(股份有限公司|有限公司|無限公司|企業社|商行)(.*分公司)?$/, '')
    .trim();
}

// The invoices in a picture (ImageData), or [] when it has none or ZXing
// can't load (the AI reads it then).
let zx = null;
export async function readInvoices(image) {
  try {
    if (!zx) {
      zx = await import('../vendor/zxing/reader/index.js');
      const wasm = new URL('../vendor/zxing/reader/zxing_reader.wasm', import.meta.url).href;
      zx.setZXingModuleOverrides({ locateFile: (path, prefix) => (path.endsWith('.wasm') ? wasm : prefix + path) });
    }
    const found = await zx.readBarcodes(image, { formats: ['QRCode'], tryHarder: true, maxNumberOfSymbols: 12 });
    return invoicesOf(found.map(r => ({ bytes: r.bytes, x: Math.min(r.position.topLeft.x, r.position.bottomLeft.x), y: Math.min(r.position.topLeft.y, r.position.topRight.y) })));
  } catch {
    return [];
  }
}
