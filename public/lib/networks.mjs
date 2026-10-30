// The card networks a credit or debit card can be on (Visa, Mastercard…),
// each with its mark in img/network/<id>.svg. Picked on a credit card and on
// a card under an account (Jay 2026-10-30); shown wherever the card is.

export const NETWORKS = [
  { id: 'visa', zh: 'Visa', en: 'Visa' },
  { id: 'mastercard', zh: '萬事達', en: 'Mastercard' },
  { id: 'jcb', zh: 'JCB', en: 'JCB' },
  { id: 'amex', zh: '美國運通', en: 'American Express' },
  { id: 'unionpay', zh: '銀聯', en: 'UnionPay' },
  { id: 'diners', zh: '大來卡', en: 'Diners Club' },
  { id: 'discover', zh: 'Discover', en: 'Discover' }
];
const BY_ID = new Map(NETWORKS.map(n => [n.id, n]));
export const networkOf = id => BY_ID.get(id) || null;
export const networkLogo = id => (BY_ID.has(id) ? `./img/network/${id}.svg` : '');

// The network a card is on: its own, else (a card under a credit card: the
// physical card, Apple Pay on it) the credit card's. A debit card has its own
// only. '' when none was picked.
export function netOfCard(c, a) {
  if (c && BY_ID.has(c.net)) return c.net;
  return a?.kind === 'credit' && BY_ID.has(a.net) ? a.net : '';
}
