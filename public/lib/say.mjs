// 用說的記帳, code first (Jay 11-10: "if code can read it reliably, no AI"):
// a line like "早餐 45 午餐 120 捷運 30" or "昨天 全聯 356、星巴克 150" read
// here, on the phone, for nothing. Only a line this can't read whole goes
// to the AI (the Worker's money-say): words for numbers (三百五), a sentence
// (跟同學吃火鍋花了…), income, a way to pay, a date that isn't 今天/昨天/前天.
//
//   readSay(text, today) → [{ k, day, store, total, items, cat, pay, invoice }] | null
//   a meal whose words don't say which (便當 110) is left 'food': the view asks
//   which meal itself (mealAsk), with the kit's chips: no AI for that either.
//   (the shape the Worker's reads have: views/photo.mjs takes either)
import { guessCat, guessSub } from './cats.mjs';

const narrow = s => s.normalize('NFKC');
const addDays = (day, n) => new Date(Date.parse(`${day}T12:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);
const DAYS = [
  [/^(今天|今日)/, 0],
  [/^(昨天|昨日)/, -1],
  [/^前天/, -2]
];
// Meals by their words (早上麥當勞 is breakfast): the sub under 餐飲.
const MEALS = [
  [/早餐|早上|早午餐/, 'food:breakfast'],
  [/午餐|中餐|中午/, 'food:lunch'],
  [/晚餐|晚上|宵夜|消夜/, 'food:dinner']
];
// Anything that needs judgment goes to the AI: income, a way to pay, a refund, a split.
const HARD = /薪水|薪資|零用錢|收到|收入|紅包|獎金|退款|退費|轉帳|借|還我|還給|分攤|平分|每人|一人|付的|刷卡|刷了|刷台|用.{0,8}付|pay|現金|悠遊|信用卡|一卡通|街口|全支付|[一二三四五六七八九十百千萬兩]{2,}|[月號日]|週|禮拜|星期|上個|下個/i;

export function readSay(text, today) {
  let s = narrow(String(text || '')).replace(/\s+/g, ' ').trim();
  if (!s || s.length > 200 || HARD.test(s)) return null;
  let day = today;
  for (const [re, n] of DAYS)
    if (re.test(s)) {
      day = addDays(today, n);
      s = s.replace(re, '').trim();
    }
  // Each "words amount" pair, nothing else left over but separators.
  const PAIR = /([^\d,，、;；+$]{1,16}?)\s*\$?\s*(\d{1,7}(?:\.\d+)?)\s*(?:元|塊|圓)?/g;
  const out = [];
  let meal = '';
  for (const m of s.matchAll(PAIR)) {
    const words = m[1].trim();
    const amt = Math.round(Number(m[2]));
    if (!(amt > 0) || !words) return null;
    const hit = MEALS.find(([re]) => re.test(words));
    if (hit) meal = hit[1];
    const store = words.replace(/^(早餐|午餐|中餐|晚餐|宵夜|消夜|早上|中午|晚上|早午餐)\s*/, '').trim() || words;
    let cat = guessCat(words);
    if (!cat && hit) cat = 'food';
    // (A drink stays a drink; a meal by its own words, else the meal said before it: 早上麥當勞 89 薯餅 35.)
    const sub = (cat ? guessSub(cat, words) : '') || (cat === 'food' ? (hit ? hit[1] : meal) : '');
    out.push({ k: 'out', day, store, total: amt, items: [], cat: sub || cat, pay: '', invoice: '' });
  }
  // (Left over: words that aren't a pair, "跟同學吃火鍋花了": the AI's.)
  const rest = s.replace(PAIR, '').replace(/[\s,，、;；+和跟還有及]/g, '');
  if (!out.length || rest) return null;
  return out;
}

// The question a meal left open asks (code's own, drawn by the kit's askBox).
export const MEAL_OPTIONS = [
  { id: 'food:breakfast', zh: '早餐', en: 'Breakfast' },
  { id: 'food:lunch', zh: '午餐', en: 'Lunch' },
  { id: 'food:dinner', zh: '晚餐', en: 'Dinner' },
  { id: 'food:drink', zh: '飲料點心', en: 'Drink or snack' }
];
export const openMeals = buys => buys.filter(b => b.cat === 'food');
