/**
 * saccadic-controls — LitElement web component for reader controls.
 * Includes: text paste area, WPM slider, play/pause, speed buttons, theme toggle.
 */

import { LitElement, html, css } from 'https://cdn.jsdelivr.net/gh/lit/dist@3/core/lit-core.min.js';
import { MIN_WPM, MAX_WPM, DEFAULT_WPM, WPM_STEP } from '../utils/reader.js';
import { THEMES } from '../themes/themes.js';

class SaccadicControls extends LitElement {
  static properties = {
    wpm:        { type: Number },
    playing:    { type: Boolean },
    hasText:    { type: Boolean },
    theme:      { type: String },
  };

  static styles = css`
    :host {
      display: flex;
      flex-direction: column;
      gap: 1rem;
      width: 100%;
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
      border: 1px solid var(--sacc-border);
      border-radius: 8px;
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
      border: 1px solid var(--sacc-border);
      border-radius: 6px;
      cursor: pointer;
      transition: background 120ms ease, border-color 120ms ease, opacity 120ms ease;
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
    }

    .theme-btn {
      padding: 0.3rem 0.6rem;
      font-size: 0.75rem;
      border-radius: 4px;
      background: transparent;
      color: var(--sacc-muted);
      border: 1px solid var(--sacc-border);
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
  `;

  constructor() {
    super();
    this.wpm = DEFAULT_WPM;
    this.playing = false;
    this.hasText = false;
    this.theme = 'dark';
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

  render() {
    return html`
      <!-- Text input -->
      <textarea
        placeholder="Paste your text here..."
        @input=${this._onTextInput}
        ?disabled=${this.playing}
        aria-label="Text to read"
      ></textarea>

      <!-- WPM slider -->
      <div class="slider-row">
        <label for="wpm-slider">WPM</label>
        <input
          id="wpm-slider"
          type="range"
          min=${MIN_WPM}
          max=${MAX_WPM}
          step="10"
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
