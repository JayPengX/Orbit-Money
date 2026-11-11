// 問我的帳 (Jay 11-10, the family's AI): ask about your own books in your
// own words ("這個月外食花多少", "錢都怎麼付出去的"). The phone adds up the
// entries into tables (lib/ask.mjs askTables: by category, by how it was
// paid, inside a category, income, places, the largest, against last month,
// by month, this week, the budget); the Worker's AI (money-ask) only picks
// the tables that answer and writes one line, every number checked to be
// one of them. The answer is drawn, never a paragraph (Jay 11-10: "the
// response should never be a plain text"): the line, then those tables as
// rows with bars from the phone's own numbers, the rows it named lit. The
// bar to type in is the sheet's foot, so it sits on the keyboard. Nothing is
// sent until a question is.
import { h, sheet } from '#kit/ui.mjs';
import * as kitAI from '#kit/ai.mjs';
import { askTables, booksFacts } from '../lib/ask.mjs';
import { catOf, subOf, glyph } from '../lib/cats.mjs';
import { payPic } from './pics.mjs';
import { state, W, en, today, lang, money } from '../shell.mjs';

const STARTERS = [
  W('這個月花最多在哪？', 'Where did most of this month go?'),
  W('這個月的錢怎麼付出去的？', 'How did I pay this month?'),
  W('比上個月多花在哪？', 'What’s up on last month?'),
  W('預算還剩多少？', 'How much budget is left?')
];

// (The AI writes the figures as given, 12169: shown as the app writes money, 12,169.)
const commas = t => t.replace(/\d{4,}/g, n => (/^(19|20)\d\d$/.test(n) ? n : Number(n).toLocaleString('en-US')));

// One table as rows: the label, the amount, how many times or what it was, a bar to the largest.
export function tableCard(t, mark = []) {
  const max = Math.max(1, ...t.rows.map(r => Math.max(r.amt, r.was || 0)));
  const lit = new Set(mark);
  return h('div', { class: 'mn-ask-table' }, [
    h('h4', { text: t.title }),
    ...t.rows.map(r => {
      const sub = r.was != null ? W(`之前 ${money(r.was)}`, `was ${money(r.was)}`) : r.n ? W(`${r.n} 筆`, `${r.n}×`) : '';
      return h('div', { class: `mn-ask-row${lit.has(r.label) ? ' on' : ''}` }, [
        h('span', { class: 'mn-ask-label' }, [h('span', { class: 'q-fit', text: r.label }), sub ? h('small', { text: sub }) : null]),
        h('b', { class: 'num', text: money(r.amt) }),
        h('i', { class: 'mn-ask-bar', 'aria-hidden': 'true' }, [
          r.was != null ? h('i', { class: 'was', style: `width:${(Math.max(0, r.was) / max) * 100}%` }) : null,
          h('i', { class: 'now', style: `width:${(Math.max(0, r.amt) / max) * 100}%` })
        ])
      ]);
    })
  ]);
}

// A row's picture (Jay 11-11: "icon, images… native and beautiful"): a
// category its own tile, a way to pay its card's or account's picture, the
// rest an emoji the table gave it.
function leadOf(r) {
  if (r.pay) {
    const [a, via] = r.pay.split('|');
    return payPic(a, via || '', 32);
  }
  const c = r.id && (subOf(r.id) ? catOf(subOf(r.id).parent) : catOf(r.id));
  if (c?.icon) return { glyph: glyph(c.icon), color: c.color };
  return r.pic || null;
}
// The answer drawn by the kit's one look for AI answers (aiAnswer); a phone
// on an older kit draws the tables as before.
function answerOf(line, shown, mark) {
  const lit = new Set(mark);
  const note = W('AI 挑的表，數字都是你帳本的', 'Tables picked by AI, every figure from your books');
  if (!kitAI.aiAnswer) return h('div', { class: 'mn-ask-a' }, [h('p', { class: 'mn-ask-line', text: commas(line) }), ...shown.map(t => tableCard(t, mark)), kitAI.aiNote(note)]);
  const sections = shown.map(t => {
    const max = Math.max(1, ...t.rows.map(r => Math.max(r.amt, r.was || 0)));
    return {
      title: t.title,
      rows: t.rows.map(r => ({
        lead: leadOf(r),
        label: r.label,
        sub: r.was != null ? W(`之前 ${money(r.was)}`, `was ${money(r.was)}`) : r.n ? W(`${r.n} 筆`, `${r.n}×`) : '',
        value: money(r.amt),
        bar: { now: r.amt, was: r.was ?? null, max },
        on: lit.has(r.label)
      }))
    };
  });
  return kitAI.aiAnswer({ line: commas(line), sections, note });
}

// `ask`: a question already said (問 Orbit's, #ask=…), asked at once.
export function openAsk({ ask = '' } = {}) {
  const talk = h('div', { class: 'mn-ask-talk', 'aria-live': 'polite' });
  let open = true;
  const bar = kitAI.aiBar({ placeholder: W('問你的帳…', 'Ask your books…'), label: W('問我的帳', 'Ask my books'), max: 200, onSend: q => go(q) });
  const starters = h('div', { class: 'q-ai-chips mn-ask-starters' }, STARTERS.map(q => h('button', { class: 'q-chip', type: 'button', text: q, onclick: () => go(q) })));
  const hint = h('p', { class: 'mn-hint', text: W('數字都由手機從你的帳本算好，AI 只挑出回答的表、說一句話，不會改動任何一筆。', 'Your phone adds up your entries; AI only picks the tables that answer and says one line, and never changes an entry.') });
  const foot = h('div', { class: 'q-sheet-foot mn-ask-foot' }, [bar]);
  sheet({ title: W('問我的帳', 'Ask my books'), detent: 'large', cls: 'mn-say mn-ask', body: [hint, starters, talk], foot, onClose: () => (open = false) });
  if (ask) requestAnimationFrame(() => go(String(ask).slice(0, 200)));
  else requestAnimationFrame(() => bar.input.focus());

  async function go(q) {
    if (bar.classList.contains('busy')) return;
    starters.hidden = true;
    bar.busy(true);
    bar.clear();
    const doing = W('翻一下你的帳…', 'Looking through your books…');
    const think = kitAI.aiAnswerWait?.({ text: doing, rows: 3 }) || kitAI.aiThinking(doing);
    talk.append(h('p', { class: 'mn-say-you', text: q }), think);
    think.scrollIntoView?.({ block: 'nearest' });
    try {
      const day = today();
      const { tables } = askTables(state.books, day, { lang });
      const facts = booksFacts(state.books, day, { lang });
      const r = await kitAI.aiCall('money-ask', { question: q, facts, lang: en ? 'en' : 'zh' });
      if (!open) return;
      const line = r.out?.line || r.out?.answer;
      const shown = (r.out?.show || []).map(id => tables[id]).filter(Boolean);
      const a = line
        ? answerOf(line, shown, r.out?.mark || [])
        : h('p', { class: 'mn-hint mn-say-err', text: r.error ? kitAI.aiSays(r.error, r.left) : W('這個問題從帳本裡看不出來，換個問法試試。', 'Your books don’t say. Try asking another way.') });
      think.replaceWith(a);
      a.scrollIntoView?.({ block: 'nearest', behavior: 'smooth' });
    } finally {
      bar.busy(false);
    }
  }
}
