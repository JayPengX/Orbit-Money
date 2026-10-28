# Orbit Money: the map

Your own books: what you spend each day, what each account holds, and
whether an invoice won. Real money, kept apart from Orbit's play money.
Signs in with the Orbit Pass; the books sync on it.

Live: https://orbit.jaypengx.com/money/

## How it works

- **Tabs:** 月曆 (the month's spent / income / left and the total budget;
  each day's spending in its square, days off from `#kit/dayoff.mjs`; a
  day's entries below) · 帳戶 (總資產, accounts by kind, 固定收支) · 統計
  (支出 and 收入 as two views, never netted, Jay 2026-10-27; week / month /
  year / any dates from the period's label; numbers in `lib/stats.mjs`,
  tested: each category with its subs and their share of the whole, against
  the period before, by account and way to pay, fixed against day to day,
  fees and money back, the largest, places paid twice or more, weekdays, the
  month's pace, recent months, income against spending; every row opens its
  entries, a category's with its last twelve months) · 發票
  (手機條碼, scan, 載具 import, 對獎). The + adds an entry anywhere.
- **The books** (`lib/books.mjs`, pure, tested): accounts (cash, bank,
  電子票證, 電子支付, credit, other; `inTotal: false` keeps one out of
  總資產), debit cards on a bank, entries (`out`, `in`, `move` between own
  accounts, `adj` a balance fix, `back` money back for a spend: a 退款 or a
  friend's share, which comes off the spend and is never income; a spend or
  move can carry a `fee`, counted under 稅費 › 手續費, and `also`, a part paid
  another way such as LINE Points), budgets, repeats (added on their day as
  `r-<id>-<day>`). Every total goes through `lines` (one function: a spend
  less what came back, its fee, an income). `upgradeBooks` / `upgradeCats`
  bring older books up on open (退款 income → money back for its likeliest
  spend; 訂閱/遊戲 from 娛樂 to 數位). 到期提醒 (`renew`, lib/renew.mjs): any pass, subscription,
  membership or card fee, each with its start, how long it lasts, whether it
  renews itself, the category whose spend restarts it, and when to be told;
  `upgradeRenew` turns the old TPASS setting into the first item. Due ones show
  on 月曆 and become notices (`renew`, at its own time of day `tm`, 08:00 unless set);
  更多 › 到期提醒 (views/renew.mjs) edits them. Every record has `u`; a removal is a tombstone kept 120
  days; two devices merge record by record, newest `u` wins. Stored on the
  Pass as `m1:` + gzip base64 (`orbit-money`, 1 MB).
- **發票** (`lib/invoice.mjs`, tested): both QR codes of a paper
  電子發票證明聯 (Big5, UTF-8 or Base64 items), the draw and its prizes,
  the 手機條碼 as a Code 39 barcode (black on white: tills need it).
  The camera (`views/scan.mjs`) reads with BarcodeDetector, else jsQR
  (`vendor/jsqr.mjs`, Apache-2.0) on the frame and each half.
- **載具** (a person can't get 財政部's AppID): the CSV the 電子發票平台
  exports (查詢消費發票 › 匯出) read by `#kit/carrier-csv.mjs`, picked in
  the app (`views/carrier-import.mjs`). Each invoice is `inv-<number>`, so
  nothing comes in twice, and one matching a purchase logged by hand (same
  amount, its day or next to it; `lib/books.mjs matchInvoices`) is attached
  to it instead of added. No mail-in (Jay 2026-10-27: 財政部 only mails
  monthly, and handing over the 載具's email is too much to ask).
  The category is guessed from the store and items (`lib/cats.mjs guessCat`).
- **Proxy** (`https://invoice.orbit/…` through `proxyJson`, Orbit-Core
  `invoice.js`): `win.json` the last draws (財政部's invoice.xml),
  `seller.json?ids=` names behind 統編 (經濟部 GCIS).
- **Logos** (`img/brand/`, `lib/logos.mjs`): each bank's or wallet's own
  icon (`scripts/brand-logos.mjs`, a few from its App Store app); one with
  none uses its kind's icon.
