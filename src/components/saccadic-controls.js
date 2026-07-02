/**
 * saccadic-controls — LitElement web component for reader controls.
 * Includes: text paste area (Paste mode) or listening button (Speak mode),
 * WPM slider, play/pause, speed buttons, theme toggle, mode toggle.
 */

import { LitElement, html, css } from 'https://cdn.jsdelivr.net/gh/lit/dist@3/core/lit-core.min.js';
import { MIN_WPM, MAX_WPM, DEFAULT_WPM, WPM_STEP } from '../utils/reader.js';
import { isSpeechSupported } from '../utils/speech.js';
import { THEMES } from '../themes/themes.js';

class SaccadicControls extends LitElement {
  static properties = {
    wpm:           { type: Number },
    playing:       { type: Boolean },
    hasText:       { type: Boolean },
    theme:         { type: String },
    orpColor:      { type: String },   // current --sacc-orp color (hex string like "#ff4444")
    orpCustom:     { type: Boolean },  // true if user has set a custom override
    _mode:         { type: String, state: true },  // 'paste' | 'speak'
    _listening:    { type: Boolean, state: true },
    _transcript:   { type: String, state: true },
  };

  static styles = css`
    :host {
      display: flex;
      flex-direction: column;
      gap: 1rem;
      width: 100%;
    }

    /* ── Mode toggle ──────────────────────────── */
    .mode-toggle {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0;
      border: var(--sacc-border-width, 1px) solid var(--sacc-border);
      border-radius: var(--sacc-radius, 8px);
      overflow: hidden;
      width: 100%;
      max-width: 280px;
      margin: 0 auto;
    }
    .mode-toggle button {
      flex: 1;
      font-family: var(--sacc-font, monospace);
      font-size: 0.8125rem;
      font-weight: 600;
      padding: 0.45rem 0.75rem;
      border: none;
      border-radius: 0;
      cursor: pointer;
      background: transparent;
      color: var(--sacc-muted);
      transition: background 120ms ease, color 120ms ease;
    }
    .mode-toggle button.active {
      background: var(--sacc-accent);
      color: #fff;
    }
    .mode-toggle button:hover:not(.active) {
      background: var(--sacc-surface);
      color: var(--sacc-text);
    }
    .mode-toggle button:disabled {
      opacity: 0.35;
      cursor: not-allowed;
    }

    /* ── Text input ─────────────────────────── */
    textarea {
      width: 100%;
      min-height: 120px;
      padding: 0.75rem 1rem;
      font-family: var(--sacc-font, monospace);
      font-size: 0.9375rem;
      line-height: 1.6;
      color: var(--sacc-text);
      background: var(--sacc-surface);
      border: var(--sacc-border-width, 1px) solid var(--sacc-border);
      border-radius: var(--sacc-radius, 8px);
      resize: vertical;
      box-sizing: border-box;
      outline: none;
      transition: border-color 150ms ease;
    }
    textarea:focus {
      border-color: var(--sacc-accent);
    }
    textarea::placeholder {
      color: var(--sacc-muted);
    }

    /* ── Listen button ──────────────────────── */
    .listen-area {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0.75rem;
      padding: 1.5rem;
      border: var(--sacc-border-width, 1px) solid var(--sacc-border);
      border-radius: var(--sacc-radius, 8px);
      background: var(--sacc-surface);
      min-height: 120px;
      justify-content: center;
    }
    .listen-btn {
      font-family: var(--sacc-font, monospace);
      font-size: 1rem;
      font-weight: 700;
      padding: 0.75rem 2.5rem;
      border: var(--sacc-border-width, 2px) solid var(--sacc-accent);
      border-radius: var(--sacc-radius, 999px);
      cursor: pointer;
      background: transparent;
      color: var(--sacc-accent);
      transition: background 150ms ease, color 150ms ease, box-shadow 150ms ease;
      letter-spacing: 0.05em;
    }
    .listen-btn:hover:not(:disabled) {
      background: var(--sacc-accent);
      color: #fff;
      box-shadow: 0 0 18px color-mix(in srgb, var(--sacc-accent) 50%, transparent);
    }
    .listen-btn.listening {
      background: var(--sacc-accent);
      color: #fff;
      animation: pulse 1.4s ease-in-out infinite;
    }
    @keyframes pulse {
      0%, 100% { box-shadow: 0 0 0 0 color-mix(in srgb, var(--sacc-accent) 60%, transparent); }
      50%       { box-shadow: 0 0 0 10px color-mix(in srgb, var(--sacc-accent) 0%, transparent); }
    }
    .listen-btn:disabled {
      opacity: 0.35;
      cursor: not-allowed;
      animation: none;
    }
    .listen-hint {
      font-family: var(--sacc-font, monospace);
      font-size: 0.6875rem;
      color: var(--sacc-muted);
      text-align: center;
    }
    .transcript-preview {
      font-family: var(--sacc-font, monospace);
      font-size: 0.8125rem;
      color: var(--sacc-muted);
      text-align: center;
      min-height: 1.2em;
      max-height: 3.6em;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: pre-wrap;
      word-break: break-word;
      width: 100%;
    }

    /* ── Slider row ──────────────────────────── */
    .slider-row {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      flex-wrap: wrap;
    }

    label {
      font-family: var(--sacc-font, monospace);
      font-size: 0.8125rem;
      color: var(--sacc-muted);
      white-space: nowrap;
    }

    input[type="range"] {
      flex: 1;
      min-width: 140px;
      accent-color: var(--sacc-accent);
      cursor: pointer;
      height: 20px;
    }

    .wpm-value {
      font-family: var(--sacc-font, monospace);
      font-size: 0.875rem;
      font-weight: 700;
      color: var(--sacc-accent);
      min-width: 3.5ch;
      text-align: right;
    }

    /* ── Buttons ─────────────────────────────── */
    .btn-row {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      flex-wrap: wrap;
      justify-content: center;
    }

    button {
      font-family: var(--sacc-font, monospace);
      font-size: 0.875rem;
      font-weight: 600;
      padding: 0.5rem 1.25rem;
      border: var(--sacc-border-width, 1px) solid var(--sacc-border);
      border-radius: var(--sacc-radius, 6px);
      cursor: pointer;
      transition: background 120ms ease, border-color 120ms ease, opacity 120ms ease, color 120ms ease;
      line-height: 1.4;
    }

    button:disabled {
      opacity: 0.35;
      cursor: not-allowed;
    }

    /* Primary — play/pause */
    .btn-primary {
      background: var(--sacc-accent);
      border-color: var(--sacc-accent);
      color: #fff;
      min-width: 120px;
    }
    .btn-primary:hover:not(:disabled) {
      filter: brightness(1.15);
    }
    .btn-primary:active:not(:disabled) {
      filter: brightness(0.9);
    }

    /* Secondary — speed controls */
    .btn-secondary {
      background: var(--sacc-surface);
      color: var(--sacc-text);
    }
    .btn-secondary:hover:not(:disabled) {
      border-color: var(--sacc-accent);
      color: var(--sacc-accent);
    }

    /* Ghost — reset */
    .btn-ghost {
      background: transparent;
      color: var(--sacc-muted);
      border-color: transparent;
    }
    .btn-ghost:hover:not(:disabled) {
      color: var(--sacc-text);
      border-color: var(--sacc-border);
    }

    /* Theme selector */
    .theme-row {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      justify-content: flex-end;
      flex-wrap: wrap;
    }

    /* Highlight color picker */
    .orp-color-row {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      justify-content: flex-end;
      flex-wrap: wrap;
    }
    .orp-color-row label {
      font-size: 0.6875rem;
      letter-spacing: 0.05em;
      text-transform: uppercase;
    }
    .orp-color-input {
      /* Native color input — minimal styling */
      width: 44px;
      height: 44px;
      border: 1px solid var(--sacc-border);
      border-radius: 4px;
      padding: 0;
      background: transparent;
      cursor: pointer;
      overflow: hidden;
    }
    .orp-color-input::-webkit-color-swatch-wrapper { padding: 2px; }
    .orp-color-input::-webkit-color-swatch { border: none; border-radius: 2px; }
    .orp-color-input::-moz-color-swatch { border: none; border-radius: 2px; }
    .orp-color-reset {
      min-height: 44px;
      padding: 0.4rem 0.75rem;
      font-size: 0.6875rem;
      border-radius: 4px;
      background: transparent;
      color: var(--sacc-muted);
      border: 1px solid var(--sacc-border);
    }
    .orp-color-reset:hover:not(:disabled) {
      color: var(--sacc-text);
      border-color: var(--sacc-muted);
    }

    .theme-btn {
      padding: 0.25rem 0.5rem;
      font-size: 0.6875rem;
      border-radius: var(--sacc-radius, 4px);
      background: transparent;
      color: var(--sacc-muted);
      border: var(--sacc-border-width, 1px) solid var(--sacc-border);
      white-space: nowrap;
    }
    .theme-btn.active {
      color: var(--sacc-accent);
      border-color: var(--sacc-accent);
      background: color-mix(in srgb, var(--sacc-accent) 10%, transparent);
    }
    .theme-btn:hover {
      border-color: var(--sacc-muted);
    }

    /* ── Keyboard hint ─────────────────────── */
    .hint {
      font-family: var(--sacc-font, monospace);
      font-size: 0.6875rem;
      color: var(--sacc-muted);
      text-align: center;
      letter-spacing: 0.05em;
    }
    .hint kbd {
      display: inline-block;
      padding: 1px 5px;
      border: 1px solid var(--sacc-border);
      border-radius: 3px;
      background: var(--sacc-surface);
      font-size: 0.6875rem;
    }

    /* ── Mobile (≤ 480px) ─────────────────── */
    @media (max-width: 480px) {
      :host {
        gap: 0.875rem;
      }

      /* Mode toggle full width on mobile */
      .mode-toggle {
        max-width: 100%;
      }

      /* WPM slider: tighten gaps */
      .slider-row {
        gap: 0.5rem;
      }
      input[type="range"] {
        min-width: 0;
      }

      /* Button row: 2×2 grid on small screens */
      .btn-row {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 0.5rem;
      }
      .btn-primary {
        grid-column: 1 / -1;
        min-width: unset;
      }
      .btn-secondary,
      .btn-ghost {
        font-size: 0.8125rem;
        padding: 0.5rem 0.75rem;
      }

      /* Listen area: tighter padding */
      .listen-area {
        padding: 1rem;
        min-height: 100px;
      }
      .listen-btn {
        padding: 0.65rem 2rem;
        font-size: 0.9375rem;
      }

      /* Theme row: smaller text */
      .theme-row {
        justify-content: center;
      }
      .theme-btn {
        font-size: 0.6875rem;
        padding: 0.25rem 0.5rem;
      }

      /* Color picker row: center on mobile like the theme row */
      .orp-color-row {
        justify-content: center;
      }

      /* Keyboard hints hidden on mobile (space bar doesn't apply) */
      .hint {
        display: none;
      }
    }
  `;

  constructor() {
    super();
    this.wpm        = DEFAULT_WPM;
    this.playing    = false;
    this.hasText    = false;
    this.theme      = 'dark';
    this.orpColor   = '#ff4444';
    this.orpCustom  = false;
    this._mode      = 'paste';
    this._listening = false;
    this._transcript = '';
  }

  _dispatch(name, detail = {}) {
    this.dispatchEvent(new CustomEvent(name, { bubbles: true, composed: true, detail }));
  }

  _onTextInput(e) {
    this._dispatch('text-changed', { text: e.target.value });
  }

  _onSlider(e) {
    const wpm = parseInt(e.target.value, 10);
    this._dispatch('wpm-changed', { wpm });
  }

  _onPlayPause() {
    this._dispatch('play-pause');
  }

  _onSpeedUp() {
    this._dispatch('speed-change', { delta: WPM_STEP });
  }

  _onSpeedDown() {
    this._dispatch('speed-change', { delta: -WPM_STEP });
  }

  _onReset() {
    this._dispatch('reset');
  }

  _onTheme(id) {
    this._dispatch('theme-change', { theme: id });
  }

  _onModeChange(mode) {
    if (mode === this._mode) return;
    this._mode = mode;
    this._dispatch('mode-change', { mode });
  }

  _onOrpColorChange(e) {
    this._dispatch('orp-color-change', { color: e.target.value });
  }

  _onOrpColorReset() {
    this._dispatch('orp-color-reset');
  }

  _onListenClick() {
    this._dispatch('listen-click');
  }

  _setListening(v) {
    this._listening = v;
  }

  _setTranscript(v) {
    this._transcript = v;
  }

  render() {
    return html`
      <!-- Mode toggle -->
      <div class="mode-toggle">
        <button
          class="${this._mode === 'paste' ? 'active' : ''}"
          @click=${() => this._onModeChange('paste')}
          ?disabled=${this.playing}
          aria-pressed=${this._mode === 'paste'}
        >Paste</button>
        <button
          class="${this._mode === 'speak' ? 'active' : ''}"
          @click=${() => this._onModeChange('speak')}
          ?disabled=${!isSpeechSupported || this.playing}
          title=${isSpeechSupported ? 'Speak mode' : 'Speech not supported in this browser'}
          aria-pressed=${this._mode === 'speak'}
        >Speak</button>
      </div>

      <!-- Paste mode: textarea -->
      ${this._mode === 'paste' ? html`
        <textarea
          placeholder="Paste your text here..."
          @input=${this._onTextInput}
          ?disabled=${this.playing}
          aria-label="Text to read"
        ></textarea>
      ` : ''}

      <!-- Speak mode: listen button -->
      ${this._mode === 'speak' ? html`
        <div class="listen-area">
          <button
            class="listen-btn ${this._listening ? 'listening' : ''}"
            @click=${this._onListenClick}
            aria-label=${this._listening ? 'Stop listening' : 'Start listening'}
          >
            ${this._listening ? '■ Stop' : '🎤  Start Listening'}
          </button>
          <div class="transcript-preview">${this._transcript}</div>
          <div class="listen-hint">
            ${this._listening
              ? 'Listening... speak or read aloud'
              : isSpeechSupported
                ? 'Click to start · speak or read text aloud'
                : 'Speech recognition not supported in this browser'}
          </div>
        </div>
      ` : ''}

      <!-- WPM slider — step=5 keeps drag-precision while never snapping away from z/x keyboard values (which step by WPM_STEP=25). -->
      <div class="slider-row">
        <label for="wpm-slider">WPM</label>
        <input
          id="wpm-slider"
          type="range"
          min=${MIN_WPM}
          max=${MAX_WPM}
          step="5"
          .value=${String(this.wpm)}
          @input=${this._onSlider}
          aria-label="Words per minute"
        />
        <span class="wpm-value">${this.wpm}</span>
      </div>

      <!-- Control buttons -->
      <div class="btn-row">
        <!-- Play / Pause -->
        <button
          class="btn-primary"
          @click=${this._onPlayPause}
          ?disabled=${!this.hasText}
          aria-label=${this.playing ? 'Pause' : 'Play'}
        >
          ${this.playing ? '⏸ Pause' : '▶ Play'}
        </button>

        <!-- Speed down -->
        <button
          class="btn-secondary"
          @click=${this._onSpeedDown}
          ?disabled=${!this.hasText || this.wpm <= MIN_WPM}
          aria-label="Slow down"
          title="Slow down (X)"
        >− Slower</button>

        <!-- Speed up -->
        <button
          class="btn-secondary"
          @click=${this._onSpeedUp}
          ?disabled=${!this.hasText || this.wpm >= MAX_WPM}
          aria-label="Speed up"
          title="Speed up (Z)"
        >+ Faster</button>

        <!-- Reset -->
        <button
          class="btn-ghost"
          @click=${this._onReset}
          ?disabled=${!this.hasText}
          aria-label="Reset to beginning"
        >↺ Reset</button>
      </div>

      <!-- Theme toggle -->
      <div class="theme-row">
        ${Object.values(THEMES).map(t => html`
          <button
            class="theme-btn ${this.theme === t.id ? 'active' : ''}"
            @click=${() => this._onTheme(t.id)}
            aria-label="Theme: ${t.name}"
            title=${t.name}
          >${t.name}</button>
        `)}
      </div>

      <!-- ORP highlight color picker -->
      <div class="orp-color-row">
        <label for="orp-color">Highlight</label>
        <input
          id="orp-color"
          class="orp-color-input"
          type="color"
          .value=${this.orpColor}
          @input=${this._onOrpColorChange}
          aria-label="ORP highlight color"
          title="Pick a custom highlight color for the focal letter"
        />
        <button
          class="orp-color-reset"
          @click=${this._onOrpColorReset}
          ?disabled=${!this.orpCustom}
          aria-label="Reset highlight color to theme default"
          title="Reset to theme default"
        >Reset</button>
      </div>

      <!-- Keyboard hints -->
      <div class="hint">
        <kbd>Space</kbd> play/pause &nbsp;·&nbsp;
        <kbd>Z</kbd> faster &nbsp;·&nbsp;
        <kbd>X</kbd> slower
      </div>
    `;
  }
}

customElements.define('saccadic-controls', SaccadicControls);
