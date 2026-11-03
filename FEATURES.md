# Features kept

Every feature a person uses in this app, with the code that makes it.
`tests/features.test.mjs` fails if any mark below disappears, so a refactor cannot
drop a feature silently (2026-11-03, after the lost-features audit).
To remove a feature on purpose, delete its line here in the same commit and say why.
- 餐飲's 早餐, 午餐, 晚餐 apart (Jay 11-01) — `public/lib/cats.mjs`: `'breakfast', '早餐'`, `'lunch', '午餐'`, `'dinner', '晚餐'`, `splitMeals`
- The twelve categories, old books moved once — `public/lib/cats.mjs`: `broadCats`
- 收入's 中獎 — `public/lib/cats.mjs`: `id: 'prize'`
- TPASS and YouBike show their own logos — `public/views/pics.mjs`: `'transport:tpass': 'tpass'`, `YOUBIKE`
- 拍照記帳, a match offered to merge — `public/views/photo.mjs`: `拍照記帳`, `mergeInto`
- 自動帶入 per category, guesses from your own entries — `public/lib/cats.mjs`, `public/views/more.mjs`: `智慧帶入`
- 記一筆's first guess: what most people log at the hour and amount in a first week, catch-ups in the day's order, payday on its date; guessed again once the amount or a store's name is typed (Jay 11-03) — `public/lib/guess.mjs`: `COMMON`, `USUAL`, `nightShare`, `monthly`, `guessNew`, `MODEL`; `public/views/entry.mjs`: `guessAgain`; `public/lib/cats.mjs`: `subFromWords`
- 轉帳 only a transfer's fields: 從 over 到 with logos and balances, a swap, 手續費, the usual pair guessed (Jay 11-03) — `public/views/entry.mjs`, `public/lib/guess.mjs`: `paintMove`, `mn-xfer-swap`, `mn-fee-pill`, `guessMove`
- 自動加值 on stored-value cards — `public/lib/books.mjs`: `autoReload`
- Money back, fees, 朋友分攤, LINE Points — `public/lib/books.mjs`, `public/views/entry.mjs`: `backsFor`, `feeOf`, `朋友分攤`, `LINE Points`
- Card networks (卡別) — `public/views/accounts.mjs`, `public/views/pics.mjs`: `卡別`, `netTile`
- 到期提醒 and the TPASS countdown — `public/views/renew.mjs`: `reminderTile`
- Budgets — `public/views/stats.mjs`: `budget`
- 不計入 — `public/lib/stats.mjs`: `不計入`
