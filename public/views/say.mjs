// 用說的記帳 (Jay 11-10): type or dictate what you spent ("早餐 45 午餐 120
// 捷運 30", "跟同學吃火鍋花了三百五") and it becomes entries to look over,
// as 拍照記帳's reads do (views/photo.mjs use: one opens 記一筆 filled in,
// several are looked over together; every field still the person's to change).
// Code first: lib/say.mjs reads plain "words amount" lines on the phone for
// nothing, and asks itself which meal a 便當 was (the kit's chips); only a
// line it can't read goes to the Worker's AI (money-say), which may ask back
// once (a meal, an amount; a category or a way to pay from the person's own
// lists, 其他 opening the whole list) rather than guess.
import { h, sheet } from '#kit/ui.mjs';
import * as kitAI from '#kit/ai.mjs';
import { readSay, openMeals, MEAL_OPTIONS } from '../lib/say.mjs';
import { state, W, en, today } from '../shell.mjs';
import { use, lists } from './photo.mjs';

export function openSay() {
  const host = h('div', { class: 'mn-say-flow', 'aria-live': 'polite' });
  const said = h('div', { class: 'mn-say-said' });
  let open = true;
  const bar = kitAI.aiBar({ placeholder: W('早餐 45 午餐 120', 'Breakfast 45, lunch 120'), label: W('用說的記帳', 'Say what you spent'), onSend: t => go(t) });
  const hint = h('p', { class: 'mn-hint' }, [W('打字或按鍵盤上的麥克風說：花了什麼、多少。可以一次說好幾筆，「昨天」「前天」也行。', 'Type, or tap the keyboard’s mic: what and how much. Several at once is fine, and “yesterday” too.')]);
  const s = sheet({ title: W('用說的記帳', 'Say it'), detent: 'medium', cls: 'mn-say', body: [hint, said, host, bar], onClose: () => (open = false) });
  // (In the tap that opened it: iOS raises its keys only then; the kit lands the sheet first.)
  bar.input.focus();

  async function go(text) {
    bar.busy(true);
    host.replaceChildren();
    said.replaceChildren(h('p', { class: 'mn-say-you', text }));
    bar.clear();
    try {
      // The phone's own read first: plain "words amount" lines, nothing sent.
      const own = readSay(text, today());
      if (own) {
        const meals = { meal: MEAL_OPTIONS.map(m => ({ id: m.id, name: en ? m.en : m.zh })) };
        for (const b of openMeals(own)) {
          const { box, answer } = kitAI.askBox({ q: W(`「${b.store}」是哪一餐？`, `Which meal was “${b.store}”?`), field: 'meal', options: MEAL_OPTIONS.map(m => m.id) }, { lists: meals });
          host.append(box);
          const a = await answer;
          if (a?.id) b.cat = a.id;
        }
        return finish(own);
      }
      const { cats, pays } = lists();
      const r = globalThis.ORBIT_TEST?.flags?.moneyAiCap ? { error: 'cap', left: 0 } : await kitAI.aiFlow(host, {
        feature: 'money-say',
        input: { text, today: today(), cats, pays, lang: en ? 'en' : 'zh' },
        lists: { cat: cats, pay: pays },
        titles: { cat: W('分類', 'Category'), pay: W('付款方式', 'Paid with') },
        thinking: W('整理中…', 'Sorting it out…')
      });
      if (!open) return;
      if (r.error) {
        host.replaceChildren(h('p', { class: 'mn-hint mn-say-err', text: kitAI.aiSays(r.error, r.left) }));
        return;
      }
      finish(r.out?.buys || []);
    } finally {
      bar.busy(false);
    }
  }
  function finish(buys) {
    if (!open) return;
    if (!buys.length) {
      host.replaceChildren(h('p', { class: 'mn-hint mn-say-err', text: W('沒聽到金額。說說花了什麼、多少錢，例如「午餐 120」。', 'No amount heard. Say what and how much, like “lunch 120”.') }));
      return;
    }
    s.close();
    use(buys, { none: W('沒聽到金額', 'No amount heard') });
  }
}
