/*
 * store.js — the ONLY place notes are saved and loaded.
 *
 * Right now notes live in the browser's localStorage.
 * Phase 2 (Google Drive sync) will plug in here: the rest of the app
 * only calls Store.getAll / get / save / remove, so it won't need to change.
 *
 * A note looks like this:
 * {
 *   id:        "k3x9...",          unique ID (used for syncing later)
 *   title:     "Shin Ramyun",
 *   category:  "home" | "restaurant",
 *   body:      "Cook 4 min...",
 *   date:      "2026-11-04",       the date you pick in the form
 *   createdAt: ISO timestamp,
 *   updatedAt: ISO timestamp,      lets sync decide which copy is newer
 *   place:     null                reserved for Phase 5 (Yelp restaurant info)
 * }
 */
const Store = (() => {
  const STORAGE_KEY = 'foodJournal.notes.v1';
  const listeners = [];

  function makeId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  // Returns a date like "2026-11-04" in your local time zone.
  // daysAgo lets the seed notes have slightly different dates.
  function today(daysAgo = 0) {
    const d = new Date();
    d.setDate(d.getDate() - daysAgo);
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }

  function seedNotes() {
    const now = new Date().toISOString();
    const make = (title, category, body, daysAgo) => ({
      id: makeId(), title, category, body,
      date: today(daysAgo), createdAt: now, updatedAt: now, place: null,
    });
    return [
      make('Shin Ramyun', 'home', 'Cook 4 min, add egg at minute 2', 0),
      make('Beef Stew in Instant Pot', 'home',
        'High pressure 35 min, quick release, add veg, 4 min natural release', 2),
      make('Hey Noodle', 'restaurant',
        'Beef brisket noodle, extra spicy, regular numbing, firm noodles', 5),
    ];
  }

  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw === null) {
        // First visit: start with the seed notes.
        const seeded = seedNotes();
        write(seeded);
        return seeded;
      }
      return JSON.parse(raw) || [];
    } catch (err) {
      console.error('Could not load notes', err);
      return [];
    }
  }

  function write(list) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
    } catch (err) {
      console.error('Could not save notes', err);
      alert('Sorry, your browser would not let Food Journal save notes.');
    }
  }

  let notes = load();

  function changed() {
    write(notes);
    listeners.forEach((fn) => fn());
  }

  // Newest date first; ties broken by most recently edited.
  function byNewest(a, b) {
    if (a.date !== b.date) return a.date < b.date ? 1 : -1;
    return a.updatedAt < b.updatedAt ? 1 : -1;
  }

  return {
    today,

    // All notes, newest first. Returns copies so nobody edits them by accident.
    getAll() {
      return notes.map((n) => ({ ...n })).sort(byNewest);
    },

    get(id) {
      const n = notes.find((x) => x.id === id);
      return n ? { ...n } : null;
    },

    // Adds a new note (no id) or updates an existing one (has id).
    save(input) {
      const now = new Date().toISOString();
      const existing = input.id && notes.find((x) => x.id === input.id);
      let note;
      if (existing) {
        note = { ...existing, ...input, updatedAt: now };
        notes = notes.map((x) => (x.id === note.id ? note : x));
      } else {
        note = { place: null, ...input, id: makeId(), createdAt: now, updatedAt: now };
        notes.push(note);
      }
      changed();
      return { ...note };
    },

    remove(id) {
      notes = notes.filter((x) => x.id !== id);
      changed();
    },

    // Run a function whenever notes change (Phase 2 sync will use this).
    subscribe(fn) {
      listeners.push(fn);
    },
  };
})();
