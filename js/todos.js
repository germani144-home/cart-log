// To-dos tab: lists (shared and private), headings, folding, editing and hold-and-drag reordering.
// ---------- to-dos: ordered lists of bulleted items and headings; ticked ones sink to "Done" ----------
// "Home" (id main) is the original shared list: its to-dos have no list field. Extra lists are described by
// meta docs "tl_<id>" {id,kind:'tl',name,emoji,ts}: shared ones under the list code (lists/{code}/meta + todos),
// private ones under this phone's own code (lists/{me}/meta + todos), which only this phone knows.
const MAX_OPEN_TODOS = 150;
const LIST_ICONS = ['📝', '🚲', '🔧', '🏠', '🛒', '💼', '🎁', '✈️', '🏋️', '📚', '🌱', '💡'];
const homeList = () => ({
  id: 'main',
  name: 'Home',
  emoji: '🏠',
  priv: false,
  ...(listMeta.tl_main
    ? { name: listMeta.tl_main.name, emoji: listMeta.tl_main.emoji, title: listMeta.tl_main.title }
    : {}),
});
function allTodoLists() {
  const sh = Object.values(listMeta)
    .filter((v) => v.kind === 'tl' && v.id !== 'tl_main')
    .map((v) => ({ ...v, priv: false }));
  const pr = privateCode
    ? Object.values(privateMeta)
        .filter((v) => v.kind === 'tl')
        .map((v) => ({ ...v, priv: true }))
    : [];
  return [homeList(), ...[...sh, ...pr].sort((a, b) => (a.ts || 0) - (b.ts || 0))];
}
let currentListId = load('cl_tdlist', 'main');
const currentList = () => allTodoLists().find((l) => l.id === currentListId) || homeList();
const todoListById = (id) => allTodoLists().find((l) => l.id === (id || 'main'));
const currentListTodos = () => {
  const l = currentList();
  return (l.priv ? privateTodos : todos).filter((t) => (t.list || 'main') === l.id);
};
const todoById = (id) => todos.find((t) => t.id === id) || privateTodos.find((t) => t.id === id);
const openTodos = () =>
  currentListTodos()
    .filter((t) => !t.done)
    .sort(compareTodoOrder);
let editingTodoId = null,
  todosNeedRedraw = false,
  dragState = null,
  pressState = null,
  ignoreTapsUntil = 0;
function saveTodo(t) {
  const l = todoListById(t.list);
  if (!l) return;
  if (l.priv) {
    const i = privateTodos.findIndex((x) => x.id === t.id);
    if (i < 0) privateTodos.push(t);
    else privateTodos[i] = t;
    save('cl_ptodos', privateTodos);
    renderTodos();
    writePrivate('todos', t);
  } else {
    const i = todos.findIndex((x) => x.id === t.id);
    if (i < 0) todos.push(t);
    else todos[i] = t;
    save('cl_todos', todos);
    renderTodos();
    writeShared('todos', t);
  }
}
function removeTodo(id) {
  if (privateTodos.some((x) => x.id === id)) {
    privateTodos = privateTodos.filter((x) => x.id !== id);
    save('cl_ptodos', privateTodos);
    renderTodos();
    deletePrivate('todos', id);
  } else {
    todos = todos.filter((x) => x.id !== id);
    save('cl_todos', todos);
    renderTodos();
    deleteShared('todos', id);
  }
}
// folded headings: per phone, {headingId:true}
var foldedHeadings = load('cl_folded', {});
// headings (head:true) are section titles inside a list: no tick box, never "done", don't count as to-dos
const isTodoItem = (t) => !t.head;
function addTodo(text, head) {
  text = text.trim();
  if (!text || (!head && openTodos().filter(isTodoItem).length >= MAX_OPEN_TODOS)) return false;
  const l = currentList();
  if (!head) {
    const v = openTodos();
    for (let k = v.length - 1; k >= 0; k--)
      if (v[k].head) {
        if (foldedHeadings[v[k].id]) {
          delete foldedHeadings[v[k].id];
          save('cl_folded', foldedHeadings);
        }
        break;
      }
  } // new items land in the last section: unfold it
  const link = head ? { text } : splitLink(text); // a link in an item: its own field, the words around it as text
  saveTodo({
    id: newId(),
    text: link.text,
    ...(link.url ? { url: link.url } : {}),
    done: false,
    order: currentListTodos().reduce((m, t) => Math.max(m, t.order || 0), 0) + 1000,
    ts: Date.now(),
    ...(head ? { head: true } : {}),
    ...(l.id === 'main' ? {} : { list: l.id }),
  });
  return true;
}
// ＋ on a heading opens a typing line at the end of that section; Enter adds an item there and keeps the line open
var addUnderHeading = null, // id of the heading whose section has the typing line
  renderingTodos = false;
function openHeadingAdd(id) {
  if (foldedHeadings[id]) {
    delete foldedHeadings[id];
    save('cl_folded', foldedHeadings);
  }
  addUnderHeading = id;
  renderTodos();
  const line = $('#tdOpen .tadd-in');
  if (line) line.focus();
}
function closeHeadingAdd() {
  if (addUnderHeading == null) return;
  addUnderHeading = null;
  renderTodos();
}
// a new item at the end of the heading's section (just before the next heading)
function addUnderHeadingItem(text) {
  text = text.trim();
  if (!text || openTodos().filter(isTodoItem).length >= MAX_OPEN_TODOS) return false;
  const open = openTodos(),
    h = open.findIndex((t) => t.id === addUnderHeading);
  if (h < 0) return false;
  let end = h;
  while (end + 1 < open.length && !open[end + 1].head) end++;
  const next = open[end + 1],
    l = currentList(),
    r = orderBetween(open[end].order || 0, next ? next.order || 0 : null),
    link = splitLink(text),
    todo = {
      id: newId(),
      text: link.text,
      ...(link.url ? { url: link.url } : {}),
      done: false,
      order: r.renumber ? open[end].order || 0 : r.order,
      ts: Date.now(),
      ...(l.id === 'main' ? {} : { list: l.id }),
    };
  saveTodo(todo);
  if (r.renumber) {
    const ids = open.map((t) => t.id);
    ids.splice(end + 1, 0, todo.id);
    renumberAll(ids);
  }
  return true;
}
// ---------- links in to-dos ----------
// An item's link is kept in its own `url` field and shown as its text; older items may still have links inside the
// text, which are shown as links too. Only http(s) links are ever made clickable (see safeUrl in logic.js).
const linkHtml = (url, label) =>
  `<a class="tlink" href="${esc(url)}" data-link="${esc(url)}" target="_blank" rel="noopener noreferrer">${esc(label)}</a>`;
function todoTextHtml(t) {
  const url = t.url && safeUrl(t.url);
  if (url) return linkHtml(url, t.text);
  return linkSegments(t.text)
    .map((s) => (s.url ? linkHtml(s.url, s.label) : esc(s.text)))
    .join('');
}
// tapping a link asks first, then opens it in the browser
$('#paneT').addEventListener('click', (e) => {
  const a = e.target.closest('a[data-link]');
  if (!a) return;
  e.preventDefault();
  e.stopPropagation(); // not an edit of the row's text
  if (Date.now() < ignoreTapsUntil) return;
  const url = safeUrl(a.dataset.link);
  if (url && confirm(`Open this link?\n\n${url}`)) window.open(url, '_blank', 'noopener,noreferrer');
});
// ✎ on a link item: change the text shown and/or the link (an empty link removes it)
let linkEditId = null;
function openLinkDialog(id) {
  const t = todoById(id);
  if (!t) return;
  linkEditId = id;
  $('#lkText').value = t.text;
  $('#lkUrl').value = t.url || '';
  $('#lkHint').textContent = 'Leave the link empty to remove it.';
  $('#lkDlg').showModal();
  $('#lkDlg .dt').focus();
}
function saveLinkDialog() {
  const t = todoById(linkEditId);
  if (!t) return $('#lkDlg').close();
  const raw = $('#lkUrl').value.trim(),
    url = raw ? safeUrl(raw) : null;
  if (raw && !url) {
    $('#lkHint').textContent = 'That doesn’t look like a web link (https://…).';
    return $('#lkUrl').focus();
  }
  const text = $('#lkText').value.trim().replace(/\s+/g, ' ') || (url ? shortUrl(url) : '');
  if (!text) return $('#lkText').focus();
  const { url: _old, ...rest } = t;
  saveTodo({ ...rest, text, ...(url ? { url } : {}) });
  $('#lkDlg').close();
}
$('#tdOpen').addEventListener('click', (e) => {
  const b = e.target.closest('[data-le]');
  if (b && Date.now() >= ignoreTapsUntil) openLinkDialog(b.dataset.le);
});
$('#lkSave').onclick = saveLinkDialog;
$('#lkCancel').onclick = () => $('#lkDlg').close();
['#lkText', '#lkUrl'].forEach((s) =>
  $(s).addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      saveLinkDialog();
    }
  }),
);

// ---------- sharing a list ----------
// Share opens the phone's share sheet (Messages, WhatsApp, Mail, Copy…) with the open to-dos as text; where there is
// no share sheet, the text is copied instead.
async function shareTodoList() {
  const b = $('#tdShare'),
    text = listAsText(listCardTitle(currentList()), openTodos());
  if (navigator.share) {
    try {
      await navigator.share({ text });
      return;
    } catch (e) {
      if (e.name === 'AbortError') return; // closed the share sheet
    }
  }
  try {
    await navigator.clipboard.writeText(text);
    b.dataset.busy = '1';
    b.textContent = 'Copied ✓';
    setTimeout(() => {
      delete b.dataset.busy;
      renderTodos();
    }, 1500);
  } catch {
    alert('Couldn’t copy the list on this phone.');
  }
}
$('#tdShare').onclick = shareTodoList;

function renderTodos() {
  if (!listCode) return;
  if (dragState || editingTodoId) {
    todosNeedRedraw = true;
    return;
  } // never rebuild the DOM under a finger or a cursor
  todosNeedRedraw = false;
  drawListChips();
  const open = openTodos(),
    done = currentListTodos()
      .filter((t) => t.done)
      .sort((a, b) => (b.ts || 0) - (a.ts || 0));
  const nItems = open.filter(isTodoItem).length;
  // folded headings (per phone): their items stay in the list (so drag keeps sections together) but hidden
  const sec = {};
  let cur = null;
  open.forEach((t) => {
    if (t.head) cur = t.id;
    else if (cur) sec[cur] = (sec[cur] || 0) + 1;
  });
  let hide = false;
  // the typing line under a heading (＋): keep what's typed and the keyboard if the list redraws meanwhile
  if (addUnderHeading && !open.some((t) => t.id === addUnderHeading && t.head)) addUnderHeading = null;
  const typing = $('#tdOpen .tadd-in'),
    keep = typing && { value: typing.value, focused: document.activeElement === typing };
  const rows = open.map((t) => {
    if (t.head) hide = !!foldedHeadings[t.id];
    return t.head
      ? `<div class="td hd${hide ? ' closed' : ''}" data-id="${esc(t.id)}"><button class="hcv" data-hc="${esc(t.id)}" aria-label="${hide ? 'Unfold' : 'Fold'}" aria-expanded="${!hide}">▾</button><div class="tdt" data-xe="${esc(t.id)}">${esc(t.text)}</div>${hide && sec[t.id] ? `<span class="hcn">${sec[t.id]}</span>` : ''}<span class="hdn"></span><button class="hadd" data-ha="${esc(t.id)}" aria-label="Add an item under ${esc(t.text)}">＋</button><button class="x" data-xd="${esc(t.id)}" aria-label="Delete heading">✕</button></div>`
      : `<div class="td${hide ? ' cz' : ''}" data-id="${esc(t.id)}"><button class="tchk" data-xt="${esc(t.id)}" aria-label="Done"></button><span class="rn">•</span><div class="tdt" data-xe="${esc(t.id)}">${todoTextHtml(t)}</div>${t.url ? `<button class="lked" data-le="${esc(t.id)}" aria-label="Edit link">✎</button>` : ''}<button class="x" data-xd="${esc(t.id)}" aria-label="Delete">✕</button></div>`;
  });
  if (addUnderHeading) {
    const h = open.findIndex((t) => t.id === addUnderHeading);
    let end = h;
    while (end + 1 < open.length && !open[end + 1].head) end++;
    const name = open[h].text;
    rows.splice(
      end + 1,
      0,
      `<div class="td tadd"><span class="rn">•</span><input class="tadd-in" placeholder="Add to ${esc(name)}…" aria-label="New item under ${esc(name)}" enterkeyhint="done" autocapitalize="sentences" autocomplete="off"></div>`,
    );
  }
  renderingTodos = true;
  $('#tdOpen').innerHTML = open.length
    ? rows.join('')
    : '<div class="empty">Nothing to do 🎉<br>Add a to-do above.</div>';
  renderingTodos = false;
  const line = $('#tdOpen .tadd-in');
  if (line && keep) {
    line.value = keep.value;
    if (keep.focused) line.focus();
  }
  $('#tdN').textContent = nItems ? ` · ${nItems}` : '';
  $('#tdTip').textContent = open.length > 1 ? 'hold & drag to reorder' : '';
  $('#tdShare').hidden = !nItems;
  if (!$('#tdShare').dataset.busy) $('#tdShare').textContent = navigator.share ? 'Share' : 'Copy';
  $('#tdDoneCard').hidden = !done.length;
  $('#tdDoneN').textContent = ` · ${done.length}`;
  $('#tdDone').innerHTML = done
    .map(
      (t) =>
        `<div class="td done" data-id="${esc(t.id)}"><button class="tchk" data-xt="${esc(t.id)}" aria-label="Undo">✓</button><div class="tdt">${todoTextHtml(t)}</div><button class="x" data-xd="${esc(t.id)}" aria-label="Delete">✕</button></div>`,
    )
    .join('');
  const full = nItems >= MAX_OPEN_TODOS && !headingMode;
  $('#tdNew').disabled = full;
  $('#tdNew').placeholder = full
    ? `List is full (${MAX_OPEN_TODOS}). Tick or delete one first`
    : headingMode
      ? 'Add a heading…'
      : 'Add an item…';
  $('#tdHint').textContent = nItems >= MAX_OPEN_TODOS - 10 ? `${nItems} of ${MAX_OPEN_TODOS}` : '';
  $('#cntT').textContent = nItems || '';
}
// H button: the next entry becomes a heading; it switches back to normal to-dos after one heading
var headingMode = false;
function setHeadingMode(on) {
  headingMode = on;
  $('#tdHeadBtn').setAttribute('aria-pressed', on);
  $('#tdNew').classList.toggle('hdm', on);
  renderTodos();
}
$('#tdHeadBtn').addEventListener('pointerdown', (e) => e.preventDefault()); // keep the keyboard open
$('#tdHeadBtn').onclick = () => {
  setHeadingMode(!headingMode);
  $('#tdNew').focus();
};
// paste several lines at once (see parseTodoText in logic.js)
$('#tdNew').addEventListener('paste', (e) => {
  const txt = (e.clipboardData || window.clipboardData)?.getData('text') || '';
  if (!/\n/.test(txt.trim())) return; // single line: normal paste
  e.preventDefault();
  const rows = parseTodoText(txt),
    nh = rows.filter((r) => r.head).length,
    ni = rows.length - nh;
  const room = MAX_OPEN_TODOS - openTodos().filter(isTodoItem).length;
  if (!rows.length) return;
  if (ni > room)
    return alert(`That's ${ni} to-dos, but this list only has room for ${room} more (max ${MAX_OPEN_TODOS} open).`);
  if (
    !confirm(
      `Add ${nh} heading${nh === 1 ? '' : 's'} and ${ni} to-do${ni === 1 ? '' : 's'} to "${currentList().name}"?`,
    )
  )
    return;
  rows.forEach((r) => addTodo(r.text, r.head));
  $('#tdNew').value = '';
  setHeadingMode(false);
});
$('#tdForm').onsubmit = (e) => {
  e.preventDefault();
  const i = $('#tdNew');
  if (addTodo(i.value, headingMode)) {
    i.value = '';
    if (headingMode) setHeadingMode(false);
  }
  i.focus();
};
$('#tdClear').onclick = () => {
  const d = currentListTodos().filter((t) => t.done);
  if (d.length && confirm(`Remove ${d.length} done to-do${d.length > 1 ? 's' : ''}?`))
    d.forEach((t) => removeTodo(t.id));
};

// list chips: tap to switch, tap the current one to edit it, ＋ to make a new list
function drawListChips() {
  const ls = allTodoLists();
  if (!ls.some((l) => l.id === currentListId)) {
    currentListId = 'main';
    save('cl_tdlist', currentListId);
  }
  $('#tlChips').innerHTML =
    ls
      .map(
        (l) =>
          `<button type="button" class="chip${l.id === currentListId ? ' on' : ''}" data-tl="${esc(l.id)}">${esc(l.emoji || '📝')} ${esc(l.name)}${l.priv ? ' 🔒' : ''}</button>`,
      )
      .join('') + `<button type="button" class="chip add" data-tl="+">＋ New list</button>`;
  const c = currentList();
  $('#tdTitle').textContent = listCardTitle(c) + (c.priv ? ' 🔒' : '');
}
let listDialog = null; // dialog state {id|null, name, emoji, priv}
// the title on the list card: its own title if set, else "To do" for Home and the list's name for the others.
// Tap it to rename; it's stored on the list (shared lists sync it, private ones stay private).
const listCardTitle = (l) => l.title || (l.id === 'main' ? 'To do' : l.name);
function renameListTitle() {
  const l = currentList(),
    v = prompt('Title of this list', listCardTitle(l));
  if (v == null) return;
  const t = v.trim().replace(/\s+/g, ' ').slice(0, 40);
  if (l.id === 'main') {
    const d = { id: 'tl_main', kind: 'tlmain', name: l.name, emoji: l.emoji, ...(t ? { title: t } : {}) };
    listMeta.tl_main = d;
    save('cl_meta', listMeta);
    writeShared('meta', d);
  } else {
    const src = l.priv ? privateMeta : listMeta,
      old = src[l.id];
    if (!old) return;
    const { title, ...rest } = old;
    const d = { ...rest, ...(t ? { title: t } : {}) };
    src[l.id] = d;
    if (l.priv) {
      save('cl_pmeta', privateMeta);
      writePrivate('meta', d);
    } else {
      save('cl_meta', listMeta);
      writeShared('meta', d);
    }
  }
  renderTodos();
}
$('#tdTitle').onclick = () => {
  if (Date.now() >= ignoreTapsUntil) renameListTitle();
};
$('#tdTitle').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') renameListTitle();
});
function openListDialog(l) {
  listDialog = l ? { id: l.id, emoji: l.emoji || '📝', priv: l.priv } : { id: null, emoji: '📝', priv: true };
  $('#tlHead').textContent = l ? 'Edit list' : 'New list';
  $('#tlName').value = l ? l.name : '';
  $('#tlKindBox').hidden = !!l;
  $('#tlDel').hidden = !l || l.id === 'main';
  drawListDialog();
  $('#tlDlg').showModal();
  $('#tlHead').focus();
}
function drawListDialog() {
  $('#tlEmo').innerHTML = LIST_ICONS.map(
    (e) => `<button type="button" class="chip${e === listDialog.emoji ? ' sel' : ''}" data-te="${e}">${e}</button>`,
  ).join('');
  document
    .querySelectorAll('#tlDlg [data-tk]')
    .forEach((b) => b.classList.toggle('sel', (b.dataset.tk === 'priv') === listDialog.priv));
  $('#tlKindHint').textContent = listDialog.priv
    ? "Stays on your phone's private code: other phones on this list never see it."
    : 'Everyone with the list code sees it, like the Home list.';
}
$('#tlChips').addEventListener('click', (e) => {
  const b = e.target.closest('[data-tl]');
  if (!b) return;
  const id = b.dataset.tl;
  if (id === '+') return openListDialog(null);
  if (id === currentListId) return openListDialog(currentList());
  currentListId = id;
  save('cl_tdlist', currentListId);
  renderTodos();
});
$('#tlDlg').addEventListener('click', (e) => {
  const em = e.target.closest('[data-te]'),
    k = e.target.closest('[data-tk]');
  if (em) {
    listDialog.emoji = em.dataset.te;
    drawListDialog();
  }
  if (k) {
    listDialog.priv = k.dataset.tk === 'priv';
    drawListDialog();
  }
});
function saveListDialog() {
  const name = $('#tlName').value.trim().replace(/\s+/g, ' ').slice(0, 30);
  if (!name) return $('#tlName').focus();
  if (listDialog.id === 'main') {
    const d = {
      id: 'tl_main',
      kind: 'tlmain',
      name,
      emoji: listDialog.emoji,
      ...(homeList().title ? { title: homeList().title } : {}),
    };
    listMeta.tl_main = d;
    save('cl_meta', listMeta);
    writeShared('meta', d);
  } else {
    const old = listDialog.id && todoListById(listDialog.id),
      priv = old ? old.priv : listDialog.priv;
    const d = {
      id: listDialog.id || 'tl_' + newId(),
      kind: 'tl',
      name,
      emoji: listDialog.emoji,
      ts: old ? old.ts : Date.now(),
      ...(old && old.title ? { title: old.title } : {}),
    };
    if (priv) {
      const first = !privateCode;
      if (first) {
        privateCode = generateCode();
        save('cl_me', privateCode);
      } // first private list: this phone gets its own code
      privateMeta[d.id] = d;
      save('cl_pmeta', privateMeta);
      writePrivate('meta', d);
      if (first) connect();
    } else {
      listMeta[d.id] = d;
      save('cl_meta', listMeta);
      writeShared('meta', d);
    }
    currentListId = d.id;
    save('cl_tdlist', currentListId);
  }
  $('#tlDlg').close();
  renderTodos();
}
$('#tlSave').onclick = saveListDialog;
$('#tlName').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    saveListDialog();
  }
});
$('#tlCancel').onclick = () => $('#tlDlg').close();
$('#tlDel').onclick = () => {
  const l = todoListById(listDialog.id);
  if (!l || l.id === 'main') return;
  const mine = (l.priv ? privateTodos : todos).filter((t) => t.list === l.id);
  if (!confirm(`Delete "${l.name}"${mine.length ? ` and its ${mine.length} to-do${mine.length > 1 ? 's' : ''}` : ''}?`))
    return;
  mine.forEach((t) => removeTodo(t.id));
  if (l.priv) {
    delete privateMeta[l.id];
    save('cl_pmeta', privateMeta);
    deletePrivate('meta', l.id);
  } else {
    delete listMeta[l.id];
    save('cl_meta', listMeta);
    deleteShared('meta', l.id);
  }
  currentListId = 'main';
  save('cl_tdlist', currentListId);
  $('#tlDlg').close();
  renderTodos();
};

// tap the text to edit it in place
function editTodoText(id) {
  const t = todoById(id),
    box = document.querySelector(`#tdOpen .td[data-id="${id}"] .tdt`);
  if (!t || !box || editingTodoId) return;
  editingTodoId = id;
  const ta = document.createElement('textarea');
  ta.className = 'tded';
  ta.rows = 1;
  ta.value = t.text;
  ta.enterKeyHint = 'done';
  box.replaceWith(ta);
  const fit = () => {
    ta.style.height = 'auto';
    ta.style.height = ta.scrollHeight + 'px';
  };
  ta.oninput = fit;
  fit();
  ta.focus();
  ta.setSelectionRange(ta.value.length, ta.value.length);
  let fin = false;
  const finish = (save) => {
    if (fin) return;
    fin = true;
    editingTodoId = null;
    const v = ta.value.trim();
    if (save && v && v !== t.text) saveTodo({ ...t, text: v });
    else renderTodos();
  };
  ta.onkeydown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      finish(true);
    } else if (e.key === 'Escape') {
      finish(false);
    }
  };
  ta.onblur = () => finish(true);
}

$('#tdOpen').addEventListener('click', (e) => {
  const add = e.target.closest('[data-ha]');
  if (add) {
    if (Date.now() >= ignoreTapsUntil) openHeadingAdd(add.dataset.ha);
    return;
  }
  const b = e.target.closest('[data-hc]');
  if (!b || Date.now() < ignoreTapsUntil) return;
  const id = b.dataset.hc;
  if (foldedHeadings[id]) delete foldedHeadings[id];
  else foldedHeadings[id] = true;
  save('cl_folded', foldedHeadings);
  renderTodos();
});
$('#tdOpen').addEventListener('keydown', (e) => {
  if (!e.target.classList.contains('tadd-in')) return;
  if (e.key === 'Enter') {
    e.preventDefault();
    if (addUnderHeadingItem(e.target.value)) {
      const line = $('#tdOpen .tadd-in');
      if (line) line.value = '';
    }
  } else if (e.key === 'Escape') closeHeadingAdd();
});
// tapping away from an empty typing line closes it
$('#tdOpen').addEventListener('focusout', (e) => {
  if (!e.target.classList.contains('tadd-in') || renderingTodos) return;
  setTimeout(() => {
    const line = $('#tdOpen .tadd-in');
    if (line && document.activeElement !== line && !line.value.trim()) closeHeadingAdd();
  }, 0);
});
// hold a row, then drag it. Only a stationary press starts a drag, so normal swipes still scroll the page.
const todoListEl = $('#tdOpen');
function startPress(el, x, y, touch) {
  cancelPress();
  const h = { el, x, y, ly: y, touch };
  h.timer = setTimeout(
    () => {
      if (pressState === h) {
        pressState = null;
        startDrag(h.el, h.ly);
      }
    },
    touch ? 330 : 220,
  );
  pressState = h;
}
function cancelPress() {
  if (pressState) {
    clearTimeout(pressState.timer);
    pressState = null;
  }
}
// a heading carries its section (the rows after it, up to the next heading): they fold away while dragging,
// the heading moves past whole sections, and the rows unfold under it when dropped
const isHeadingRow = (n) => n && n.classList.contains('hd');
function startDrag(el, y) {
  if (editingTodoId || !el.isConnected) return;
  // the typing line under a heading isn't a row: take it away before anything moves
  const line = $('#tdOpen .tadd');
  if (line) {
    addUnderHeading = null;
    line.remove();
  }
  const group = [];
  if (isHeadingRow(el)) {
    for (let n = el.nextElementSibling; n && !isHeadingRow(n); n = n.nextElementSibling) group.push(n);
  }
  // keep the page the same height while the section is folded, so the heading stays under the finger
  const top0 = el.getBoundingClientRect().top,
    hid = group.reduce((h, n) => h + n.offsetHeight, 0);
  if (document.activeElement && document.activeElement !== document.body) document.activeElement.blur();
  if (hid) todoListEl.style.paddingBottom = hid + 'px';
  group.forEach((n) => (n.style.display = 'none'));
  const shift = el.getBoundingClientRect().top - top0;
  if (Math.abs(shift) > 1) scrollBy(0, shift);
  if (group.length) el.querySelector('.hdn').textContent = `+${group.length} to-do${group.length > 1 ? 's' : ''}`;
  dragState = { el, id: el.dataset.id, startY: y + scrollY, cy: y, raf: 0, group };
  el.classList.add('lift');
  document.body.classList.add('dragging');
  try {
    navigator.vibrate && navigator.vibrate(12);
  } catch {}
  dragState.raf = requestAnimationFrame(autoScrollWhileDragging);
}
function animateMove(n, mut) {
  const a = n.offsetTop;
  mut();
  const b = n.offsetTop;
  if (a === b) return;
  n.style.transition = 'none';
  n.style.transform = `translateY(${a - b}px)`;
  void n.offsetHeight;
  n.style.transition = 'transform .16s ease';
  n.style.transform = '';
}
// the block next to the dragged heading: a whole section (heading + rows), or loose rows above the first heading
function sectionBlockAfter(el) {
  const last = dragState.group.length ? dragState.group[dragState.group.length - 1] : el;
  const f = last.nextElementSibling;
  if (!f) return null;
  const b = [f];
  for (let n = f.nextElementSibling; n && !isHeadingRow(n); n = n.nextElementSibling) b.push(n);
  return b;
}
// loose rows above the first heading stay on top: a section never moves above them
function sectionBlockBefore(el) {
  const b = [];
  for (let n = el.previousElementSibling; n; n = n.previousElementSibling) {
    b.unshift(n);
    if (isHeadingRow(n)) return b;
  }
  return null;
}
const isShown = (n) => n.offsetParent !== null;
const blockMiddle = (b) => {
  const v = b.filter(isShown);
  if (!v.length) return -1e9;
  const l = v[v.length - 1];
  return (v[0].offsetTop + l.offsetTop + l.offsetHeight) / 2;
};
const blockHeight = (b) => {
  const v = b.filter(isShown);
  if (!v.length) return 0;
  const l = v[v.length - 1];
  return l.offsetTop + l.offsetHeight - v[0].offsetTop;
};
const isFoldedHeading = (n) => n && n.classList.contains('closed');
function rowBlockAfter(el) {
  const n = el.nextElementSibling;
  if (!n) return null;
  if (!isFoldedHeading(n)) return [n];
  const b = [n];
  for (let m = n.nextElementSibling; m && m.classList.contains('cz'); m = m.nextElementSibling) b.push(m);
  return b;
}
function rowBlockBefore(el) {
  const n = el.previousElementSibling;
  if (!n) return null;
  if (!n.classList.contains('cz')) return [n];
  const b = [];
  for (let m = n; m; m = m.previousElementSibling) {
    b.unshift(m);
    if (isHeadingRow(m)) break;
  }
  return b;
}
function moveDraggedSection() {
  const d = dragState,
    el = d.el;
  for (let g = 0; g < 60; g++) {
    const c = el.offsetTop + el.offsetHeight / 2 + (d.cy + scrollY - d.startY);
    const nb = sectionBlockAfter(el),
      pb = sectionBlockBefore(el);
    if (nb && c > blockMiddle(nb)) {
      const h = blockHeight(nb);
      const ref = el;
      nb.forEach((n) => animateMove(n, () => todoListEl.insertBefore(n, ref)));
      d.startY += h;
      continue;
    }
    if (pb && c < blockMiddle(pb)) {
      const h = blockHeight(pb);
      const after = (d.group.length ? d.group[d.group.length - 1] : el).nextSibling;
      pb.forEach((n) => animateMove(n, () => todoListEl.insertBefore(n, after)));
      d.startY -= h;
      continue;
    }
    break;
  }
  el.style.transform = `translateY(${d.cy + scrollY - d.startY}px)`;
}
function moveDraggedRow() {
  const d = dragState;
  if (!d) return;
  const el = d.el;
  if (isHeadingRow(el)) return moveDraggedSection();
  for (let g = 0; g < 60; g++) {
    const c = el.offsetTop + el.offsetHeight / 2 + (d.cy + scrollY - d.startY);
    // a folded section counts as one block (its heading plus hidden items), so an item hops over it whole
    const nb = rowBlockAfter(el),
      pb = rowBlockBefore(el);
    if (nb && c > blockMiddle(nb)) {
      const h = blockHeight(nb);
      nb.forEach((n) => animateMove(n, () => todoListEl.insertBefore(n, el)));
      d.startY += h;
      continue;
    }
    if (pb && c < blockMiddle(pb)) {
      const h = blockHeight(pb),
        ref = el.nextSibling;
      pb.forEach((n) => animateMove(n, () => todoListEl.insertBefore(n, ref)));
      d.startY -= h;
      continue;
    }
    break;
  }
  el.style.transform = `translateY(${d.cy + scrollY - d.startY}px)`;
}
function onDragMove(y) {
  if (dragState) {
    dragState.cy = y;
    moveDraggedRow();
  }
}
function autoScrollWhileDragging() {
  // scroll the page while the finger is near the top or bottom edge
  if (!dragState) return;
  const y = dragState.cy,
    h = innerHeight,
    edge = 90;
  let v = 0;
  if (y < edge) v = -Math.ceil(((edge - y) / edge) * 16);
  else if (y > h - edge) v = Math.ceil(((y - (h - edge)) / edge) * 16);
  if (v) {
    const b = scrollY;
    scrollBy(0, v);
    if (scrollY !== b) moveDraggedRow();
  }
  dragState.raf = requestAnimationFrame(autoScrollWhileDragging);
}
function endDrag() {
  const d = dragState;
  if (!d) return;
  dragState = null;
  cancelAnimationFrame(d.raf);
  ignoreTapsUntil = Date.now() + 600;
  d.el.classList.remove('lift');
  document.body.classList.remove('dragging');
  d.el.style.transform = '';
  if (isHeadingRow(d.el)) {
    let ref = d.el.nextSibling;
    d.group.forEach((n) => {
      todoListEl.insertBefore(n, ref);
      n.style.display = '';
    }); // unfold under the heading
    todoListEl.style.paddingBottom = '';
    return commitSectionMove(
      [d.id, ...d.group.map((n) => n.dataset.id)],
      [...todoListEl.children].map((r) => r.dataset.id),
    );
  }
  commitRowMove(
    d.id,
    [...todoListEl.children].map((r) => r.dataset.id),
  );
}
// no room left between two neighbours: every open row gets 1000, 2000, … in screen order
function renumberAll(ids) {
  ids.forEach((x, k) => {
    const q = todoById(x);
    if (q && q.order !== (k + 1) * 1000) saveTodo({ ...q, order: (k + 1) * 1000 });
  });
}
// a moved section: the heading and its rows get evenly spaced orders between the new neighbours (in their order)
function commitSectionMove(sec, ids) {
  const i = ids.indexOf(sec[0]),
    j = i + sec.length - 1;
  if (i < 0) return renderTodos();
  const p = i > 0 ? todoById(ids[i - 1]) : null,
    n = j < ids.length - 1 ? todoById(ids[j + 1]) : null,
    rows = sec.map(todoById);
  if (rows.some((x) => !x)) return renderTodos();
  const r = ordersForMovedSection(
    p ? p.order : null,
    n ? n.order : null,
    rows.map((x) => x.order),
  );
  if (r.keep) return renderTodos();
  if (r.renumber) return renumberAll(ids);
  rows.forEach((x, k) => saveTodo({ ...x, order: r.orders[k] }));
}
// only the moved row gets a new order value (halfway between its new neighbours), so two phones editing at once don't clash
function commitRowMove(id, ids) {
  const i = ids.indexOf(id),
    t = todoById(id);
  if (i < 0 || !t) return renderTodos();
  const p = i > 0 ? todoById(ids[i - 1]) : null,
    n = i < ids.length - 1 ? todoById(ids[i + 1]) : null;
  const r = orderForMovedRow(p ? p.order : null, n ? n.order : null, t.order);
  if (r.keep) return renderTodos();
  if (r.renumber) return renumberAll(ids);
  saveTodo({ ...t, order: r.order });
}
todoListEl.addEventListener(
  'touchstart',
  (e) => {
    const el = e.target.closest('.td');
    if (e.touches.length !== 1 || !el || el.classList.contains('tadd') || e.target.closest('button,textarea,input'))
      return cancelPress();
    const t = e.touches[0];
    startPress(el, t.clientX, t.clientY, true);
  },
  { passive: true },
);
todoListEl.addEventListener(
  'touchmove',
  (e) => {
    const t = e.touches[0];
    if (dragState) {
      e.preventDefault();
      onDragMove(t.clientY);
      return;
    }
    if (pressState) {
      if (Math.abs(t.clientX - pressState.x) > 8 || Math.abs(t.clientY - pressState.y) > 8) cancelPress();
      else pressState.ly = t.clientY;
    }
  },
  { passive: false },
);
const onTodoTouchEnd = (e) => {
  if (dragState) {
    if (e.cancelable) e.preventDefault();
    endDrag();
  } else cancelPress();
};
todoListEl.addEventListener('touchend', onTodoTouchEnd);
todoListEl.addEventListener('touchcancel', onTodoTouchEnd);
todoListEl.addEventListener('contextmenu', (e) => {
  if (e.target.closest('.td')) e.preventDefault();
});
todoListEl.addEventListener('mousedown', (e) => {
  const el = e.target.closest('.td');
  if (e.button !== 0 || !el || el.classList.contains('tadd') || e.target.closest('button,textarea,input')) return;
  startPress(el, e.clientX, e.clientY, false);
});
document.addEventListener('mousemove', (e) => {
  if (dragState) {
    onDragMove(e.clientY);
    return;
  }
  if (pressState && !pressState.touch) {
    if (Math.abs(e.clientX - pressState.x) > 5 || Math.abs(e.clientY - pressState.y) > 5) cancelPress();
    else pressState.ly = e.clientY;
  }
});
document.addEventListener('mouseup', () => {
  if (dragState) endDrag();
  else cancelPress();
});
