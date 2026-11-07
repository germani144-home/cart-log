// To-dos tab: shared Home list, headings, drag order, folding, paste import, extra and private lists.
const { test, expect, LIST, addTodo, todoRows, dragTodo, paste, tab, touch } = require('../fixtures');

const shared = (cloud) => cloud.list(`lists/${LIST}/todos`);
const ordered = (docs) =>
  docs
    .filter((t) => !t.done)
    .sort((x, y) => x.order - y.order)
    .map((t) => (t.head ? '#' : '') + t.text);

test('add, edit in place, tick into Done, untick, delete and clear done', async ({ phone, cloud }) => {
  const a = await phone();
  await tab(a, 'todos');
  await expect(a.locator('#tdNew')).toHaveAttribute('placeholder', 'Add an item…');
  for (const t of ['Buy bulbs', 'Fix drawer', 'Call plumber']) await addTodo(a, t);
  await expect.poll(() => todoRows(a)).toEqual(['Buy bulbs', 'Fix drawer', 'Call plumber']);
  await expect(a.locator('#tdOpen .rn').first()).toHaveText('•');
  expect(shared(cloud).every((t) => !('list' in t))).toBe(true); // Home's to-dos have no list field

  await a.tap('#tdOpen .tdt >> text=Fix drawer');
  await a.keyboard.press('End');
  await a.keyboard.type(' in kitchen');
  await a.keyboard.press('Enter');
  await expect.poll(() => todoRows(a)).toEqual(['Buy bulbs', 'Fix drawer in kitchen', 'Call plumber']);

  await a.tap('#tdOpen .td:has-text("Buy bulbs") .tchk');
  await expect(a.locator('#tdDone .tdt')).toHaveText(['Buy bulbs']);
  await expect(a.locator('#tdN')).toHaveText(' · 2');
  await a.tap('#tdDone .tchk');
  await expect.poll(() => todoRows(a)).toContain('Buy bulbs');

  await a.tap('#tdOpen .td:has-text("Call plumber") .x');
  await expect.poll(() => shared(cloud).length).toBe(2);
  await a.tap('#tdOpen .td:has-text("Buy bulbs") .tchk');
  a.answers.push(true);
  await a.tap('#tdClear');
  await expect.poll(() => shared(cloud).map((t) => t.text)).toEqual(['Fix drawer in kitchen']);
});

test('headings: H adds one heading then switches back; bullets for items; deleting a heading asks first', async ({
  phone,
  cloud,
}) => {
  const a = await phone();
  await tab(a, 'todos');
  await a.tap('#tdNew');
  await a.tap('#tdHeadBtn');
  await expect(a.locator('#tdNew')).toHaveAttribute('placeholder', 'Add a heading…');
  await expect(a.locator('#tdNew')).toBeFocused(); // the keyboard stays up
  await addTodo(a, 'Kitchen');
  await expect(a.locator('#tdHeadBtn')).toHaveAttribute('aria-pressed', 'false');
  await addTodo(a, 'Fix drawer');
  await expect.poll(() => todoRows(a)).toEqual(['#Kitchen', 'Fix drawer']);
  expect(shared(cloud).find((t) => t.text === 'Kitchen')).toMatchObject({ head: true });
  await expect(a.locator('#tdN')).toHaveText(' · 1'); // headings don't count
  await expect(a.locator('#cntT')).toHaveText('1');
  await expect(a.locator('#tdOpen .td.hd .tchk')).toHaveCount(0);

  a.answers.push(false);
  await a.tap('#tdOpen .td.hd .x');
  expect(a.dialogs.pop()).toContain('Delete the heading "Kitchen"? Its to-dos stay in the list.');
  await expect.poll(() => todoRows(a)).toEqual(['#Kitchen', 'Fix drawer']);
  a.answers.push(true);
  await a.tap('#tdOpen .td.hd .x');
  await expect.poll(() => todoRows(a)).toEqual(['Fix drawer']);
});

test('＋ on a heading adds items at the end of that section, unfolding it, and the other phone gets them there', async ({
  phone,
  cloud,
}) => {
  const a = await phone();
  const b = await phone({ device: 'iPhone 13' });
  await tab(a, 'todos');
  await tab(b, 'todos');
  await paste(a, '#tdNew', 'A\n- a1\nB\n- b1\nC\n- c1');
  await a.tap('#tdOpen .td.hd:has-text("B") .hcv'); // fold B
  await a.tap('#tdOpen .td.hd:has-text("B") .hadd');
  await expect(a.locator('#tdOpen .tadd-in')).toBeFocused();
  await expect(a.locator('#tdOpen .tadd-in')).toHaveAttribute('placeholder', 'Add to B…');
  await a.keyboard.type('b2');
  await a.keyboard.press('Enter');
  await expect(a.locator('#tdOpen .tadd-in')).toBeFocused(); // stays open for the next one
  await a.keyboard.type('b3');
  await a.keyboard.press('Enter');
  await expect.poll(() => todoRows(a)).toEqual(['#A', 'a1', '#B', 'b1', 'b2', 'b3', '#C', 'c1']);
  await expect.poll(() => todoRows(b)).toEqual(['#A', 'a1', '#B', 'b1', 'b2', 'b3', '#C', 'c1']);
  expect(ordered(shared(cloud))).toEqual(['#A', 'a1', '#B', 'b1', 'b2', 'b3', '#C', 'c1']);
  expect(shared(cloud).find((t) => t.text === 'b2')).not.toHaveProperty('head');
  // the last heading: items go at the very end
  await a.tap('#tdOpen .td.hd:has-text("C") .hadd');
  await a.keyboard.type('c2');
  await a.keyboard.press('Enter');
  await expect.poll(() => todoRows(a)).toEqual(['#A', 'a1', '#B', 'b1', 'b2', 'b3', '#C', 'c1', 'c2']);
  // tapping away with the line empty closes it
  await a.evaluate(() => document.activeElement.blur());
  await expect(a.locator('#tdOpen .tadd')).toHaveCount(0);
  await expect.poll(() => todoRows(a)).toEqual(['#A', 'a1', '#B', 'b1', 'b2', 'b3', '#C', 'c1', 'c2']);
});

test('the typing line under a heading keeps what is typed when the other phone changes the list, and drag still works', async ({
  phone,
}) => {
  const a = await phone();
  const b = await phone({ device: 'iPhone 13' });
  await tab(a, 'todos');
  await tab(b, 'todos');
  await paste(a, '#tdNew', 'A\n- a1\n- a2\nB\n- b1');
  await a.tap('#tdOpen .td.hd:has-text("A") .hadd');
  await a.keyboard.type('half-typed');
  await addTodo(b, 'from the other phone');
  await expect.poll(() => todoRows(a)).toContain('from the other phone');
  await expect(a.locator('#tdOpen .tadd-in')).toHaveValue('half-typed');
  await expect(a.locator('#tdOpen .tadd-in')).toBeFocused();
  await a.keyboard.press('Escape');
  await expect(a.locator('#tdOpen .tadd')).toHaveCount(0);
  await dragTodo(a, 'a1', 'b1', 'after');
  await expect.poll(() => todoRows(a)).toEqual(['#A', 'a2', '#B', 'b1', 'a1', 'from the other phone']);
});

test('pasting several lines adds headings and items; a bare "-" is skipped', async ({ phone }) => {
  const a = await phone();
  await tab(a, 'todos');
  await paste(
    a,
    '#tdNew',
    'Stevens\n-\n\nGiant Talon E\n- Bleed brakes\n- Add side bags\n• Change tires\nNS:\n* Bed brake pads ',
  );
  await expect
    .poll(() => todoRows(a))
    .toEqual(['#Stevens', '#Giant Talon E', 'Bleed brakes', 'Add side bags', 'Change tires', '#NS', 'Bed brake pads']);
  expect(a.dialogs.pop()).toBe('Add 3 headings and 4 to-dos to "Home"?');
  await expect(a.locator('#tdNew')).toHaveValue('');
});

test('hold and drag reorders an item and the other phone gets the same order', async ({ phone, cloud }) => {
  const a = await phone();
  const b = await phone({ device: 'iPhone 13' });
  await tab(a, 'todos');
  await tab(b, 'todos');
  for (const t of ['one', 'two', 'three', 'four']) await addTodo(a, t);
  await a.evaluate(() => document.activeElement.blur());
  await dragTodo(a, 'one', 'three', 'after');
  await expect.poll(() => todoRows(a)).toEqual(['two', 'three', 'one', 'four']);
  await expect.poll(() => todoRows(b)).toEqual(['two', 'three', 'one', 'four']);
  expect(ordered(shared(cloud))).toEqual(['two', 'three', 'one', 'four']);
});

test('dragging a heading moves its whole section; loose items stay on top; items move between sections', async ({
  phone,
  cloud,
}) => {
  const a = await phone();
  await tab(a, 'todos');
  await paste(a, '#tdNew', '- loose\nA\n- a1\n- a2\nB\n- b1\nC\n- c1\n- c2');
  await expect.poll(() => todoRows(a)).toEqual(['loose', '#A', 'a1', 'a2', '#B', 'b1', '#C', 'c1', 'c2']);
  await a.evaluate(() => document.activeElement.blur());

  // the heading stays under the finger while its section is folded away
  const from = await a.evaluate(() => {
    const r = [...document.querySelectorAll('#tdOpen .td.hd')]
      .find((e) => e.textContent.includes('C'))
      .getBoundingClientRect();
    return { x: r.x + r.width / 3, y: r.y + r.height / 2 };
  });
  const t = await touch(a);
  await t.start(from.x, from.y);
  await a.waitForTimeout(600);
  const lifted = await a.evaluate(() => {
    const el = document.querySelector('.td.lift');
    const r = el.getBoundingClientRect();
    return { y: r.y + r.height / 2, label: el.querySelector('.hdn').textContent };
  });
  expect(lifted.label).toBe('+2 to-dos');
  expect(Math.abs(lifted.y - from.y)).toBeLessThan(3);
  await t.end();
  await a.waitForTimeout(700);

  await dragTodo(a, 'C', 'A', 'before');
  await expect.poll(() => todoRows(a)).toEqual(['loose', '#C', 'c1', 'c2', '#A', 'a1', 'a2', '#B', 'b1']);
  await dragTodo(a, 'A', 'b1', 'after');
  await expect.poll(() => todoRows(a)).toEqual(['loose', '#C', 'c1', 'c2', '#B', 'b1', '#A', 'a1', 'a2']);
  await dragTodo(a, 'b1', 'a1', 'before');
  await expect.poll(() => todoRows(a)).toEqual(['loose', '#C', 'c1', 'c2', '#B', '#A', 'b1', 'a1', 'a2']);
  await expect.poll(() => ordered(shared(cloud))).toEqual(['loose', '#C', 'c1', 'c2', '#B', '#A', 'b1', 'a1', 'a2']);
});

test('after a drop, a stray tap on the input does not pop up the keyboard', async ({ phone }) => {
  const a = await phone();
  await tab(a, 'todos');
  for (const t of ['one', 'two']) await addTodo(a, t);
  await a.evaluate(() => document.activeElement.blur());
  const from = await a.evaluate(() => {
    const r = document.querySelector('#tdOpen .td .tdt').getBoundingClientRect();
    return { x: r.x + 20, y: r.y + r.height / 2 };
  });
  const t = await touch(a);
  await t.start(from.x, from.y);
  await a.waitForTimeout(600);
  await t.move(from.x, from.y + 60);
  await t.end();
  await a.waitForTimeout(80);
  const box = await a.locator('#tdNew').boundingBox();
  await a.mouse.click(box.x + 20, box.y + 10);
  await expect(a.locator('#tdNew')).not.toBeFocused();
  await a.waitForTimeout(700);
  await a.tap('#tdNew');
  await expect(a.locator('#tdNew')).toBeFocused();
});

test('folding a heading hides its items on this phone only and is remembered', async ({ phone }) => {
  const a = await phone();
  const b = await phone({ device: 'iPhone 13' });
  await tab(a, 'todos');
  await tab(b, 'todos');
  await paste(a, '#tdNew', 'A\n- a1\nB\n- b1\n- b2\n- b3\nC\n- c1');
  await a.tap('#tdOpen .td.hd:has-text("B") .hcv');
  await expect.poll(() => todoRows(a)).toEqual(['#A', 'a1', '#▸B', '#C', 'c1']);
  await expect(a.locator('#tdOpen .td.hd.closed .hcn')).toHaveText('3');
  await expect.poll(() => todoRows(b)).toEqual(['#A', 'a1', '#B', 'b1', 'b2', 'b3', '#C', 'c1']);
  await a.reload();
  await expect.poll(() => todoRows(a)).toEqual(['#A', 'a1', '#▸B', '#C', 'c1']);
  // an item dragged past a folded section hops over it whole
  await a.evaluate(() => document.activeElement.blur());
  await dragTodo(a, 'a1', 'C', 'after');
  await expect.poll(() => todoRows(a)).toEqual(['#A', '#▸B', '#C', 'a1', 'c1']);
  // adding an item to a folded last section unfolds it
  await a.tap('#tdOpen .td.hd:has-text("C") .hcv');
  await addTodo(a, 'c2');
  await expect.poll(() => todoRows(a)).toEqual(['#A', '#▸B', '#C', 'a1', 'c1', 'c2']);
  await a.tap('#tdOpen .td.hd:has-text("B") .hcv');
  await expect.poll(() => todoRows(a)).toEqual(['#A', '#B', 'b1', 'b2', 'b3', '#C', 'a1', 'c1', 'c2']);
});

test('a private list lives under this phone’s own code and never reaches the other phone', async ({ phone, cloud }) => {
  const a = await phone();
  const b = await phone({ device: 'iPhone 13' });
  await tab(a, 'todos');
  await tab(b, 'todos');
  await a.tap('#tlChips .chip.add');
  await expect(a.locator('#tlDlg')).toBeVisible();
  await expect(a.locator('#tlHead')).toBeFocused(); // no keyboard on open
  await a.fill('#tlName', 'Bike fleet');
  await a.tap('#tlEmo [data-te="🚲"]');
  await expect(a.locator('#tlDlg [data-tk="priv"]')).toHaveClass(/sel/); // private is the default
  await a.tap('#tlSave');
  await expect(a.locator('#tlChips .chip.on')).toHaveText('🚲 Bike fleet 🔒');
  for (const t of ['Bleed brakes', 'New grips']) await addTodo(a, t);
  const me = await a.evaluate(() => JSON.parse(localStorage.getItem('cart-log.me')));
  expect(me).toMatch(/^[A-Z2-9]{8}$/);
  expect(me).not.toBe(LIST);
  await expect
    .poll(() =>
      cloud
        .list(`lists/${me}/todos`)
        .map((t) => t.text)
        .sort(),
    )
    .toEqual(['Bleed brakes', 'New grips']);
  expect(cloud.list(`lists/${me}/meta`)).toEqual([
    expect.objectContaining({ kind: 'tl', name: 'Bike fleet', emoji: '🚲' }),
  ]);
  expect(JSON.stringify(cloud.keys(`lists/${LIST}/`).map((k) => cloud.docs[k]))).not.toContain('Bike fleet');
  await expect(b.locator('#tlChips .chip')).toHaveText(['🏠 Home', '＋ New list']);
  // the private code shows only in the menu
  await a.tap('#menu');
  await expect(a.locator('#meShow')).toHaveText(me);
  await a.evaluate(() => document.querySelector('#dlg').close());

  // restore on a new phone with the code
  const c = await phone();
  await tab(c, 'todos');
  c.answers.push(me);
  await c.tap('#menu');
  await c.tap('#meBtn');
  await c.evaluate(() => document.querySelector('#dlg').close());
  await expect(c.locator('#tlChips .chip')).toHaveText(['🏠 Home', '🚲 Bike fleet 🔒', '＋ New list']);
});

test('shared extra lists: create, rename (chip and card title), delete with its to-dos', async ({ phone, cloud }) => {
  const a = await phone();
  const b = await phone({ device: 'iPhone 13' });
  await tab(a, 'todos');
  await tab(b, 'todos');
  await a.tap('#tlChips .chip.add');
  await a.fill('#tlName', 'Weekend');
  await a.tap('#tlDlg [data-tk="shared"]');
  await a.tap('#tlEmo [data-te="🌱"]');
  await a.tap('#tlSave');
  await addTodo(a, 'Rake leaves');
  await expect(b.locator('#tlChips .chip')).toHaveText(['🏠 Home', '🌱 Weekend', '＋ New list']);
  const doc = shared(cloud).find((t) => t.text === 'Rake leaves');
  expect(doc.list).toMatch(/^tl_/);

  // card title: Home shows "To do" until renamed; renaming syncs
  await a.tap('#tlChips .chip >> text=Home');
  await expect(a.locator('#tdTitle')).toHaveText('To do');
  a.answers.push('House projects');
  await a.tap('#tdTitle');
  await expect(b.locator('#tdTitle')).toHaveText('House projects');
  // renaming the chip keeps the title
  await a.tap('#tlChips .chip.on');
  await a.fill('#tlName', 'Hjem');
  await a.tap('#tlSave');
  await expect(b.locator('#tlChips .chip').first()).toHaveText('🏠 Hjem');
  await expect(b.locator('#tdTitle')).toHaveText('House projects');
  a.answers.push('');
  await a.tap('#tdTitle');
  await expect(a.locator('#tdTitle')).toHaveText('To do');

  await b.tap('#tlChips .chip >> text=Weekend');
  await b.tap('#tlChips .chip.on');
  b.answers.push(true);
  await b.tap('#tlDel');
  await expect(a.locator('#tlChips .chip')).toHaveText(['🏠 Hjem', '＋ New list']);
  await expect.poll(() => shared(cloud).some((t) => t.text === 'Rake leaves')).toBe(false);
});
