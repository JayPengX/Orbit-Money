// The pictures of where money is: an account's logo (its brand's, else its
// kind's tile), and a way to pay's (Apple Pay, LINE Pay… their own logo; a
// debit or credit card its network's mark, Visa, Mastercard…, else its card
// tile). Shared by the accounts, the entry sheet's 付款方式 and a repeat's.
import { h, tile } from '#kit/ui.mjs';
import { glyph } from '../lib/cats.mjs';
import { LOGOS } from '../lib/logos.mjs';
import { networkLogo, netOfCard } from '../lib/networks.mjs';
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

// A card network's mark (Visa, Mastercard…), the card shape on a square of `size`.
export function netTile(id, size = 40) {
  return h('span', { class: 'mn-net', style: `--s:${size}px` }, [h('img', { src: networkLogo(id), alt: '', loading: 'lazy', decoding: 'async' })]);
}
// A bank's or a wallet's picture with the card's network in its corner (from
// 36 px up: any smaller and the mark can't be read).
const withNet = (pic, net, size) => (net && size >= 36 ? h('span', { class: 'mn-has-net', style: `--s:${size}px` }, [pic, h('img', { class: 'mn-net-badge', src: networkLogo(net), alt: '', decoding: 'async' })]) : pic);

// An account's picture: its brand's logo, else its kind's tile. A credit
// card's network in the corner; a credit card of no bank shows its network.
export function acctTile(a, size = 40) {
  const src = logoFor(a);
  const net = a?.kind === 'credit' ? netOfCard(null, a) : '';
  if (!src && net) return netTile(net, size);
  return withNet(src ? img(src, size, () => kindTile(a?.kind, size)) : kindTile(a?.kind, size), net, size);
}

// A sub with its own logo instead of its category's tile: TPASS 行政院通勤月票
// (its wordmark from tpass.tw) and YouBike (its wordmark from youbike.com.tw), on a
// white plate. `size`: the tile's.
const SUB_LOGO = { 'transport:tpass': 'tpass', 'transport:youbike': 'youbike' };
export function whatTile(look, sub, size = 40) {
  const id = SUB_LOGO[sub];
  const plain = () => tile(glyph(look.icon), look.color);
  return id && LOGOS.has(id) ? img(`./img/brand/${id}.png`, size, plain) : plain();
}

// A way to pay by its name: the wallet's own logo id, '' for a plain card.
const METHOD_LOGO = { 'Apple Pay': 'applepay', 'Google Pay': 'googlepay', 'Samsung Pay': 'samsungpay', 'LINE Pay': 'linepay', 街口支付: 'jkopay', 全支付: 'pxpay' };
export const methodLogo = name => {
  const id = METHOD_LOGO[String(name || '').trim()];
  return id && LOGOS.has(id) ? `./img/brand/${id}.png` : '';
};
// net: the card's network (netOfCard): a plain card shows its mark, a wallet
// on the card has it in the corner.
export function methodTile(name, size = 40, net = '') {
  const src = methodLogo(name);
  if (!src && net) return netTile(net, size);
  const plain = () => {
    const t = tile(glyph('card'), '#0088ff');
    if (size < 40) t.style.cssText += `;width:${size}px;height:${size}px;border-radius:${Math.round(size * 0.3)}px`;
    return t;
  };
  return src ? withNet(img(src, size, plain), net, size) : plain();
}
export const cardTile = (c, size = 40) => methodTile(c.name, size, netOfCard(c, acct(c.acct)));

// How one is paid: the way to pay's picture, else its account's.
export const payPic = (a, via, size = 40) => (via && card(via) ? cardTile(card(via), size) : acctTile(acct(a), size));
