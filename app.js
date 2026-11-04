/*
 * app.js — everything you see and click.
 * It reads and writes notes only through Store (see store.js).
 */
(() => {
  const CATEGORIES = { home: 'Home', restaurant: 'Restaurant' };

  // What the screen is showing right now.
  const state = {
    filter: 'all',      // 'all' | 'home' | 'restaurant'
    query: '',          // search box text
    selectedId: null,   // which note is open
    mode: 'empty',      // 'empty' | 'view' | 'edit' | 'new'
    view: 'list',       // phones only: 'list' or 'detail' screen
  };

  const $ = (sel) => document.querySelector(sel);
  const app = $('#app');
  const listEl = $('#noteList');
  const emptyEl = $('#emptyList');
  const detailEl = $('#detail');
  const searchEl = $('#search');

  // Small helper to build HTML elements safely (no raw HTML from notes).
  function el(tag, props = {}, ...children) {
    const node = document.createElement(tag);
    for (const [key, value] of Object.entries(props)) {
      if (key === 'class') node.className = value;
      else if (key.startsWith('on')) node.addEventListener(key.slice(2), value);
      else if (key in node) node[key] = value;
      else node.setAttribute(key, value);
    }
    for (const child of children.flat()) {
      if (child == null || child === false) continue;
      node.append(child instanceof Node ? child : document.createTextNode(child));
    }
    return node;
  }

  function formatDate(ymd) {
    const [y, m, d] = ymd.split('-').map(Number);
    return new Date(y, m - 1, d).toLocaleDateString(undefined, {
      month: 'short', day: 'numeric', year: 'numeric',
    });
  }

  function badge(category) {
    return el('span', { class: `badge badge-${category}` }, CATEGORIES[category]);
  }

  // ---------- Filtering + search ----------

  function visibleNotes() {
    const q = state.query.trim().toLowerCase();
    return Store.getAll().filter((n) => {
      if (state.filter !== 'all' && n.category !== state.filter) return false;
      if (!q) return true;
      return n.title.toLowerCase().includes(q) || n.body.toLowerCase().includes(q);
    });
  }

  // ---------- Rendering ----------

  function render() {
    app.dataset.view = state.view;
    document.querySelectorAll('[data-filter]').forEach((btn) => {
      const on = btn.dataset.filter === state.filter;
      btn.classList.toggle('active', on);
      btn.setAttribute('aria-pressed', on);
    });
    renderList();
    renderDetail();
  }

  function renderList() {
    const notes = visibleNotes();
    listEl.replaceChildren(...notes.map((n) =>
      el('li', {},
        el('button', {
          class: 'note-card' + (n.id === state.selectedId ? ' selected' : ''),
          type: 'button',
          onclick: () => openNote(n.id),
        },
          el('span', { class: 'note-card-title' }, n.title),
          el('span', { class: 'note-card-meta' }, badge(n.category), formatDate(n.date)),
          el('span', { class: 'note-card-snippet' }, n.body),
        ))));

    emptyEl.hidden = notes.length > 0;
    if (!notes.length) {
      emptyEl.textContent = state.query
        ? `No notes match “${state.query}”.`
        : 'No notes here yet. Tap “New” to write one.';
    }
  }

  function renderDetail() {
    const note = state.selectedId && Store.get(state.selectedId);
    if (state.mode === 'new') return detailEl.replaceChildren(noteForm(null));
    if (state.mode === 'edit' && note) return detailEl.replaceChildren(noteForm(note));
    if (state.mode === 'view' && note) return detailEl.replaceChildren(noteView(note));
    detailEl.replaceChildren(
      el('div', { class: 'welcome' },
        el('p', { class: 'welcome-mark', 'aria-hidden': 'true' }, '🥄'),
        el('h2', {}, 'Pick a note, or start a new one'),
        el('p', {}, 'Recipe timings, favorite orders, the way you like your noodles.'),
        el('button', { class: 'btn btn-primary', type: 'button', onclick: newNote }, '+ New note'),
      ));
  }

  function backButton() {
    return el('button', { class: 'btn btn-ghost back', type: 'button', onclick: goBack }, '← Notes');
  }

  function noteView(note) {
    return el('article', { class: 'paper' },
      backButton(),
      el('div', { class: 'paper-meta' }, badge(note.category), formatDate(note.date)),
      el('h2', { class: 'paper-title' }, note.title),
      el('div', { class: 'paper-body' }, note.body || ' '),
      // Phase 4: a "Read Aloud" button will go here.
      el('div', { class: 'actions' },
        el('button', { class: 'btn btn-primary', type: 'button', onclick: () => editNote(note.id) }, 'Edit'),
        el('button', { class: 'btn btn-danger', type: 'button', onclick: () => deleteNote(note) }, 'Delete'),
      ));
  }

  function noteForm(note) {
    const isNew = !note;
    const category = note ? note.category : (state.filter === 'all' ? 'home' : state.filter);

    const form = el('form', { class: 'paper', onsubmit: (e) => saveForm(e, note) },
      backButton(),
      el('h2', { class: 'paper-title' }, isNew ? 'New note' : 'Edit note'),

      el('label', { class: 'field' }, el('span', {}, 'Title'),
        el('input', { name: 'title', required: true, maxLength: 120, value: note ? note.title : '',
          placeholder: 'e.g. Shin Ramyun' })),

      el('div', { class: 'field-row' },
        el('fieldset', { class: 'field segmented' },
          el('legend', {}, 'Category'),
          ...Object.entries(CATEGORIES).map(([value, label]) =>
            el('label', {},
              el('input', { type: 'radio', name: 'category', value, checked: value === category }),
              el('span', {}, label)))),
        el('label', { class: 'field' }, el('span', {}, 'Date'),
          el('input', { type: 'date', name: 'date', required: true, value: note ? note.date : Store.today() })),
      ),

      // Phase 5: restaurant lookup (Yelp) will appear here when category is Restaurant.

      el('label', { class: 'field' }, el('span', {}, 'Notes'),
        // Phase 4: a microphone (voice input) button will sit next to this box.
        el('textarea', { name: 'body', rows: 8, value: note ? note.body : '',
          placeholder: 'Steps, timings, how you like to order it…' })),

      el('div', { class: 'actions' },
        el('button', { class: 'btn btn-primary', type: 'submit' }, isNew ? 'Add note' : 'Save changes'),
        el('button', { class: 'btn btn-ghost', type: 'button', onclick: cancelForm }, 'Cancel'),
      ));

    // Put the cursor in the title box.
    setTimeout(() => form.elements.title.focus(), 0);
    return form;
  }

  // ---------- Actions ----------

  function openNote(id) {
    Object.assign(state, { selectedId: id, mode: 'view', view: 'detail' });
    render();
  }

  function newNote() {
    Object.assign(state, { selectedId: null, mode: 'new', view: 'detail' });
    render();
  }

  function editNote(id) {
    Object.assign(state, { selectedId: id, mode: 'edit', view: 'detail' });
    render();
  }

  function saveForm(event, note) {
    event.preventDefault();
    const f = event.target.elements;
    const title = f.title.value.trim();
    if (!title) return f.title.focus();
    const saved = Store.save({
      ...(note ? { id: note.id } : {}),
      title,
      category: f.category.value,
      date: f.date.value,
      body: f.body.value.trim(),
    });
    // Make sure the saved note is visible in the list.
    if (state.filter !== 'all' && state.filter !== saved.category) state.filter = 'all';
    state.query = '';
    searchEl.value = '';
    openNote(saved.id);
  }

  function cancelForm() {
    if (state.mode === 'edit') openNote(state.selectedId);
    else goBack();
  }

  function deleteNote(note) {
    if (!confirm(`Delete “${note.title}”? This can't be undone.`)) return;
    Store.remove(note.id);
    goBack();
  }

  function goBack() {
    Object.assign(state, { selectedId: null, mode: 'empty', view: 'list' });
    render();
  }

  function setFilter(filter) {
    state.filter = filter;
    // On phones, tapping a tab takes you back to the list.
    state.view = 'list';
    render();
  }

  // ---------- Wire up buttons ----------

  document.querySelectorAll('[data-filter]').forEach((btn) =>
    btn.addEventListener('click', () => setFilter(btn.dataset.filter)));
  $('#newBtn').addEventListener('click', newNote);
  $('#tabNew').addEventListener('click', newNote);
  searchEl.addEventListener('input', () => {
    state.query = searchEl.value;
    renderList();
  });

  render();
})();
