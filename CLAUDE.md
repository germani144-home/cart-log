# Working on Home log (repo: cart-log)

Rules for any Claude chat working on this repo.

## Scope
- One chat per app: a chat working on Home log touches only `germani144-home/cart-log`. Don't read or push other repos (nap-log, lift-log); tell Pedro to use that app's chat instead.
- Always fetch and reset to the latest `origin/main` before editing. Another chat may have pushed since you last looked.

## Every change
- Update `README.md` in the same commit whenever a change adds, removes or changes a feature, a setting, the data layout, the Firestore rule, the files, or the setup steps.
- Bump the version on every release that changes app files, in both places with the same number: the `v1.0`-style label next to "Home log" in `index.html`, and the cache name `cart-log-X.Y` in `sw.js`. Small fix or tweak: +0.1. Big feature or redesign: next whole number. Tell Pedro the new version number when you push.
- Test before pushing: `npm test` runs the unit tests, the end-to-end tests (emulated Android and iPhone with touch, fake Firestore) and the screenshot comparison; all must pass. Add or update tests with the change: rules go into `js/logic.js` with a unit test in `tests/unit/logic.spec.js`, flows into `tests/e2e/`. Update screenshots only for an intended visual change (`npx playwright test tests/e2e/visual.spec.js --update-snapshots`) and look at them first.
- Run `npm run format` (Prettier) before committing.
- No build step: the app is plain static files served by GitHub Pages from `main`. `package.json`, `tests/` and the config files are dev-only; the app never loads them.

## Code layout
- `index.html` is markup only; styles are in `styles.css`; code is in `js/`, loaded as plain scripts in this order: `ios-manifest.js` (in `<head>`), then `logic.js`, `core.js`, `sync.js`, `groceries.js`, `tabs.js`, `recipes.js`, `todos.js`, `gestures.js`, `settings.js`, `backup.js`, `boot.js`. They share one global scope: code that runs while a file loads may only use names from that file or earlier ones.
- `js/logic.js` holds the rules as plain functions: no `document`, no `localStorage`, no Firestore, no app state (pass data in). Keep it that way so it stays unit-testable in Node.
- A new file in `js/` goes into `index.html` (in load order) and into `SHELL` in `sw.js`, or the app breaks offline; `tests/unit/files.spec.js` checks this.
- The cache-name line in `sw.js` (`const CACHE=PREFIX+'X.Y';`) keeps that exact spacing (it has `prettier-ignore`); "Check for updates" and a test read it.
- README "How it works" describes the files, data layout, sync and tests; keep it in step.

## Don'ts
- Keep personal details (Firebase project sharing, names) out of public files like the README.
- Firestore data lives under `lists/{code}/{items|catalog|cats|todos|dishes|meta}`; don't move it without a migration, or existing lists disappear.
- Private to-do lists live under each phone's own private code (`localStorage` `cart-log.me`): `lists/{me}/{todos|meta}`. Never write private data under the shared list code, and never show the private code anywhere but the ⋯ menu. Home's to-dos have no `list` field; keep it that way so older data still shows.

## Security rules
- `index.html` has a Content-Security-Policy with no `'unsafe-inline'` for scripts: no inline `<script>` blocks and no `on…=` attributes; put code in `js/` and wire events with `addEventListener`. If a feature needs another address, add exactly that address to the right directive (`connect-src` for data, `script-src` for scripts) and say so in the README. Never add `*` or broad wildcards.
- Anything that came from Firestore, the catalog or the user goes through `esc()` before it is put into HTML (text and attributes, ids included). Prefer `textContent` where possible.
- No secrets in this public repo, and no personal data (lists, exports) committed. Export files (`home-log-*.json`) are in `.gitignore`; never commit one.
- Export/import (`EXP_VERSION`, `SPEC`, `metaSpec` in `js/logic.js`): when a document gets a new field, add it to the spec too, or exports drop it and imports reject it. If the file format changes incompatibly, bump `EXP_VERSION` and keep reading the old version.

## Address and storage rules

Home log lives at https://germani144-home.github.io/cart-log/ (repo `germani144-home/cart-log`, moved from `Germani144/cart-log` on 2026-10-20).

**One installable app per address.** Chrome on Android lets only one app per address (origin) be installed: a second app on the same address shows "This app is already installed" and can't be installed (found 2026-10-20). So every app Pedro installs needs its own address. Nap Log is the installed app on `germani144.github.io`; Lift Log moved to `germani144-lift.github.io` and Home log to `germani144-home.github.io` (each its own free GitHub organization). Changes that apply to every app at once are made from Pedro's orchestration chat; they never touch UI or calculations. Never move Home log back onto an address another installable app uses. The rules below still apply, so Home log stays clean if it ever shares an address again.

- **Service worker:** Cache names start with `cart-log-` (the cache is `cart-log-X.Y`, same number as the version label). The pinned Firebase SDK on gstatic.com is the one outside file it also handles, because offline sync needs it (it loads as a cross-site script, so its response is opaque and never stored; offline it comes from the phone's HTTP cache, which the worker leaves it to). On activate, delete only caches with that prefix (never "every cache but the current one"). Read from this app's own cache (`caches.open(C).then(c => c.match(...))`), never the global `caches.match()`. Only handle requests whose URL starts with `self.registration.scope`; leave other apps, the GitHub API and other origins alone.
- **Updates (cache-first, same in all of Pedro's apps since 2026-10-25):** open the app from this version's own cache, never network-first (with many files it made every open wait for one round trip per file). The install downloads every app file fresh (`?v=` plus `cache: 'reload'`) into the new version's cache and fails as a whole if one file fails; files not in the cache are fetched with `{cache: 'no-cache'}` (the pinned SDK may use the HTTP cache); store only `r.ok` responses. Register the worker with `{scope: './', updateViaCache: 'none'}`, call `reg.update()` when the app becomes visible, and reload once on `controllerchange` (not on the first install). So a release only reaches phones if the version in the cache name changes. `tests/e2e/ui.spec.js` checks that opening downloads no app files and that a release takes over by itself.
- **Storage:** every `localStorage` key starts with `cart-log.` (use the `load`/`save` helpers).
- **Manifest:** `scope` and `start_url` are `./`. **Never change the manifest `id`**, not even to fix an install problem, unless Pedro explicitly asks for it in that chat. The id is how Android recognises the installed app: changing it orphans the installed copy. If installing fails on the phone, investigate and report; don't change the id.
- Keep Firebase initialised as the named app `cart-log` (never the default app): Nap Log uses the same Firebase project, and the app name keeps Firestore's offline database and `firestore_…` keys separate if the apps ever share an address again.
- The manifest `id` is `cart-log-v1`.
- On iPhone/iPad the manifest is deliberately not linked (`js/ios-manifest.js`, loaded in `<head>`), and in the browser the address keeps `?list=CODE`: that's how the home-screen app, whose storage is separate from Safari's, starts already in the list. Don't strip the code from the URL or link the manifest on iOS.

## Notes
- The app reloads itself once when a new service worker takes over, so updates show on the next open. Re-installing is only needed for icon or name changes on the home screen.
