// Home log's core rules as plain functions: no page, no localStorage, no Firestore. The other files call these,
// and tests/unit/logic.spec.js tests them directly in Node.
// In the app this is a normal script, so its top-level names are visible to the scripts loaded after it.

// ---------- text ----------

/** List codes are upper-case letters and digits: "test-list" → "TESTLIST". */
const normalizeListCode = (s) => (s || '').toUpperCase().replace(/[^A-Z0-9]/g, '');

/** An item's id in the database, from its Danish name: "Hakket oksekød" → "hakket_oksekød". */
const itemKey = (s) =>
  s
    .trim()
    .toLowerCase()
    .replace(/[\/\s]+/g, '_');

/** Dishes are the same if their names match ignoring case and outer spaces. */
const dishNameKey = (s) => s.trim().toLocaleLowerCase('da');

const stripAccents = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '');

/**
 * Two spellings of a text for searching, so æ/ø/å and their plain-letter spellings find each other:
 * "Løg" → ["loeg", "log"]. Lower case, accents removed.
 */
const searchForms = (s) => {
  const l = (s || '').toLowerCase();
  return [
    stripAccents(l.replace(/æ/g, 'ae').replace(/ø/g, 'oe').replace(/å/g, 'aa')),
    stripAccents(l.replace(/æ/g, 'a').replace(/ø/g, 'o').replace(/å/g, 'a')),
  ];
};
const anyIncludes = (hay, needles) => hay.some((h) => needles.some((n) => h.includes(n)));
const anyStartsWith = (hay, needles) => hay.some((h) => needles.some((n) => h.startsWith(n)));
const anyEqual = (a, b) => a.some((x) => b.includes(x));

// ---------- amounts and units ----------

const UNITS = ['pcs', 'g', 'kg', 'ml', 'dl', 'l', 'pack', 'can', 'bottle', 'bunch'];
/** Words people type for a unit (Danish or English) → the unit. */
const UNIT_ALIASES = {
  x: 'pcs',
  stk: 'pcs',
  pcs: 'pcs',
  pk: 'pack',
  pak: 'pack',
  pakke: 'pack',
  pakker: 'pack',
  pack: 'pack',
  packs: 'pack',
  dåse: 'can',
  dåser: 'can',
  can: 'can',
  cans: 'can',
  fl: 'bottle',
  flaske: 'bottle',
  flasker: 'bottle',
  bottle: 'bottle',
  bottles: 'bottle',
  bdt: 'bunch',
  bundt: 'bunch',
  bunch: 'bunch',
  liter: 'l',
  g: 'g',
  kg: 'kg',
  ml: 'ml',
  dl: 'dl',
  l: 'l',
};
const unitFromWord = (s) => UNIT_ALIASES[(s || '').toLowerCase()] || null;

/** "1,5" or "1.5" → 1.5; anything that isn't a positive number → 1. */
const parseAmount = (v) => {
  const n = parseFloat(String(v).replace(',', '.'));
  return n > 0 ? n : 1;
};
/** 1.5 → "1,5" (Danish decimal comma, at most two decimals). */
const formatAmount = (n) => String(Math.round(n * 100) / 100).replace('.', ',');
/** "500 g" → {amt: 500, unit: 'g'} (the built-in database's standard amounts). */
const parseStandardAmount = (v) => {
  const [a, u] = (v || '1 pcs').split(' ');
  return { amt: parseAmount(a), unit: u || 'pcs' };
};

/** "2 l mælk" → amount, optional unit word, then the name. */
const QUANTITY_PATTERN =
  /^(\d+(?:[.,]\d+)?)\s*(x|stk|pcs|g|kg|ml|dl|l|liter|pk|pak|pakke|pakker|pack|packs|can|cans|dåse|dåser|fl|flaske|flasker|bottle|bottles|bdt|bunch|bundt)?\s+(\S.*)$/i;
/** "2 l mælk" → {typed: {amt: 2, unit: 'l'}, rest: 'mælk'}; "mælk" → {typed: null, rest: 'mælk'}. */
function parseQuantity(t) {
  const m = QUANTITY_PATTERN.exec(t.trim());
  return m
    ? { typed: { amt: parseAmount(m[1]), unit: unitFromWord(m[2]) }, rest: m[3].trim() }
    : { typed: null, rest: t.trim() };
}

/** A database entry's standard amount and unit (1 pcs if it has none). */
const standardAmount = (e) => ({ amt: typeof (e && e.amt) === 'number' ? e.amt : 1, unit: (e && e.unit) || 'pcs' });

/**
 * A grocery item's amount and unit. Older items stored a text like "2 l" in `qty` instead of amt/unit;
 * `standardFor()` gives the item's standard amount when the text has no unit or no number.
 */
function itemAmount(item, standardFor) {
  if (typeof item.amt === 'number') return { amt: item.amt, unit: item.unit || 'pcs' };
  const m = /^(\d+(?:[.,]\d+)?)\s*([^\d\s]*)$/.exec((item.qty || '').trim());
  const d = standardFor();
  return m ? { amt: parseAmount(m[1]), unit: unitFromWord(m[2]) || d.unit } : d;
}

/** How much one tap on − / + changes an amount, per unit. */
const STEP_SIZES = { pcs: 1, pack: 1, can: 1, bottle: 1, bunch: 1, g: 50, kg: 0.5, ml: 50, dl: 1, l: 0.5 };
/** One − (dir −1) or + (dir 1) step. Grams and ml step by 100 from 500 up; never goes below one step. */
function stepAmount(a, u, dir) {
  let st = STEP_SIZES[u] || 1;
  if ((u === 'g' || u === 'ml') && a >= 500) st = 100;
  const n = Math.round((a + dir * st) * 100) / 100;
  return n < (STEP_SIZES[u] || 1) ? a : n;
}

/** Units that convert into each other: mass (g, kg) and volume (ml, dl, l), with their size in the base unit. */
const UNIT_CONVERSIONS = { g: ['m', 1], kg: ['m', 1000], ml: ['v', 1], dl: ['v', 100], l: ['v', 1000] };
/** Amount `a` in unit `from` expressed in unit `to`, or null if they don't convert (e.g. g → pcs). */
const convertAmount = (a, from, to) =>
  from === to
    ? a
    : UNIT_CONVERSIONS[from] && UNIT_CONVERSIONS[to] && UNIT_CONVERSIONS[from][0] === UNIT_CONVERSIONS[to][0]
      ? (a * UNIT_CONVERSIONS[from][1]) / UNIT_CONVERSIONS[to][1]
      : null;
/** Like convertAmount, rounded to three decimals: "500 g" of flour kept in kg → 0.5. */
const amountInUnit = (a, from, to) => {
  const c = convertAmount(a, from, to);
  return c == null ? null : Math.round(c * 1000) / 1000;
};
/**
 * Adding `addAmount addUnit` to an item already on the list as `listAmount listUnit`: the new amount in the
 * list's unit (two decimals), or null if the units don't combine.
 */
const topUpAmount = (listAmount, listUnit, addAmount, addUnit) => {
  const c = convertAmount(addAmount, addUnit, listUnit);
  return c == null ? null : Math.round((listAmount + c) * 100) / 100;
};

/** Units you buy whole: scaled amounts round up (no 4,5 eggs). */
const COUNTABLE_UNITS = new Set(['pcs', 'pack', 'can', 'bottle', 'bunch']);
/** A scaled amount as you'd buy it: whole units round up, g/ml to whole numbers, the rest to one decimal. */
const roundForShopping = (a, u) =>
  COUNTABLE_UNITS.has(u)
    ? Math.max(1, Math.ceil(a - 1e-9))
    : u === 'g' || u === 'ml'
      ? Math.max(1, Math.round(a))
      : Math.max(0.1, Math.round(a * 10) / 10);
/** A recipe for `serves` people scaled to `people`, rounded for shopping. */
const scaleIngredients = (ingredients, people, serves) =>
  ingredients.map((g) => ({ ...g, amt: roundForShopping((g.amt * people) / serves, g.unit) }));

// ---------- the item database ----------

/**
 * The built-in database from seed.js: categories (in store-walk order) and items with their standard amounts.
 * itemsByCategory: {cat: "Dansk=English;…"}, standardAmounts: "Navn=500 g;…", categoryStandard: {cat: "1 pcs"}.
 */
function buildBuiltInDatabase(categoryRows, itemsByCategory, standardAmounts, categoryStandard) {
  const categories = {},
    categoryOrder = {},
    items = {},
    standardByName = {};
  categoryRows.forEach(([id, da, en, color], i) => {
    categories[id] = { id, da, en, color };
    categoryOrder[id] = i;
  });
  standardAmounts.split(';').forEach((p) => {
    const [n, v] = p.split('=');
    standardByName[n] = v;
  });
  Object.entries(itemsByCategory).forEach(([cat, s]) =>
    s.split(';').forEach((p) => {
      const [da, en] = p.split('=');
      const id = itemKey(da);
      items[id] = {
        id,
        da,
        en: en || '',
        cat,
        n: 0,
        at: 0,
        ...parseStandardAmount(standardByName[da] || categoryStandard[cat]),
      };
    }),
  );
  return { categories, categoryOrder, items };
}

/** The database the app searches: built-in items plus the list's own entries (own fields win). */
function combineDatabase(builtIn, own) {
  const o = {};
  for (const k of new Set([...Object.keys(builtIn), ...Object.keys(own)])) o[k] = { ...builtIn[k], ...own[k] };
  return o;
}

/** True if `entry` ({da, en}) is exactly `text` in Danish or English (æ/ø/å-proof, any case). */
const namesMatch = (entry, text) => {
  const f = searchForms(text);
  return anyEqual(searchForms(entry.da), f) || (!!entry.en && anyEqual(searchForms(entry.en), f));
};
/** The entry (item or category) whose Danish or English name is exactly `text`, if any. */
const findExactEntry = (list, text) => list.find((e) => namesMatch(e, text));

/**
 * Best matches for typed text, at most 8: names that start with it, then names that contain it, then items
 * whose category name contains it; ties go to the most used, then the shortest name, then A–Å.
 * categoryOf(id) gives a category's {da, en}.
 */
function rankEntries(list, text, categoryOf) {
  const q = searchForms(text);
  return list
    .map((e) => {
      const nf = [...searchForms(e.da), ...searchForms(e.en)],
        cf = ((ci) => [...searchForms(ci.da), ...searchForms(ci.en || '')])(categoryOf(e.cat));
      const tier = anyStartsWith(nf, q) ? 0 : anyIncludes(nf, q) ? 1 : anyIncludes(cf, q) ? 2 : 9;
      return { e, tier };
    })
    .filter((x) => x.tier < 9)
    .sort(
      (a, b) =>
        a.tier - b.tier ||
        (b.e.n || 0) - (a.e.n || 0) ||
        a.e.da.length - b.e.da.length ||
        a.e.da.localeCompare(b.e.da, 'da'),
    )
    .slice(0, 8);
}

// ---------- colours ----------

const DEFAULT_COLOR = '#5F6B7A';
/** A #rrggbb colour, or the default grey for anything else (never lets other text into a style). */
const safeColor = (c) => (/^#[0-9a-fA-F]{6}$/.test(c || '') ? c : DEFAULT_COLOR);
/** Relative luminance of a #rrggbb colour (0 = black, 1 = white). */
const luminance = (h) => {
  const [r, g, b] = [1, 3, 5]
    .map((i) => parseInt(h.slice(i, i + 2), 16) / 255)
    .map((v) => (v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
/** Readable text colour on a category banner: white on dark colours, a dark shade of the colour on light ones. */
const textColorOn = (h) => (luminance(h) < 0.3 ? '#fff' : `color-mix(in srgb,${h} 22%,#000)`);
/** A palette colour picked from a name, so a new category gets the same suggestion every time. */
const colorForName = (name, palette) => palette[[...name].reduce((a, ch) => a + ch.charCodeAt(0), 0) % palette.length];

// ---------- to-dos ----------

/** Open to-dos are shown by `order`, then by when they were made, then by id. */
const compareTodoOrder = (a, b) =>
  (a.order || 0) - (b.order || 0) || (a.ts || 0) - (b.ts || 0) || (a.id < b.id ? -1 : 1);

/**
 * Pasted text → rows: "- text" (or •, *, –) lines are to-dos, other lines are headings (a trailing ":" dropped),
 * empty lines and a bare "-" are skipped.
 */
function parseTodoText(txt) {
  const out = [];
  for (let line of txt.split(/\r?\n/)) {
    line = line.trim();
    if (!line) continue;
    const m = /^[-•*–]\s*(.*)$/.exec(line);
    if (m) {
      const t = m[1].trim();
      if (t) out.push({ text: t, head: false });
    } else out.push({ text: line.replace(/:$/, ''), head: true });
  }
  return out;
}

/**
 * New `order` for one dragged row, from its new neighbours' orders (null at an end). Only the moved row changes,
 * so two phones reordering at once don't clash.
 * → {keep: true} if it already sits between them, {renumber: true} if there's no room left between the
 *   neighbours (then every row gets 1000, 2000, … in screen order), else {order}.
 */
function orderForMovedRow(prevOrder, nextOrder, ownOrder) {
  const a = prevOrder,
    b = nextOrder;
  if ((a == null || a < ownOrder) && (b == null || ownOrder < b)) return { keep: true };
  if (a != null && b != null && Math.abs(b - a) < 1e-6) return { renumber: true };
  return { order: a == null && b == null ? 1000 : a == null ? b - 1000 : b == null ? a + 1000 : (a + b) / 2 };
}

/**
 * Order for a new row placed between two rows (null at an end): halfway between them, or 1000 past the end.
 * → {order}, or {renumber: true} if there's no room left between them.
 */
function orderBetween(prevOrder, nextOrder) {
  const a = prevOrder,
    b = nextOrder;
  if (a == null && b == null) return { order: 1000 };
  if (a == null) return { order: b - 1000 };
  if (b == null) return { order: a + 1000 };
  if (b - a < 1e-6) return { renumber: true };
  return { order: (a + b) / 2 };
}

/**
 * New orders for a dragged section (a heading and its rows, in screen order), evenly spaced between the new
 * neighbours. → {keep: true}, {renumber: true} or {orders: [...]} (one per row), as for orderForMovedRow.
 */
function ordersForMovedSection(prevOrder, nextOrder, ownOrders) {
  const a = prevOrder,
    b = nextOrder,
    n = ownOrders.length;
  const inPlace =
    ownOrders.every((o, k) => (k === 0 ? a == null || a < o : ownOrders[k - 1] < o)) &&
    (b == null || ownOrders[n - 1] < b);
  if (inPlace) return { keep: true };
  if (a != null && b != null && (b - a) / (n + 1) < 1e-6) return { renumber: true };
  const start = a == null ? (b == null ? 0 : b - 1000 * (n + 1)) : a,
    step = a == null || b == null ? 1000 : (b - a) / (n + 1);
  return { orders: ownOrders.map((_, k) => start + step * (k + 1)) };
}

// ---------- export / import ----------
// File: {format:'home-log-export', version:1, exportedAt, appVersion,
//        shared: {items, catalog, cats, todos, dishes, meta}, private: {todos, meta} | null}
// Only known fields are exported, and an import is checked completely before anything is written.

const EXP_FORMAT = 'home-log-export',
  EXP_VERSION = 1;
/** Field checks: each returns true, or a short reason the value is wrong. */
const FIELD_CHECKS = {
  str:
    (max = 2000) =>
    (v) =>
      (typeof v === 'string' && v.length <= max) || `must be text (max ${max} characters)`,
  id: (v) =>
    (typeof v === 'string' &&
      v.length >= 1 &&
      v.length <= 200 &&
      !v.includes('/') &&
      v !== '.' &&
      v !== '..' &&
      !/^__.*__$/.test(v)) ||
    'must be a valid id',
  num: (v) => (typeof v === 'number' && isFinite(v)) || 'must be a number',
  ts: (v) => (typeof v === 'number' && isFinite(v) && v >= 0) || 'must be a timestamp',
  amt: (v) => (typeof v === 'number' && isFinite(v) && v > 0 && v <= 1e6) || 'must be a positive amount',
  int: (lo, hi) => (v) => (Number.isInteger(v) && v >= lo && v <= hi) || `must be a whole number ${lo}–${hi}`,
  bool: (v) => typeof v === 'boolean' || 'must be true or false',
  unit: (v) => UNITS.includes(v) || `must be one of ${UNITS.join(', ')}`,
  color: (v) => (typeof v === 'string' && /^#[0-9a-fA-F]{6}$/.test(v)) || 'must be a colour like #2F855A',
  is: (x) => (v) => v === x || `must be "${x}"`,
};
const V = FIELD_CHECKS; // short name for the specs below
/** Fields of a recipe ingredient. */
const INGREDIENT_SPEC = { cid: V.id, da: V.str(200), en: V.str(200), amt: V.amt, unit: V.unit };
/** Fields of each kind of document (Firestore collection). Add new fields here, or exports drop them. */
const SPEC = {
  items: {
    id: V.id,
    cid: V.str(200),
    da: V.str(200),
    en: V.str(200),
    text: V.str(200),
    qty: V.str(50),
    cat: V.str(100),
    done: V.bool,
    ts: V.ts,
    amt: V.amt,
    unit: V.unit,
  },
  catalog: {
    id: V.id,
    da: V.str(200),
    en: V.str(200),
    name: V.str(200),
    cat: V.str(100),
    amt: V.amt,
    unit: V.unit,
    n: V.int(0, 1e9),
    at: V.ts,
  },
  cats: { id: V.id, da: V.str(100), en: V.str(100), color: V.color },
  todos: { id: V.id, text: V.str(1000), done: V.bool, order: V.num, ts: V.ts, head: V.bool, list: V.id },
  dishes: {
    id: V.id,
    name: V.str(200),
    serves: V.int(1, 50),
    ingredients: (v) => (Array.isArray(v) && v.length <= 200) || 'must be a list (max 200)',
    ts: V.ts,
  },
};
const REQUIRED_FIELDS = { items: [], catalog: [], cats: [], todos: ['text'], dishes: ['name'] };
/** Meta documents depend on their id: the dish-list title, Home's name/icon/title, or an extra to-do list. */
const metaSpec = (id, priv) =>
  !priv && id === 'dishes'
    ? { id: V.id, title: V.str(100) }
    : !priv && id === 'tl_main'
      ? { id: V.id, kind: V.is('tlmain'), name: V.str(30), emoji: V.str(16), title: V.str(40) }
      : /^tl_/.test(id)
        ? { id: V.id, kind: V.is('tl'), name: V.str(30), emoji: V.str(16), ts: V.ts, title: V.str(40) }
        : null;
const SHARED_COLLECTIONS = ['items', 'catalog', 'cats', 'todos', 'dishes', 'meta'],
  PRIVATE_COLLECTIONS = ['todos', 'meta'];

/** Copy of `doc` with only the fields in `spec` (recipe ingredients likewise). */
function pickKnownFields(doc, spec) {
  const o = {};
  for (const k in spec)
    if (doc[k] !== undefined)
      o[k] = k === 'ingredients' ? doc[k].map((g) => pickKnownFields(g, INGREDIENT_SPEC)) : doc[k];
  return o;
}
/** Adds a message to `errs` for every problem with `doc`. */
function checkDocument(doc, spec, req, where, errs, needId = true) {
  if (!doc || typeof doc !== 'object' || Array.isArray(doc)) return errs.push(`${where}: must be an object`);
  if (!spec) return errs.push(`${where}: unknown kind of entry (id "${String(doc.id).slice(0, 40)}")`);
  for (const k of Object.keys(doc)) {
    if (!spec[k]) {
      errs.push(`${where}: unknown field "${k.slice(0, 40)}"`);
      continue;
    }
    const r = spec[k](doc[k]);
    if (r !== true) errs.push(`${where}.${k}: ${r}`);
  }
  if (needId && doc.id === undefined) errs.push(`${where}.id: missing`);
  for (const k of req || []) if (doc[k] === undefined) errs.push(`${where}.${k}: missing`);
  if (Array.isArray(doc.ingredients))
    doc.ingredients.forEach((g, i) =>
      checkDocument(g, INGREDIENT_SPEC, ['cid', 'da', 'amt', 'unit'], `${where}.ingredients[${i}]`, errs, false),
    );
}
/**
 * Checks a parsed export file completely. → {data: {shared, private}} with every section present (missing ones
 * as []), or {errors: [...]}.
 */
function validateExport(raw) {
  const errs = [],
    out = { shared: {}, private: null };
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { errors: ["The file isn't a Home log export."] };
  if (raw.format !== EXP_FORMAT)
    return { errors: ["The file isn't a Home log export (format field missing or wrong)."] };
  if (raw.version !== EXP_VERSION)
    return {
      errors: [
        `Unsupported export version ${String(raw.version).slice(0, 20)} (this app reads version ${EXP_VERSION}).`,
      ],
    };
  for (const k of Object.keys(raw))
    if (!['format', 'version', 'exportedAt', 'appVersion', 'shared', 'private'].includes(k))
      errs.push(`unknown top-level field "${k.slice(0, 40)}"`);
  if (raw.exportedAt !== undefined && (typeof raw.exportedAt !== 'string' || raw.exportedAt.length > 40))
    errs.push('exportedAt: must be a date');
  if (raw.appVersion !== undefined && (typeof raw.appVersion !== 'string' || raw.appVersion.length > 20))
    errs.push('appVersion: must be text');
  const section = (obj, cols, priv, label) => {
    const res = {};
    if (obj == null) return res;
    if (typeof obj !== 'object' || Array.isArray(obj)) {
      errs.push(`${label}: must be an object`);
      return res;
    }
    for (const k of Object.keys(obj)) if (!cols.includes(k)) errs.push(`${label}: unknown section "${k.slice(0, 40)}"`);
    for (const c of cols) {
      const list = obj[c];
      if (list === undefined) {
        res[c] = []; // older/smaller exports may leave sections out
        continue;
      }
      if (!Array.isArray(list)) {
        errs.push(`${label}.${c}: must be a list`);
        continue;
      }
      if (list.length > 5000) {
        errs.push(`${label}.${c}: too many entries (${list.length})`);
        continue;
      }
      const seen = new Set();
      list.forEach((d, i) => {
        const where = `${label}.${c}[${i}]`;
        checkDocument(
          d,
          c === 'meta' ? (d && typeof d.id === 'string' ? metaSpec(d.id, priv) : null) : SPEC[c],
          c === 'meta' ? [] : REQUIRED_FIELDS[c],
          where,
          errs,
        );
        if (d && typeof d.id === 'string') {
          if (seen.has(d.id)) errs.push(`${where}.id: "${d.id.slice(0, 40)}" appears twice`);
          seen.add(d.id);
        }
      });
      res[c] = list;
    }
    return res;
  };
  out.shared = section(raw.shared, SHARED_COLLECTIONS, false, 'shared');
  if (raw.private != null) out.private = section(raw.private, PRIVATE_COLLECTIONS, true, 'private');
  return errs.length ? { errors: errs } : { data: out };
}

/** One export section: {collection: [documents with known fields only]}; documents without an id are left out. */
function exportSection(docsByCollection, collections, isPrivate) {
  const o = {};
  for (const c of collections)
    o[c] = docsByCollection[c]
      .map((d) => pickKnownFields(d, c === 'meta' ? metaSpec(d.id, isPrivate) || {} : SPEC[c]))
      .filter((d) => d.id !== undefined);
  return o;
}

/** "home-log-2026-10-24.json" for the given (local) date. */
const exportFileName = (d) =>
  `home-log-${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}.json`;

/**
 * What importing one collection does. merge: add documents whose id isn't here yet, keep everything else.
 * replace: remove documents not in the file and write all of the file's.
 * → {write: [docs to write], remove: [ids to delete], next: [the collection afterwards]}.
 */
function planImport(current, incoming, mode) {
  const incomingIds = new Set(incoming.map((d) => d.id));
  if (mode === 'replace')
    return {
      write: incoming,
      remove: current.filter((d) => !incomingIds.has(d.id)).map((d) => d.id),
      next: incoming.map((d) => ({ ...d })),
    };
  const have = new Set(current.map((d) => d.id)),
    add = incoming.filter((d) => !have.has(d.id));
  return { write: add, remove: [], next: [...current, ...add.map((d) => ({ ...d }))] };
}

/** For the import preview: how many documents the file has, and how many of them aren't here yet. */
function importCounts(current, incoming) {
  const have = new Set(current.map((d) => d.id));
  return { n: incoming.length, fresh: incoming.filter((d) => !have.has(d.id)).length };
}

// ---------- updates ----------

/** The app version in sw.js's cache name: "const CACHE=PREFIX+'4.1';" → "4.1" (null if not found). */
const versionFromServiceWorker = (text) => (/PREFIX\s*\+\s*'([\d.]+)'/.exec(text) || [])[1] || null;

if (typeof module === 'object' && module.exports)
  module.exports = {
    normalizeListCode,
    itemKey,
    dishNameKey,
    stripAccents,
    searchForms,
    anyIncludes,
    anyStartsWith,
    anyEqual,
    UNITS,
    UNIT_ALIASES,
    unitFromWord,
    parseAmount,
    formatAmount,
    parseStandardAmount,
    QUANTITY_PATTERN,
    parseQuantity,
    standardAmount,
    itemAmount,
    STEP_SIZES,
    stepAmount,
    UNIT_CONVERSIONS,
    convertAmount,
    amountInUnit,
    topUpAmount,
    COUNTABLE_UNITS,
    roundForShopping,
    scaleIngredients,
    buildBuiltInDatabase,
    combineDatabase,
    namesMatch,
    findExactEntry,
    rankEntries,
    DEFAULT_COLOR,
    safeColor,
    luminance,
    textColorOn,
    colorForName,
    compareTodoOrder,
    parseTodoText,
    orderForMovedRow,
    orderBetween,
    ordersForMovedSection,
    EXP_FORMAT,
    EXP_VERSION,
    FIELD_CHECKS,
    INGREDIENT_SPEC,
    SPEC,
    REQUIRED_FIELDS,
    metaSpec,
    SHARED_COLLECTIONS,
    PRIVATE_COLLECTIONS,
    pickKnownFields,
    checkDocument,
    validateExport,
    exportSection,
    exportFileName,
    planImport,
    importCounts,
    versionFromServiceWorker,
  };
