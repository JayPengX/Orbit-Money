// 分類 (from 更多): the person's own categories. Spending's or income's, each
// with its subs; a category opens to its name, look and subs. Anything can be
// renamed, moved up or down, hidden, or merged into another (its history goes
// with it, and a merge can be undone); one never used can be deleted. The
// built-ins are only ever hidden, never lost.
import { h, icons, tile, sheet, segmented, menu, toast, tick } from '#kit/ui.mjs';
import { ask } from '#kit/orbit.mjs';
import { catList, catOf, subsOf, subOf, catName, glyph, usesOf, saveCat, addCat, moveCat, mergeCat, removeCat, isBuiltIn, catUndo, useCats, CAT_ICONS, CAT_COLORS } from '../lib/cats.mjs';
import { state, W, lang, saved } from '../shell.mjs';

const changed = () => (useCats(state.books.cats), saved());

export function openCats(kind = 'out') {
  const b = state.books;
  let k = kind;
  let open = '';
  let lookOpen = false;
  const box = h('div', { class: 'mn-catedit' });
  const foot = h('div', { class: 'q-sheet-foot' });
  const s = sheet({ title: W('分類', 'Categories'), detent: 'large', cls: 'mn-catsheet', body: [box], foot });
  const title = s.el.querySelector('.q-sheet-head h2');

  function paint() {
    useCats(b.cats);
    return open ? paintOne(open) : paintList();
  }

  // ---- Every category -------------------------------------------------------------
  function paintList() {
    title.textContent = W('分類', 'Categories');
    s.el.setAttribute('data-detent', 'large');
    const kinds = segmented(
      [
        { id: 'out', label: W('支出', 'Spending') },
        { id: 'in', label: W('收入', 'Income') }
      ],
      { value: k, label: W('種類', 'Kind'), onChange: x => ((k = x), paint()) }
    );
    const rows = catList(k, { all: true }).map(c =>
      h('button', { class: `q-ritem chevron mn-row${c.hidden ? ' mn-hiddencat' : ''}`, type: 'button', onclick: () => ((open = c.id), paint()) }, [
        tile(glyph(c.icon), c.color),
        h('span', { class: 'q-ritem-text' }, [h('span', { class: 'q-ritem-title', text: catName(c, lang) }), h('small', { text: c.hidden ? W('已隱藏', 'Hidden') : c.subs.map(x => catName(x, lang)).join('、') || W('沒有細項', 'No subs') })])
      ])
    );
    box.replaceChildren(kinds, h('div', { class: 'q-rowcard' }, rows), h('p', { class: 'mn-hint', text: W('細項讓統計分得更細，例如 交通 › TPASS、餐飲 › 午餐。', 'Subs split the stats finer, like Transport › TPASS or Food › Lunch.') }));
    foot.replaceChildren(h('button', { class: 'q-btn primary block', type: 'button', onclick: () => newCat() }, [h('span', { html: icons.plus }), W('新增分類', 'New category')]));
  }
  async function newCat() {
    const name = await nameAsk(W('新分類', 'New category'), '');
    if (!name) return;
    const c = addCat(b, { k, zh: name, icon: 'grid', color: CAT_COLORS[catList(k, { all: true }).length % CAT_COLORS.length] });
    changed();
    open = c.id;
    paint();
  }

  // ---- One category ---------------------------------------------------------------
  function paintOne(id) {
    const c = catOf(id);
    if (c.id !== id) return ((open = ''), paintList());
    title.textContent = catName(c, lang);
    // (As tall as what's in it: a category with two subs isn't a full-height page.)
    s.el.removeAttribute('data-detent');
    const back = h('button', { class: 'mn-backlink', type: 'button', onclick: () => ((open = ''), (lookOpen = false), paint()) }, [h('span', { html: icons.chevron }), W('所有分類', 'All categories')]);
    const head = h('div', { class: 'mn-cathead' }, [
      // (The look waits behind the tile: the subs are what's opened for.)
      h('button', { class: 'mn-cathead-t', type: 'button', 'aria-label': W('顏色和圖示', 'Colour and icon'), 'aria-expanded': String(lookOpen), onclick: () => ((lookOpen = !lookOpen), paint()) }, [tile(glyph(c.icon), c.color, 'lg'), h('span', { class: 'mn-cathead-edit', html: icons.pencil })]),
      h('button', { class: 'mn-pill mn-catname', type: 'button', onclick: async () => {
        const name = await nameAsk(W('名稱', 'Name'), catName(c, lang));
        if (name && name !== c.zh) (saveCat(b, { id, zh: name }), changed(), paint());
      } }, [h('span', { class: 'mn-pill-t', text: catName(c, lang) }), h('span', { html: icons.pencil })]),
      h('button', { class: 'q-btn tinted small', type: 'button', 'aria-label': W('更多', 'More'), text: '⋯', onclick: e => actions(e.currentTarget, c) })
    ]);
    const looks = !lookOpen ? null : h('div', { class: 'mn-looks' }, [
      h('div', { class: 'mn-swatches', role: 'radiogroup', 'aria-label': W('顏色', 'Colour') }, CAT_COLORS.map(col => h('button', { class: 'mn-swatch', type: 'button', role: 'radio', 'aria-checked': String(col === c.color), style: `background:${col}`, 'aria-label': col, onclick: () => (tick(), saveCat(b, { id, color: col }), changed(), paint()) }))),
      h('div', { class: 'mn-icons', role: 'radiogroup', 'aria-label': W('圖示', 'Icon') }, CAT_ICONS.map(ic => h('button', { class: 'mn-iconpick', type: 'button', role: 'radio', 'aria-checked': String(ic === c.icon), html: glyph(ic), onclick: () => (tick(), saveCat(b, { id, icon: ic }), changed(), paint()) })))
    ]);
    const subs = subsOf(id, { all: true });
    const subRows = subs.map(x =>
      h('button', { class: `q-ritem mn-row mn-subrow${x.hidden ? ' mn-hiddencat' : ''}`, type: 'button', onclick: e => actions(e.currentTarget, x) }, [
        h('span', { class: 'q-ritem-text' }, [h('span', { class: 'q-ritem-title', text: catName(x, lang) }), x.hidden ? h('small', { text: W('已隱藏', 'Hidden') }) : null]),
        h('span', { class: 'mn-more', 'aria-hidden': 'true', text: '⋯' })
      ])
    );
    box.replaceChildren(
      ...[
      back,
      head,
      c.hidden ? h('div', { class: 'mn-closed-note' }, [h('span', { text: W('已隱藏：記帳時不會出現，紀錄還在', 'Hidden: off the picker, history kept') }), h('button', { class: 'q-btn tinted small', type: 'button', text: W('顯示', 'Show'), onclick: () => (saveCat(b, { id, hidden: false }), changed(), paint()) })]) : null,
      looks,
      h('section', { class: 'q-section' }, [h('div', { class: 'q-section-head' }, [h('h2', { text: W('細項', 'Subs') })]), subs.length ? h('div', { class: 'q-rowcard' }, subRows) : h('p', { class: 'mn-hint', text: W('還沒有細項。', 'No subs yet.') })])
      ].filter(Boolean)
    );
    foot.replaceChildren(h('button', { class: 'q-btn tinted block', type: 'button', onclick: async () => {
      const name = await nameAsk(W('新細項', 'New sub'), '');
      if (name) (addCat(b, { k: c.k, parent: id, zh: name }), changed(), paint());
    } }, [h('span', { html: icons.plus }), W('新增細項', 'New sub')]));
  }

  // A category's or a sub's menu: rename (a sub), move, hide or show, merge, delete.
  function actions(anchor, c) {
    const sub = Boolean(c.parent);
    const sibs = sub ? subsOf(c.parent, { all: true }) : catList(c.k, { all: true });
    const at = sibs.findIndex(x => x.id === c.id);
    const uses = usesOf(b, c.id);
    menu(anchor, [
      sub ? { label: W('改名', 'Rename'), onClick: async () => {
        const name = await nameAsk(W('名稱', 'Name'), catName(c, lang));
        if (name && name !== c.zh) (saveCat(b, { id: c.id, zh: name }), changed(), paint());
      } } : null,
      at > 0 ? { label: W('往前移', 'Move up'), onClick: () => (moveCat(b, c.id, -1), changed(), paint()) } : null,
      at < sibs.length - 1 ? { label: W('往後移', 'Move down'), onClick: () => (moveCat(b, c.id, 1), changed(), paint()) } : null,
      { label: c.hidden ? W('顯示', 'Show') : W('隱藏', 'Hide'), onClick: () => (saveCat(b, { id: c.id, hidden: !c.hidden }), changed(), paint()) },
      { label: W('合併到⋯', 'Merge into…'), onClick: () => mergeMenu(anchor, c, uses) },
      !uses && !isBuiltIn(c.id) ? { label: W('刪除', 'Delete'), danger: true, onClick: () => {
        const undo = catUndo(b);
        removeCat(b, c.id);
        if (open === c.id) open = '';
        changed();
        paint();
        toast(W(`已刪除 ${catName(c, lang)}`, `${catName(c, lang)} deleted`), { ms: 6000, action: { label: W('復原', 'Undo'), onTap: () => (undo(), changed(), paint()) } });
      } } : null
    ].filter(Boolean));
  }
  // Where it can go: another category of its kind, or (a sub) its own category, or another sub there.
  function mergeMenu(anchor, c, uses) {
    const into = c.parent ? [catOf(c.parent), ...subsOf(c.parent, { all: true }).filter(x => x.id !== c.id)] : catList(c.k, { all: true }).filter(x => x.id !== c.id);
    menu(anchor, into.map(x => ({ label: x.id === c.parent ? W(`${catName(x, lang)}（不分細項）`, `${catName(x, lang)} (no sub)`) : catName(x, lang), onClick: () => merge(c, x, uses) })));
  }
  async function merge(c, into, uses) {
    const name = catName(c, lang);
    const to = catName(into, lang);
    const ok = await ask({ title: W(`把 ${name} 合併到 ${to}？`, `Merge ${name} into ${to}?`), body: uses ? W(`${uses} 筆紀錄會改成 ${to}，${name} 不再出現。`, `${uses} entries become ${to}; ${name} goes away.`) : W(`${name} 不再出現。`, `${name} goes away.`), ok: W('合併', 'Merge'), cancel: W('取消', 'Cancel'), icon: 'swap' });
    if (!ok) return;
    const undo = catUndo(b);
    mergeCat(b, c.id, into.id);
    if (open === c.id) open = into.parent || into.id;
    changed();
    paint();
    toast(W(`${name} 已合併到 ${to}`, `${name} merged into ${to}`), { ms: 6000, action: { label: W('復原', 'Undo'), onTap: () => (undo(), changed(), paint()) } });
  }

  paint();
  return s;
}

// A name typed in a small sheet of its own (the keyboard rule keeps it above the keys).
function nameAsk(title, value) {
  return new Promise(resolve => {
    let done = false;
    const input = h('input', { class: 'q-field mn-big-in', type: 'text', maxlength: '12', value, enterkeyhint: 'done', autocomplete: 'off', placeholder: W('名稱', 'Name') });
    const finish = v => {
      if (done) return;
      done = true;
      resolve(v);
      s.close();
    };
    const go = () => finish(input.value.trim());
    input.addEventListener('keydown', e => e.key === 'Enter' && (e.preventDefault(), go()));
    const s = sheet({ title, cls: 'mn-namesheet', body: [input], onClose: () => finish(''), foot: h('div', { class: 'q-sheet-foot' }, [h('button', { class: 'q-btn primary block', type: 'button', text: W('好', 'Done'), onclick: go })]) });
    setTimeout(() => input.focus(), 300);
  });
}
