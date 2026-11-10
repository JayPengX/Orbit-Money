// 問我的帳 (Jay 11-10, the family's AI): ask about your own books in your
// own words ("這個月外食花多少", "比上個月多花在哪"). The phone adds up the
// entries (lib/ask.mjs booksFacts: three months, lean); the Worker's AI
// (money-ask) only finds the answer in those numbers and says it, every
// number checked to be one of them. Nothing is sent until a question is.
import { h, sheet } from '#kit/ui.mjs';
import * as kitAI from '#kit/ai.mjs';
import { booksFacts } from '../lib/ask.mjs';
import { state, W, en, today, lang } from '../shell.mjs';

const STARTERS = [
  W('這個月花最多在哪？', 'Where did most of this month go?'),
  W('這個月吃飯花多少？', 'How much on food this month?'),
  W('比上個月多花在哪？', 'What’s up on last month?'),
  W('預算還剩多少？', 'How much budget is left?')
];

export function openAsk() {
  const talk = h('div', { class: 'mn-ask-talk', 'aria-live': 'polite' });
  let open = true;
  const bar = kitAI.aiBar({ placeholder: W('問你的帳，例如「這週花多少」', 'Ask, e.g. “How much this week?”'), label: W('問我的帳', 'Ask my books'), max: 200, onSend: q => go(q) });
  const starters = h('div', { class: 'q-ai-chips mn-ask-starters' }, STARTERS.map(q => h('button', { class: 'q-chip', type: 'button', text: q, onclick: () => go(q) })));
  const hint = h('p', { class: 'mn-hint', text: W('數字都由手機從你的帳本算好，AI 只負責回答，不會改動任何一筆。', 'Your phone adds up your entries; AI only answers from those numbers and never changes an entry.') });
  sheet({ title: W('問我的帳', 'Ask my books'), detent: 'large', cls: 'mn-say mn-ask', body: [hint, starters, talk, bar], onClose: () => (open = false) });
  requestAnimationFrame(() => bar.input.focus());

  async function go(q) {
    if (bar.classList.contains('busy')) return;
    starters.hidden = true;
    bar.busy(true);
    bar.clear();
    const think = kitAI.aiThinking(W('翻一下你的帳…', 'Looking through your books…'));
    talk.append(h('p', { class: 'mn-say-you', text: q }), think);
    think.scrollIntoView?.({ block: 'nearest' });
    try {
      const facts = booksFacts(state.books, today(), { lang });
      const r = await kitAI.aiCall('money-ask', { question: q, facts, lang: en ? 'en' : 'zh' });
      if (!open) return;
      const answer = r.out?.answer;
      think.replaceWith(answer ? h('div', { class: 'mn-ask-a' }, [h('p', { text: answer.replace(/\d{4,}/g, n => (/^(19|20)\d\d$/.test(n) ? n : Number(n).toLocaleString('en-US'))) }), kitAI.aiNote(W('AI 依你帳本的數字回答', 'Answered by AI from your own numbers'))]) : h('p', { class: 'mn-hint mn-say-err', text: r.error ? kitAI.aiSays(r.error, r.left) : W('這個問題從帳本裡看不出來，換個問法試試。', 'Your books don’t say. Try asking another way.') }));
    } finally {
      bar.busy(false);
    }
  }
}
