// The categories: spending's and income's, each with its tile (a glyph and
// a colour). Glyphs are the kit's icons where it has one, else this app's own
// on the same 24-unit grid with round 2px strokes.
import { icons as kitIcons } from '#kit/ui.mjs';
import { addDays } from '#kit/format.mjs';
import { put, drop, live, newId } from './books.mjs';

const g = d => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
// This app's glyphs (nothing else in the family draws these).
export const GLYPHS = {
  food: g('<path d="M7 3v8M4.5 3v5a2.5 2.5 0 0 0 5 0V3M7 11v10M17.5 21V3c-2.5 1.5-3.5 4.5-3.5 8h3.5"/>'),
  bag: g('<path d="M5.5 8h13l-1 12.5h-11zM9 8V6.5a3 3 0 0 1 6 0V8"/>'),
  basket: g('<path d="M3.5 10h17l-2 10h-13zM8 10l3-6M16 10l-3-6M9 14v3M15 14v3"/>'),
  bolt: g('<path d="M13 3 5.5 13.5H12L11 21l7.5-10.5H12z"/>'),
  phone: g('<rect x="7" y="2.5" width="10" height="19" rx="2.5"/><path d="M11 18.5h2"/>'),
  health: g('<rect x="3.5" y="3.5" width="17" height="17" rx="4"/><path d="M12 8v8M8 12h8"/>'),
  gift: g('<rect x="4" y="9" width="16" height="11.5" rx="1.5"/><path d="M3 9h18M12 9v11.5M12 9c-1.5-4-6-4-6-1.5S12 9 12 9zM12 9c1.5-4 6-4 6-1.5S12 9 12 9z"/>'),
  plane: g('<path d="M10.5 13.5 3 11l1.5-1.5 7.5 1 4.5-5a2 2 0 0 1 3 3l-5 4.5 1 7.5L14 22l-2.5-7.5L8 18v2.5L6.5 22 5 19l-3-1.5L3.5 16H6z"/>'),
  car: g('<path d="M4 16.5V12l2-5h12l2 5v4.5M4 16.5h16M4 16.5V19h3v-2.5M17 16.5V19h3v-2.5M4 12h16"/><circle cx="7.5" cy="14" r=".5"/><circle cx="16.5" cy="14" r=".5"/>'),
  paw: g('<circle cx="7" cy="9" r="1.8"/><circle cx="17" cy="9" r="1.8"/><circle cx="10" cy="5.5" r="1.8"/><circle cx="14" cy="5.5" r="1.8"/><path d="M12 12c-3 0-5.5 3.5-5.5 6 0 1.5 1.2 2.5 2.7 2.2 1-.2 1.8-.7 2.8-.7s1.8.5 2.8.7c1.5.3 2.7-.7 2.7-2.2 0-2.5-2.5-6-5.5-6z"/>'),
  baby: g('<circle cx="12" cy="12" r="8.5"/><path d="M9 10.5h.01M15 10.5h.01M9.5 15a3.5 3.5 0 0 0 5 0M12 3.5c-1 1.5-.5 3 1 3"/>'),
  receipt: g('<path d="M6 3h12v18l-2-1.5L14 21l-2-1.5L10 21l-2-1.5L6 21zM9 8h6M9 12h6M9 16h3"/>'),
  scan: g('<path d="M4 8V5.5A1.5 1.5 0 0 1 5.5 4H8M16 4h2.5A1.5 1.5 0 0 1 20 5.5V8M20 16v2.5a1.5 1.5 0 0 1-1.5 1.5H16M8 20H5.5A1.5 1.5 0 0 1 4 18.5V16M4 12h16"/>'),
  card: g('<rect x="3" y="5.5" width="18" height="13" rx="2.5"/><path d="M3 10h18M6.5 15h4"/>'),
  repeat: g('<path d="M4 11V9a3 3 0 0 1 3-3h12l-3-3M20 13v2a3 3 0 0 1-3 3H5l3 3"/>'),
  target: kitIcons.target,
  mail: g('<path d="M3.5 6.5h17v11h-17zM3.5 7l8.5 6.5L20.5 7"/>'),
  barcode: g('<path d="M4 5v14M7 5v14M10.5 5v14M13 5v14M16.5 5v14M20 5v14"/>')
};
const icon = name => GLYPHS[name] || kitIcons[name] || kitIcons.grid;

// Spending. `subs`: the finer kinds most people keep apart (Jay 2026-10-27:
// 餐飲 into meals, his monthly TPASS under 交通), each picked or not.
const S = (cat, list) => list.map(([key, zh, en]) => ({ id: `${cat}:${key}`, zh, en, parent: cat }));
export const OUT = [
  { id: 'food', zh: '餐飲', en: 'Food', icon: 'food', color: '#ff8d28', subs: S('food', [['breakfast', '早餐', 'Breakfast'], ['lunch', '午餐', 'Lunch'], ['dinner', '晚餐', 'Dinner'], ['late', '宵夜', 'Late night'], ['snack', '點心', 'Snacks'], ['out', '聚餐', 'Eating out']]) },
  { id: 'drink', zh: '飲料', en: 'Drinks', icon: 'cup', color: '#ac7f5e', subs: S('drink', [['coffee', '咖啡', 'Coffee'], ['tea', '手搖飲', 'Bubble tea']]) },
  // (The family's Orbit Transit: TPASS and every way it rides.)
  { id: 'transport', zh: '交通', en: 'Transport', icon: 'bus', color: '#0088ff', subs: S('transport', [['tpass', 'TPASS', 'TPASS'], ['mrt', '捷運', 'MRT'], ['bus', '公車', 'Bus'], ['youbike', 'YouBike', 'YouBike'], ['thsr', '高鐵', 'High-speed rail'], ['tra', '台鐵', 'Railway'], ['coach', '客運', 'Coach'], ['taxi', '計程車', 'Taxi']]) },
  { id: 'shop', zh: '購物', en: 'Shopping', icon: 'bag', color: '#ff2d55', subs: S('shop', [['clothes', '服飾', 'Clothes'], ['tech', '3C', 'Tech'], ['online', '網購', 'Online'], ['beauty', '美妝', 'Beauty']]) },
  { id: 'daily', zh: '日用品', en: 'Household', icon: 'basket', color: '#00c3d0', subs: S('daily', [['grocery', '超市', 'Groceries'], ['supplies', '生活用品', 'Supplies'], ['stationery', '文具', 'Stationery']]) },
  { id: 'home', zh: '居住', en: 'Housing', icon: 'home', color: '#6155f5', subs: S('home', [['rent', '房租', 'Rent'], ['fee', '管理費', 'Building fee'], ['loan', '房貸', 'Mortgage'], ['fix', '修繕', 'Repairs']]) },
  { id: 'bills', zh: '水電瓦斯', en: 'Utilities', icon: 'bolt', color: '#e3a008', subs: S('bills', [['power', '電費', 'Power'], ['water', '水費', 'Water'], ['gas', '瓦斯', 'Gas']]) },
  { id: 'phone', zh: '通訊', en: 'Phone', icon: 'phone', color: '#34c759', subs: S('phone', [['mobile', '手機', 'Mobile'], ['net', '網路', 'Internet']]) },
  { id: 'fun', zh: '娛樂', en: 'Fun', icon: 'tv', color: '#cb30e0', subs: S('fun', [['movie', '電影', 'Movies'], ['show', '展演', 'Shows'], ['ktv', 'KTV', 'KTV']]) },
  // (Jay 2026-10-27: a domain, Claude Pro, Cloudflare's plan, TDX's quota,
  // games. Then: what keeps things running and what's for fun are "really
  // different", so the tools come first and 影音串流 and 遊戲 stand apart;
  // 統計 shows each sub on its own. `subs` was 訂閱 until then.)
  { id: 'digital', zh: '數位', en: 'Digital', icon: 'cloud', color: '#5e5ce6', subs: S('digital', [['ai', 'AI', 'AI'], ['cloud', '雲端網域', 'Cloud'], ['apps', '軟體', 'Apps'], ['subs', '影音串流', 'Media'], ['games', '遊戲', 'Games']]) },
  { id: 'health', zh: '醫療', en: 'Health', icon: 'health', color: '#ff383c', subs: S('health', [['clinic', '看診', 'Doctor'], ['meds', '藥品', 'Medicine'], ['dental', '牙醫', 'Dentist']]) },
  { id: 'learn', zh: '學習', en: 'Learning', icon: 'book', color: '#00c8b3', subs: S('learn', [['books', '書', 'Books'], ['class', '課程', 'Classes']]) },
  { id: 'social', zh: '人情', en: 'Gifts', icon: 'gift', color: '#f59e0b', subs: S('social', [['gift', '禮物', 'Gifts'], ['redenv', '紅包', 'Red envelopes'], ['treat', '請客', 'Treating']]) },
  { id: 'car', zh: '汽機車', en: 'Vehicle', icon: 'car', color: '#64748b', subs: S('car', [['fuel', '加油', 'Fuel'], ['park', '停車', 'Parking'], ['toll', 'ETC', 'Tolls'], ['service', '保養', 'Service']]) },
  { id: 'travel', zh: '旅遊', en: 'Travel', icon: 'plane', color: '#0ea5e9', subs: S('travel', [['stay', '住宿', 'Stay'], ['ticket', '機票車票', 'Tickets'], ['tour', '行程', 'Activities']]) },
  { id: 'pet', zh: '寵物', en: 'Pets', icon: 'paw', color: '#a16207', subs: [] },
  { id: 'kids', zh: '育兒', en: 'Kids', icon: 'baby', color: '#ec4899', subs: [] },
  { id: 'insure', zh: '保險', en: 'Insurance', icon: 'shield', color: '#475569', subs: [] },
  // (手續費: an entry's own fee is counted here, books.mjs FEE.)
  { id: 'tax', zh: '稅費', en: 'Tax & fees', icon: 'bank', color: '#78716c', subs: S('tax', [['fee', '手續費', 'Fees'], ['tax', '稅金', 'Taxes'], ['fine', '罰單', 'Fines']]) },
  { id: 'other', zh: '其他', en: 'Other', icon: 'grid', color: '#8e8e93', subs: [] }
];
// Income.
export const IN = [
  { id: 'salary', zh: '薪水', en: 'Salary', icon: 'wallet', color: '#16a34a', subs: [] },
  { id: 'bonus', zh: '獎金', en: 'Bonus', icon: 'spark', color: '#eab308', subs: [] },
  { id: 'invest', zh: '投資', en: 'Investing', icon: 'chart', color: '#0d9488', subs: S('invest', [['dividend', '股利', 'Dividends'], ['interest', '利息', 'Interest'], ['gain', '買賣', 'Gains']]) },
  { id: 'side', zh: '兼職', en: 'Side work', icon: 'work', color: '#2563eb', subs: [] },
  { id: 'allowance', zh: '零用錢', en: 'Allowance', icon: 'coin', color: '#65a30d', subs: [] },
  { id: 'redenv', zh: '紅包', en: 'Red envelope', icon: 'gift', color: '#dc2626', subs: [] },
  // (No 退款: money back comes off what it was for, Jay 2026-10-27.)
  { id: 'cashback', zh: '回饋', en: 'Cashback', icon: 'star', color: '#0891b2', subs: S('cashback', [['points', '點數', 'Points'], ['cash', '現金回饋', 'Cash back']]) },
  { id: 'prize', zh: '中獎', en: 'Prize', icon: 'trophy', color: '#f59e0b', subs: [] },
  // A card's 自動加值 paid by nobody in the books (a parent's card): its own, not 其他 (Jay 2026-10-29).
  { id: 'topup', zh: '自動加值', en: 'Auto top-up', icon: 'swap', color: '#0ea5e9', subs: [] },
  { id: 'otherin', zh: '其他', en: 'Other', icon: 'grid', color: '#8e8e93', subs: [] }
];
const BUILT = new Map([...OUT, ...IN].flatMap(c => [[c.id, { ...c, k: IN.includes(c) ? 'in' : 'out', parent: '' }], ...c.subs.map(x => [x.id, { ...x, k: IN.includes(c) ? 'in' : 'out' }])]));
export const MOVE = { id: 'move', zh: '轉帳', en: 'Transfer', icon: 'exchange', color: '#8e8e93' };
export const ADJ = { id: 'adj', zh: '調整餘額', en: 'Balance fix', icon: 'pencil', color: '#8e8e93' };

// The person's own changes (books.cats: { id: { id, k, parent, zh, icon,
// color, order, hidden } }): a built-in's id renames, reorders, hides or
// moves it; a new id adds one (a sub when it has a parent). app.mjs hands
// them in before anything is drawn.
// Under a preset (books.opt.preset) its own set shows instead of the
// person's hidden ones; their names, looks and subs stand either way.
let table = BUILT;
export function useCats(cats, preset = '') {
  table = new Map(BUILT);
  for (const r of Object.values(cats || {})) {
    if (!r || r.del) continue;
    const base = BUILT.get(r.id);
    table.set(r.id, { ...(base || { icon: 'grid', color: '#8e8e93' }), ...r, zh: r.zh || base?.zh || '', en: r.zh || base?.en || '' });
  }
  const p = PRESETS.find(x => x.id === preset);
  // (In the preset's own order, the rest after, unless the person set one.)
  const rank = p && p.id !== 'all' ? [...Object.keys(p.out), ...p.in] : [];
  if (p) [...table].forEach(([id, c], i) => table.set(id, { ...c, hidden: !inPreset(p, c), order: c.order ?? (p.id === 'all' ? undefined : rank.includes(id) ? rank.indexOf(id) : 100 + i) }));
}
export const useBooksCats = books => useCats(books.cats, books.opt?.preset);

// ---- Presets ----------------------------------------------------------------------
// (Jay 2026-10-30: too many categories; a set for each kind of person, and
// what the person changes becomes their own.) A top id with the sub keys
// it keeps (all of them when none are named); `all` shows everything. A
// switch only changes what the picker shows: nothing logged moves, and the
// person's own set (their hidden ones, books.cats) waits under 「我的」.
export const PRESETS = [
  {
    id: 'student', zh: '學生', en: 'Student', icon: 'school',
    out: { food: ['breakfast', 'lunch', 'dinner', 'snack', 'out'], drink: [], transport: ['tpass', 'mrt', 'bus', 'youbike', 'tra', 'thsr', 'coach'], learn: [], daily: ['supplies', 'stationery'], shop: ['clothes', 'tech', 'online'], health: [], fun: [], digital: [], social: ['gift', 'treat'], other: [] },
    in: ['allowance', 'redenv', 'side', 'prize', 'cashback', 'topup', 'otherin']
  },
  {
    id: 'worker', zh: '上班族', en: 'Office worker', icon: 'work',
    out: { food: [], drink: [], transport: [], shop: [], daily: [], home: ['rent', 'fee', 'fix'], bills: [], phone: [], fun: [], digital: [], health: [], social: [], other: [] },
    in: ['salary', 'bonus', 'invest', 'side', 'redenv', 'cashback', 'prize', 'topup', 'otherin']
  },
  {
    id: 'family', zh: '家庭', en: 'Family', icon: 'home',
    out: { food: ['breakfast', 'lunch', 'dinner', 'snack', 'out'], daily: [], home: [], bills: [], phone: [], transport: ['mrt', 'bus', 'thsr', 'tra', 'taxi'], car: [], kids: [], learn: [], health: [], insure: [], social: [], other: [] },
    in: ['salary', 'bonus', 'invest', 'side', 'redenv', 'cashback', 'topup', 'otherin']
  },
  { id: 'all', zh: '全部', en: 'Everything', icon: 'grid' }
];
function inPreset(p, c) {
  if (p.id === 'all') return true;
  if (c.k === 'in') return !c.parent && p.in.includes(c.id);
  if (!c.parent) return Boolean(p.out[c.id]);
  const keep = p.out[c.parent];
  return Boolean(keep) && (!keep.length || keep.includes(c.id.slice(c.parent.length + 1)));
}
// Which set is in use: a preset's id, 'mine' (the person's own changes), or
// 'all' when nothing was ever changed.
export const presetOf = books => (PRESETS.some(p => p.id === books.opt?.preset) ? books.opt.preset : hasOwn(books) ? 'mine' : 'all');
// Whether the person's own set differs from showing everything (one hidden, or one of their own).
export const hasOwn = books => Object.values(books.cats || {}).some(r => r && !r.del && (r.hidden || !BUILT.has(r.id)));
// Use a preset, or 'mine' to go back to the person's own.
export function usePreset(books, id) {
  books.opt = { ...books.opt, preset: id === 'mine' ? '' : id, picked: 1 };
  useBooksCats(books);
}
// Before the person changes what shows (hides, adds, merges): what the preset
// shows becomes theirs, written down, and 「我的」 is in use from then on.
export function ownPreset(books, now = Date.now()) {
  if (!PRESETS.some(p => p.id === books.opt?.preset)) return false;
  useBooksCats(books);
  for (const c of table.values()) {
    const m = mineOf(books, c.id);
    if (Boolean(m.hidden) !== c.hidden || (c.order != null && m.order !== c.order)) saveCat(books, { id: c.id, hidden: c.hidden, ...(c.order != null ? { order: c.order } : {}) }, now);
  }
  usePreset(books, 'mine');
  return true;
}
// What a set would show (the person's own names), the table left as it was.
export function presetCats(books, id, kind) {
  useCats(books.cats, id === 'mine' ? '' : id);
  const list = catList(kind);
  useBooksCats(books);
  return list;
}
// A picked or guessed category if it shows, else the kind's first that does
// (one the preset hides isn't offered for a new entry).
export function shownCat(kind, id) {
  const list = catsFor(kind);
  return list.find(c => c.id === id)?.id || list[0]?.id || (kind === 'in' ? 'otherin' : 'other');
}
const ordered = list => list.map((c, i) => ({ c, i })).sort((x, y) => (x.c.order ?? x.i) - (y.c.order ?? y.i)).map(x => x.c);
// A kind's categories (hidden ones too with `all`), each with its subs.
export function catList(kind, { all = false } = {}) {
  const tops = ordered([...table.values()].filter(c => c.k === kind && !c.parent && (all || !c.hidden)));
  return tops.map(c => ({ ...c, subs: subsOf(c.id, { all }) }));
}
export const subsOf = (id, { all = false } = {}) => ordered([...table.values()].filter(x => x.parent === id && (all || !x.hidden)));
// A category by id (a hidden one too: its history still shows it), else 其他.
export const catOf = id => {
  const c = table.get(id);
  return c && !c.parent ? c : table.get(c?.k === 'in' ? 'otherin' : 'other');
};
export const subOf = id => (id && table.get(id)?.parent ? table.get(id) : null);
export const isBuiltIn = id => BUILT.has(id);
// What picking it fills in (Jay 2026-10-27: YouBike always on his 儲值卡, NT$5
// a unit; TPASS always the same price): { pay: { a, via }, amt, unit }, a
// sub's own over its category's; nothing until the person sets it.
export function defaultsOf(cat, sub = '') {
  const c = table.get(cat) || {};
  const x = (sub && table.get(sub)?.parent === cat && table.get(sub)) || {};
  const amtOf = r => (r.unit > 0 ? { unit: r.unit, amt: 0 } : r.amt > 0 ? { amt: r.amt, unit: 0 } : null);
  return { pay: x.pay?.a ? x.pay : c.pay?.a ? c.pay : null, ...(amtOf(x) || amtOf(c) || { amt: 0, unit: 0 }) };
}
export const catsFor = kind => catList(kind === 'in' ? 'in' : 'out');

// ---- Changing them ------------------------------------------------------------------
// (Each a change to the books; the caller saves. Nothing with history is ever
// just deleted: it's merged into another, or hidden.)

// How many entries and repeats use a category or a sub.
export const usesOf = (books, id) => [...live(books.entries), ...live(books.recur)].filter(e => e.cat === id || e.sub === id).length;
const mineOf = (books, id) => (books.cats?.[id] && !books.cats[id].del ? books.cats[id] : {});
export const saveCat = (books, rec, now = Date.now()) => put(books, 'cats', { ...mineOf(books, rec.id), ...rec }, now);
// A new one (a sub under `parent`), last in its list.
export function addCat(books, { k, parent = '', zh, icon = 'grid', color = '#8e8e93' }, now = Date.now()) {
  useBooksCats(books);
  const sibs = parent ? subsOf(parent, { all: true }) : catList(k, { all: true });
  return saveCat(books, { id: `c-${newId(now)}`, k, parent, zh, icon, color, order: sibs.length }, now);
}
// One place up (-1) or down (+1) among its own: every sibling's order written, so they stay put.
export function moveCat(books, id, dir, now = Date.now()) {
  useBooksCats(books);
  const c = table.get(id);
  if (!c) return false;
  const sibs = c.parent ? subsOf(c.parent, { all: true }) : catList(c.k, { all: true });
  const i = sibs.findIndex(x => x.id === id);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= sibs.length) return false;
  [sibs[i], sibs[j]] = [sibs[j], sibs[i]];
  sibs.forEach((x, n) => x.order !== n && saveCat(books, { id: x.id, order: n }, now));
  return true;
}
// `from` folded into `into`: its entries, repeats and subs move there, its
// budget goes; then it's gone (a built-in hidden). A sub into its own parent
// is the sub let go (its entries just the category).
export function mergeCat(books, from, into, now = Date.now()) {
  useBooksCats(books);
  const a = table.get(from);
  const b = table.get(into);
  if (!a || !b || from === into) return false;
  const top = b.parent || b.id;
  for (const col of ['entries', 'recur'])
    for (const e of live(books[col])) {
      if (a.parent ? e.sub === from : e.cat === from) put(books, col, { ...e, cat: top, sub: a.parent ? (b.parent ? into : '') : e.sub || '' }, now);
    }
  if (!a.parent) {
    for (const s of subsOf(from, { all: true })) saveCat(books, { id: s.id, parent: into, k: b.k }, now);
    for (const x of live(books.budgets)) if (x.cat === from) drop(books, 'budgets', x.id, now);
  }
  removeCat(books, from, now);
  return true;
}
// Every record a change to the categories can touch, as it is now: the
// function puts them back (one a change made, removed).
export function catUndo(books) {
  const cols = ['entries', 'recur', 'budgets', 'cats'];
  const keep = Object.fromEntries(cols.map(c => [c, { ...(books[c] || {}) }]));
  return (now = Date.now()) => {
    for (const c of cols)
      for (const [id, r] of Object.entries(books[c] || {})) {
        const was = keep[c][id];
        if (was === r) continue;
        if (was && !was.del) put(books, c, { ...was }, now);
        else drop(books, c, id, now);
      }
  };
}
// Choices for a category's look.
export const CAT_ICONS = ['food', 'cup', 'bus', 'car', 'bag', 'basket', 'home', 'bolt', 'phone', 'tv', 'health', 'book', 'gift', 'plane', 'paw', 'baby', 'shield', 'bank', 'wallet', 'coin', 'spark', 'chart', 'work', 'trophy', 'swap', 'grid'];
export const CAT_COLORS = ['#ff8d28', '#ff383c', '#ff2d55', '#cb30e0', '#6155f5', '#0088ff', '#00c3d0', '#34c759', '#e3a008', '#ac7f5e', '#64748b', '#8e8e93'];

// Gone when nothing uses it (a built-in only ever hidden); false when it has history.
export function removeCat(books, id, now = Date.now()) {
  if (usesOf(books, id)) return false;
  if (isBuiltIn(id)) saveCat(books, { id, hidden: true }, now);
  else {
    useBooksCats(books);
    for (const s of subsOf(id, { all: true })) removeCat(books, s.id, now);
    drop(books, 'cats', id, now);
  }
  return true;
}
export const catName = (c, lang) => (lang === 'en' ? c.en || c.zh : c.zh);
export const glyph = icon;
// An entry's look: its category, or a transfer's, or a fix's.
export const lookOf = e => (e.k === 'move' ? MOVE : e.k === 'adj' ? ADJ : catOf(e.cat));

// A spending category from a store's name or an item (an imported 載具
// invoice): '' when nothing fits, for the caller's own default.
const GUESS = [
  ['drink', /咖啡|星巴克|路易莎|cama|85度C|清心|50嵐|迷客夏|可不可|茶湯會|麻古|鮮茶|手搖|飲料|coffee|starbucks|louisa/i],
  ['transport', /tpass|定期票|月票|youbike|捷運|高鐵|台鐵|臺鐵|鐵路|客運|公車|悠遊卡|一卡通|uber|計程車|台灣大車隊/i],
  ['car', /加油|中油|台塑石化|全國加油|停車|嘉義汽車|輪胎|機車行|保養/i],
  ['daily', /全聯|家樂福|大潤發|好市多|costco|愛買|美聯社|頂好|超市|寶雅|屈臣氏|康是美|小北百貨|日藥本舖/i],
  ['health', /藥局|藥房|醫院|診所|牙醫|醫療|大樹藥|丁丁藥/i],
  ['phone', /中華電信|台灣大哥大|遠傳|台灣之星|亞太電信|電信/i],
  ['bills', /台灣電力|台電|自來水|瓦斯|天然氣/i],
  ['daily', /文具|文化用品/],
  ['learn', /書店|誠品|博客來|金石堂|補習/i],
  ['digital', /cloudflare|anthropic|claude|openai|chatgpt|gemini|github|google one|icloud|netflix|spotify|youtube premium|disney\+|kkbox|app store|apple\.com\/bill|google play|steam|playstation|nintendo|xbox|epic games|網域|tdx/i],
  ['fun', /影城|威秀|秀泰|電影|ktv|錢櫃|好樂迪|遊樂/i],
  ['home', /房租|租金|管理費|房貸/],
  ['pet', /寵物|動物醫院|毛孩/i],
  ['travel', /飯店|酒店|旅館|旅行社|民宿|航空|機場|booking|agoda|airbnb/i],
  ['shop', /momo|蝦皮|shopee|pchome|uniqlo|zara|h&m|無印良品|百貨|新光三越|遠東|sogo|3c|燦坤|全國電子|順發|apple|小米/i],
  ['food', /便利商店|統一超商|7-?eleven|全家|萊爾富|ok超商|ok便利|麥當勞|肯德基|摩斯|漢堡|餐|麵|飯|食|小吃|便當|鍋|燒肉|壽司|拉麵|早午餐|吃/i]
];
export function guessCat(text) {
  const s = String(text || '');
  for (const [id, re] of GUESS) if (re.test(s) && !table.get(id)?.hidden) return id;
  return '';
}
// The finer kind too, where the words say it ('' when not, or when the person hid it).
const SUB_GUESS = [
  ['drink:coffee', /咖啡|星巴克|路易莎|cama|coffee|starbucks|louisa/i],
  ['drink:tea', /50嵐|清心|迷客夏|可不可|茶湯會|麻古|鮮茶|手搖/],
  ['transport:tpass', /tpass|定期票|月票/i],
  ['transport:thsr', /高鐵/],
  ['transport:tra', /台鐵|臺鐵/],
  ['transport:mrt', /捷運/],
  ['transport:youbike', /youbike|微笑單車/i],
  ['transport:coach', /客運|國光|統聯|和欣/],
  ['transport:taxi', /uber|計程車|大車隊|55688|yoxi/i],
  ['car:fuel', /加油|中油|台塑石化/],
  ['car:park', /停車/],
  ['daily:stationery', /文具|文化用品/],
  ['daily:grocery', /全聯|家樂福|大潤發|好市多|costco|愛買|美聯社|頂好|超市/i],
  ['digital:ai', /anthropic|claude|openai|chatgpt|gemini|perplexity|midjourney/i],
  ['digital:cloud', /cloudflare|github|aws|google cloud|vercel|godaddy|namecheap|gandi|網域|tdx|icloud|google one|dropbox|onedrive/i],
  ['digital:games', /steam|playstation|nintendo|xbox|epic games|遊戲|點數卡|mycard|gash/i],
  ['digital:subs', /netflix|spotify|youtube|disney|apple music|apple tv|kkbox|friday|catchplay|hbo|動畫瘋|愛奇藝|iqiyi/i],
  ['digital:apps', /app store|google play|apple\.com\/bill/i],
  ['fun:ktv', /ktv|錢櫃|好樂迪/i],
  ['shop:online', /momo|蝦皮|shopee|pchome|博客來/i],
  ['home:rent', /房租|租金/],
  ['home:fee', /管理費/],
  ['home:loan', /房貸/],
  ['bills:power', /台灣電力|台電/],
  ['bills:water', /自來水/],
  ['bills:gas', /瓦斯|天然氣/]
];
// A meal by the hour it's eaten (a new entry for today under 餐飲).
const MEAL = h => (h < 4 ? 'late' : h < 10.5 ? 'breakfast' : h < 14.5 ? 'lunch' : h < 17 ? 'snack' : h < 21 ? 'dinner' : 'late');
export function guessSub(cat, text = '', at = null) {
  const s = String(text || '');
  const hit = SUB_GUESS.find(([id, re]) => id.startsWith(`${cat}:`) && re.test(s))?.[0] || (cat === 'food' && at ? `food:${MEAL(at.getHours() + at.getMinutes() / 60)}` : '');
  const x = hit && table.get(hit);
  return x && !x.hidden && x.parent === cat ? hit : '';
}

// ---- Older books brought up to date ---------------------------------------------------
// 訂閱 and 遊戲 moved from 娛樂 to 數位 (2026-10-27): their entries, repeats and
// the person's changes to them go along. The 退款 income category is gone
// (books.mjs upgradeBooks turns its entries into money back): a change to it
// is let go. 訂閱 became 影音串流 (2026-10-28): one under it that was storage
// (iCloud, Google One) moves to 雲端・網域, and one logged under 數位 with no
// sub gets the one its words say; once (books.opt.dig2), so a later choice of
// the person's stands. → how many records changed.
const MOVED = { 'fun:subs': 'digital:subs', 'fun:games': 'digital:games' };
const STORAGE = /icloud|google one|dropbox|onedrive|雲端硬碟/i;
export function upgradeCats(books, now = Date.now()) {
  let n = 0;
  const split = !books.opt?.dig2;
  for (const col of ['entries', 'recur'])
    for (const e of live(books[col])) {
      const words = `${e.note || ''} ${e.inv?.seller || ''} ${(e.inv?.items || []).map(x => x.name).join(' ')}`;
      if (MOVED[e.sub]) put(books, col, { ...e, cat: 'digital', sub: MOVED[e.sub] }, now), n++;
      else if (!split) continue;
      else if (e.sub === 'digital:subs' && STORAGE.test(words)) put(books, col, { ...e, sub: 'digital:cloud' }, now), n++;
      else if (e.cat === 'digital' && !e.sub) {
        const sub = guessSub('digital', words);
        if (sub) put(books, col, { ...e, sub }, now), n++;
      }
    }
  for (const [from, to] of Object.entries(MOVED)) {
    const mine = books.cats?.[from];
    if (!mine || mine.del) continue;
    const { id, parent, k, u, ...rest } = mine;
    put(books, 'cats', { ...(books.cats[to] && !books.cats[to].del ? books.cats[to] : {}), ...rest, id: to }, now);
    drop(books, 'cats', from, now);
    n++;
  }
  if (books.cats?.refund && !books.cats.refund.del) drop(books, 'cats', 'refund', now), n++;
  if (split) (books.opt ||= {}).dig2 = 1, n++;
  if (n) useBooksCats(books);
  return n;
}
