// The categories: spending's and income's, each with its tile (a glyph and
// a colour). Glyphs are the kit's icons where it has one, else this app's own
// on the same 24-unit grid with round 2px strokes.
import { icons as kitIcons } from '#kit/ui.mjs';

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

// Spending.
export const OUT = [
  { id: 'food', zh: '餐飲', en: 'Food', icon: 'food', color: '#ff8d28' },
  { id: 'drink', zh: '飲料', en: 'Drinks', icon: 'cup', color: '#ac7f5e' },
  { id: 'transport', zh: '交通', en: 'Transport', icon: 'bus', color: '#0088ff' },
  { id: 'shop', zh: '購物', en: 'Shopping', icon: 'bag', color: '#ff2d55' },
  { id: 'daily', zh: '日用品', en: 'Household', icon: 'basket', color: '#00c3d0' },
  { id: 'home', zh: '居住', en: 'Housing', icon: 'home', color: '#6155f5' },
  { id: 'bills', zh: '水電瓦斯', en: 'Utilities', icon: 'bolt', color: '#e3a008' },
  { id: 'phone', zh: '通訊', en: 'Phone', icon: 'phone', color: '#34c759' },
  { id: 'fun', zh: '娛樂', en: 'Fun', icon: 'tv', color: '#cb30e0' },
  { id: 'health', zh: '醫療', en: 'Health', icon: 'health', color: '#ff383c' },
  { id: 'learn', zh: '學習', en: 'Learning', icon: 'book', color: '#00c8b3' },
  { id: 'social', zh: '人情', en: 'Gifts', icon: 'gift', color: '#f59e0b' },
  { id: 'car', zh: '汽機車', en: 'Vehicle', icon: 'car', color: '#64748b' },
  { id: 'travel', zh: '旅遊', en: 'Travel', icon: 'plane', color: '#0ea5e9' },
  { id: 'pet', zh: '寵物', en: 'Pets', icon: 'paw', color: '#a16207' },
  { id: 'kids', zh: '育兒', en: 'Kids', icon: 'baby', color: '#ec4899' },
  { id: 'insure', zh: '保險', en: 'Insurance', icon: 'shield', color: '#475569' },
  { id: 'tax', zh: '稅費', en: 'Tax & fees', icon: 'bank', color: '#78716c' },
  { id: 'other', zh: '其他', en: 'Other', icon: 'grid', color: '#8e8e93' }
];
// Income.
export const IN = [
  { id: 'salary', zh: '薪水', en: 'Salary', icon: 'wallet', color: '#16a34a' },
  { id: 'bonus', zh: '獎金', en: 'Bonus', icon: 'spark', color: '#eab308' },
  { id: 'invest', zh: '投資', en: 'Investing', icon: 'chart', color: '#0d9488' },
  { id: 'side', zh: '兼職', en: 'Side work', icon: 'work', color: '#2563eb' },
  { id: 'allowance', zh: '零用錢', en: 'Allowance', icon: 'coin', color: '#65a30d' },
  { id: 'redenv', zh: '紅包', en: 'Red envelope', icon: 'gift', color: '#dc2626' },
  { id: 'refund', zh: '退款', en: 'Refund', icon: 'swap', color: '#0891b2' },
  { id: 'prize', zh: '中獎', en: 'Prize', icon: 'trophy', color: '#f59e0b' },
  { id: 'otherin', zh: '其他', en: 'Other', icon: 'grid', color: '#8e8e93' }
];
const ALL = new Map([...OUT, ...IN].map(c => [c.id, c]));
export const MOVE = { id: 'move', zh: '轉帳', en: 'Transfer', icon: 'exchange', color: '#8e8e93' };
export const ADJ = { id: 'adj', zh: '調整餘額', en: 'Balance fix', icon: 'pencil', color: '#8e8e93' };

export const catOf = id => ALL.get(id) || ALL.get('other');
export const catsFor = kind => (kind === 'in' ? IN : OUT);
export const catName = (c, lang) => (lang === 'en' ? c.en : c.zh);
export const glyph = icon;
// An entry's look: its category, or a transfer's, or a fix's.
export const lookOf = e => (e.k === 'move' ? MOVE : e.k === 'adj' ? ADJ : catOf(e.cat));

// A spending category from a store's name or an item (an imported 載具
// invoice): '' when nothing fits, for the caller's own default.
const GUESS = [
  ['drink', /咖啡|星巴克|路易莎|cama|85度C|清心|50嵐|迷客夏|可不可|茶湯會|麻古|鮮茶|手搖|飲料|coffee|starbucks|louisa/i],
  ['transport', /捷運|高鐵|台鐵|臺鐵|鐵路|客運|公車|悠遊卡|一卡通|uber|計程車|台灣大車隊/i],
  ['car', /加油|中油|台塑石化|全國加油|停車|嘉義汽車|輪胎|機車行|保養/i],
  ['daily', /全聯|家樂福|大潤發|好市多|costco|愛買|美聯社|頂好|超市|寶雅|屈臣氏|康是美|小北百貨|日藥本舖/i],
  ['health', /藥局|藥房|醫院|診所|牙醫|醫療|大樹藥|丁丁藥/i],
  ['phone', /中華電信|台灣大哥大|遠傳|台灣之星|亞太電信|電信/i],
  ['bills', /台灣電力|台電|自來水|瓦斯|天然氣/i],
  ['learn', /書店|誠品|博客來|金石堂|補習|文具/i],
  ['fun', /影城|威秀|秀泰|電影|ktv|錢櫃|好樂迪|遊樂|steam|netflix|spotify|playstation|nintendo/i],
  ['pet', /寵物|動物醫院|毛孩/i],
  ['travel', /飯店|酒店|旅館|旅行社|民宿|航空|機場|booking|agoda|airbnb/i],
  ['shop', /momo|蝦皮|shopee|pchome|uniqlo|zara|h&m|無印良品|百貨|新光三越|遠東|sogo|3c|燦坤|全國電子|順發|apple|小米/i],
  ['food', /便利商店|統一超商|7-?eleven|全家|萊爾富|ok超商|ok便利|麥當勞|肯德基|摩斯|漢堡|餐|麵|飯|食|小吃|便當|鍋|燒肉|壽司|拉麵|早午餐|吃/i]
];
export function guessCat(text) {
  const s = String(text || '');
  for (const [id, re] of GUESS) if (re.test(s)) return id;
  return '';
}
