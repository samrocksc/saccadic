/**
 * store.js — localStorage wrapper for saved books.
 *
 * Each SavedBook:
 *   {
 *     id:        string,   // timestamp-ms (unique per book)
 *     title:     string,   // user-provided or auto-generated
 *     text:      string,   // full book text
 *     wordCount: number,   // total words
 *     savedIndex:number,   // word index bookmark (0 = start)
 *     createdAt: number,   // Date.now() when first saved
 *     updatedAt: number,   // Date.now() when last updated
 *   }
 *
 * localStorage key: 'saccadic-books'
 */

const STORAGE_KEY = 'saccadic-books';

function _loadRaw() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function _save(arr) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(arr));
}

/** List all saved books, newest first. */
export function listBooks() {
  return _loadRaw().sort((a, b) => b.updatedAt - a.updatedAt);
}

/** Get a single book by id, or null. */
export function getBook(id) {
  const all = _loadRaw();
  return all.find(b => b.id === String(id)) ?? null;
}

/**
 * Save a new book or update an existing one.
 * Pass { id } to update; omit id to create fresh.
 * Auto-sets createdAt on first save.
 */
export function saveBook({ id, title, text }) {
  const all = _loadRaw();
  const now = Date.now();
  const words = text.trim().split(/\s+/).filter(Boolean);

  if (id) {
    // Update existing
    const idx = all.findIndex(b => b.id === String(id));
    if (idx === -1) return null;
    const existing = all[idx];
    all[idx] = {
      ...existing,
      title: title || existing.title,
      text,
      wordCount: words.length,
      updatedAt: now,
    };
  } else {
    // Create new
    const newBook = {
      id: String(now),
      title: title || `Untitled — ${new Date().toLocaleDateString()}`,
      text,
      wordCount: words.length,
      savedIndex: 0,
      createdAt: now,
      updatedAt: now,
    };
    all.push(newBook);
    id = newBook.id;
  }

  _save(all);
  return getBook(id);
}

/**
 * Update only the bookmark index of a book.
 * Also bumps updatedAt.
 */
export function updateBookmark(id, savedIndex) {
  const all = _loadRaw();
  const idx = all.findIndex(b => b.id === String(id));
  if (idx === -1) return;
  all[idx].savedIndex = savedIndex;
  all[idx].updatedAt = Date.now();
  _save(all);
}

/** Delete a book by id. */
export function deleteBook(id) {
  const all = _loadRaw().filter(b => b.id !== String(id));
  _save(all);
}
