# Task: count plays in Cloudflare Web Analytics

We want to know how many times people actually play TRON: each time someone starts a run in a mode, not each time the page loads. Use the same mechanism as the installed-app start tracking, which is already in the repo:

- `src/pwa/launch.js`: when TRON runs as an installed app, it loads `public/pwa-start.html` in a hidden iframe once per launch.
- `public/pwa-start.html`: contains only the Cloudflare beacon, wrapped in the `<template data-colvmn-analytics>` + inline loader. That wrapper skips analytics in browsers opted out with `?analytics=off`. Each load shows up in Cloudflare as a view of that path.

There's no backend involved. The stats side (the dekorte.com page-view board and daily summaries) already leaves anything under `/fun/TRON/events/` out of the page-view count, and will report those paths as plays.

## What to build

1. **One marker page per mode,** at `public/events/play-<mode>.html`. For example `play-grid.html` for Clu's tank on the grid, and `play-cycles.html` for the light-cycle arena. Use whatever modes the game really has, with short kebab-case names. Copy `pwa-start.html` exactly, including the `<template>` + loader block with the same token and `noindex`, and change only the title and comment.
2. **A small helper,** such as `src/analytics/mark-play.js` exporting `markPlay(mode)`, called at the moment a play really starts. You choose the exact trigger: when the player gains control in a mode, or when an arena match starts. A restart or new round that starts a fresh run counts as a new play. Opening menus, the attract screen and page loads don't count. Write down the definition you pick in a comment.
   - **Production only:** do nothing unless `import.meta.env.PROD`, the same as `launch.js`.
   - **One iframe at a time:** remove the previous play's iframe before adding the next, so iframes don't pile up during long sessions. Leave each one in place for a few seconds so its beacon can report.
   - **Never break the game:** wrap it in try/catch, and make sure nothing waits on it.
3. **Keep the marker pages out of the offline precache.** `scripts/build-pwa.mjs` only precaches `index.html`, `mcp.html`, the manifest, and the `assets`, `audio`, `fonts`, `images`, `icons` and `bit` folders. An `events/` folder is left out automatically; keep it that way. If the marker pages were served from the app's offline cache, plays would still be counted online, but it's simpler to keep them as network-only.
4. **Leave the app-start tracking alone.** Keep `launch.js` and `pwa-start.html` working as they are. You may move the iframe code into the shared helper, as long as `launch.js` keeps the same behavior.

## How to test (no real reports to Cloudflare)

- Build into a scratch folder with `npx vite build --outDir <tmp>`, serve it locally, and drive it with Playwright from this repo (`PLAYWRIGHT_BROWSERS_PATH=$PWD/.playwright-browsers`).
- Intercept the beacon's reports with `context.route('**/cdn-cgi/rum**', …)`. Record the `"location"` in each POST body, then abort the request.
- **Check that:**
  - starting each mode produces exactly one report for its marker path;
  - restarting produces another;
  - loading the page and browsing menus produces none;
  - a context with `localStorage['colvmn:no-analytics']='1'` produces none;
  - the dev server (`npm run dev`) produces none.

## When done

Commit only the files for this change; this working tree often has unrelated uncommitted edits. Report the mode names you used and the exact trigger points. You can delete this file once the work is in.

Like page views, plays are missed when made offline or with an ad blocker, and opted-out browsers aren't counted.
