# Orbit Money: the map

Your own books: what you spend each day and what each account holds,
any receipt or screenshot logged from a photo. Real money, kept apart from Orbit's play money.
Signs in with the Orbit Pass; the books sync on it. In Orbit's own look (Jay
2026-11-03, Orbit-Core DESIGN §11): `data-look="native"` on the page, `look.css`
after `money.css`; the kit draws the month's card graphite, the gold only on
the budget's bar and the +.

Live: https://orbit.jaypengx.com/money/

## How it works

- **Days are the phone's** (2026-11-06, users outside Taiwan): today and the guesses' hours follow the phone's clock (`shell.mjs today`, `lib/guess.mjs hourOf`, kit `localDay`); in Taiwan nothing changed. NT$ only.

- **Tabs:** 月曆 (one short card: with a budget this month, what's left to
  spend is the big number, what it is a day and the days it has to last under
  it, spent beside it, the bar's mark where the month is today (`monthLeft`,
  `leftCard`); otherwise the month's spent / income / left; the picked day's week, opened to the whole month by the handle
  under it and kept so on the phone (Jay 2026-10-30: today's entries must show
  on open); each day's spending in its square, days off from `#kit/dayoff.mjs`; a
  day's entries below) · 帳戶 (總資產, accounts by kind, 固定收支) · 統計
  (支出 and 收入 as two views, never netted, Jay 2026-10-27; one page, Jay
  2026-10-30; roomy and still, Jay 2026-11-03: 支出/收入 and 篩選 on one row,
  the scale 日 / 週 / 月 / 年 on the next, then the card: the period's name
  (its menu: recent periods and 自訂期間, `pickPeriod`, `openCustom`) with ‹ ›,
  the total, two figures always, and the periods as bars (a week of days, else
  up to twelve; tap one to pick it, a swipe steps; they turn a page only when
  a step leaves them, `windowOf`, `trendOf`, `periodKey`), the average named
  under them; a redraw goes through `hooks.render` so the title stays and
  nothing moves), then everything about that period; 篩選
  is one sheet with a switch for every category and sub, and every figure is
  counted again without what's off (books `skip` in `lines`); numbers in `lib/stats.mjs`,
  tested: each category with its subs and their share of the whole (a donut on
  top, subs in their shades around it, Jay 2026-10-30; a category's sheet and
  支出組成 have one too; a tap names a slice), against
  the period before, by account and way to pay, fixed against day to day,
  fees and money back, the largest, places paid twice or more, weekdays, the
  month's pace, recent months, income against spending; every row opens its
  entries, a category's with its last twelve months) · 更多
  (the tools as rows, each saying what it does and where it stands, 拍照記帳
  first). The + adds an entry anywhere.
- **Every screen** (Jay 2026-10-31; Orbit-Core DESIGN.md §10): a phone upright
  is one column; on its side or a tablet two, a computer three (`shell.mjs`
  `columns` for 月曆's month beside the day, `flow` for 帳戶 and 統計: the
  phone's order cut into even columns; 更多's tools a grid of cards with no
  lone one on the last row). The page redraws when the screen changes
  (`onScreen` in app.mjs). On a phone on its side 記一筆 puts the categories
  in a column beside the rest (money.css `.mn-part`).
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
  spend; 訂閱/遊戲 from 娛樂 to 數位; 2026-10-31 數位's subs broad: 專案維運, 工具訂閱, 影音串流, 遊戲, 軟體 folded into 工具訂閱). **One set of categories** (Jay 2026-11-01, `lib/cats.mjs`): twelve broad
  spending ones for everyone, each with two to four broad subs (交通: TPASS,
  搭車 for YouBike, 捷運, 公車 and 計程車, 長途, 汽機車). Books from the old 20
  and their subs move once (`books.opt.cats12`: entries, repeats, reminders,
  money back, the guess stamps; two budgets that became one add up; the
  person's own subs go with their category). The presets (學生/上班族/家庭)
  and their picker are gone. 分類 (`views/cat-edit.mjs`): categories and subs
  put in order by their grips (kit `reorder`, `orderCats`). 到期提醒 (`renew`, lib/renew.mjs): any pass, subscription,
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
  repeats or automatic top-ups) is a clue, weighed by how recent (half-life
  45 days), weekday or weekend, where (`pl`, "lat,lon" to 3 decimals, only
  with 更多 › 智慧帶入 › 用所在位置 on, `opt.geo`), and the hour it
  happened: when it was logged if it was logged as it happened, else when
  the person usually does that thing (the bus both ways counts at both),
  else when most people do (`USUAL`: breakfast about 07:30). Logged as it
  happens, the hour wanted is now; in a catch-up (within 15 minutes of the
  last, or for an earlier day) it's soon after the last thing written down
  for the day, as people go through a day in its order; late at night with
  nothing yet for the day, partly the day's first, as often as the person's
  days are written down at night. Then the day's own entries: a thing done
  counts by how often it comes twice in a day (no second lunch), and what
  usually follows the last one counts more (`habitsOf`). Once a month on
  about this date (pay, rent: two months or more) counts ten times. With
  little history what most people log comes in (`COMMON`: about two dozen
  things, each with how often a week, its weekday and weekend hours, and its
  usual amount and how far amounts stray), worth a few entries of the
  person's own at first and fading as theirs grow (`PRIOR`), so a first week
  starts on the meal, the bus or the drink of the hour (Jay 2026-11-03: "if
  we rely solely on user behavior they need to use like months"). Once an
  amount is typed, or a note naming a store (`subFromWords` in
  `lib/cats.mjs`), and no category or sub picked yet, 記一筆 guesses again
  (`guessAgain` in `views/entry.mjs`, the `amt` of `cluesFor`): each clue
  counts by how near its amount is (the person's own: NT$25 at 08:00 is the
  bus, NT$60 breakfast; most people's: NT$10,000 in the morning is the rent).
  `guessNew` is what a blank + starts on (kind, category, sub,
  way to pay); a category tapped gets its own likeliest sub and way to pay
  (until the person picks one; a category's own 自動帶入 still wins). The
  amount is never filled from a guess: the likeliest is first and ringed in
  常用, a tap fills it. Each new entry keeps what was guessed (`g`:
  "cat|sub|a|via|amt|model"); 智慧帶入 shows how many of the last 50 guessed
  the current way (`MODEL`) were right, and until there are 10 of those, the
  same guesses replayed on the books from the first entry (`guessReplay`).
  `TZ=Asia/Taipei node scripts/backtest-guess.mjs --against <ref>` replays
  made-up people from their first entry, the way 智慧帶入 counts it
  (2026-11-03, category and sub right in week one: a student 28→48%, an office
  worker 47→58%, one who writes it all down at night 19→41%; over 60 days
  50→58%, 67→70%, 42→53%; then with the amount typed, `--typed`, `MODEL` 3:
  week one 48→77%, 58→87%, 41→74%, a nurse 40→54%, a parent 41→48%; over 60
  days 58→88%, 70→92%, 53→85%). Run it before and after any change to the guessing.
- **轉帳** (Jay 2026-11-03: "why so many other things from 收入/支出"): only
  what a transfer has: the amount, one card with 從 over 到 (each account's
  logo and balance, a round button between them turns it around; picking the
  other side's account turns it around too), the day, 手續費 as its own pill,
  a note. It opens on the two accounts the person usually moves between
  (`guessMove`, not the automatic top-ups) with that pair's usual amounts as
  常用 chips; else from a bank to another account, never from a card.
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
