<p align="center">
  <img src="public/icons/icon-192.png" width="96" height="96" alt="">
</p>

<h1 align="center">Orbit Money</h1>

<p align="center">
  <b>Every dollar, in its place.</b><br>
  <a href="https://jaypengx.com/money/"><b>jaypengx.com/money</b></a>
</p>

<p align="center">
  <img alt="JavaScript" src="https://img.shields.io/badge/JavaScript-ES_modules-F7DF1E?logo=javascript&logoColor=000"> <img alt="PWA" src="https://img.shields.io/badge/PWA-works_offline-5A0FC8?logo=pwa&logoColor=fff"> <img alt="Cloudflare" src="https://img.shields.io/badge/Cloudflare-Workers-F38020?logo=cloudflare&logoColor=fff"> <img alt="GitHub" src="https://img.shields.io/badge/GitHub-Pages-24292F?logo=github&logoColor=fff"> <img alt="Tests" src="https://img.shields.io/badge/Tests-node_--test-339933?logo=nodedotjs&logoColor=fff">
</p>

Your own books for real money: what you spend each day, what each account holds, and whether an invoice won. Part of **Orbit**, a family of phone apps for life in Taiwan that share one sign-in, the Orbit Pass. See them all at [jaypengx.com](https://jaypengx.com/).

## What it does

- **Calendar:** each day's spending in its square, with the month's total and budget.
- **Accounts:** cash, banks, cards and e-wallets, with each bank's own logo.
- **Stats and budgets** by week, month and year.
- **Invoices (發票):** scan the QR code, import the e-invoice carrier list, and check the draw.
- **Syncs** between devices through the Orbit Pass.

## Stack

- Plain JavaScript (ES modules), HTML and CSS: no framework, no build step, no runtime dependencies.
- An installable phone web app (Add to Home Screen), cached by a service worker.
- The look, sign-in (the Orbit Pass) and notices come from the shared kit in [Shared-Proxy](https://github.com/JayPengX/Shared-Proxy).
- Live data goes through the Orbit proxy on Cloudflare Workers (`api.jaypengx.com`). Invoice draws from 財政部, store names from GCIS.
- Hosted on GitHub Pages and served at jaypengx.com by a Cloudflare Worker; every push to `main` tests and deploys.

## For developers

```bash
npm test
```

How it works, file by file, and the decisions still in force: **[MAP.md](MAP.md)**.
