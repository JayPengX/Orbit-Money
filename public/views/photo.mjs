// 拍照記帳 (Jay 2026-10-31: "AI image recognition to record, not made around
// 發票"): any picture of money paid or received (a receipt, an invoice, a
// bill, a store, delivery or payment app's screenshot, a transfer notice, a
// price tag) read by Gemini (the Worker's money-read.js, a day's cap) into
// the amount, day, store, items, category and way to pay. Picking the picture
// is the tap that asks for it; nothing is saved before the person looks.
// One read opens as a filled-in 記一筆 (which offers to merge with an entry
// already logged: lib/books.mjs sameAs); several (a list on a screenshot) are
// looked over together, each matched the same way.
import { h, icons, sheet, toast, menu } from '#kit/ui.mjs';
import { workerJson } from '#kit/orbit.mjs';
import { put, autoReload, matchBuys } from '../lib/books.mjs';
import { catsFor, subsOf, catName, catOf, subOf, guessCat, guessSub, shownCat } from '../lib/cats.mjs';
import { state, W, lang, money, dayLabel, today, saved, acct, card } from '../shell.mjs';
import { openEntry, payOptions, lastPay, titleOf } from './entry.mjs';

const MAX_SIDE = 1600;

// The phone's own picker (take a photo, or one from the library or Files).
// Called straight from a tap: Safari opens a picker only inside one.
// picked(): once a picture is chosen (記一筆 closes itself then, not before:
// closed first, the picker floated over an empty page, Jay 2026-10-31).
export function snap({ picked = null } = {}) {
  for (const old of document.querySelectorAll('input.mn-snap-in')) old.remove();
  const file = h('input', { class: 'mn-snap-in', type: 'file', accept: 'image/*', hidden: '' });
  document.body.append(file);
  file.addEventListener('change', () => {
    const f = file.files?.[0];
    file.remove();
    if (!f) return;
    picked?.();
    read(f);
  });
  file.click();
}

// The picture, and how the read is going (again on a failure, until the day's reads are used up).
function read(f) {
  const url = URL.createObjectURL(f);
  const status = h('p', { class: 'mn-photo-status' });
  const note = h('p', { class: 'mn-hint mn-photo-note' });
  const again = h('button', { class: 'q-btn primary block', type: 'button', hidden: '', text: W('再試一次', 'Try again'), onclick: () => go() });
  let open = true;
  const s = sheet({
    title: W('拍照記帳', 'From a photo'),
    cls: 'mn-photo',
    onClose: () => ((open = false), URL.revokeObjectURL(url)),
    body: [h('img', { class: 'mn-photo-img', src: url, alt: '' }), status, note],
    foot: h('div', { class: 'q-sheet-foot' }, [again])
  });
  async function go() {
    again.hidden = true;
    status.replaceChildren(h('span', { class: 'spinner', 'aria-hidden': 'true' }), W('AI 讀取中⋯', 'Reading…'));
    note.textContent = state.readLeft != null ? W(`今天還可以讀 ${state.readLeft} 張`, `${state.readLeft} left today`) : '';
    const r = await send(f);
    if (r?.left != null) state.readLeft = r.left;
    if (!open) return;
    if (!r || r.error) {
      status.textContent = r?.error === 'cap' ? W('今天的 AI 讀圖用完了', 'No more reads today') : W('這張沒有讀出來', 'That one didn’t read');
      note.textContent = r?.error === 'cap' ? W('明天再來，或先自己記一筆。', 'Back tomorrow; add it by hand for now.') : W('可以再試一次，或換一張清楚一點的。', 'Try again, or a clearer picture.');
      again.hidden = r?.error === 'cap';
      return;
    }
    s.close();
    use(r.buys || []);
  }
  go();
}

// What the read is told about the person: their categories (subs by their
// parent's name) and their ways to pay, so it picks from their own.
function lists() {
  const cats = [];
  for (const k of ['out', 'in'])
    for (const c of catsFor(k)) {
      cats.push({ id: c.id, name: catName(c, 'zh'), k });
      for (const x of subsOf(c.id)) cats.push({ id: x.id, name: `${catName(c, 'zh')} › ${catName(x, 'zh')}`, k });
    }
  const pays = payOptions().map(o => ({ id: `${o.a}|${o.via}`, name: o.label }));
  return { cats, pays };
}

async function send(f) {
  try {
    const img = await createImageBitmap(f, { imageOrientation: 'from-image' });
    const k = Math.min(1, MAX_SIDE / Math.max(img.width, img.height));
    const c = Object.assign(document.createElement('canvas'), { width: Math.round(img.width * k), height: Math.round(img.height * k) });
    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
    const data = c.toDataURL('image/jpeg', 0.85).split(',')[1];
    return await workerJson('/money-read', 'v=1', { body: JSON.stringify({ image: { mime_type: 'image/jpeg', data }, ...lists() }), timeout: 45_000, errors: true });
  } catch {
    return null;
  }
}

// One read as what an entry needs: the category (a sub picked means its
// parent too; none read, the store's words), the way to pay when the picture
// showed one, and the receipt kept on the entry (`inv`).
function asBuy(r) {
  const k = r.k === 'in' ? 'in' : 'out';
  const sub = subOf(r.cat);
  const words = `${r.store} ${(r.items || []).map(i => i.name).join(' ')}`;
  const cat = sub ? sub.parent : r.cat && catOf(r.cat).id === r.cat ? r.cat : k === 'out' ? guessCat(words) : '';
  const [a, via = ''] = String(r.pay || '').split('|');
  const pay = a && acct(a) && !acct(a).closed && (!via || (card(via) && !card(via).closed)) ? { a, via } : null;
  const day = r.day || today();
  return {
    k,
    day,
    total: r.total,
    store: r.store || '',
    no: r.invoice || '',
    cat,
    sub: sub?.id || (cat ? guessSub(cat, words) : ''),
    pay,
    inv: { seller: r.store || '', items: (r.items || []).map(i => ({ name: i.name, qty: 1, price: i.amt })), no: r.invoice || '', day, total: r.total, from: 'photo' }
  };
}

function use(read) {
  if (!read.length) return toast(W('照片裡沒有看到金額', 'No payment in that picture'), { tone: 'bad' });
  const buys = read.map(asBuy);
  if (buys.length === 1) {
    const [x] = buys;
    return openEntry({ day: x.day, kind: x.k, amt: x.total, note: x.store || x.inv.items[0]?.name || '', cat: x.cat, sub: x.sub, pay: x.pay, inv: x.inv });
  }
  review(buys.sort((p, q) => p.day.localeCompare(q.day)));
}

// The receipt kept on an entry, merged into one already logged: its amount,
// day and way to pay stay as the person logged them; the store and items come
// in, and a category only where it had none.
export function mergeInto(e, x, now = Date.now()) {
  put(state.books, 'entries', { ...e, inv: x.inv, note: e.note || x.store, cat: e.cat || x.cat, sub: e.cat ? e.sub || '' : x.sub }, now);
}

// Several at once: each row new (記一筆), merged into the entry it matched,
// or left out; a tap on a row picks. One way to pay for the new ones, unless
// the picture showed a row's own.
function review(buys) {
  const b = state.books;
  const rows = matchBuys(b, buys).map(({ buy, e }) => ({ x: buy, e, act: e ? 'merge' : 'add' }));
  const p = lastPay();
  const f = { a: p?.a || 'cash', via: p?.via || '' };
  const payPill = h('button', { class: 'mn-pill', type: 'button' });
  const paintPay = () => payPill.replaceChildren(h('span', { class: 'mn-pill-t', text: payOptions().find(o => o.a === f.a && o.via === f.via)?.label || W('選帳戶', 'Choose') }), h('i', { html: icons.chevron }));
  payPill.onclick = ev => menu(ev.currentTarget, payOptions().map(o => ({ label: o.label, icon: o.a === f.a && o.via === f.via ? '✓' : '', onClick: () => ((f.a = o.a), (f.via = o.via), paintPay()) })));
  paintPay();
  const list = h('div', { class: 'q-rowcard mn-photo-rows' });
  const go = h('button', { class: 'q-btn primary block', type: 'button', onclick: () => commit() });
  const payRow = h('div', { class: 'mn-field' }, [h('span', { class: 'mn-field-l', text: W('新的從哪裡付', 'New ones paid from') }), payPill]);
  const md = d => `${Number(d.slice(5, 7))}/${Number(d.slice(8))}`;
  function paint() {
    list.replaceChildren(
      ...rows.map(r => {
        const what = catName(subOf(r.x.sub) || catOf(r.x.cat || shownCat(r.x.k)), lang);
        const tag = r.act === 'merge' ? h('span', { class: 'q-tag merge', text: W(`併入 ${md(r.e.d)} ${titleOf(r.e)}`, `Merge into ${md(r.e.d)} ${titleOf(r.e)}`) }) : r.act === 'skip' ? h('span', { class: 'q-tag', text: W('不記', 'Left out') }) : null;
        return h('button', { class: `q-ritem chevron mn-row${r.act === 'skip' ? ' skip' : ''}`, type: 'button', onclick: ev => pick(ev.currentTarget, r) }, [
          h('span', { class: 'q-ritem-text' }, [h('span', { class: 'q-ritem-title', text: r.x.store || r.x.inv.items[0]?.name || what }), h('small', { text: `${dayLabel(r.x.day, { week: false })} · ${what}` }), tag ? h('span', { class: 'q-tags' }, [tag]) : null]),
          h('span', { class: `q-ritem-value num${r.x.k === 'in' ? ' mn-amt in' : ''}`, text: money(r.x.total) })
        ]);
      })
    );
    const n = rows.filter(r => r.act !== 'skip').length;
    payRow.hidden = !rows.some(r => r.act === 'add' && !r.x.pay);
    go.disabled = !n;
    go.textContent = W(`記下 ${n} 筆`, `Save ${n}`);
  }
  function pick(anchor, r) {
    menu(anchor, [
      { label: W('記一筆', 'Add it'), icon: r.act === 'add' ? '✓' : '', onClick: () => ((r.act = 'add'), paint()) },
      r.e ? { label: W(`併入 ${dayLabel(r.e.d, { week: false })} ${titleOf(r.e)} ${money(r.e.amt)}`, `Merge into ${titleOf(r.e)} ${money(r.e.amt)}`), icon: r.act === 'merge' ? '✓' : '', onClick: () => ((r.act = 'merge'), paint()) } : null,
      { label: W('不記', 'Leave out'), icon: r.act === 'skip' ? '✓' : '', onClick: () => ((r.act = 'skip'), paint()) }
    ].filter(Boolean));
  }
  function commit() {
    const now = Date.now();
    let added = 0;
    let merged = 0;
    for (const [n, r] of rows.entries()) {
      if (r.act === 'merge') (mergeInto(r.e, r.x, now), merged++);
      if (r.act !== 'add') continue;
      const pay = r.x.pay || f;
      const e = put(b, 'entries', { d: r.x.day, k: r.x.k, amt: r.x.total, cat: r.x.cat || shownCat(r.x.k), sub: r.x.cat ? r.x.sub : '', note: r.x.store || r.x.inv.items[0]?.name || '', a: pay.a, via: pay.via || '', to: '', inv: r.x.inv, t: now + n }, now);
      if (r.x.k === 'out') autoReload(b, e, now);
      added++;
    }
    b.st = Math.round(now / 1000);
    s.close();
    toast([added ? W(`記好 ${added} 筆`, `${added} added`) : '', merged ? W(`併入 ${merged} 筆`, `${merged} merged`) : ''].filter(Boolean).join(W('，', ', ')));
    saved();
  }
  const sum = buys.reduce((t, x) => t + (x.k === 'out' ? x.total : 0), 0);
  const s = sheet({
    title: W(`讀到 ${buys.length} 筆`, `${buys.length} read`),
    subtitle: sum ? W(`支出共 ${money(sum)}`, `${money(sum)} spent`) : '',
    detent: 'large',
    cls: 'mn-photo-list',
    body: [payRow, list],
    foot: h('div', { class: 'q-sheet-foot' }, [go])
  });
  paint();
}

// The receipt behind an entry (read from a picture, or an older 發票's):
// like the paper, sized to what's on it.
export function openReceipt(inv, entry = null) {
  const items = inv.items || [];
  const total = inv.total ?? entry?.amt ?? items.reduce((t, i) => t + Math.round(i.qty * i.price), 0);
  const day = inv.day || entry?.d;
  sheet({
    title: inv.seller || entry?.note || W('收據', 'Receipt'),
    cls: 'mn-receipt-sheet',
    body: [
      h('div', { class: 'mn-receipt' }, [
        h('div', { class: 'mn-receipt-meta' }, [h('span', { text: day ? dayLabel(day, { week: false, year: day.slice(0, 4) !== today().slice(0, 4) }) : '' }), h('span', { text: inv.no ? `${inv.no.slice(0, 2)}-${inv.no.slice(2)}` : '' })]),
        ...items.map(it =>
          h('div', { class: 'mn-receipt-line' }, [
            h('span', {}, [h('span', { text: it.name }), it.qty !== 1 ? h('small', { class: 'num', text: `${it.qty} × ${money(it.price, { digits: it.price % 1 ? 1 : 0 })}` }) : null]),
            h('b', { class: 'num', text: money(Math.round(it.qty * it.price)) })
          ])
        ),
        h('div', { class: 'mn-receipt-sum' }, [h('span', { text: W('合計', 'Total') }), h('span', { class: 'num', text: money(total) })])
      ])
    ]
  });
}

// (For 記一筆's receipt row.)
export const receiptLabel = inv => [inv.seller || W('收據', 'Receipt'), inv.items?.length ? W(`${inv.items.length} 項`, `${inv.items.length} item${inv.items.length === 1 ? '' : 's'}`) : ''].filter(Boolean).join(' · ');
