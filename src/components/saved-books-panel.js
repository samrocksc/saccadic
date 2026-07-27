/**
 * saved-books-panel.js — LitElement side panel for saved books.
 *
 * Modes:
 *   'list'    — show saved books
 *   'confirm' — confirm-delete guard
 *
 * Custom events dispatched (bubbles + composed):
 *   'book-load'    — detail: { id }
 *   'book-delete'  — detail: { id }
 *   'book-save'    — detail: { title, text }
 *   'panel-close'  — detail: {}
 */

import { LitElement, html, css } from 'https://cdn.jsdelivr.net/gh/lit/dist@3/core/lit-core.min.js';
import { listBooks, getBook } from '../utils/store.js';

class SavedBooksPanel extends LitElement {
  static properties = {
    _open:      { type: Boolean, state: true },
    _books:     { type: Array,  state: true },
    _mode:      { type: String, state: true },  // 'list' | 'confirm'
    _deleteId:  { type: String, state: true },
    _saveTitle: { type: String, state: true },
  };

  static styles = css`
    /* Shadow roots don't inherit the light-DOM reset in index.html. */
    *, *::before, *::after { box-sizing: border-box; }

    :host {
      display: block;
      width: 100%;
    }

    /* ── Backdrop ──────────────────────────── */
    .backdrop {
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.55);
      z-index: 100;
      display: flex;
      align-items: stretch;
      justify-content: flex-end;
      animation: fadeIn 150ms ease;
    }
    @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }

    /* ── Panel ─────────────────────────────── */
    .panel {
      width: min(380px, 92vw);
      height: 100%;
      background: var(--sacc-surface, #161b22);
      border-left: var(--sacc-border-width, 1px) solid var(--sacc-border, #30363d);
      display: flex;
      flex-direction: column;
      gap: 0;
      animation: slideIn 180ms cubic-bezier(0.22, 1, 0.36, 1);
      overflow: hidden;
    }
    @keyframes slideIn {
      from { transform: translateX(100%); }
      to   { transform: translateX(0); }
    }

    /* ── Panel header ─────────────────────── */
    .panel-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 1rem 1.25rem;
      border-bottom: 1px solid var(--sacc-border, #30363d);
      flex-shrink: 0;
    }
    .panel-title {
      font-family: var(--sacc-font, monospace);
      font-size: 0.9375rem;
      font-weight: 700;
      color: var(--sacc-text, #e6edf3);
      margin: 0;
    }
    .close-btn {
      font-family: var(--sacc-font, monospace);
      font-size: 1.25rem;
      font-weight: 400;
      background: transparent;
      border: none;
      color: var(--sacc-muted, #7d8590);
      cursor: pointer;
      padding: 0.2rem 0.5rem;
      border-radius: 4px;
      line-height: 1;
      transition: color 120ms ease;
    }
    .close-btn:hover {
      color: var(--sacc-text, #e6edf3);
    }

    /* ── Book list ────────────────────────── */
    .book-list {
      flex: 1;
      overflow-y: auto;
      padding: 0.75rem;
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }

    .book-card {
      padding: 0.875rem 1rem;
      border: var(--sacc-border-width, 1px) solid var(--sacc-border, #30363d);
      border-radius: var(--sacc-radius, 8px);
      background: var(--sacc-bg, #0d1117);
      cursor: pointer;
      transition: border-color 120ms ease, background 120ms ease;
      display: flex;
      flex-direction: column;
      gap: 0.4rem;
    }
    .book-card:hover {
      border-color: var(--sacc-accent, #ff4444);
      background: color-mix(in srgb, var(--sacc-accent, #ff4444) 6%, var(--sacc-bg, #0d1117));
    }

    .book-title {
      font-family: var(--sacc-font, monospace);
      font-size: 0.875rem;
      font-weight: 600;
      color: var(--sacc-text, #e6edf3);
      margin: 0;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .book-meta {
      font-family: var(--sacc-font, monospace);
      font-size: 0.6875rem;
      color: var(--sacc-muted, #7d8590);
      display: flex;
      gap: 0.75rem;
      flex-wrap: wrap;
    }
    .book-progress-bar {
      height: 3px;
      border-radius: 2px;
      background: var(--sacc-border, #30363d);
      overflow: hidden;
    }
    .book-progress-fill {
      height: 100%;
      background: var(--sacc-accent, #ff4444);
      border-radius: 2px;
      transition: width 300ms ease;
    }
    .book-actions {
      display: flex;
      gap: 0.5rem;
      margin-top: 0.25rem;
    }
    .book-actions button {
      font-family: var(--sacc-font, monospace);
      font-size: 0.6875rem;
      font-weight: 600;
      padding: 0.25rem 0.65rem;
      border-radius: 4px;
      cursor: pointer;
      border: 1px solid var(--sacc-border, #30363d);
      background: transparent;
      color: var(--sacc-muted, #7d8590);
      transition: color 120ms ease, border-color 120ms ease;
    }
    .book-actions button:hover {
      color: var(--sacc-text, #e6edf3);
      border-color: var(--sacc-muted, #7d8590);
    }
    .book-actions .delete-btn:hover {
      color: #ff6b6b;
      border-color: #ff6b6b;
    }

    /* ── Empty state ──────────────────────── */
    .empty-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 0.5rem;
      padding: 3rem 1rem;
      color: var(--sacc-muted, #7d8590);
      font-family: var(--sacc-font, monospace);
      font-size: 0.8125rem;
      text-align: center;
    }
    .empty-icon {
      font-size: 2rem;
      opacity: 0.4;
    }

    /* ── Panel footer ────────────────────── */
    .panel-footer {
      padding: 0.875rem 1.25rem;
      border-top: 1px solid var(--sacc-border, #30363d);
      flex-shrink: 0;
    }
    .save-form {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }
    .save-form input {
      width: 100%;
      padding: 0.5rem 0.75rem;
      font-family: var(--sacc-font, monospace);
      font-size: 0.8125rem;
      color: var(--sacc-text, #e6edf3);
      background: var(--sacc-bg, #0d1117);
      border: var(--sacc-border-width, 1px) solid var(--sacc-border, #30363d);
      border-radius: var(--sacc-radius, 6px);
      outline: none;
      box-sizing: border-box;
      transition: border-color 150ms ease;
    }
    .save-form input:focus {
      border-color: var(--sacc-accent, #ff4444);
    }
    .save-form input::placeholder {
      color: var(--sacc-muted, #7d8590);
    }
    .save-btn {
      width: 100%;
      padding: 0.5rem;
      font-family: var(--sacc-font, monospace);
      font-size: 0.8125rem;
      font-weight: 700;
      border: var(--sacc-border-width, 1px) solid var(--sacc-accent, #ff4444);
      border-radius: var(--sacc-radius, 6px);
      cursor: pointer;
      background: var(--sacc-accent, #ff4444);
      color: #fff;
      transition: filter 120ms ease;
    }
    .save-btn:hover:not(:disabled) {
      filter: brightness(1.15);
    }
    .save-btn:disabled {
      opacity: 0.35;
      cursor: not-allowed;
    }
    .save-hint {
      font-family: var(--sacc-font, monospace);
      font-size: 0.625rem;
      color: var(--sacc-muted, #7d8590);
      text-align: center;
    }

    /* ── Confirm delete ──────────────────── */
    .confirm-wrap {
      display: flex;
      flex-direction: column;
      gap: 0.875rem;
      padding: 1.25rem;
    }
    .confirm-msg {
      font-family: var(--sacc-font, monospace);
      font-size: 0.875rem;
      color: var(--sacc-text, #e6edf3);
      line-height: 1.5;
    }
    .confirm-buttons {
      display: flex;
      gap: 0.5rem;
    }
    .confirm-buttons button {
      flex: 1;
      padding: 0.5rem;
      font-family: var(--sacc-font, monospace);
      font-size: 0.8125rem;
      font-weight: 600;
      border-radius: var(--sacc-radius, 6px);
      cursor: pointer;
      border: var(--sacc-border-width, 1px) solid var(--sacc-border, #30363d);
      background: transparent;
      color: var(--sacc-text, #e6edf3);
      transition: background 120ms ease;
    }
    .confirm-buttons .confirm-yes {
      background: #ff6b6b;
      border-color: #ff6b6b;
      color: #fff;
    }
    .confirm-buttons .confirm-yes:hover {
      filter: brightness(1.1);
    }
  `;

  constructor() {
    super();
    this._open = false;
    this._books = [];
    this._mode = 'list';
    this._deleteId = null;
    this._saveTitle = '';
    this._saveText = '';
  }

  /** Call with (title, text) to pre-fill the save form from saccadic-app. */
  prefillSave(title, text) {
    this._saveTitle = title || '';
    this._saveText = text || '';
  }

  open() {
    this._books = listBooks();
    this._mode = 'list';
    this._open = true;
  }

  close() {
    this._open = false;
    this._mode = 'list';
    this._deleteId = null;
    this._saveTitle = '';
  }

  _dispatch(name, detail = {}) {
    this.dispatchEvent(new CustomEvent(name, { bubbles: true, composed: true, detail }));
  }

  _formatDate(ts) {
    const d = new Date(ts);
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  }

  _progress(book) {
    if (!book.wordCount || book.wordCount === 0) return 0;
    return Math.round((book.savedIndex / book.wordCount) * 100);
  }

  _onBookClick(id) {
    this._dispatch('book-load', { id });
    this.close();
  }

  _onDeleteClick(e, id) {
    e.stopPropagation();
    this._deleteId = id;
    this._mode = 'confirm';
  }

  _onConfirmDelete() {
    this._dispatch('book-delete', { id: this._deleteId });
    this._books = listBooks();
    this._deleteId = null;
    this._mode = 'list';
  }

  _onConfirmCancel() {
    this._deleteId = null;
    this._mode = 'list';
  }

  _onSaveTitleInput(e) {
    this._saveTitle = e.target.value;
  }

  _onSaveSubmit() {
    if (!this._saveText.trim()) return;
    this._dispatch('book-save', { title: this._saveTitle.trim(), text: this._saveText });
    this._books = listBooks();
    this._saveTitle = '';
    this._saveText = '';
  }

  _renderBookCard(book) {
    const pct = this._progress(book);
    return html`
      <div class="book-card" @click=${() => this._onBookClick(book.id)}>
        <div class="book-title">${book.title}</div>
        <div class="book-meta">
          <span>${book.wordCount.toLocaleString()} words</span>
          <span>${pct}% complete</span>
          <span>${this._formatDate(book.updatedAt)}</span>
        </div>
        <div class="book-progress-bar">
          <div class="book-progress-fill" style="width: ${pct}%"></div>
        </div>
        <div class="book-actions" @click=${(e) => e.stopPropagation()}>
          <button @click=${() => this._onBookClick(book.id)}>Load</button>
          <button class="delete-btn" @click=${(e) => this._onDeleteClick(e, book.id)}>Delete</button>
        </div>
      </div>
    `;
  }

  render() {
    if (!this._open) return html``;

    return html`
      <div class="backdrop" @click=${() => this.close()}>
        <div class="panel" @click=${(e) => e.stopPropagation()}>

          <!-- Header -->
          <div class="panel-header">
            <h2 class="panel-title">Saved Books</h2>
            <button class="close-btn" @click=${() => this.close()} aria-label="Close">×</button>
          </div>

          ${this._mode === 'confirm' ? html`
            <!-- Confirm delete -->
            <div class="confirm-wrap">
              <p class="confirm-msg">
                Delete <strong>${getBook(this._deleteId)?.title ?? 'this book'}</strong>?<br/>
                This cannot be undone.
              </p>
              <div class="confirm-buttons">
                <button @click=${this._onConfirmCancel}>Cancel</button>
                <button class="confirm-yes" @click=${this._onConfirmDelete}>Delete</button>
              </div>
            </div>

          ` : html`
            <!-- Book list -->
            <div class="book-list">
              ${this._books.length === 0 ? html`
                <div class="empty-state">
                  <div class="empty-icon">📚</div>
                  <div>No saved books yet</div>
                  <div>Give your text a title and save it below</div>
                </div>
              ` : this._books.map(b => this._renderBookCard(b))}
            </div>

            <!-- Save current text -->
            <div class="panel-footer">
              <div class="save-form">
                <input
                  type="text"
                  placeholder="Book title (optional)"
                  .value=${this._saveTitle}
                  @input=${this._onSaveTitleInput}
                  aria-label="Book title"
                />
                <button
                  class="save-btn"
                  ?disabled=${!this._saveText.trim()}
                  @click=${this._onSaveSubmit}
                >Save Current Text</button>
                <div class="save-hint">bookmark is saved automatically on load</div>
              </div>
            </div>
          `}

        </div>
      </div>
    `;
  }
}

customElements.define('saved-books-panel', SavedBooksPanel);
