# Home log

A shared grocery list, to-do list and list of dishes for a household, synced live between phones.
Works on Android and iPhone as an installable web app, no accounts needed, and keeps working offline.

Live: https://germani144-home.github.io/cart-log/ (the repo kept its original name, `cart-log`). It moved from `germani144.github.io` on 2026-10-20 because Chrome on Android installs only one app per address; after the move, enter the list code once on each phone.

## Features

**Groceries**
- Add items in Danish or English (`2 mælk`, `milk`, `æbler`). Search ignores æ/ø/å spelling differences.
- Built-in item database of ~280 items in 16 categories, each with a Danish and English name and a sensible default amount (milk 1 l, eggs 10 pcs, coffee 500 g).
- Unknown items go straight onto the list under Andet / Other, no questions asked. Tap one later to give it a category (existing or new), an English name and a standard amount; it's then saved to the shared database, so next time it lands in the right category.
- One-off buys: the edit screen of an item you added yourself has **Forget item** at the top, which removes it from the list and from the saved database so it stops being suggested. ("Remove from list" keeps it saved. Built-in items can't be forgotten.)
- List grouped by category, each with its own colour; new categories get a colour picker.
- Amount and unit per item (pcs, g, kg, ml, dl, l, pack, can, bottle, bunch) with one-tap − / + right on the row.
- Tick items into "In the cart", clear them all when you're done shopping.

**To-dos**
- Several lists, picked with chips at the top of the tab. **Home** is the original shared list (tap it again to rename it or change its icon); **＋ New list** makes another one with a name and icon.
- Each new list is either **shared** (everyone with the list code sees it) or **private** (🔒, only this phone). Private lists are stored under the phone's own private code, which is never shared; it's shown in ⋯ → *Your private lists*, and *Restore private lists from another phone* brings them back on a new phone. A private list stays private (it can't be turned into a shared one).
- Tap the selected list's chip again to rename it, change its icon, or delete it with its to-dos.
- The title on the list card ("To do" for Home, the list's name for others) can be renamed by tapping it; clearing it brings back the default. Shared lists sync the title, private ones keep it private.
- Each list is an ordered list of bulleted to-dos (up to 50 open). Tap **H** next to the input to add the next entry as a **heading** instead (it switches back after one); headings group to-dos into sections, show bigger and bolder than to-dos, and have no tick box. Hold and drag a heading to move its whole section (its to-dos fold under it while dragging and come along); drag a single to-do to reorder it within a section or move it to another. To-dos above the first heading stay on top. Deleting a heading asks first; its to-dos stay in the list. Tap the ▾ arrow on a heading to fold its section (the heading shows how many items are hidden); folding is per phone and remembered, and adding an item to a folded last section unfolds it. The tab badge counts the open to-dos (not headings) of the list you're on.
- Paste several lines into *Add an item…* to add them all at once: lines starting with `-` (or `•`, `*`) become to-dos, other lines become headings, and a bare `-` is skipped. It asks before adding.
- Tick to move an item to Done (struck through, faded).

**Recipes**
- A shared, alphabetical list of saved dishes (e.g. Lasagne, Chili sin carne) under a title you can rename (tap the heading; the name is shared by everyone on the list). Add one by name; adding a name that's already saved just says so.
- Tap a dish to open its recipe: name, ingredients, and how many people the amounts are for (default 2). ✕ on the row deletes the dish.
- Ingredients come from the same item database as the grocery list (same search, æ/ø/å-proof). Pick one and its unit is filled in from the database and fixed; you only type the amount (e.g. 500 g, 1 l, 10 pcs). Typing `500 g mel` when flour is stored in kg gives 0,5 kg.
- An ingredient that isn't in the database yet gets a unit picker once; on Save it's added to the database under Andet / Other (it doesn't show up as a grocery suggestion until it's been bought).
- A brand-new list starts with one classic already in its recipes: Rachel's trifle (ladyfingers, jam, custard, raspberries, beef sautéed with peas and onions, bananas, cream). Delete it like any other dish. Lists you join keep what they have.
- **Starter dishes:** the *＋ Add N starter dishes with recipes* button under the dish list (also in ⋯) adds 35 everyday dishes (stews, quesadillas, halloumi dishes, noodle bowls…) with recipes for 2 from `dishes-pack.json`. Dishes the list already has (same name) are skipped, and missing ingredients (halloumi, chorizo, gyoza…) are added to the item database; nothing already saved is changed, so it's safe to tap again. The button under the list disappears once the list has them all. Pantry staples (salt, pepper, oil, flour, sugar, stock, dried spices, soy sauce, mayo, mustard, peanut butter, honey) are left out of the recipes on purpose.
- **Add to grocery list** asks for how many people, shows the scaled amounts, and puts every ingredient on the list. Countable units (pcs, pack, can…) round up. If an ingredient is already on the list, its amount is topped up (g↔kg and ml↔dl↔l are converted); if the units can't be combined, it's left as is and named in the message.

**General**
- Three tabs (Groceries, To-dos, Recipes); swipe left or right to switch, with live feedback while dragging. On narrow phones the tab icons sit above the labels and counts show as small badges.
- Share a list with its 8-character code or invite link (`?list=CODE`). Anyone with the code can see and edit it.
- Opening an invite link joins the list straight away, and the code stays in the address. On iPhone that matters: a home-screen app has its own storage, separate from Safari, so "Add to Home Screen" from that page installs an app that's already in the list. (The installed app only uses that code if it has no list yet, so leaving or switching lists in the app sticks.)
- Offline-first: changes made without signal sync when the phone is back online.
- Updates install themselves; the app reloads once when a new version is available. ⋯ → **Check for updates** compares with the version on the server and, if there's a newer one, clears the app's cache and reloads straight into it.
- The version (e.g. v1.0) shows next to the title, so you can tell which build a phone is running.
- Follows the phone's light or dark mode.
- **Backup:** ⋯ → **Export data** downloads `home-log-YYYY-MM-DD.json` with this shared list's groceries, item database, categories, to-dos, recipes and list settings, plus this phone's private to-dos as a separate section. List codes are never in the file. The file is made in the browser, so nothing is sent anywhere.
- ⋯ → **Import data** checks the whole file first (format, version and every field; old exports with missing fields are fine) and writes nothing if anything is wrong. A preview shows what's in it, then **Merge** (default) adds entries that aren't here yet and keeps everything that is (matched by id), or **Replace** wipes and restores, after a second confirmation because every phone on the list sees it. Shared data goes to this list, private to-dos only under this phone's private code (skipped if the phone has none yet).
- Dialogs open without popping up the keyboard; it appears when you tap a field. While the keyboard is up, the dialog fits above it and scrolls the field you're typing in to the top, so suggestions stay visible.

## Versioning

Each release bumps the version in two places, kept identical: the label next to the title in `index.html` and the cache name in `sw.js` (`cart-log-X.Y`). Small fixes and tweaks raise the second number (1.0 → 1.1); bigger features or redesigns raise the first (1.4 → 2.0).

## How it works

Plain static files served by GitHub Pages from `main`: no build step, no framework, no runtime dependencies besides the pinned Firebase SDK. Sync is Firebase Cloud Firestore (free Spark plan) with offline persistence.

### Files

| File | What it does |
|---|---|
| `index.html` | The markup: tabs, panes and dialogs. Loads the files below |
| `styles.css` | All styles (light and dark) |
| `js/ios-manifest.js` | Runs first, in `<head>`: links the manifest everywhere except iPhone/iPad (see *Offline and updates*) |
| `js/logic.js` | The core rules as plain functions with no page, storage or Firestore: æ/ø/å search, amounts and units, recipe scaling, catalog matching and ranking, to-do order, paste parsing, the export format and its checks, import planning. Unit-tested |
| `js/core.js` | Page helpers (`$`, `esc`), `localStorage` (`load`/`save`), the built-in item database from `seed.js`, and the app's state |
| `js/sync.js` | Connecting to Firestore and writing documents; the grocery item helpers built on that |
| `js/groceries.js` | Groceries tab: adding items, suggestions, the item dialog (categories, colours, amounts), the list, the manager |
| `js/tabs.js` | Switching tabs, and keeping dialogs above the on-screen keyboard |
| `js/recipes.js` | Recipes tab: dishes, the recipe dialog, adding a dish to the grocery list |
| `js/todos.js` | To-dos tab: lists (shared and private), headings, folding, editing, hold-and-drag |
| `js/gestures.js` | Swiping between tabs, and ignoring stray taps right after a drag |
| `js/settings.js` | Joining, sharing and leaving a list, the ⋯ menu, private-code restore, updates, starter dishes |
| `js/backup.js` | Export data / Import data (the rules are in `logic.js`) |
| `js/boot.js` | Startup: picks up `?list=CODE`, draws the app, connects, registers the service worker |
| `seed.js` | Built-in bilingual item database and categories |
| `dishes-pack.json` | Starter dishes with recipes, loaded by the *Add starter dishes* button |
| `firebase-config.js` | Firebase web config for the project |
| `sw.js` | Service worker: opens the app from its cache and updates it in the background (cache name `cart-log-X.Y` matches the app version) |
| `manifest.json` | Install name, icons and colours; `scope` and `start_url` are `./`, so the installed app covers only `/cart-log/`, not the whole site |
| `icon-*.png` | App icons |
| `tests/`, `package.json`, `playwright.config.js`, `.prettierrc.json` | Dev-only: tests and formatting. Nothing here is loaded by the app |

The `js/` files are ordinary scripts, loaded in the order above, so a name defined in one is visible in the later ones. Code that runs while a file loads only uses names from that file or earlier ones; everything else runs later, from events.

### Data layout

Everything for one list lives under its code:

```
lists/{code}/items     grocery items (name, category, amount, unit, done)
lists/{code}/catalog   items added by the household, shared across the list
lists/{code}/cats      custom categories and their colours
lists/{code}/todos     to-dos (text, order, done, head: true for headings, list: absent for Home, else the list's id)
lists/{code}/dishes    saved dishes (name, serves, ingredients: [{cid, da, en, amt, unit}])
lists/{code}/meta      list settings: "dishes" (title of the dish list), "tl_main" (Home's name/icon/card title),
                       "tl_<id>" (each extra shared to-do list: name, emoji, optional card title)
lists/{private}/todos  a phone's private to-dos (same shape)
lists/{private}/meta   its private lists ("tl_<id>")
```

Each phone also keeps a copy of everything in `localStorage` (keys `cart-log.<name>`), so the app opens instantly and works offline.

### How sync works

- On start the app shows the copy in `localStorage`, then `connect()` (in `sync.js`) listens to each collection of the list in Firestore. Every snapshot replaces the local copy and redraws.
- A change is applied to the local copy straight away and written to Firestore. Without signal, Firestore queues the write and sends it later; the dot next to the title shows *live*, *syncing…* (writes still on their way) or *offline*.
- Firebase runs as a named app (`cart-log`), so its offline database and keys stay separate from other apps on the same address that use the same Firebase project.
- To-do order: each to-do has an `order` number. A dragged row gets the number halfway between its new neighbours, so only that row changes and two phones reordering at once don't overwrite each other. A dragged heading moves its whole section, spaced evenly between the neighbours. If two neighbours ever get too close, the list is renumbered 1000, 2000, …

### Private to-do lists

The first private list a phone makes gives it a second, random code of its own (`cart-log.me` in `localStorage`). Private lists and their to-dos live under that code (`lists/{private}/…`), which is never written anywhere else: not under the shared code, not in invite links, not in exports. The app listens to it next to the shared list. The ⋯ menu shows the code so the lists can be restored on a new phone; that's the only place it appears.

### Offline and updates

Home log has its own address, but it still keeps strictly to its own cache and storage (so it stays clean if it ever shares an address with another app):

- The service worker precaches the app's files, only handles requests under its own scope (`/cart-log/`) plus the pinned Firebase SDK, and reads only from its own cache.
- On update it deletes only its own old caches (names starting with `cart-log-`), never other apps'.
- The app opens from its own cache (cache-first), so opening never waits for the network and works offline. Network-first made every open wait for one round trip per file once the app was split into files (found 2026-10-25), so don't go back to it.
- How a release reaches a phone: the browser checks `sw.js` on every open (`updateViaCache: 'none'`) and `boot.js` asks again when the app comes back to the screen. A release changes the cache name, so the new worker downloads every file fresh (`?v=` so GitHub's CDN can't hand out an old copy, and `cache: 'reload'`) into a new cache and only takes over once all of them arrived; `boot.js` then reloads once (not while typing or dragging). The first open after a release still shows the old version for a moment. Files that aren't precached (the starter dishes) come from the server once and are kept; the pinned Firebase SDK uses the phone's normal browser cache.
- `localStorage` keys are prefixed `cart-log.` (older `cl_` keys are moved over automatically).
- On iPhone/iPad the manifest isn't linked and the address keeps `?list=CODE`, so Safari's "Add to Home Screen" starts the app at that address. The home-screen app has its own storage, separate from Safari's, and joins the list from the address by itself.

### Security

- No secrets in the code: the Firebase web config is public by design; the Firestore rules decide who may read or write.
- Everything synced or typed in is shown as text: it goes through `esc()` before it reaches the page, item ids included.
- `index.html` sets a Content-Security-Policy: scripts only from this site and the pinned Firebase SDK on gstatic.com (no inline scripts), and data may only be sent to this site and Firestore (`firestore.googleapis.com`).

### Tests

Dev-only, with [Playwright](https://playwright.dev) and Node 18+:

```
npm install
npx playwright install chromium   # once per machine
npm test                          # everything (about 2 minutes)
npm run test:unit                 # only the plain-function tests (seconds)
npm run format                    # Prettier
```

- `tests/unit/`: `logic.js` function by function, plus checks that every file the page loads is precached, there are no inline scripts, the version label matches the cache name and the manifest id is unchanged.
- `tests/e2e/`: the real app in emulated Android (Pixel 7) and iPhone phones with touch, against a fake, shared Firestore (`tests/fake-firestore.js`), so two or three "phones" can sync with each other in a test. Covers groceries, to-dos (including drag, sections, folding, private lists), recipes, export/import, joining, the iPhone home-screen rules, updates and offline start. Every test fails on a page error or a CSP violation.
- `tests/e2e/visual.spec.js` compares screenshots of the main screens with `tests/e2e/__screenshots__/`. After an intended visual change, update them with `npx playwright test tests/e2e/visual.spec.js --update-snapshots`.

### Firestore rule

Only known list codes are allowed (set 2026-10-22). The rules live only in the Firebase console, never in this public repo, because they contain the real codes:

```
function listOk(id) { return id in ['<shared list code>', '<private to-do code>', ...]; }
match /lists/{listId}/{sub}/{id} {
  allow read, write: if listOk(listId);
}
```

Anyone can open the app, but with any other code nothing syncs: it can't read, write or create a list. **A new list (or a new private to-do list) only works after its code is added to the rules** in the Firebase console (Firestore → Rules → Publish). The same rules also cover Nap Log, which shares the Firebase project. The web config in `firebase-config.js` is not a secret.

## Running your own copy

1. Copy the files into your own repo and enable GitHub Pages (branch `main`, root).
2. Create a Firebase project, add a Firestore database, and publish the rule above.
3. Register a web app in Firebase and paste its config into `firebase-config.js`.
4. Open the Pages URL, create a list, and install it to the home screen.

Without a config the app still runs, but the list stays on that one phone ("local only").

### Export file format

```
{ "format": "home-log-export", "version": 1, "exportedAt": "…", "appVersion": "v4.1",
  "shared":  { "items": […], "catalog": […], "cats": […], "todos": […], "dishes": […], "meta": […] },
  "private": { "todos": […], "meta": […] } | null }
```

Each entry is a Firestore document with its `id`, using the fields from *Data layout*. Only known fields are exported and accepted; sections may be left out.
