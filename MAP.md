# Orbit Money: the map

Jay's own books (real money, kept apart from Orbit's play money): what is spent
each day and what each account holds, any receipt or screenshot logged from a
photo. Signs in with the Orbit Pass; the books sync on it.
Live: https://orbit.jaypengx.com/money/

## Rules

Jay's, dated (Taiwan day), newest wins; the family's are in Orbit-Core `docs/RULEBOOK.md`.

**Real money.**
- 10-27 Never invent entries, balances or categories the person didn't give. Jay started fresh 2026-11-01; never re-add the 天天記帳 import or commit his CSV.
- 10-27 Every change to what entries mean works on what's already logged (old books upgraded on open, `upgradeBooks`). Removing an account never loses history.
- 10-27 退款 is never income: it comes off its spend, all or part; a friend's share of what you paid comes off too, their cash counted once handed over. A 自動加值 nobody in the books paid for (a parent's card) is 收入.
- 10-27 Fees (ATM, 境外交易手續費) are typed from the bill, with a 1.5% tap for a credit card; never calculated on their own.
- 10-27 LINE Points (any points or gift card) can pay part of a spend. 悠遊卡/一卡通 are 儲值卡, never 電子錢包.
- 10-30 Cards carry their network (卡別: Visa, Mastercard, JCB, American Express, UnionPay…), picked when adding or editing and shown wherever the card is (its real mark).
- 10-27 Ways to pay show their own logos; 手機條碼 stays black on white in dark mode.

**Categories.**
- 10-27 Categories have subs and are the person's to edit (add, rename, hide, merge); 自動帶入 is set per person, never hardcoded.
- 11-01 One set for everyone: twelve broad spending categories, two to four broad subs each (餐飲 早餐/午餐/晚餐/飲料點心; 交通 TPASS/搭車/長途/汽機車, YouBike, 捷運, 公車 and 計程車 all under 搭車; 購物 服飾美妝/3C 家電/日用品; 居住 房租房貸/水電瓦斯/電信網路/管理修繕; 娛樂 休閒/旅遊/運動; 數位; 醫療 看診/藥品/保險; 學習; 人情; 家人 孝親/育兒/寵物; 稅費; 其他). What was logged under an old set moves once, amounts untouched.
- 11-01 Meals stay three: 早餐/午餐/晚餐 apart; 宵夜 counts as 晚餐; no 三餐 sub. 11-03 No 聚餐 sub: a meal out counts as its meal.
- 10-31 Subs stay broad, because 統計 is built on them. 數位 (digital things: domains, AI plans, cloud, games) has four: 專案維運 (a project's running costs: TDX, domains, hosting), 工具訂閱, 影音串流, 遊戲. Upkeep and fun stay apart.

**Entering.**
- 10-27 記一筆: the amount is a field (the iPhone's keys, no keypad of our own); every category in view, no pages to swipe; something not set shows nothing (no example values). 預算 sits in 更多 until one is set, then in 統計.
- 10-30 記一筆 guesses kind, category, sub and way to pay from the person's own entries (time of day, weekday/weekend, place when allowed, past picks); the amount is only offered and fills on a tap. Location is opt-in (更多 › 智慧帶入), kept to about 100 m.
- 11-03 The guesses must be right far more often: a first week guesses from the hour as most people live it until their own entries outweigh it; a catch-up goes through the day in order; pay and bills on their day of the month; 智慧帶入's 猜中 counts only guesses made the current way. Any change is measured first: `TZ=Asia/Taipei node scripts/backtest-guess.mjs --against <ref>`.
- 11-03 轉帳 shows only what a transfer has: the amount, 從 and 到 (logo and balance, a swap), the day, 手續費, a note; it opens on the accounts usually moved between.
- 10-31 No 發票 features (no 對獎, 手機條碼, scanner or 載具 file): one 拍照記帳 for any picture (receipt, invoice, bill, app screenshot, transfer notice, price tag); the AI reads amount, day, store, items, category and way to pay; it opens as a filled entry to check, and a matching entry already logged (same amount, within a day) is offered to merge, never added twice.
- 11-10 拍照記帳 reads a paper 電子發票's QR codes on the phone first (exact number, day, total and items with no AI read; the seller's name from 經濟部's register), nothing to tap or see added; any other picture goes to the AI.
- 10-27 A TPASS (any sub with 有效天數) is counted down on 月曆, with a notice the evening before and the morning of its last day.

**統計 and the look.**
- 10-27 統計 is a full statistics area: every category with its subs and their share; every useful cut (account and way to pay, a category across months, against the period before, fixed vs day to day, fees, money back, largest, places, weekdays, income vs spending, any dates). 支出 and 收入 are separate views, never netted; the share kept is secondary, under 收入.
- 10-31 統計 and 帳戶 open dense: one short card, no chart when only one period has anything; groups of a list 16 apart; 分類 a small donut beside one split bar, each line's share and change, subs folded until tapped; a quick-facts strip.
- 11-03 統計's card has room and holds still: 支出/收入 and 篩選 on one row, 日 / 週 / 月 / 年 on its own row; the card leads with the period's name (its menu: recent periods and 自訂期間) and ‹ ›; two figures always; a pick or a step changes words and bars, never the card's size or the page's place. 自訂期間's days are our own centred text over the phone's picker.
- 10-27 Sheets fit their content; nothing that matters below the fold.
- 11-06 Days are the phone's (`localDay`); NT$ only.

## How it works

- **Tabs:** 月曆 (the month's card: with a budget, what's left a day; the picked day's week, the whole month under its handle; a day's entries) · 帳戶 (總資產, accounts by kind, 固定收支) · 統計 (numbers in `lib/stats.mjs`, tested; 篩選 switches every category and sub off and on; every row opens its entries) · 更多 (the tools as rows, 拍照記帳 first). The + adds an entry anywhere. Wide screens: `shell.mjs columns`/`flow` and `lib/columns.mjs evenCuts`; 更多's tools a grid with full rows (`evenRows`).
- **The books** (`lib/books.mjs`, pure, tested): accounts (cash, bank, 電子票證, 電子支付, credit, other; `inTotal: false` keeps one out of 總資產), debit cards on a bank, entries (`out`, `in`, `move`, `adj` a balance fix, `back` money back for a spend; `fee`, `also` a part paid another way), budgets, repeats (`r-<id>-<day>`), 到期提醒 (`renew`, `lib/renew.mjs`). Every total goes through `lines` (one function). Every record has `u`; a removal is a tombstone kept 120 days; devices merge record by record, newest `u` wins. Stored on the Pass as `m1:` + gzip base64 (`orbit-money`, 1 MB).
- **Categories** (`lib/cats.mjs`): the one set; old books move once (`books.opt.cats12`); `views/cat-edit.mjs` orders them with the kit's `reorder`.
- **拍照記帳** (`views/photo.mjs`): a paper 電子發票's QR codes read on the phone (`lib/receipt-qr.mjs`, ZXing WebAssembly in `vendor/zxing`, loaded only here); anything else to Orbit-Core `/money-read` (`money-read.js`, 30 a day a Pass) with the person's own categories and ways to pay. Several entries are looked over in one sheet. Never twice: `sameAs` / `matchBuys` offer 合併.
- **The guesses** (`lib/guess.mjs`, tested): every spend and income of the last half year is a clue, weighed by recency (half-life 45 days), weekday, place (`pl`, only with 用所在位置), the hour, what usually follows; monthly things count ten times; `COMMON`/`PRIOR` fill a first week; `guessAgain` once an amount or a store is typed. Each entry keeps what was guessed (`g`), so 智慧帶入 can count hits (`MODEL`, `guessReplay`).
- **The family's AI** (code first): 用說的記帳 (`lib/say.mjs`: plain "words amount" lines read on the phone; only the rest to `money-say`); 問我的帳 (`lib/ask.mjs`: the phone builds the tables, `money-ask` picks one or two and writes one line, every number checked; drawn as rows, never a paragraph); 每月回顧 (`lib/month.mjs`: last month's figures and one suggestion from what the card doesn't show, `patternOf`; `money-month` once a month).
- **車資記帳:** a trip Transit planned with its fare (the family's notebook, `transit.ride`) is offered on 月曆 for 12 hours (`lib/ride.mjs`); never saved on its own.
- **Logos** (`img/brand/`, `lib/logos.mjs`, `scripts/brand-logos.mjs`) and card networks (`img/network/`, `lib/networks.mjs`, payment-icons MPL-2.0).

## Files (`public/`)

| File | What |
| --- | --- |
| `app.mjs`, `shell.mjs`, `index.html`, `money.css`, `look.css` | Start, session and sync, tabs and columns, the page |
| `lib/books.mjs`, `cats.mjs`, `stats.mjs` | The books and every total; the categories; 統計's numbers |
| `lib/guess.mjs`, `say.mjs`, `ask.mjs`, `month.mjs`, `receipt-qr.mjs` | The guesses; 用說的記帳; 問我的帳's tables; 每月回顧; 電子發票 QR |
| `lib/renew.mjs`, `ride.mjs`, `columns.mjs`, `logos.mjs`, `brands.mjs`, `networks.mjs` | 到期提醒; 車資記帳; even columns; logos and card networks |
| `testing.mjs` | Money's switches in the kit's hidden 測試工具 (display and reads only, nothing saved): `moneyRead` (拍照記帳 cap/fail), `moneyAiCap`, `moneyBudget` (low/over), `moneyTpass`, `moneyRide`, `moneyNoticeDenied`, `moneyGeoDenied` |
| `views/` | Each tab and sheet: `calendar`, `accounts`, `stats`, `more`, `entry` (記一筆), `photo`, `say`, `ask`, `renew`, `cat-edit`, `pics` |

## Run and test

```bash
npm test
node tools/sample-books.mjs > /tmp/books.txt
node ../Orbit-Core/tools/preview.mjs money cal accts stats inv --webkit --width 320 --payload /tmp/books.txt   # add --dark
```

## If you change…

| This | Also check |
| --- | --- |
| What an entry means | `upgradeBooks` for books already logged; every total through `lines` |
| The guessing | `scripts/backtest-guess.mjs` before and after |
| The payload | older copies open; the merge by `u` |
