// The pictures of where money is: an account's logo (its brand's, else its
// kind's tile), and a way to pay's (Apple Pay, LINE Pay… their own logo; a
// debit or credit card its card tile). Shared by the accounts, the entry
// sheet's 付款方式 and a repeat's.
import { h, tile } from '#kit/ui.mjs';
import { glyph } from '../lib/cats.mjs';
import { LOGOS } from '../lib/logos.mjs';
import { KINDS, logoFor, acct, card } from '../shell.mjs';

const img = (src, size, fallback) => {
  const i = h('img', { src, alt: '', width: String(size), height: String(size), loading: 'lazy', decoding: 'async' });
  i.addEventListener('error', () => i.parentNode?.replaceWith(fallback()), { once: true });
  return h('span', { class: 'mn-logo', style: `--s:${size}px` }, [i]);
};
const kindTile = (kind, size) => {
  const k = KINDS[kind] || KINDS.other;
  const t = tile(glyph(k.icon), k.color);
  if (size < 40) t.style.cssText += `;width:${size}px;height:${size}px;border-radius:${Math.round(size * 0.3)}px`;
  return t;
};

// An account's picture: its brand's logo, else its kind's tile.
export function acctTile(a, size = 40) {
  const src = logoFor(a);
  return src ? img(src, size, () => kindTile(a?.kind, size)) : kindTile(a?.kind, size);
}

// A way to pay by its name: the wallet's own logo id, '' for a plain card.
const METHOD_LOGO = { 'Apple Pay': 'applepay', 'Google Pay': 'googlepay', 'Samsung Pay': 'samsungpay', 'LINE Pay': 'linepay', 街口支付: 'jkopay', 全支付: 'pxpay' };
export const methodLogo = name => {
  const id = METHOD_LOGO[String(name || '').trim()];
  return id && LOGOS.has(id) ? `./img/brand/${id}.png` : '';
};
export function methodTile(name, size = 40) {
  const src = methodLogo(name);
  const plain = () => {
    const t = tile(glyph('card'), '#0088ff');
    if (size < 40) t.style.cssText += `;width:${size}px;height:${size}px;border-radius:${Math.round(size * 0.3)}px`;
    return t;
  };
  return src ? img(src, size, plain) : plain();
}

// How one is paid: the way to pay's picture, else its account's.
export const payPic = (a, via, size = 40) => (via && card(via) ? methodTile(card(via).name, size) : acctTile(acct(a), size));
