// Another app's books brought in as past history: 天天記帳's CSV export
// (日期,類別,大類別,金額,幣別,成員,帳戶,標籤,備註,收支區分,上次更新,UUID).
// History only: an entry is tied to no account (`a: ''`, the old account's
// name kept as `old`), so it shows in 月曆 and 統計 and never moves a
// balance (that app's accounts were renamed, deleted, and cash left out).
// Its invoices (a note 天天記帳 wrote from the 載具: items, the day, the
// seller, '#電子發票號碼: XX12345678') come along for 對獎. Each entry is
// 'tt-<UUID>', so a second import adds nothing. Pure, tested.
import { parseCsvRows } from '#kit/carrier-csv.mjs';

export const SOURCE = '天天記帳';
const HEAD = ['日期', '類別', '金額', '收支區分', 'UUID'];

// Its categories, by 大類別 then 類別, as Orbit Money's (cats.mjs); a sub-category
// that says more than the category is kept as the entry's note.
const OUT_BY_GROUP = { 飲食: 'food', 交通: 'transport' };
const OUT_BY_NAME = { 休閒: 'fun', 其他: 'other', 國外交易手續費: 'tax', 轉帳手續費: 'tax', 數位服務: 'fun', 日常: 'daily' };
const IN_BY_GROUP = { 爸媽: 'allowance' };
const IN_BY_NAME = { 利息: 'invest', 其他: 'otherin' };

export const isTiantian = text => HEAD.every(h => String(text || '').slice(0, 400).includes(h));

// One note's 載具 invoice, or null: { no, day, seller, items, rest }.
export function noteInvoice(note) {
  const s = String(note || '');
  const no = /#電子發票號碼:\s*([A-Z]{2}\d{8})/.exec(s)?.[1];
  if (!no) return null;
  const lines = s.split(/\r?\n/).map(l => l.trim());
  const items = [];
  let day = '';
  let seller = '';
  for (const [i, l] of lines.entries()) {
    const m = /^(.*\S)\s+(\d+(?:\.\d+)?)\*(-?\d+(?:\.\d+)?)=(-?\d+(?:\.\d+)?)$/.exec(l);
    if (m) items.push({ name: m[1], qty: Number(m[2]), price: Number(m[3]) });
    const d = /^(\d{4})年(\d{1,2})月(\d{1,2})日/.exec(l);
    if (d) {
      day = `${d[1]}-${d[2].padStart(2, '0')}-${d[3].padStart(2, '0')}`;
      seller = lines[i + 1] && !lines[i + 1].startsWith('#') ? lines[i + 1] : '';
    }
  }
  return { no, day, seller, items };
}

function catOfRow(r, inc) {
  const group = r['大類別'];
  const name = r['類別'];
  const note = r['備註'] || '';
  if (inc) {
    if (IN_BY_GROUP[group]) return IN_BY_GROUP[group];
    if (IN_BY_NAME[name]) return IN_BY_NAME[name];
    // (Its own 「我」: gifts and wins, by what the note says.)
    if (/紅包|禮金/.test(note)) return 'redenv';
    if (/中獎/.test(note)) return 'prize';
    return 'otherin';
  }
  return OUT_BY_GROUP[group] || OUT_BY_NAME[name] || 'other';
}

// The file's rows as entries ({ id, d, k, amt, cat, note, a: '', old, inv, src }),
// oldest first. shorten(seller) makes a store's name short (invoices.mjs shortName).
export function tiantianEntries(text, { shorten = s => s } = {}) {
  const rows = parseCsvRows(String(text || '').replace(/^﻿/, ''));
  const head = rows.shift() || [];
  if (!HEAD.every(h => head.includes(h))) return [];
  const col = Object.fromEntries(head.map((h, i) => [h, i]));
  const out = [];
  for (const row of rows) {
    const r = Object.fromEntries(head.map(h => [h, (row[col[h]] ?? '').trim()]));
    const day = /^(\d{4})(\d{2})(\d{2})$/.exec(r['日期']);
    const amt = Number(r['金額']);
    if (!day || !Number.isFinite(amt) || !amt || !r.UUID || (r['幣別'] && r['幣別'] !== 'TWD')) continue;
    let inc = r['收支區分'] === '收';
    let cat = catOfRow(r, inc);
    // (A negative spend is money back.)
    if (amt < 0 && !inc) (inc = true), (cat = 'refund');
    const inv = noteInvoice(r['備註']);
    const seller = inv ? shorten(inv.seller) : '';
    const sub = r['類別'] && !['其他', '我'].includes(r['類別']) && r['類別'] !== r['大類別'] ? r['類別'] : '';
    const who = r['成員'] && r['成員'] !== '自己' ? r['成員'] : '';
    const said = inv ? seller : r['備註'].replace(/\s+/g, ' ');
    const note = [said || sub, who && `（${who}）`].filter(Boolean).join('');
    const d = `${day[1]}-${day[2]}-${day[3]}`;
    out.push({
      id: `tt-${r.UUID.toLowerCase()}`,
      d,
      k: inc ? 'in' : 'out',
      amt: Math.abs(Math.round(amt)),
      cat,
      note,
      a: '',
      via: '',
      to: '',
      old: r['帳戶'] || '',
      inv: inv ? { no: inv.no, day: inv.day || d, sid: '', seller, total: Math.abs(Math.round(amt)), items: inv.items, from: 'old' } : null,
      src: SOURCE
    });
  }
  return out.sort((a, b) => a.d.localeCompare(b.d));
}
