// The camera on a paper 發票: both QR codes read (the left one has the number,
// day, amounts, seller and the first items; the right one the rest of the
// items), or a photo of it. BarcodeDetector where the browser has one, else
// jsQR (vendor/, loaded only here) on the frame and on each half, since it
// finds one code at a time. Resolves the invoice (lib/invoice.mjs), or null.
import { h, icons, tick } from '#kit/ui.mjs';
import { parseLeft, parseRight, joinQr, qrText, qrEncoding, isLeft, isRight } from '../lib/invoice.mjs';
import { W } from '../shell.mjs';

const EVERY_MS = 140;
// After the left code, the right one is waited for this long (when the left says items follow).
const RIGHT_WAIT_MS = 2500;
const MAX_SIDE = 1100;

let jsQR = null;
const detector = (() => {
  try {
    return 'BarcodeDetector' in globalThis ? new globalThis.BarcodeDetector({ formats: ['qr_code'] }) : null;
  } catch {
    return null;
  }
})();

// Every QR code in a picture (a canvas), as { text, bytes }.
async function readCodes(canvas) {
  if (detector) {
    try {
      const found = await detector.detect(canvas);
      if (found.length) return found.map(f => ({ text: f.rawValue, bytes: null }));
    } catch {}
  }
  jsQR ||= (await import('../vendor/jsqr.mjs')).default;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  const { width: w, height: hgt } = canvas;
  const out = [];
  for (const [x, cw] of [[0, w], [0, Math.round(w * 0.55)], [Math.round(w * 0.45), w - Math.round(w * 0.45)]]) {
    const img = ctx.getImageData(x, 0, cw, hgt);
    const r = jsQR(img.data, cw, hgt, { inversionAttempts: 'dontInvert' });
    if (r) out.push({ text: r.data, bytes: r.binaryData });
  }
  return out;
}

// The invoice in a picture (both its QR codes read where both show), or null:
// free, on the phone (讀圖 tries this before anything goes to Gemini).
export async function invoiceInPicture(blob) {
  const img = await createImageBitmap(blob, { imageOrientation: 'from-image' });
  const canvas = document.createElement('canvas');
  const k = Math.min(1, MAX_SIDE / Math.max(img.width, img.height));
  canvas.width = Math.round(img.width * k);
  canvas.height = Math.round(img.height * k);
  canvas.getContext('2d', { willReadFrequently: true }).drawImage(img, 0, 0, canvas.width, canvas.height);
  let left = null;
  let right = null;
  for (const c of await readCodes(canvas)) {
    const text = c.bytes ? qrText(c.bytes) : c.text;
    if (!left && isLeft(text)) {
      const enc = qrEncoding(text);
      left = parseLeft(c.bytes && enc === 'big5' ? qrText(c.bytes, 'big5') : text);
    } else if (!right && isRight(text)) right = c;
  }
  return left ? joinQr(left, right ? parseRight(qrText(right.bytes || right.text, left.enc), left.enc) : []) : null;
}

export function openScanner() {
  return new Promise(resolve => {
    let left = null;
    let leftAt = 0;
    let right = null;
    let stream = null;
    let timer = 0;
    let done = false;
    const video = h('video', { class: 'mn-scan-v', playsinline: '', muted: '', autoplay: '' });
    const canvas = h('canvas');
    const status = h('p', { class: 'mn-scan-status', text: W('對準發票上的兩個 QR code', 'Point at the invoice’s two QR codes') });
    const chip = (label, on) => h('span', { class: `mn-scan-chip${on ? ' on' : ''}` }, [on ? h('span', { html: icons.check }) : null, label]);
    const chips = h('div', { class: 'mn-scan-chips' });
    const paintChips = () => chips.replaceChildren(chip(W('左邊 QR', 'Left QR'), Boolean(left)), chip(W('右邊 QR', 'Right QR'), Boolean(right) || (left && !left.more)));
    paintChips();
    const file = h('input', { type: 'file', accept: 'image/*', hidden: '' });
    const fromPhoto = h('button', { class: 'q-btn glass mn-scan-photo', type: 'button', onclick: () => file.click() }, [h('span', { html: icons.camera }), W('從照片', 'From a photo')]);
    const close = h('button', { class: 'q-close mn-scan-x', type: 'button', 'aria-label': W('關閉', 'Close'), text: '✕', onclick: () => finish(null) });
    const d = h('dialog', { class: 'mn-scan', 'aria-label': W('掃描發票', 'Scan an invoice') }, [video, h('div', { class: 'mn-scan-frame', 'aria-hidden': 'true' }, [h('i'), h('i')]), h('div', { class: 'mn-scan-top' }, [close]), h('div', { class: 'mn-scan-foot' }, [status, chips, fromPhoto, file])]);
    d.addEventListener('cancel', e => (e.preventDefault(), finish(null)));
    document.body.append(d);
    d.showModal();

    function finish(result) {
      if (done) return;
      done = true;
      clearTimeout(timer);
      for (const t of stream?.getTracks() || []) t.stop();
      d.close();
      d.remove();
      resolve(result);
    }
    const result = () => joinQr(left, right ? parseRight(qrText(right.bytes || right.text, left.enc), left.enc) : []);
    // What a picture's codes add; true once there's enough to finish.
    function take(codes) {
      for (const c of codes) {
        const text = c.bytes ? qrText(c.bytes) : c.text;
        if (!left && isLeft(text)) {
          const enc = qrEncoding(text);
          const parsed = parseLeft(c.bytes && enc === 'big5' ? qrText(c.bytes, 'big5') : text);
          if (parsed) {
            left = parsed;
            leftAt = Date.now();
            tick();
          }
        } else if (!right && isRight(text)) right = c;
      }
      paintChips();
      if (left) status.textContent = left.more && !right ? W('再對準右邊的 QR code', 'Now the right QR code') : W('讀到了', 'Got it');
      return Boolean(left && (right || !left.more || Date.now() - leftAt > RIGHT_WAIT_MS));
    }
    function draw(src, w, hgt) {
      const s = Math.min(1, MAX_SIDE / Math.max(w, hgt));
      canvas.width = Math.round(w * s);
      canvas.height = Math.round(hgt * s);
      canvas.getContext('2d', { willReadFrequently: true }).drawImage(src, 0, 0, canvas.width, canvas.height);
    }
    async function frame() {
      if (done) return;
      if (video.readyState >= 2 && video.videoWidth) {
        draw(video, video.videoWidth, video.videoHeight);
        try {
          if (take(await readCodes(canvas))) return finish(result());
        } catch {}
      }
      timer = setTimeout(frame, EVERY_MS);
    }
    file.addEventListener('change', async () => {
      const f = file.files?.[0];
      if (!f) return;
      try {
        const img = await createImageBitmap(f, { imageOrientation: 'from-image' });
        draw(img, img.width, img.height);
        take(await readCodes(canvas));
        if (left) return finish(result());
        status.textContent = W('照片裡找不到發票的 QR code', 'No invoice QR code in that photo');
      } catch {
        status.textContent = W('這張照片打不開', 'That photo couldn’t be opened');
      }
    });
    navigator.mediaDevices
      ?.getUserMedia({ video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } }, audio: false })
      .then(s => {
        if (done) return s.getTracks().forEach(t => t.stop());
        stream = s;
        video.srcObject = s;
        video.play().catch(() => {});
        frame();
      })
      .catch(() => {
        status.textContent = W('沒有相機權限：可以改用照片', 'No camera access: use a photo instead');
        d.classList.add('nocam');
      }) ?? ((status.textContent = W('這台裝置沒有相機：可以改用照片', 'No camera here: use a photo instead')), d.classList.add('nocam'));
  });
}
