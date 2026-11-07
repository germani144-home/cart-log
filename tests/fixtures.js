// Dev-only test fixtures: emulated phones that run the real app against a fake, shared Firestore ("cloud").
//
//   test('…', async ({ phone, cloud }) => {
//     const a = await phone();                       // this project's device (Pixel 7 or iPhone 13)
//     const b = await phone({ device: 'iPhone 13' }); // a second phone on the same list
//   });
//
// Each phone answers alert/confirm/prompt from `page.answers` (true = OK, false = Cancel, a string = prompt
// text); unanswered dialogs are accepted. Every dialog message is kept in `page.dialogs`.
const fs = require('fs');
const path = require('path');
const base = require('@playwright/test');
const { devices, expect } = base;

const FAKE_SDK = fs.readFileSync(path.join(__dirname, 'fake-firestore.js'), 'utf8');
const FAKE_CONFIG = 'const FIREBASE_CONFIG={apiKey:"test",authDomain:"test",projectId:"test",appId:"test"};';
const LIST = 'TESTLIST';

const test = base.test.extend({
  cloud: async ({}, use) => {
    const cloud = {
      docs: {},
      pages: [],
      /** documents under a path prefix, e.g. cloud.list('lists/TESTLIST/items') */
      list(prefix) {
        return Object.entries(this.docs)
          .filter(([k]) => k.startsWith(prefix + '/') && !k.slice(prefix.length + 1).includes('/'))
          .map(([, v]) => v);
      },
      keys(prefix) {
        return Object.keys(this.docs).filter((k) => k.startsWith(prefix));
      },
    };
    await use(cloud);
  },

  phone: async ({ browser, cloud }, use, testInfo) => {
    const contexts = [];
    const open = async ({ list = LIST, device, url, serviceWorkers = 'block', colorScheme, storage } = {}) => {
      const d = device ? devices[device] : testInfo.project.use;
      const context = await browser.newContext({
        viewport: d.viewport,
        userAgent: d.userAgent,
        deviceScaleFactor: d.deviceScaleFactor,
        isMobile: d.isMobile,
        hasTouch: d.hasTouch,
        locale: 'en-GB',
        timezoneId: 'Europe/Copenhagen',
        colorScheme: colorScheme || 'light',
        serviceWorkers,
        acceptDownloads: true,
        baseURL: testInfo.project.use.baseURL,
      });
      contexts.push(context);
      // the fake SDK starts with the cloud's documents as they are when the page (re)loads
      await context.route(/firebase-app-compat\.js/, (r) =>
        r.fulfill({
          contentType: 'text/javascript',
          body: `window.__fakeInit=${JSON.stringify(cloud.docs)};\n${FAKE_SDK}`,
        }),
      );
      await context.route(/firebase-firestore-compat\.js/, (r) =>
        r.fulfill({ contentType: 'text/javascript', body: '' }),
      );
      await context.route(/firebase-config\.js/, (r) =>
        r.fulfill({ contentType: 'text/javascript', body: FAKE_CONFIG }),
      );
      await context.exposeBinding('__fakeSync', async (_src, docPath, value) => {
        if (value === null) delete cloud.docs[docPath];
        else cloud.docs[docPath] = value;
        for (const p of cloud.pages) {
          await p
            .evaluate(([k, v]) => window.__fakeApply && window.__fakeApply(k, v), [docPath, value])
            .catch(() => {});
        }
      });
      if (storage) {
        await context.addInitScript((s) => {
          for (const [k, v] of Object.entries(s)) localStorage.setItem(k, JSON.stringify(v));
        }, storage);
      }
      const page = await context.newPage();
      page.answers = [];
      page.dialogs = [];
      page.errors = [];
      page.on('dialog', (dlg) => {
        page.dialogs.push(dlg.message());
        const a = page.answers.shift();
        if (a === false) return dlg.dismiss();
        return dlg.accept(typeof a === 'string' ? a : undefined);
      });
      page.on('pageerror', (e) => page.errors.push(e.message));
      page.on('console', (m) => {
        if (/Content.Security.Policy|Refused to/i.test(m.text())) page.errors.push('CSP: ' + m.text());
      });
      await page.goto(url !== undefined ? url : list ? `./?list=${list}` : './');
      await page.waitForLoadState('load');
      await page.waitForTimeout(150);
      cloud.pages.push(page);
      return page;
    };
    await use(open);
    for (const p of cloud.pages) expect(p.errors, 'page errors / CSP violations').toEqual([]);
    for (const c of contexts) await c.close();
  },
});

// ---------- helpers ----------

/** Real touch events through the DevTools protocol (Playwright's tap has no press-and-hold or drag). */
async function touch(page) {
  if (!page.__cdp) page.__cdp = await page.context().newCDPSession(page);
  const cdp = page.__cdp;
  return {
    start: (x, y) => cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] }),
    move: (x, y) => cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y }] }),
    end: () => cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }),
  };
}

/** centre of the first element matching selector whose text is exactly `text` */
async function centreOf(page, selector, text) {
  return page.evaluate(
    ([sel, t]) => {
      const el = [...document.querySelectorAll(sel)].find((e) => (t === undefined ? true : e.textContent.trim() === t));
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { x: r.x + r.width / 3, y: r.y + r.height / 2, h: r.height };
    },
    [selector, text],
  );
}

/** Hold a to-do row (by its text) and drag it so it lands just above (`before`) or below (`after`) another row. */
async function dragTodo(page, fromText, toText, where = 'before') {
  const row = (t) => centreOf(page, '#tdOpen .td .tdt', t);
  const from = await row(fromText);
  const t = await touch(page);
  await t.start(from.x, from.y);
  await page.waitForTimeout(600); // hold to lift
  const to = await row(toText); // re-measure: lifting a heading folds its section
  const target = to.y + (where === 'before' ? -to.h * 0.3 : to.h * 0.3);
  for (let k = 1; k <= 12; k++) {
    await t.move(from.x, from.y + ((target - from.y) * k) / 12);
    await page.waitForTimeout(30);
  }
  await t.end();
  await page.waitForTimeout(700); // past the post-drop tap guard
}

/** Horizontal swipe across the middle of the screen. dir 'left' = next tab, 'right' = previous tab. */
async function swipe(page, dir) {
  const { width, height } = page.viewportSize();
  const t = await touch(page);
  const [a, b] = dir === 'left' ? [width - 60, 60] : [60, width - 60];
  const y = Math.round(height * 0.6);
  await t.start(a, y);
  for (let k = 1; k <= 6; k++) {
    await t.move(a + ((b - a) * k) / 6, y);
    await page.waitForTimeout(20);
  }
  await t.end();
  // let the gesture settle: Chromium treats a tap right after a swipe as "stop the scroll" and sends no click
  await page.waitForTimeout(1000);
}

/** Paste multi-line text into an input (the app reads clipboardData on the paste event). */
async function paste(page, selector, text) {
  await page.focus(selector);
  await page.evaluate(
    ([sel, txt]) => {
      const dt = new DataTransfer();
      dt.setData('text/plain', txt);
      document
        .querySelector(sel)
        .dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }));
    },
    [selector, text],
  );
}

async function addItem(page, text) {
  await page.fill('#newItem', text);
  await page.press('#newItem', 'Enter');
}

async function addTodo(page, text) {
  await page.fill('#tdNew', text);
  await page.press('#tdNew', 'Enter');
}

const groceryNames = (page) => page.$$eval('#todo .item .da', (e) => e.map((x) => x.textContent));
const cartNames = (page) => page.$$eval('#done .item .da', (e) => e.map((x) => x.textContent));
/** open to-do rows as text; headings start with '#' and folded ones with '#▸' (hidden rows left out) */
const todoRows = (page) =>
  page.$$eval('#tdOpen .td', (e) =>
    e
      .filter((x) => x.offsetParent !== null && !x.classList.contains('tadd')) // not the typing line under a heading
      .map(
        (x) =>
          (x.classList.contains('hd') ? (x.classList.contains('closed') ? '#▸' : '#') : '') +
          x.querySelector('.tdt').textContent,
      ),
  );
const dishNames = (page) => page.$$eval('#dsList .ds > .tdt', (e) => e.map((x) => x.firstChild.textContent));
const tab = (page, name) => page.tap(`.tab[data-tab="${{ groceries: 'g', todos: 't', recipes: 'd' }[name]}"]`);
const currentTab = (page) =>
  page.$eval('.tab.on', (e) => ({ g: 'groceries', t: 'todos', d: 'recipes' })[e.dataset.tab]);

module.exports = {
  test,
  expect,
  LIST,
  touch,
  dragTodo,
  swipe,
  paste,
  addItem,
  addTodo,
  groceryNames,
  cartNames,
  todoRows,
  dishNames,
  tab,
  currentTab,
};
