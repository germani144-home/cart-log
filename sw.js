// Home log service worker. Apps on the same address share one CacheStorage, so this worker only ever touches
// caches named PREFIX* and only handles its own URLs (Home log has its own address, but stays clean anyway).
const PREFIX = 'cart-log-';
// "Check for updates" in the app reads the version from this exact line, so keep its spacing:
// prettier-ignore
const CACHE=PREFIX+'4.3'; // keep in step with the version label in index.html
// caches this app used before the prefix existed; safe to remove, nothing else uses these names
const LEGACY = /^cart-(v\d+|\d+\.\d+)$/;
const SCOPE = self.registration.scope; // e.g. https://germani144-home.github.io/cart-log/
// the app's own files, cached on install so it starts offline (tests/unit/files.spec.js checks this list)
const SHELL = [
  './',
  'index.html',
  'styles.css',
  'js/ios-manifest.js',
  'js/logic.js',
  'js/core.js',
  'js/sync.js',
  'js/groceries.js',
  'js/tabs.js',
  'js/recipes.js',
  'js/todos.js',
  'js/gestures.js',
  'js/settings.js',
  'js/backup.js',
  'js/boot.js',
  'firebase-config.js',
  'seed.js',
  'manifest.json',
  'icon-192.png',
];
// the pinned Firebase SDK lives on another origin but is needed for offline sync, so it is cached too
const SDK = /^https:\/\/www\.gstatic\.com\/firebasejs\/10\.12\.2\//;

// Opening the app never waits for the network: every file comes from this version's cache, so a phone always runs one
// complete version and it opens instantly, even offline. The browser checks sw.js itself for changes (registered with
// updateViaCache: 'none'; boot.js also asks whenever the app comes back to the screen). A release changes CACHE above,
// so the new worker downloads every file fresh into a new cache before it takes over, and boot.js reloads once.
// (Network-first made every open wait for one round trip per file: found 2026-10-25.)
// install: '?v=' makes GitHub's CDN fetch each file anew and cache: 'reload' skips the phone's HTTP cache, so a release
// can never mix in an old copy. If any file fails, the install fails and the phone stays on the current version.
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) =>
      Promise.all(
        SHELL.map(async (p) => {
          const r = await fetch(p + '?v=' + CACHE, { cache: 'reload', credentials: 'same-origin' });
          if (!r.ok) throw new Error('could not save ' + p + ' for offline use');
          await c.put(p, r);
        }),
      ),
    ),
  );
  self.skipWaiting();
});
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((k) =>
        Promise.all(
          k.filter((n) => n !== CACHE && (n.startsWith(PREFIX) || LEGACY.test(n))).map((n) => caches.delete(n)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});
self.addEventListener('fetch', (e) => {
  const url = e.request.url;
  if (e.request.method !== 'GET' || !(url.startsWith(SCOPE) || SDK.test(url))) return;
  if (url.startsWith(SCOPE) && new URL(url).searchParams.has('check')) return; // "Check for updates": always the server
  e.respondWith(cacheFirst(e.request));
});
// From this version's cache. Opening the app keeps ?list=CODE in the address, so pages match without the query.
// Anything not in the cache (the pinned SDK, the starter dishes) comes from the server once ('no-cache': revalidated,
// not GitHub's 10-minute HTTP cache) and is kept if it worked.
async function cacheFirst(req) {
  const c = await caches.open(CACHE);
  const page = req.mode === 'navigate';
  const hit = (await c.match(req, { ignoreSearch: page })) || (page && (await c.match('index.html')));
  if (hit) return hit;
  try {
    // the SDK's address is pinned to one version and never changes, so the phone's own HTTP cache may answer it
    const r = await fetch(req, SDK.test(req.url) ? {} : { cache: 'no-cache' });
    if (r.ok) await c.put(req, r.clone());
    return r;
  } catch {
    return Response.error();
  }
}
