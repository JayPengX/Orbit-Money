# Orbit Money: the map

Your own books: what you spend each day and what each account holds,
any receipt or screenshot logged from a photo. Real money, kept apart from Orbit's play money.
Signs in with the Orbit Pass; the books sync on it.

Live: https://orbit.jaypengx.com/money/

## How it works

- **Tabs:** 月曆 (one short card: the month's spent / income / left and the
  total budget; the picked day's week, opened to the whole month by the handle
  under it and kept so on the phone (Jay 2026-10-30: today's entries must show
  on open); each day's spending in its square, days off from `#kit/dayoff.mjs`; a
  day's entries below) · 帳戶 (總資產, accounts by kind, 固定收支) · 統計
  (支出 and 收入 as two views, never netted, Jay 2026-10-27; one page, Jay
  2026-10-30: the scale 週 / 月 / 年 / 自訂 on top, the card with the period
  picked and up to twelve periods as bars (tap one to pick it, ‹ or a swipe
  for older; `trendOf`, `periodKey`), then everything about that period; 篩選
  is one sheet with a switch for every category and sub, and every figure is
  counted again without what's off (books `skip` in `lines`); numbers in `lib/stats.mjs`,
  tested: each category with its subs and their share of the whole (a donut on
  top, subs in their shades around it, Jay 2026-10-30; a category's sheet and
  支出組成 have one too; a tap names a slice), against
  the period before, by account and way to pay, fixed against day to day,
  fees and money back, the largest, places paid twice or more, weekdays, the
  month's pace, recent months, income against spending; every row opens its
  entries, a category's with its last twelve months) · 更多
  (拍照記帳 first, then the tools). The + adds an entry anywhere.
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
  spend; 訂閱/遊戲 from 娛樂 to 數位; 2026-10-31 數位's subs broad: 專案維運, 工具訂閱, 影音串流, 遊戲, 軟體 folded into 工具訂閱). **Category sets** (Jay 2026-10-30, too
  many 類別; `lib/cats.mjs PRESETS`): 學生 (11), 上班族 (13), 家庭 (13), 全部,
  picked once before the first 記一筆 and at the top of 更多 › 分類
  (`books.opt.preset`, `opt.picked`). A set only changes what the picker
  shows (nothing logged moves; a hidden one still names its history); the
  person's own hidden ones in `cats` are 「我的」, kept while a set is in use.
  Hiding, showing, adding, merging or deleting under a set first writes the
  set down as theirs (`ownPreset`). 到期提醒 (`renew`, lib/renew.mjs): any pass, subscription,
  membership or card fee, each with its start, how long it lasts, whether it
  renews itself, the category whose spend restarts it, and when to be told;
  `upgradeRenew` turns the old TPASS setting into the first item. Due ones show
  on 月曆 and become notices (`renew`, at its own time of day `tm`, 08:00 unless set);
  更多 › 到期提醒 (views/renew.mjs) edits them. Every record has `u`; a removal is a tombstone kept 120
  days; two devices merge record by record, newest `u` wins. Stored on the
  Pass as `m1:` + gzip base64 (`orbit-money`, 1 MB).
- **拍照記帳** (`views/photo.mjs`; Jay 2026-10-31: no 發票 features, one
  general tool): any picture (a receipt, an invoice, a bill, a store,
  delivery or payment app's screenshot, a transfer notice, a price tag) goes
  to the Worker's `/money-read` (Orbit-Core `money-read.js`, Gemini
  Flash-Lite, 30 a day a Pass) with the person's categories and ways to pay,
  and comes back as entries: kind, day, store, total, items, category and
  way to pay (only from their own lists; none read, the store's words guess
  the category and the usual guesses the way to pay). Picking the picture is
  the tap; nothing is saved unseen. One opens as a filled 記一筆 (the camera
  button is in its top corner, and 更多's gold button); several (a list on a
  screenshot) are looked over in one sheet, each row added, merged or left out.
  The store and items are kept on the entry (`inv`, shown as a receipt).
- **Never twice** (`lib/books.mjs sameAs` / `matchBuys`, tested; Jay
  2026-10-31, a NT$68 全家 typed in and then its receipt): a picture's entry
  that is the same kind and amount as one logged on its day or a day either
  side is offered on top of 記一筆 as 合併 (its own day first, then a note
  naming the store, then the latest; the same 發票號碼 always). Merging keeps
  the logged amount, day and way to pay and adds the store and items. (Why it
  was missed before: only the 載具 file was ever matched, never a scan.)
- **記一筆's guesses** (`lib/guess.mjs`, tested; Jay 2026-10-30: "a guess
  of everything"): every spend and income of the last half year (not `r-`
  repeats or automatic top-ups) is a clue, weighed by how close its logged
  hour is (`t`, Taiwan time; only one logged on its own day, not an import),
  weekday or weekend, where (`pl`, "lat,lon" to 3 decimals, only with 更多 ›
  智慧帶入 › 用所在位置 on, `opt.geo`) and how recent (half-life 45 days).
  Then today's own entries: a thing logged today counts by how often it
  comes twice in a day (no second lunch), what usually follows the last
  one logged counts more (`habitsOf`), and entries logged within minutes of
  each other (an evening catch-up) don't count their hour.
  A blank + picks the kind, category, sub and way to pay; a category tapped
  gets its own likeliest sub and way to pay (until the person picks one; a
  category's own 自動帶入 still wins). The amount is never filled from a
  guess: the likeliest is first and ringed in 常用, a tap fills it. Each new
  entry keeps what was guessed (`g`: "cat|sub|a|via|amt"); 智慧帶入 shows how
  many of the last 50 were right, and until there are 10 of those, the
  guesses replayed on the books (`guessReplay`: each entry guessed again from
  what was logged before it). On simulated habits (an evening catch-up 3
  days in 10) the today signals took category+sub from 49% to 61% right.
- **Logos** (`img/brand/`, `lib/logos.mjs`): each bank's or wallet's own
  icon (`scripts/brand-logos.mjs`, a few from its App Store app); one with
  none uses its kind's icon.
- **Card networks** (`img/network/*.svg`, `lib/networks.mjs`, Jay
  2026-10-30): a credit card and any card under an account can be on Visa,
  Mastercard, JCB, American Express, UnionPay, Diners Club or Discover
  (`net`, picked as 卡別). A card under a credit card is on the card's unless
  set. Shown in the corner of the bank's or wallet's logo (36 px and up), or
  alone where the card has no other picture (`views/pics.mjs`). Marks from
  payment-icons (MPL-2.0, `img/network/LICENSE.txt`).
