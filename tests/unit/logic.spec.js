// Unit tests for js/logic.js (plain functions, no browser).
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { test, expect } = require('@playwright/test');
const L = require('../../js/logic.js');

const root = path.resolve(__dirname, '../..');
const seed = vm.runInNewContext(
  fs.readFileSync(path.join(root, 'seed.js'), 'utf8') + ';({SEED_CATS,SEED_ITEMS,SEED_DEF,SEED_CATDEF})',
);
const db = L.buildBuiltInDatabase(seed.SEED_CATS, seed.SEED_ITEMS, seed.SEED_DEF, seed.SEED_CATDEF);
const categoryOf = (id) => db.categories[id] || { da: id, en: '' };

test.describe('text', () => {
  test('list codes', () => {
    expect(L.normalizeListCode('test-list')).toBe('TESTLIST');
    expect(L.normalizeListCode(' ab 12 ')).toBe('AB12');
    expect(L.normalizeListCode(null)).toBe('');
  });
  test('item keys and dish names', () => {
    expect(L.itemKey('Hakket oksekød')).toBe('hakket_oksekød');
    expect(L.itemKey('  Salt/peber ')).toBe('salt_peber');
    expect(L.dishNameKey('  Lasagne ')).toBe(L.dishNameKey('lasagne'));
  });
  test('æ/ø/å search forms', () => {
    expect(L.searchForms('Løg')).toEqual(['loeg', 'log']);
    expect(L.searchForms('Æbler')).toEqual(['aebler', 'abler']);
    expect(L.searchForms('Crème')).toEqual(['creme', 'creme']);
    expect(L.anyEqual(L.searchForms('aebler'), L.searchForms('Æbler'))).toBe(true);
  });
});

test.describe('amounts and units', () => {
  test('parse and format amounts', () => {
    expect(L.parseAmount('1,5')).toBe(1.5);
    expect(L.parseAmount('2.25')).toBe(2.25);
    expect(L.parseAmount('nope')).toBe(1);
    expect(L.parseAmount('-3')).toBe(1);
    expect(L.formatAmount(1.5)).toBe('1,5');
    expect(L.formatAmount(0.333)).toBe('0,33');
    expect(L.formatAmount(500)).toBe('500');
  });
  test('typed quantities', () => {
    expect(L.parseQuantity('2 l mælk')).toEqual({ typed: { amt: 2, unit: 'l' }, rest: 'mælk' });
    expect(L.parseQuantity('500 g hakket oksekød')).toEqual({ typed: { amt: 500, unit: 'g' }, rest: 'hakket oksekød' });
    expect(L.parseQuantity('3 æg')).toEqual({ typed: { amt: 3, unit: null }, rest: 'æg' });
    expect(L.parseQuantity('2 dåser tomater')).toEqual({ typed: { amt: 2, unit: 'can' }, rest: 'tomater' });
    expect(L.parseQuantity(' mælk ')).toEqual({ typed: null, rest: 'mælk' });
    expect(L.parseQuantity('7up')).toEqual({ typed: null, rest: '7up' });
  });
  test('standard amounts and older items with a text quantity', () => {
    expect(L.standardAmount({ amt: 500, unit: 'g' })).toEqual({ amt: 500, unit: 'g' });
    expect(L.standardAmount(undefined)).toEqual({ amt: 1, unit: 'pcs' });
    const std = () => ({ amt: 1, unit: 'l' });
    expect(L.itemAmount({ amt: 2, unit: 'kg' }, std)).toEqual({ amt: 2, unit: 'kg' });
    expect(L.itemAmount({ qty: '2 l' }, std)).toEqual({ amt: 2, unit: 'l' });
    expect(L.itemAmount({ qty: '3' }, std)).toEqual({ amt: 3, unit: 'l' });
    expect(L.itemAmount({ qty: 'lots' }, std)).toEqual({ amt: 1, unit: 'l' });
  });
  test('− / + steps', () => {
    expect(L.stepAmount(1, 'l', 1)).toBe(1.5);
    expect(L.stepAmount(450, 'g', 1)).toBe(500);
    expect(L.stepAmount(500, 'g', 1)).toBe(600);
    expect(L.stepAmount(1, 'pcs', -1)).toBe(1); // never below one step
    expect(L.stepAmount(0.5, 'kg', -1)).toBe(0.5);
  });
  test('unit conversion and topping up', () => {
    expect(L.convertAmount(500, 'g', 'kg')).toBe(0.5);
    expect(L.convertAmount(2, 'dl', 'l')).toBe(0.2);
    expect(L.convertAmount(1, 'kg', 'l')).toBeNull();
    expect(L.convertAmount(3, 'pcs', 'pcs')).toBe(3);
    expect(L.amountInUnit(333, 'g', 'kg')).toBe(0.333);
    expect(L.topUpAmount(1, 'l', 2, 'l')).toBe(3);
    expect(L.topUpAmount(1, 'kg', 250, 'g')).toBe(1.25);
    expect(L.topUpAmount(1, 'pack', 200, 'g')).toBeNull();
  });
  test('scaling a recipe rounds the way you shop', () => {
    expect(L.roundForShopping(4.5, 'pcs')).toBe(5);
    expect(L.roundForShopping(4.0000000001, 'pcs')).toBe(4);
    expect(L.roundForShopping(0.2, 'pack')).toBe(1);
    expect(L.roundForShopping(333.4, 'g')).toBe(333);
    expect(L.roundForShopping(0.25, 'kg')).toBe(0.3);
    expect(L.roundForShopping(0.01, 'l')).toBe(0.1);
    const ings = [
      { cid: 'æg', amt: 3, unit: 'pcs' },
      { cid: 'mel', amt: 0.2, unit: 'kg' },
    ];
    expect(L.scaleIngredients(ings, 3, 2)).toEqual([
      { cid: 'æg', amt: 5, unit: 'pcs' },
      { cid: 'mel', amt: 0.3, unit: 'kg' },
    ]);
    expect(ings[0].amt).toBe(3); // input untouched
  });
});

test.describe('the item database', () => {
  test('built-in database from seed.js', () => {
    expect(Object.keys(db.items).length).toBeGreaterThan(250);
    expect(db.items['mælk']).toEqual({
      id: 'mælk',
      da: 'Mælk',
      en: 'Milk',
      cat: 'mejeri',
      n: 0,
      at: 0,
      amt: 1,
      unit: 'l',
    });
    expect(db.items['hakket_oksekød']).toMatchObject({ amt: 500, unit: 'g' });
    expect(db.categoryOrder.frugt).toBe(0);
    expect(db.categories.andet).toMatchObject({ da: 'Andet', en: 'Other' });
  });
  test('the list’s own entries override built-in fields', () => {
    const all = L.combineDatabase(db.items, {
      mælk: { id: 'mælk', da: 'Mælk', unit: 'dl', n: 4 },
      pesto2: { id: 'pesto2', da: 'Pesto 2' },
    });
    expect(all['mælk']).toMatchObject({ en: 'Milk', unit: 'dl', n: 4 });
    expect(all.pesto2.da).toBe('Pesto 2');
  });
  test('exact matches by Danish or English name', () => {
    const list = Object.values(db.items);
    expect(L.findExactEntry(list, 'milk').id).toBe('mælk');
    expect(L.findExactEntry(list, 'MAELK').id).toBe('mælk');
    expect(L.findExactEntry(list, 'mælke')).toBeUndefined();
  });
  test('ranking: starts with, then contains, then category; popular and short names first', () => {
    const list = Object.values(L.combineDatabase(db.items, { mælk: { n: 5 } }));
    const names = (t) => L.rankEntries(list, t, categoryOf).map((x) => x.e.da);
    expect(names('mæl')[0]).toBe('Mælk');
    expect(names('loeg')[0]).toBe('Løg');
    expect(L.rankEntries(list, 'x', categoryOf).length).toBeLessThanOrEqual(8);
    const byCategory = L.rankEntries(list, 'mejeri', categoryOf);
    expect(byCategory.every((x) => x.tier === 2)).toBe(true);
  });
});

test.describe('colours', () => {
  test('only #rrggbb gets through', () => {
    expect(L.safeColor('#2F855A')).toBe('#2F855A');
    expect(L.safeColor('red;background:url(x)')).toBe(L.DEFAULT_COLOR);
    expect(L.safeColor(undefined)).toBe(L.DEFAULT_COLOR);
  });
  test('banner text is white on dark colours', () => {
    expect(L.textColorOn('#123456')).toBe('#fff');
    expect(L.textColorOn('#E6C65C')).toBe('color-mix(in srgb,#E6C65C 22%,#000)');
    expect(L.luminance('#ffffff')).toBeCloseTo(1);
  });
  test('a name always suggests the same palette colour', () => {
    const palette = ['#111111', '#222222', '#333333'];
    expect(L.colorForName('Krydderiskab', palette)).toBe(L.colorForName('Krydderiskab', palette));
    expect(palette).toContain(L.colorForName('abc', palette));
  });
});

test.describe('to-dos', () => {
  test('order: by order, then time made, then id', () => {
    const list = [
      { id: 'b', order: 2000 },
      { id: 'a', order: 1000, ts: 5 },
      { id: 'c', order: 1000, ts: 1 },
      { id: 'd' },
    ];
    expect(list.sort(L.compareTodoOrder).map((t) => t.id)).toEqual(['d', 'c', 'a', 'b']);
  });
  test('pasted text', () => {
    expect(L.parseTodoText('Stevens\n-\n\nGiant:\n- Bleed brakes\n• Bags\n* Tyres\n– Chain\n  - ')).toEqual([
      { text: 'Stevens', head: true },
      { text: 'Giant', head: true },
      { text: 'Bleed brakes', head: false },
      { text: 'Bags', head: false },
      { text: 'Tyres', head: false },
      { text: 'Chain', head: false },
    ]);
    expect(L.parseTodoText('a\r\n- b')).toEqual([
      { text: 'a', head: true },
      { text: 'b', head: false },
    ]);
  });
  test('a dragged row gets the midpoint, or keeps its place, or triggers a renumber', () => {
    expect(L.orderForMovedRow(1000, 2000, 1500)).toEqual({ keep: true });
    expect(L.orderForMovedRow(1000, 2000, 3000)).toEqual({ order: 1500 });
    expect(L.orderForMovedRow(null, 1000, 3000)).toEqual({ order: 0 });
    expect(L.orderForMovedRow(3000, null, 1000)).toEqual({ order: 4000 });
    expect(L.orderForMovedRow(null, null, undefined)).toEqual({ keep: true }); // the only row
    expect(L.orderForMovedRow(1000, 1000, 5)).toEqual({ renumber: true });
  });
  test('a new row between two rows goes halfway, or 1000 past the end', () => {
    expect(L.orderBetween(1000, 2000)).toEqual({ order: 1500 });
    expect(L.orderBetween(3000, null)).toEqual({ order: 4000 });
    expect(L.orderBetween(null, 1000)).toEqual({ order: 0 });
    expect(L.orderBetween(null, null)).toEqual({ order: 1000 });
    expect(L.orderBetween(1000, 1000)).toEqual({ renumber: true });
  });
  test('a dragged section is spaced evenly between its new neighbours', () => {
    expect(L.ordersForMovedSection(1000, 5000, [2000, 3000])).toEqual({ keep: true });
    expect(L.ordersForMovedSection(1000, 4000, [5000, 6000])).toEqual({ orders: [2000, 3000] });
    expect(L.ordersForMovedSection(null, 1000, [5000, 6000])).toEqual({ orders: [-1000, 0] });
    expect(L.ordersForMovedSection(6000, null, [1000, 2000])).toEqual({ orders: [7000, 8000] });
    expect(L.ordersForMovedSection(1000, 1000.000001, [5000, 6000])).toEqual({ renumber: true });
  });
});

test.describe('export / import', () => {
  const file = (shared, priv = null) => ({ format: L.EXP_FORMAT, version: L.EXP_VERSION, shared, private: priv });
  test('a valid file passes, with missing sections filled in', () => {
    const r = L.validateExport(file({ items: [{ id: 'mælk', da: 'Mælk', amt: 1, unit: 'l', done: false }] }));
    expect(r.errors).toBeUndefined();
    expect(Object.keys(r.data.shared)).toEqual(L.SHARED_COLLECTIONS);
    expect(r.data.shared.todos).toEqual([]);
    expect(r.data.private).toBeNull();
  });
  test('problems are named', () => {
    const errs = (f) => L.validateExport(f).errors || [];
    expect(errs(null)).toEqual(["The file isn't a Home log export."]);
    expect(errs({ ...file({}), version: 9 })[0]).toContain('Unsupported export version 9');
    expect(errs(file({ items: [{ id: 'x', unit: 'barrel' }] }))[0]).toContain('shared.items[0].unit');
    expect(
      errs(
        file({
          todos: [
            { id: 't', text: 'a' },
            { id: 't', text: 'b' },
          ],
        }),
      )[0],
    ).toContain('appears twice');
    expect(errs(file({ dishes: [{ id: 'd', name: 'x', ingredients: [{ cid: 'a' }] }] }))).toEqual([
      'shared.dishes[0].ingredients[0].da: missing',
      'shared.dishes[0].ingredients[0].amt: missing',
      'shared.dishes[0].ingredients[0].unit: missing',
    ]);
    expect(errs(file({}, { meta: [{ id: 'dishes', title: 'x' }] }))[0]).toContain('unknown kind of entry');
    expect(errs(file({ meta: [{ id: 'tl_x', kind: 'tlmain', name: 'x' }] }))[0]).toContain('must be "tl"');
    expect(errs({ ...file({}), extra: 1 })).toEqual(['unknown top-level field "extra"']);
  });
  test('a to-do link survives import, and only http(s) links are accepted', () => {
    const t = { id: 't', text: 'Shelf', url: 'https://ikea.com/x', done: false, order: 1000 };
    expect(L.validateExport(file({ todos: [t] })).data.shared.todos[0].url).toBe('https://ikea.com/x');
    const errs = (url) => L.validateExport(file({ todos: [{ ...t, url }] })).errors || [];
    expect(errs('javascript:alert(1)')[0]).toContain('must be an http(s) link');
    expect(errs('https://' + 'a'.repeat(2000))[0]).toContain('must be an http(s) link');
  });
  test('export keeps only known fields and documents with an id', () => {
    const out = L.exportSection(
      {
        items: [{ id: 'a', da: 'A', secret: 1 }, { da: 'no id' }],
        meta: [{ id: 'tl_1', kind: 'tl', name: 'L', other: 2 }],
      },
      ['items', 'meta'],
      false,
    );
    expect(out).toEqual({ items: [{ id: 'a', da: 'A' }], meta: [{ id: 'tl_1', kind: 'tl', name: 'L' }] });
  });
  test('merge adds what is missing; replace mirrors the file', () => {
    const cur = [{ id: 'a', v: 'local' }, { id: 'b' }];
    const inc = [{ id: 'a', v: 'file' }, { id: 'c' }];
    expect(L.planImport(cur, inc, 'merge')).toEqual({
      write: [{ id: 'c' }],
      remove: [],
      next: [{ id: 'a', v: 'local' }, { id: 'b' }, { id: 'c' }],
    });
    expect(L.planImport(cur, inc, 'replace')).toEqual({ write: inc, remove: ['b'], next: inc });
    expect(L.importCounts(cur, inc)).toEqual({ n: 2, fresh: 1 });
  });
  test('file name', () => {
    expect(L.exportFileName(new Date(2026, 0, 5))).toBe('home-log-2026-01-05.json');
  });
});

test('the version in sw.js, with or without spaces', () => {
  expect(L.versionFromServiceWorker("const CACHE=PREFIX+'4.1';")).toBe('4.1');
  expect(L.versionFromServiceWorker("const CACHE = PREFIX + '12.0';")).toBe('12.0');
  expect(L.versionFromServiceWorker('nothing here')).toBeNull();
  const label = fs.readFileSync(path.join(root, 'index.html'), 'utf8').match(/id="ver">v([\d.]+)</)[1];
  expect(L.versionFromServiceWorker(fs.readFileSync(path.join(root, 'sw.js'), 'utf8'))).toBe(label);
});

test('links: only http(s) are safe, and a link is split from the words around it', () => {
  expect(L.safeUrl('https://a.dk/x')).toBe('https://a.dk/x');
  expect(L.safeUrl('www.a.dk')).toBe('https://www.a.dk/');
  expect(L.safeUrl('javascript:alert(1)')).toBeNull();
  expect(L.safeUrl('data:text/html,hi')).toBeNull();
  expect(L.shortUrl('https://www.ikea.com/dk/da/p/billy-bogreol-hvid-00263850/')).toBe(
    'ikea.com/dk/da/p/billy-bogreol-hvid…',
  );
  expect(L.splitLink('Shelf https://ikea.com/x')).toEqual({ text: 'Shelf', url: 'https://ikea.com/x' });
  expect(L.splitLink('Buy this: https://a.dk/b).')).toEqual({ text: 'Buy this', url: 'https://a.dk/b' });
  expect(L.splitLink('Køb (https://a.dk) i morgen')).toEqual({ text: 'Køb i morgen', url: 'https://a.dk/' });
  expect(L.splitLink('https://a.dk')).toEqual({ text: 'a.dk', url: 'https://a.dk/' });
  expect(L.splitLink('plain text')).toEqual({ text: 'plain text' });
  expect(L.splitLink('javascript:alert(1)')).toEqual({ text: 'javascript:alert(1)' });
  expect(L.linkSegments('see https://a.dk now')).toEqual([
    { text: 'see ' },
    { url: 'https://a.dk/', label: 'a.dk' },
    { text: ' now' },
  ]);
});

test('a list as text: title, bullets, headings as blocks, links with their address', () => {
  expect(
    L.listAsText('Wishlist', [
      { text: 'Socks' },
      { text: 'Shelf', url: 'https://ikea.com/x' },
      { text: 'ikea.com/billy', url: 'https://www.ikea.com/billy' },
      { text: 'Books', head: true },
      { text: 'Dune' },
    ]),
  ).toBe('Wishlist\n\n• Socks\n• Shelf: https://ikea.com/x\n• https://www.ikea.com/billy\n\nBooks\n• Dune');
  expect(L.listAsText('To do', [{ text: 'Kitchen', head: true }, { text: 'Tap' }])).toBe('To do\n\nKitchen\n• Tap');
  expect(L.listAsText('X', [{ text: 'bad', url: 'javascript:alert(1)' }])).toBe('X\n\n• bad');
});
