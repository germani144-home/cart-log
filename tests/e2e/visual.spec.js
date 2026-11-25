// Screenshots of the main screens. Baselines live in tests/__screenshots__/<project>/; a refactor must not
// change a single pixel beyond the tolerance. Update them only for an intended visual change:
//   npx playwright test tests/e2e/visual.spec.js --update-snapshots
const { test, expect, addItem, paste, tab } = require('../fixtures');

const shot = async (page, name) => {
  await page.evaluate(() => document.activeElement && document.activeElement.blur());
  await page.waitForTimeout(250);
  await expect(page).toHaveScreenshot(name, { mask: [page.locator('#ver')], animations: 'disabled' });
};

async function fill(page) {
  for (const t of ['2 mælk', 'æbler', '500 g hakket oksekød', 'Saffranstråde', 'toiletpapir']) await addItem(page, t);
  await page.tap('#todo .item:has-text("Æbler") .chk');
  await tab(page, 'todos');
  await paste(page, '#tdNew', 'Kitchen\n- Fix drawer\n- Paint wall\nGarden\n- Rake leaves');
  await page.tap('#tdOpen .td:has-text("Paint wall") .tchk');
  await tab(page, 'recipes');
  for (const d of ['Lasagne', 'Chili con carne', 'Frikadeller']) {
    await page.fill('#dsNew', d);
    await page.press('#dsNew', 'Enter');
  }
  await page.tap('#dsList .tdt >> text=Lasagne');
  for (const t of ['500 g hakket oksekød', '1 lasagneplader', '1 l mælk']) {
    await page.fill('#ingNew', t);
    await page.press('#ingNew', 'Enter');
  }
  await page.tap('#dsSave');
  await tab(page, 'groceries');
}

for (const scheme of ['light', 'dark']) {
  test(`main screens (${scheme})`, async ({ phone }) => {
    const a = await phone({ colorScheme: scheme });
    await fill(a);
    await shot(a, `${scheme}-groceries.png`);
    await tab(a, 'todos');
    await shot(a, `${scheme}-todos.png`);
    await tab(a, 'recipes');
    await shot(a, `${scheme}-recipes.png`);
    await a.tap('#dsList .tdt >> text=Lasagne');
    await shot(a, `${scheme}-recipe-dialog.png`);
    await a.tap('#dsCancel');
    await a.tap('#menu');
    await shot(a, `${scheme}-settings.png`);
  });
}

test('item dialog, start screen, list dialog and a note', async ({ phone }) => {
  const a = await phone();
  await addItem(a, 'Saffranstråde');
  await a.tap('#todo .txt');
  await a.fill('#cdNewDa', 'Krydderiskab');
  await shot(a, 'item-dialog.png');
  await a.tap('#cdCancel');
  await tab(a, 'todos');
  await a.tap('#tlChips .chip.add');
  await shot(a, 'list-dialog.png');
  await a.fill('#tlName', 'Gift ideas');
  await a.tap('#tlDlg [data-tt="note"]');
  await a.tap('#tlDlg [data-te="🎁"]');
  await a.tap('#tlSave');
  await a.fill('#tdNote', 'Mor\n- Scarf, dark green\n- A good book\n\nBaby\n- Bath book');
  await a.locator('#tdNote').dispatchEvent('input');
  await expect(a.locator('#tdTip')).toHaveText('saved ✓');
  await shot(a, 'note.png');
  const s = await phone({ list: null });
  await shot(s, 'start-screen.png');
});
