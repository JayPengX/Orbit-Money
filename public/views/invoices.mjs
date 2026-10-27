// 發票: the 手機條碼 (載具) as the barcode a till scans, paper invoices
// scanned in (both QR codes: the number, the seller, every item), and 對獎:
// each scanned invoice against its draw (財政部's numbers, through the proxy),
// the prize and where to claim it.
import { h, icons, tile, sheet, toast } from '#kit/ui.mjs';
import { proxyJson } from '#kit/orbit.mjs';
import { live } from '../lib/books.mjs';
import { periodOf, periodDates, prizeOf, CARRIER, cleanCarrier, code39Svg } from '../lib/invoice.mjs';
import { glyph, guessCat } from '../lib/cats.mjs';
import { state, W, en, money, dayLabel, today, saved } from '../shell.mjs';
import { openEntry } from './entry.mjs';
import { importCarrier, openMailSetup } from './carrier-import.mjs';

const INVOICE = 'https://invoice.orbit';
const PRIZE_NAME = { special: ['特別獎', 'Special prize'], grand: ['特獎', 'Grand prize'], first: ['頭獎', 'First prize'], second: ['二獎', 'Second prize'], third: ['三獎', 'Third prize'], fourth: ['四獎', 'Fourth prize'], fifth: ['五獎', 'Fifth prize'], sixth: ['六獎', 'Sixth prize'] };
const prizeName = l => (en ? PRIZE_NAME[l][1] : PRIZE_NAME[l][0]);
// 115年 07–08月 · Jul–Aug 2026
const periodName = p => {
  const y = Number(p.slice(0, 3));
  const m = Number(p.slice(3));
  return en ? `${['Jan', 'Mar', 'May', 'Jul', 'Sep', 'Nov'][(m - 1) / 2]}–${['Feb', 'Apr', 'Jun', 'Aug', 'Oct', 'Dec'][(m - 1) / 2]} ${y + 1911}` : `${y}年 ${String(m).padStart(2, '0')}–${String(m + 1).padStart(2, '0')}月`;
};

// The draws (the last six), read at most every few hours; a failed read
// leaves the ones read before.
let drawsAt = 0;
export async function loadDraws() {
  if (state.draws && Date.now() - drawsAt < 3 * 3_600_000) return;
  try {
    const r = await proxyJson(`${INVOICE}/win.json`, { ttl: 3 * 3_600_000 });
    if (Array.isArray(r?.draws)) (state.draws = r.draws), (drawsAt = Date.now());
  } catch {}
}
// The names behind 統編 not known yet (the books keep the ones found with their entry).
export async function sellerNames(ids) {
  const want = [...new Set(ids)].filter(id => /^\d{8}$/.test(id) && !(id in state.sellers)).slice(0, 20);
  if (!want.length) return;
  try {
    const r = await proxyJson(`${INVOICE}/seller.json?ids=${want.join(',')}`, { ttl: 30 * 86_400_000 });
    for (const id of want) state.sellers[id] = r?.sellers?.[id] || '';
  } catch {}
}

const invoices = () => live(state.books.entries).filter(e => e.inv?.no).sort((a, b) => b.d.localeCompare(a.d));

export function renderInvoices(box) {
  const carrier = state.books.carrier?.code || '';
  const draws = state.draws || [];
  const byPeriod = new Map();
  for (const e of invoices()) {
    const p = periodOf(e.d);
    if (!byPeriod.has(p)) byPeriod.set(p, []);
    byPeriod.get(p).push(e);
  }
  const won = [];
  for (const [p, list] of byPeriod) {
    const draw = draws.find(d => d.period === p);
    for (const e of list) {
      const prize = draw && prizeOf(e.inv.no, draw);
      if (prize) won.push({ e, prize, p });
    }
  }

  // The tab is for bringing purchases in (Jay rarely shows the barcode): the
  // ways in lead; the barcode and the draw numbers wait at the bottom.
  const month = today().slice(0, 7);
  const thisMonth = invoices().filter(e => e.d.startsWith(month));
  const mailOn = !!state.mail?.address;
  const way = (glyphName, label, onclick) => h('button', { class: 'mn-way', type: 'button', onclick }, [h('span', { html: glyph(glyphName) }), label]);
  const hero = h('section', { class: 'q-hero-card mn-hero mn-inhero' }, [
    h('span', { class: 'q-hc-eyebrow' }, [h('span', { html: glyph('receipt') }), W('帶入消費明細', 'Bring purchases in')]),
    thisMonth.length
      ? h('span', { class: 'mn-in-stat' }, [h('b', { class: 'num', text: W(`${thisMonth.length} 張`, `${thisMonth.length}`) }), h('small', { text: W(`這個月帶入 · ${money(thisMonth.reduce((t, e) => t + (e.inv.total ?? e.amt), 0))}`, `invoices this month · ${money(thisMonth.reduce((t, e) => t + (e.inv.total ?? e.amt), 0))}`) })])
      : h('span', { class: 'mn-in-stat' }, [h('b', { text: W('不用打字', 'No typing') }), h('small', { text: W('店家、金額、品項自動填好', 'Seller, total and items filled in') })]),
    h('button', { class: 'mn-hero-cta', type: 'button', onclick: () => scanInvoice() }, [h('span', { html: glyph('scan') }), W('掃描紙本發票', 'Scan a paper invoice')]),
    h('div', { class: `mn-ways${mailOn ? '' : ' one'}` }, [
      way('receipt', W('匯入載具明細', 'Import carrier file'), () => importCarrier()),
      mailOn ? way('mail', W('信箱匯入', 'By mail'), () => openMailSetup()) : null
    ]),
    state.mail?.confirm ? h('span', { class: 'mn-hero-tag', text: W(`Gmail 確認碼 ${state.mail.confirm.code}`, `Gmail code ${state.mail.confirm.code}`) }) : null
  ]);

  // 對獎.
  const latest = draws[0];
  const sections = [hero];
  if (won.length)
    sections.push(
      h('section', { class: 'q-section' }, [
        h('div', { class: 'q-section-head' }, [h('h2', { text: W('中獎了', 'Winners') })]),
        h('div', { class: 'q-rowcard' }, won.map(({ e, prize, p }) => {
          const { claimTo } = periodDates(p);
          return h('button', { class: 'q-ritem chevron mn-row', type: 'button', onclick: () => openInvoice(e.inv, e) }, [tile(icons.trophy, '#f59e0b'), h('span', { class: 'q-ritem-text' }, [h('span', { class: 'q-ritem-title', text: `${prizeName(prize.level)} · ${money(prize.amt)}` }), h('small', { text: `${fmtNo(e.inv.no)} · ${W(`領獎到 ${dayLabel(claimTo, { week: false, year: true })}`, `claim by ${dayLabel(claimTo, { week: false, year: true })}`)}` })])]);
        }))
      ])
    );
  const periods = [...byPeriod.keys()].sort().reverse();
  for (const p of periods) {
    const list = byPeriod.get(p);
    const draw = draws.find(d => d.period === p);
    const { draw: drawDay } = periodDates(p);
    const status = draw ? W(`已開獎 · ${list.filter(e => prizeOf(e.inv.no, draw)).length} 張中獎`, `drawn · ${list.filter(e => prizeOf(e.inv.no, draw)).length} won`) : drawDay > today() ? W(`${dayLabel(drawDay, { week: false })} 開獎`, `drawn ${dayLabel(drawDay, { week: false })}`) : latest && latest.period < p ? W('等待開獎', 'Waiting for the draw') : W('已過領獎期限', 'Past the claim date');
    sections.push(
      h('section', { class: 'q-section' }, [
        h('div', { class: 'q-section-head' }, [h('h2', { text: periodName(p) }), h('span', { class: 'mn-sec-note', text: status })]),
        h('div', { class: 'q-rowcard' }, list.map(e => invRow(e, draw)))
      ])
    );
  }
  // The rarely used, at the bottom.
  sections.push(
    h('section', { class: 'q-section' }, [
      h('div', { class: 'q-section-head' }, [h('h2', { text: W('其他', 'More') })]),
      h('div', { class: 'q-rowcard' }, [
        h('button', { class: 'q-ritem chevron mn-row', type: 'button', onclick: () => (carrier ? openCarrier() : editCarrier()) }, [tile(glyph('barcode'), '#3a3a3c'), h('span', { class: 'q-ritem-text' }, [h('span', { class: 'q-ritem-title', text: W('手機條碼', 'Mobile barcode') }), h('small', { text: carrier || W('還沒設定', 'Not set') })])]),
        latest ? h('button', { class: 'q-ritem chevron mn-row', type: 'button', onclick: () => sheet({ title: W('中獎號碼', 'Winning numbers'), subtitle: periodName(latest.period), body: drawCard(latest) }) }, [tile(icons.trophy, '#f59e0b'), h('span', { class: 'q-ritem-text' }, [h('span', { class: 'q-ritem-title', text: W('中獎號碼', 'Winning numbers') }), h('small', { text: periodName(latest.period) })])]) : null
      ])
    ])
  );
  box.replaceChildren(...sections);
}

const fmtNo = no => `${no.slice(0, 2)}-${no.slice(2)}`;
function invRow(e, draw) {
  const prize = draw && prizeOf(e.inv.no, draw);
  return h('button', { class: 'q-ritem chevron mn-row', type: 'button', onclick: () => openInvoice(e.inv, e) }, [
    tile(glyph('receipt'), prize ? '#f59e0b' : '#8e8e93'),
    h('span', { class: 'q-ritem-text' }, [h('span', { class: 'q-ritem-title', text: e.inv.seller || e.note || fmtNo(e.inv.no) }), h('small', { text: `${Number(e.d.slice(5, 7))}/${Number(e.d.slice(8))} ${e.inv.no}` }), prize ? h('span', { class: 'q-tags' }, [h('span', { class: 'q-tag', text: `${prizeName(prize.level)} ${money(prize.amt)}` })]) : null]),
    h('span', { class: 'q-ritem-value num', text: money(e.inv.total ?? e.amt) })
  ]);
}

// The newest draw's numbers, as 財政部 publishes them.
function drawCard(d) {
  const row = (label, nums, sub) => h('div', { class: 'mn-drawrow' }, [h('span', {}, [h('b', { text: label }), sub ? h('small', { text: sub }) : null]), h('span', { class: 'mn-drawnums num' }, nums.map(n => h('span', { text: n })))]);
  return h('div', { class: 'mn-drawwrap' }, [
    h('div', { class: 'mn-drawcard' }, [
      row(W('特別獎', 'Special'), [d.special], W('1,000 萬', 'NT$10M')),
      row(W('特獎', 'Grand'), [d.grand], W('200 萬', 'NT$2M')),
      row(W('頭獎', 'First'), d.first, W('20 萬', 'NT$200K'))
    ]),
    h('p', { class: 'mn-hint mn-draw-note', text: W('頭獎號碼的末 7 到末 3 碼相同，也有 4 萬到 200 元。', 'Matching the last 7 down to 3 digits of a first-prize number wins NT$40,000 down to NT$200.') })
  ]);
}

// ---- One invoice ------------------------------------------------------------------

export function openInvoice(inv, entry = null) {
  const draw = (state.draws || []).find(d => d.period === periodOf(inv.day || entry?.d || today()));
  const prize = draw && prizeOf(inv.no, draw);
  const items = inv.items || [];
  sheet({
    title: inv.seller || W('發票', 'Invoice'),
    subtitle: fmtNo(inv.no),
    body: [
      h('div', { class: 'q-fig mn-facts' }, [
        h('div', {}, [h('small', { text: W('金額', 'Total') }), h('b', { class: 'num', text: money(inv.total ?? entry?.amt ?? 0) })]),
        h('div', {}, [h('small', { text: W('日期', 'Date') }), h('b', { text: dayLabel(inv.day || entry?.d, { week: false }) })]),
        h('div', {}, [h('small', { text: W('對獎', 'Draw') }), h('b', { text: prize ? prizeName(prize.level) : draw ? W('沒中', 'No prize') : W('未開獎', 'Not yet') })])
      ]),
      items.length
        ? h('div', { class: 'q-rowcard mn-items' }, items.map(it => h('div', { class: 'q-ritem' }, [h('span', { class: 'q-ritem-text' }, [h('span', { class: 'q-ritem-title', text: it.name }), it.qty !== 1 ? h('small', { class: 'num', text: `${it.qty} × ${money(it.price, { digits: it.price % 1 ? 1 : 0 })}` }) : null]), h('span', { class: 'q-ritem-value num', text: money(Math.round(it.qty * it.price)) })])))
        : h('p', { class: 'mn-hint', text: W('這張發票的 QR code 沒有寫品項。', 'This invoice’s QR codes list no items.') }),
      h('p', { class: 'mn-hint', text: [inv.sid ? W(`賣方統編 ${inv.sid}`, `Seller ${inv.sid}`) : '', inv.rand ? W(`隨機碼 ${inv.rand}`, `Random code ${inv.rand}`) : ''].filter(Boolean).join(' · ') })
    ]
  });
}

// ---- Scanning ---------------------------------------------------------------------

export async function scanInvoice() {
  const { openScanner } = await import('./scan.mjs');
  const inv = await openScanner();
  if (!inv) return;
  await sellerNames([inv.sid]);
  const seller = state.sellers[inv.sid] || '';
  const named = { ...inv, seller: shortName(seller) };
  const note = named.seller || inv.items[0]?.name || '';
  openEntry({ day: inv.day, kind: 'out', amt: inv.total, inv: named, note, cat: guessCat(`${seller} ${inv.items.map(i => i.name).join(' ')}`) });
}
// 統一超商股份有限公司 → 統一超商 (the register's name, less its legal ending).
export const shortName = s => String(s || '').replace(/(股份)?有限公司.*$|有限公司$|股份有限公司$/, '').replace(/^台灣|^臺灣/, m => (s.length > 8 ? '' : m)).trim();

// ---- The 手機條碼 -----------------------------------------------------------------

function openCarrier() {
  const code = state.books.carrier?.code || '';
  sheet({
    title: W('手機條碼', 'Mobile barcode'),
    cls: 'mn-carrier-sheet',
    trailing: h('button', { class: 'q-btn plain small', type: 'button', text: W('更改', 'Change'), onclick: () => (document.querySelector('dialog.mn-carrier-sheet')?.close(), editCarrier()) }),
    body: [h('div', { class: 'mn-barcode big', html: code39Svg(code, { height: 90 }) }), h('b', { class: 'mn-carrier-code big', text: code }), h('p', { class: 'mn-hint', text: W('結帳時給店員掃，發票就存進你的載具。', 'Let the cashier scan it: the invoice goes to your carrier.') })]
  });
}
function editCarrier() {
  const input = h('input', { class: 'q-field mn-big-in', type: 'text', autocapitalize: 'characters', autocomplete: 'off', spellcheck: 'false', maxlength: '8', placeholder: '/ABC1234', value: state.books.carrier?.code || '' });
  const s = sheet({
    title: W('手機條碼', 'Mobile barcode'),
    body: [h('p', { class: 'mn-hint', text: W('在財政部「統一發票兌獎」App 或電子發票平台申請的手機條碼：/ 加 7 碼。', 'The barcode from the Ministry of Finance’s e-invoice app or site: / and 7 characters.') }), input],
    foot: h('div', { class: 'q-sheet-foot mn-foot2' }, [
      state.books.carrier?.code ? h('button', { class: 'q-btn danger tinted', type: 'button', text: W('移除', 'Remove'), onclick: () => ((state.books.carrier = { code: '', u: Date.now() }), s.close(), saved()) }) : null,
      h('button', {
        class: 'q-btn primary',
        type: 'button',
        text: W('儲存', 'Save'),
        onclick: () => {
          const code = cleanCarrier(input.value);
          if (!CARRIER.test(code)) return toast(W('手機條碼是 / 加 7 個英數字', 'It’s / and 7 letters or digits'), { tone: 'bad' });
          state.books.carrier = { code, u: Date.now() };
          s.close();
          saved();
        }
      })
    ])
  });
  setTimeout(() => input.focus(), 300);
}
