# Working on Orbit Money

Read `../Orbit-Core/docs/TRUTH.md` first (one page: how the owner works and what matters).
MAP.md is this repo's map (README.md is the short public front page).

- `npm test`, then `git push origin HEAD:main`.
- See it on a phone: `node tools/sample-books.mjs > /tmp/books.txt`, then
  `node ../Orbit-Core/tools/preview.mjs money cal accts stats inv --webkit --width 320 --payload /tmp/books.txt` (add `--dark`).
- Real money: never invent entries, balances or categories the person didn't give.
- Screenshots for a change: `node ../Orbit-Core/tools/shots.mjs money --before main` (320/390, light/dark, live data, a diff against what's live; `../Orbit-Core/tools/README.md`).
