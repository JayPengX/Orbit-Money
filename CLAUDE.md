# Working on Orbit Money

Read `../Shared-Proxy/docs/TRUTH.md` first (one page: how the owner works and what matters).
MAP.md is this repo's map (README.md is the short public front page).

- `npm test`, then `git push origin HEAD:main`.
- See it on a phone: `node tools/sample-books.mjs > /tmp/books.txt`, then
  `node ../Shared-Proxy/tools/preview.mjs money cal accts stats inv --webkit --width 320 --payload /tmp/books.txt` (add `--dark`).
- Real money: never invent entries, balances or categories the person didn't give.
