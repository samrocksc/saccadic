/**
 * saccadic-app — root LitElement web component.
 * Wires together: SaccadicReader engine + orp-display + saccadic-controls + saved-books-panel.
 * Handles all custom events from child components.
 */

import { LitElement, html, css } from 'https://cdn.jsdelivr.net/gh/lit/dist@3/core/lit-core.min.js';
import { SaccadicReader, DEFAULT_WPM } from '../utils/reader.js';
import { SpeechRecognizer, isSpeechSupported } from '../utils/speech.js';
import { saveBook, updateBookmark, deleteBook, getBook } from '../utils/store.js';
import { themeManager } from '../themes/themes.js';
import './orp-display.js';
import './saccadic-controls.js';
import './saved-books-panel.js';

class SaccadicApp extends LitElement {
  static properties = {
    _wpm:       { type: Number,  state: true },
    _playing:   { type: Boolean, state: true },
    _word:      { type: String,  state: true },
    _index:     { type: Number,  state: true },
    _total:     { type: Number,  state: true },
    _hasText:   { type: Boolean, state: true },
    _theme:     { type: String,  state: true },
    _orpColor:  { type: String,  state: true },
    _orpCustom: { type: Boolean, state: true },
    _mode:      { type: String,  state: true },  // 'paste' | 'speak'
    _listening: { type: Boolean, state: true },
    _transcript:{ type: String,  state: true },
    _savedBook: { type: Object,  state: true },  // SavedBook | null
  };

  static styles = css`
    /* Shadow roots don't inherit the light-DOM reset in index.html. */
    *, *::before, *::after { box-sizing: border-box; }

    :host {
      display: flex;
      flex-direction: column;
      align-items: stretch;
      gap: 1.5rem;
      min-height: 100vh;
      padding: 1rem 1rem 2rem;
      box-sizing: border-box;
      background: var(--sacc-bg);
      color: var(--sacc-text);
      transition: background 200ms ease, color 200ms ease;
    }

    /* Header */
    header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      text-align: left;
    }
    header h1 {
      font-family: 'Space Mono', var(--sacc-font, monospace);
      font-size: clamp(1.25rem, 5vw, 1.75rem);
      font-weight: 700;
      letter-spacing: -0.02em;
      color: var(--sacc-accent);
      margin: 0;
    }
    header p {
      font-family: var(--sacc-font, monospace);
      font-size: 0.75rem;
      color: var(--sacc-muted);
      margin: 0.25rem 0 0;
      letter-spacing: 0.08em;
      text-transform: uppercase;
    }
    .header-right {
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }
    .saved-btn {
      font-family: var(--sacc-font, monospace);
      font-size: 0.75rem;
      font-weight: 600;
      min-height: 44px;
      touch-action: manipulation;
      padding: 0.35rem 0.85rem;
      border: var(--sacc-border-width, 1px) solid var(--sacc-border);
      border-radius: var(--sacc-radius, 6px);
      background: transparent;
      color: var(--sacc-muted);
      cursor: pointer;
      transition: border-color 120ms ease, color 120ms ease;
      display: flex;
      align-items: center;
      gap: 0.35rem;
    }
    .saved-btn:hover {
      border-color: var(--sacc-accent);
      color: var(--sacc-accent);
    }
    .saved-btn .bookmark-icon {
      font-size: 0.875rem;
    }

    /* Main layout: display on top, controls below */
    .display-area {
      flex: 1;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 200px;
    }

    .controls-area {
      width: 100%;
      max-width: 640px;
      margin: 0 auto;
      padding: 1.25rem;
      background: var(--sacc-surface);
      border: var(--sacc-border-width, 1px) solid var(--sacc-border);
      box-shadow: var(--sacc-shadow, none);
      border-radius: var(--sacc-radius, 8px);
    }

    /* Attribution */
    footer {
      text-align: center;
      font-family: var(--sacc-font, monospace);
      font-size: 0.6875rem;
      color: var(--sacc-muted);
      margin-top: auto;
    }
    footer a {
      color: var(--sacc-muted);
      text-decoration: none;
    }
    footer a:hover {
      color: var(--sacc-accent);
    }
  `;

  constructor() {
    super();
    this._wpm        = DEFAULT_WPM;
    this._playing    = false;
    this._word       = '';
    this._index      = 0;
    this._total      = 0;
    this._hasText    = false;
    this._theme      = 'dark';
    this._orpColor   = '#ff4444';
    this._orpCustom  = false;
    this._mode       = 'paste';
    this._listening  = false;
    this._transcript = '';
    this._savedBook  = null;   // null = unsaved / no book loaded
    this._panelRef   = null;   // refs to child components
    this._bookmarkDirty = false;

    this._reader = new SaccadicReader();
    this._wpm = this._reader.wpm; // reader restores saved WPM preference (issue #7)
    this._speech = null;
    this._accumulatedText = '';
    this._setupReaderCallbacks();
  }

  connectedCallback() {
    super.connectedCallback();
    themeManager.init();
    this._theme = themeManager.current;
    this._syncOrpFromManager();
    this._reader.attachKeyboard();
    if (isSpeechSupported) {
      try {
        this._speech = new SpeechRecognizer();
        this._setupSpeechEvents();
      } catch (e) {
        console.warn('[saccadic] speech recognizer init failed:', e);
        this._speech = null;
      }
    }
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this._reader.detachKeyboard();
    if (this._speech) {
      this._speech.stop();
      this._speech = null;
    }
    // Flush any pending bookmark before unmount
    if (this._savedBook && this._index > 0) {
      updateBookmark(this._savedBook.id, this._index);
    }
  }

  firstUpdated() {
    // Cache refs to child components after first render
    this._panelRef = this.shadowRoot.querySelector('saved-books-panel');
  }

  _setupReaderCallbacks() {
    this._reader
      .onWord((idx, word) => {
        this._word    = word;
        this._index   = idx;
        this._autoSaveBookmark();
      })
      .onEnd(() => {
        this._flushBookmark();
      })
      .onProgress((idx, total) => {
        this._index = idx;
        this._total = total;
        // Throttle: save bookmark every 50 words
        if (idx > 0 && idx % 50 === 0) {
          this._flushBookmark();
        }
      })
      // The z/x shortcuts and the slider both funnel through the reader, so the
      // reader is the single source of truth for speed. Mirroring it back into
      // component state is what keeps the slider and the readout honest —
      // without this, keyboard shortcuts silently desync the whole UI.
      .onWpmChange((wpm) => {
        this._wpm = wpm;
      })
      .onPlayState((playing) => {
        this._playing = playing;
        if (!playing) {
          this._word = this._reader.currentWord || this._word;
          this._flushBookmark();
        }
      });
  }

  _setupSpeechEvents() {
    if (!this._speech) return;

    this._speech.onResult(({ transcript, isFinal }) => {
      // Interim text is a live preview only — it gets revised as the
      // recogniser firms up, so it must never reach the word list.
      this._transcript = isFinal ? '' : transcript;
      this._requestControlsUpdate({ _transcript: this._transcript });

      if (isFinal && transcript) {
        this._accumulatedText += (this._accumulatedText ? ' ' : '') + transcript;
        // Append rather than reload. loadText() resets the cursor to word zero
        // and stops playback, so reloading on every final result made live
        // transcription restart from the beginning and never play through.
        this._total = this._reader.appendText(transcript);
        this._hasText = this._reader.hasText;
      }
    });

    this._speech.onError((error) => {
      console.warn('[saccadic] speech error:', error);
      if (this._speech) this._speech.stop();
      this._listening = false;
      this._requestControlsUpdate({ _listening: false });
    });

    this._speech.onEnd(() => {
      this._listening = false;
      this._requestControlsUpdate({ _listening: false });
    });
  }

  _requestControlsUpdate(patch) {
    const controls = this.shadowRoot.querySelector('saccadic-controls');
    if (controls) Object.assign(controls, patch);
  }

  _feedTextToReader(text) {
    this._reader.loadText(text);
    // Reloading a saved book resumes at its bookmark; fresh text starts at 0.
    const isReload = this._savedBook !== null;
    const startIdx = isReload ? this._reader.seek(this._savedBook.savedIndex) : 0;

    this._hasText = this._reader.hasText;
    this._total   = this._reader.totalWords;
    this._word    = '';
    this._index   = startIdx;
    this._playing = false;
  }

  _autoSaveBookmark() {
    this._bookmarkDirty = true;
  }

  _flushBookmark() {
    if (this._savedBook && this._bookmarkDirty) {
      updateBookmark(this._savedBook.id, this._index);
      this._bookmarkDirty = false;
    }
  }

  // --- Event handlers (events bubble from children) ---

  _onTextChanged(e) {
    const { text } = e.detail;
    this._accumulatedText = '';
    this._savedBook = null;
    this._feedTextToReader(text);
  }

  _onWpmChanged(e) {
    const { wpm } = e.detail;
    this._wpm = this._reader.setWpm(wpm);
  }

  _onPlayPause() {
    // State mirroring happens in the reader's onPlayState callback.
    this._reader.toggle();
  }

  _onSpeedChange(e) {
    const { delta } = e.detail;
    if (delta > 0) this._reader.speedUp();
    else           this._reader.speedDown();
  }

  _onReset() {
    this._reader.stop();
    this._playing = false;
    this._word    = '';
    this._index   = 0;
    this._hasText = this._reader.hasText;
    if (this._savedBook) {
      updateBookmark(this._savedBook.id, 0);
      this._savedBook = { ...this._savedBook, savedIndex: 0 };
    }
  }

  _onThemeChange(e) {
    const { theme } = e.detail;
    themeManager.apply(theme);
    this._theme = theme;
    // Theme apply preserves custom orp, but the *theme accent* (used as the fallback
    // shown in the picker when no override exists) just changed — refresh picker state.
    this._syncOrpFromManager();
  }

  _onOrpColorChange(e) {
    const { color } = e.detail;
    themeManager.setCustomOrpColor(color);
    this._orpColor = color;
    this._orpCustom = true;
  }

  _onOrpColorReset() {
    themeManager.clearCustomOrpColor();
    this._syncOrpFromManager();
  }

  /** Pull current orp color + custom flag from the theme manager into local state. */
  _syncOrpFromManager() {
    const custom = themeManager.customOrpColor;
    if (custom) {
      this._orpColor = custom;
      this._orpCustom = true;
    } else {
      // Read theme's accent from computed --sacc-orp on :root
      const computed = getComputedStyle(document.documentElement)
        .getPropertyValue('--sacc-orp')
        .trim();
      this._orpColor = this._toHex(computed) || '#ff4444';
      this._orpCustom = false;
    }
  }

  /** Best-effort normalize any CSS color to a 6-char hex (#rrggbb) for <input type="color">. */
  _toHex(color) {
    if (!color) return null;
    if (/^#[0-9a-fA-F]{6}$/.test(color)) return color.toLowerCase();
    // Resolve named/rgb via a sacrificial element
    const probe = document.createElement('span');
    probe.style.color = color;
    document.body.appendChild(probe);
    const rgb = getComputedStyle(probe).color; // "rgb(r, g, b)" or "rgba(r,g,b,a)"
    probe.remove();
    const m = rgb.match(/\d+/g);
    if (!m || m.length < 3) return null;
    const hex = '#' + [m[0], m[1], m[2]]
      .map(n => Number(n).toString(16).padStart(2, '0'))
      .join('');
    return hex;
  }

  _onModeChange(e) {
    this._mode = e.detail.mode;
    if (this._mode === 'speak') {
      this._reader.pause();
      this._playing = false;
    }
  }

  _onListenClick() {
    if (!this._speech) return;
    if (this._listening) {
      this._speech.stop();
      this._listening = false;
    } else {
      this._accumulatedText = '';
      this._transcript = '';
      this._listening = true;
      this._speech.start();
    }
    this._requestControlsUpdate({ _listening: this._listening });
  }

  _onPanelToggle() {
    if (!this._panelRef) return;
    // Always prefill with current text + suggested title
    const suggestedTitle = this._savedBook?.title
      ?? (this._reader.hasText ? `Page ${this._index + 1}` : '');
    const currentText = this._reader.hasText
      ? this._reader.words.join(' ')
      : '';
    this._panelRef.prefillSave(suggestedTitle, currentText);
    this._panelRef.open();
  }

  _onBookLoad(e) {
    const { id } = e.detail;
    // Flush current bookmark before switching
    this._flushBookmark();

    const book = getBook(id);
    if (!book) return;

    this._savedBook = { ...book };
    this._feedTextToReader(book.text);
  }

  _onBookDelete(e) {
    const { id } = e.detail;
    deleteBook(id);
    // If we were reading this book, clear the reference
    if (this._savedBook?.id === id) {
      this._savedBook = null;
    }
  }

  _onBookSave(e) {
    const { title, text } = e.detail;
    const existing = this._savedBook ?? null;
    const saved = saveBook({
      id:    existing?.id,
      title: title || existing?.title || `Untitled`,
      text,
    });
    if (saved) {
      this._savedBook = { ...saved };
    }
  }

  render() {
    return html`
      <header>
        <div>
          <h1>Saccadic</h1>
          <p>RSVP Word Runner</p>
        </div>
        <div class="header-right">
          <button class="saved-btn" @click=${this._onPanelToggle} aria-label="Open saved books">
            <span class="bookmark-icon">📑</span>
            Saved
            ${this._savedBook ? html`<span>·</span><span style="color: var(--sacc-accent)">${this._savedBook.title.slice(0, 12)}${this._savedBook.title.length > 12 ? '…' : ''}</span>` : ''}
          </button>
        </div>
      </header>

      <div class="display-area">
        <orp-display
          .word=${this._word}
          .active=${this._playing}
          .index=${this._index}
          .total=${this._total}
        ></orp-display>
      </div>

      <div class="controls-area">
        <saccadic-controls
          .wpm=${this._wpm}
          .playing=${this._playing}
          .hasText=${this._hasText}
          .theme=${this._theme}
          .orpColor=${this._orpColor}
          .orpCustom=${this._orpCustom}
          @text-changed=${this._onTextChanged}
          @wpm-changed=${this._onWpmChanged}
          @play-pause=${this._onPlayPause}
          @speed-change=${this._onSpeedChange}
          @reset=${this._onReset}
          @theme-change=${this._onThemeChange}
          @mode-change=${this._onModeChange}
          @listen-click=${this._onListenClick}
          @orp-color-change=${this._onOrpColorChange}
          @orp-color-reset=${this._onOrpColorReset}
        ></saccadic-controls>
      </div>

      <saved-books-panel></saved-books-panel>

      <footer>
        <a href="https://cowabunga.dev/" target="_blank" rel="noopener">cowabunga.dev</a>
        ·
        <a href="https://github.com/samrocksc/saccadic" target="_blank" rel="noopener">source</a>
      </footer>
    `;
  }
}

customElements.define('saccadic-app', SaccadicApp);
