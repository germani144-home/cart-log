// Groceries tab: adding, amounts, the cart, the item database (catalog) and categories.
const { test, expect, LIST, addItem, groceryNames, cartNames } = require('../fixtures');

const items = (cloud) => cloud.list(`lists/${LIST}/items`);
const catalog = (cloud) => cloud.list(`lists/${LIST}/catalog`);

test('a known item lands in its category with its standard unit and syncs to the other phone', async ({
  phone,
  cloud,
}) => {
  const a = await phone();
  const b = await phone({ device: 'iPhone 13' });
  await addItem(a, '2 mælk');
  await addItem(a, 'æbler');
  await expect.poll(() => groceryNames(b)).toEqual(['Æbler', 'Mælk']); // fruit & veg comes before dairy
  const milk = items(cloud).find((i) => i.da === 'Mælk');
  expect(milk).toMatchObject({ cid: 'mælk', en: 'Milk', cat: 'mejeri', amt: 2, unit: 'l', done: false });
  expect(catalog(cloud).find((c) => c.id === 'mælk')).toMatchObject({ da: 'Mælk', n: 1 });
  await expect(a.locator('#cntG')).toHaveText('2');
});

test('on the list, the English name sits on its own line under the Danish one', async ({ phone }) => {
  const a = await phone();
  await addItem(a, 'gulerødder');
  const box = (sel) => a.locator(`#todo .item .txt ${sel}`).boundingBox();
  const [da, en] = [await box('.da'), await box('.en')];
  expect(await a.locator('#todo .item .en').textContent()).toBe('Carrots');
  expect(en.y).toBeGreaterThanOrEqual(da.y + da.height - 2);
  expect(Math.abs(en.x - da.x)).toBeLessThan(2);
});

test('search ignores æ/ø/å spelling and a suggestion adds the item', async ({ phone }) => {
  const a = await phone();
  await a.fill('#newItem', 'aebl');
  await expect(a.locator('#chips .sg').first()).toContainText('Æbler');
  await a.tap('#chips .sg >> nth=0');
  await expect.poll(() => groceryNames(a)).toEqual(['Æbler']);
  await a.fill('#newItem', 'loeg');
  await expect(a.locator('#chips .sg').first()).toContainText('Løg');
});

test('the amount steps with − / +, and items tick into the cart and clear out', async ({ phone, cloud }) => {
  const a = await phone();
  await addItem(a, 'mælk'); // 1 l
  const plus = a.locator('#todo [data-qp]');
  await plus.tap();
  await plus.tap();
  await expect(a.locator('#todo .qv b')).toHaveText('2');
  await a.locator('#todo [data-qm]').tap();
  await expect(a.locator('#todo .qv b')).toHaveText('1,5');
  expect(items(cloud)[0]).toMatchObject({ amt: 1.5, unit: 'l' });

  await a.tap('#todo .chk');
  await expect.poll(() => cartNames(a)).toEqual(['Mælk']);
  expect(items(cloud)[0].done).toBe(true);
  await expect(a.locator('#doneHead')).toBeVisible();
  a.answers.push(true);
  await a.tap('#clearDone');
  await expect.poll(() => items(cloud).length).toBe(0);
  expect(a.dialogs.pop()).toContain('Remove 1 item from the cart?');
});

test('adding an item that is in the cart moves it back to the list instead of duplicating it', async ({
  phone,
  cloud,
}) => {
  const a = await phone();
  await addItem(a, 'mælk');
  await a.tap('#todo .chk');
  await addItem(a, 'mælk');
  await expect.poll(() => groceryNames(a)).toEqual(['Mælk']);
  expect(items(cloud)).toHaveLength(1);
  await addItem(a, 'mælk'); // already on the list: ignored
  expect(items(cloud)).toHaveLength(1);
});

test('an unknown item goes under Andet, and setting it up creates a category and a database entry', async ({
  phone,
  cloud,
}) => {
  const a = await phone();
  await addItem(a, 'Saffranstråde');
  await expect.poll(() => items(cloud)[0]?.cat).toBe('andet');
  await a.tap('#todo .txt');
  await expect(a.locator('#catDlg')).toBeVisible();
  await a.fill('#cdEn', 'Saffron threads');
  await a.fill('#cdNewDa', 'Krydderiskab');
  await expect(a.locator('#cdHint')).toContainText('Will create category');
  await a.tap('#cdUnits [data-un="g"]');
  await a.fill('#cdAmt', '2');
  await a.tap('#cdSave');
  await expect
    .poll(() => cloud.list(`lists/${LIST}/cats`))
    .toEqual([
      expect.objectContaining({
        id: 'c_krydderiskab',
        da: 'Krydderiskab',
        color: expect.stringMatching(/^#[0-9a-fA-F]{6}$/),
      }),
    ]);
  expect(items(cloud)[0]).toMatchObject({
    da: 'Saffranstråde',
    en: 'Saffron threads',
    cat: 'c_krydderiskab',
    amt: 2,
    unit: 'g',
  });
  expect(catalog(cloud).find((c) => c.id === 'saffranstråde')).toMatchObject({
    cat: 'c_krydderiskab',
    amt: 2,
    unit: 'g',
  });
  // next time it's known: typed again after clearing, it goes straight into the new category
  await a.tap('#todo .txt');
  await a.tap('#cdDel');
  await addItem(a, 'saffranstråde');
  await expect.poll(() => items(cloud)[0]?.cat).toBe('c_krydderiskab');
});

test('“Forget item” removes a one-off item from the list and from the database', async ({ phone, cloud }) => {
  const a = await phone();
  await addItem(a, 'Engangsting');
  await expect.poll(() => catalog(cloud).length).toBe(1);
  await a.tap('#todo .txt');
  await a.tap('#cdForget');
  await expect.poll(() => items(cloud).length).toBe(0);
  expect(catalog(cloud)).toHaveLength(0);
});

test('the manager lists your own items and categories and can remove them', async ({ phone, cloud }) => {
  const a = await phone();
  await addItem(a, 'Hjemmelavet pesto');
  await a.tap('#menu');
  await a.tap('#mgrBtn');
  await expect(a.locator('#mgrList')).toContainText('Hjemmelavet pesto');
  await a.tap('#mgrList [data-md]');
  await expect.poll(() => catalog(cloud).length).toBe(0);
});
