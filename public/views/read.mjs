// 讀圖: a picture of purchases brought in. An invoice's QR codes are read on
// the phone first (free, exact); anything else (a receipt, a 載具 or store
// app's screenshot, a bill) goes to Gemini only when the person taps for it
// (the Worker's money-read.js, a day's cap), and what it read is looked over
// before anything is saved.
import { h, sheet, toast } from '#kit/ui.mjs';
import { workerJson } from '#kit/orbit.mjs';
import { guessCat, glyph } from '../lib/cats.mjs';
import { state, W, today } from '../shell.mjs';
import { openEntry } from './entry.mjs';

const MAX_SIDE = 1600;

export function readPicture() {
  const file = h('input', { type: 'file', accept: 'image/*', hidden: '' });
  document.body.append(file);
  file.addEventListener('change', async () => {
    const f = file.files?.[0];
    file.remove();
    if (!f) return;
    try {
      const { invoiceInPicture } = await import('./scan.mjs');
      const inv = await invoiceInPicture(f);
      if (inv) return (await import('./invoices.mjs')).fromInvoice(inv);
    } catch {}
    askAi(f);
  });
  file.click();
}

// No invoice QR code in it: the picture, and the one tap that reads it.
function askAi(f) {
  const url = URL.createObjectURL(f);
  const left = state.readLeft;
  const go = h('button', { class: 'q-btn primary block', type: 'button' }, [h('span', { html: glyph('scan') }), W('用 AI 讀取', 'Read it with AI')]);
  const note = h('p', { class: 'mn-hint mn-read-note', text: left != null ? W(`今天還可以讀 ${left} 張`, `${left} left today`) : W('店家、日期、金額和品項會自動填好，記下前可以先看過。', 'Store, date, total and items filled in, for you to check before saving.') });
  const s = sheet({
    title: W('讀圖', 'Read a picture'),
    cls: 'mn-read',
    onClose: () => URL.revokeObjectURL(url),
    body: [h('img', { class: 'mn-read-img', src: url, alt: '' }), h('p', { class: 'mn-read-lede', text: W('這張沒有發票 QR code', 'No invoice QR code in this one') }), note],
    foot: h('div', { class: 'q-sheet-foot' }, [go])
  });
  go.onclick = async () => {
    go.disabled = true;
    go.replaceChildren(W('讀取中⋯', 'Reading…'));
    const r = await send(f);
    if (r?.left != null) state.readLeft = r.left;
    if (!r || r.error) {
      go.disabled = r?.error === 'cap';
      go.replaceChildren(W('再試一次', 'Try again'));
      note.textContent = r?.error === 'cap' ? W('今天的 AI 讀圖用完了，明天再來。', 'No more AI reads today; back tomorrow.') : W('這張沒有讀出來，可以再試一次。', 'That one didn’t read; try again.');
      return;
    }
    s.close();
    use(r.buys || []);
  };
}

async function send(f) {
  try {
    const img = await createImageBitmap(f, { imageOrientation: 'from-image' });
    const k = Math.min(1, MAX_SIDE / Math.max(img.width, img.height));
    const c = Object.assign(document.createElement('canvas'), { width: Math.round(img.width * k), height: Math.round(img.height * k) });
    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
    const data = c.toDataURL('image/jpeg', 0.85).split(',')[1];
    return await workerJson('/money-read', 'v=1', { body: JSON.stringify({ image: { mime_type: 'image/jpeg', data } }), timeout: 45_000, errors: true });
  } catch {
    return null;
  }
}

// What was read: one purchase opens as an entry to finish; several are looked
// over together (the 載具 file's list), then added.
async function use(buys) {
  if (!buys.length) return toast(W('圖裡沒有看到消費', 'No purchases in that picture'));
  const now = today();
  const list = buys.map(b => ({ no: b.invoice || '', day: b.day || now, sid: '', seller: b.store, total: b.total, items: b.items.map(i => ({ name: i.name, qty: 1, price: i.amt })), from: 'read' }));
  if (list.length === 1) {
    const [i] = list;
    const words = `${i.seller} ${i.items.map(x => x.name).join(' ')}`;
    return openEntry({ day: i.day, kind: 'out', amt: i.total, note: i.seller || i.items[0]?.name || '', cat: guessCat(words), inv: i.no ? { no: i.no, day: i.day, sid: '', seller: i.seller, total: i.total, items: i.items, from: 'read' } : null });
  }
  const { review } = await import('./carrier-import.mjs');
  review(list.sort((a, b) => a.day.localeCompare(b.day)), { title: W('讀到的消費', 'What was read'), what: W('這些都記過了。', 'All of these are already in.') });
}
