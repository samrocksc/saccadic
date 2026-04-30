/**
 * saccadic-app — root LitElement web component.
 * Wires together: SaccadicReader engine + orp-display + saccadic-controls.
 * Handles all custom events from child components.
 */

import { LitElement, html, css } from 'https://cdn.jsdelivr.net/gh/lit/dist@3/core/lit-core.min.js';
import { SaccadicReader } from '../utils/reader.js';
import { SpeechRecognizer, isSpeechSupported } from '../utils/speech.js';
import { themeManager } from '../themes/themes.js';
import './orp-display.js';
import './saccadic-controls.js';

class SaccadicApp extends LitElement {
  static properties = {
    _wpm:       { type: Number,  state: true },
    _playing:   { type: Boolean, state: true },
    _word:      { type: String,  state: true },
    _index:     { type: Number,  state: true },
    _total:     { type: Number,  state: true },
    _hasText:   { type: Boolean, state: true },
    _theme:     { type: String,  state: true },
    _mode:      { type: String,  state: true },  // 'paste' | 'speak'
    _listening: { type: Boolean, state: true },
    _transcript:{ type: String,  state: true },
  };

  static styles = css`
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
      text-align: center;
    }
    header h1 {
      font-family: var(--sacc-font, monospace);
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
    this._wpm        = 250;
    this._playing    = false;
    this._word       = '';
    this._index      = 0;
    this._total      = 0;
    this._hasText    = false;
    this._theme      = 'dark';
    this._mode       = 'paste';
    this._listening  = false;
    this._transcript = '';

    this._reader = new SaccadicReader();
    this._speech = null;
    this._accumulatedText = '';
    this._setupReaderCallbacks();
  }

  connectedCallback() {
    super.connectedCallback();
    themeManager.init();
    this._theme = themeManager.current;
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
  }

  _setupReaderCallbacks() {
    this._reader
      .onWord((idx, word) => {
        this._word    = word;
        this._index   = idx;
        this._playing = true;
      })
      .onEnd(() => {
        this._playing = false;
      })
      .onProgress((idx, total) => {
        this._index = idx;
        this._total = total;
      });
  }

  _setupSpeechEvents() {
    if (!this._speech) return;

    this._speech.onResult(({ transcript, isFinal }) => {
      this._transcript = transcript;
      if (isFinal) {
        // Append final transcript to accumulated text
        this._accumulatedText += (this._accumulatedText ? ' ' : '') + transcript;
        this._transcript = '';
        this._feedTextToReader(this._accumulatedText);
      }
    });

    this._speech.onError((error) => {
      console.warn('[saccadic] speech error:', error);
      if (this._speech) this._speech.stop();
      this._listening = false;
      // Notify controls to update its listening state
      this._requestControlsUpdate({ _listening: false });
    });

    this._speech.onEnd(() => {
      this._listening = false;
      this._requestControlsUpdate({ _listening: false });
    });
  }

  _requestControlsUpdate(patch) {
    // Find the controls element and update its internal state directly
    const controls = this.shadowRoot.querySelector('saccadic-controls');
    if (controls) {
      Object.assign(controls, patch);
    }
  }

  _feedTextToReader(text) {
    this._reader.loadText(text);
    this._hasText = this._reader.hasText;
    this._total   = this._reader.totalWords;
    this._word    = '';
    this._index   = 0;
    this._playing = false;
  }

  // --- Event handlers (events bubble from children) ---

  _onTextChanged(e) {
    const { text } = e.detail;
    this._accumulatedText = '';
    this._feedTextToReader(text);
  }

  _onWpmChanged(e) {
    const { wpm } = e.detail;
    this._wpm = this._reader.setWpm(wpm);
  }

  _onPlayPause() {
    this._reader.toggle();
    this._playing = this._reader.playing;
    if (!this._reader.playing) {
      // show last word while paused
      this._word = this._reader._words[this._reader._currentIndex] || this._word;
    }
  }

  _onSpeedChange(e) {
    const { delta } = e.detail;
    if (delta > 0) this._wpm = this._reader.speedUp();
    else          this._wpm = this._reader.speedDown();
  }

  _onReset() {
    this._reader.stop();
    this._playing = false;
    this._word    = '';
    this._index   = 0;
    this._hasText = this._reader.hasText;
  }

  _onThemeChange(e) {
    const { theme } = e.detail;
    themeManager.apply(theme);
    this._theme = theme;
  }

  _onModeChange(e) {
    this._mode = e.detail.mode;
    if (this._mode === 'speak') {
      // Stop playback when switching to speak mode
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
      // Reset accumulated text on new session
      this._accumulatedText = '';
      this._transcript = '';
      this._listening = true;
      this._speech.start();
    }
    this._requestControlsUpdate({ _listening: this._listening });
  }

  render() {
    return html`
      <header>
        <h1>Saccadic</h1>
        <p>RSVP Word Runner</p>
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
          @text-changed=${this._onTextChanged}
          @wpm-changed=${this._onWpmChanged}
          @play-pause=${this._onPlayPause}
          @speed-change=${this._onSpeedChange}
          @reset=${this._onReset}
          @theme-change=${this._onThemeChange}
          @mode-change=${this._onModeChange}
          @listen-click=${this._onListenClick}
        ></saccadic-controls>
      </div>

      <footer>
        <a href="https://github.com/samrocksc/saccadic" target="_blank" rel="noopener">saccadic</a>
        &nbsp;·&nbsp; no tracking · no account · yours forever
      </footer>
    `;
  }
}

customElements.define('saccadic-app', SaccadicApp);
