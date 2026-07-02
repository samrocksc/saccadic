/**
 * orp-display — LitElement web component for the saccadic word display.
 * Shows one word at a time with ORP (Optimal Recognition Point) indicators:
 *   - Horizontal line above the word
 *   - Horizontal line below the word
 *   - Vertical line pointing to the ORP letter
 *   - The ORP letter highlighted in accent color
 */

import { LitElement, html, css } from 'https://cdn.jsdelivr.net/gh/lit/dist@3/core/lit-core.min.js';
import { calculateORP } from '../utils/orp.js';

class OrpDisplay extends LitElement {
  static properties = {
    word:       { type: String },
    active:     { type: Boolean },  // is reader currently showing this word
    index:      { type: Number },
    total:      { type: Number },
  };

  static styles = css`
    :host {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 0;
      user-select: none;
      -webkit-user-select: none;
    }

    .orp-container {
      position: relative;
      display: flex;
      align-items: center;
      justify-content: center;
      width: 100%;
      min-height: 120px;
    }

    /* Horizontal guide lines */
    .line-top,
    .line-bottom {
      position: absolute;
      left: 0;
      right: 0;
      height: 1px;
      background: var(--sacc-line, #444d56);
    }
    .line-top    { top:    0; }
    .line-bottom { bottom: 0; }

    /* Vertical ORP indicator line */
    .orp-line {
      position: absolute;
      top:    0;
      bottom: 0;
      width: 1px;
      background: var(--sacc-accent, #ff4444);
      transform: translateX(-50%);
      pointer-events: none;
    }

    /* Word wrapper — positioned so the ORP letter is centered */
    .word-wrapper {
      position: relative;
      display: flex;
      align-items: center;
      font-family: 'Space Mono', var(--sacc-font, 'JetBrains Mono', 'Fira Mono', monospace);
      font-size: clamp(2rem, 8vw, 4rem);
      font-weight: 700;
      color: var(--sacc-text, #e6edf3);
      letter-spacing: 0.05em;
      white-space: nowrap;
      text-shadow: var(--sacc-shadow, none);
    }

    /* Each letter wrapped for individual styling */
    .letter {
      position: relative;
      display: inline-block;
      transition: color 80ms ease;
    }

    .letter.orp {
      color: var(--sacc-orp, #ff4444);
    }

    /* ORP top/bottom tick marks */
    .orp-tick-top,
    .orp-tick-bottom {
      position: absolute;
      left: 50%;
      transform: translateX(-50%);
      width: 1px;
      height: 8px;
      background: var(--sacc-accent, #ff4444);
    }
    .orp-tick-top    { top:    -10px; }
    .orp-tick-bottom { bottom: -10px; }

    /* Empty / placeholder state */
    .placeholder {
      font-family: var(--sacc-font, monospace);
      font-size: clamp(0.875rem, 3vw, 1.125rem);
      color: var(--sacc-muted, #7d8590);
      text-align: center;
      padding: 2rem 1rem;
    }

    /* Progress */
    .progress {
      font-family: var(--sacc-font, monospace);
      font-size: 0.875rem;
      color: var(--sacc-muted, #7d8590);
      margin-top: 1rem;
      letter-spacing: 0.1em;
      min-height: 1.5em;
    }

    /* Mobile (≤ 480px): tighter display */
    @media (max-width: 480px) {
      .orp-container {
        min-height: 90px;
      }
      .progress {
        font-size: 0.75rem;
        margin-top: 0.625rem;
      }
    }
  `;

  constructor() {
    super();
    this.word = '';
    this.active = false;
    this.index = 0;
    this.total = 0;
  }

  _renderLetters(word) {
    if (!word) return html``;
    const orpIdx = calculateORP(word);
    return html`${[...word].map((ch, i) => html`
      <span class="letter ${i === orpIdx ? 'orp' : ''}">${ch}</span>
    `)}`;
  }

  _renderOrpTicks(word) {
    if (!word) return html``;
    return html`
      <span class="orp-tick-top" aria-hidden="true"></span>
      <span class="orp-tick-bottom" aria-hidden="true"></span>
    `;
  }

  _renderContent() {
    if (!this.word) {
      return html`<div class="placeholder">Paste or speak some text to begin</div>`;
    }
    return html`
      <div class="orp-container">
        <div class="line-top" aria-hidden="true"></div>
        <div class="line-bottom" aria-hidden="true"></div>
        <div class="word-wrapper">
          ${this._renderOrpTicks(this.word)}
          ${this._renderLetters(this.word)}
        </div>
      </div>
      <div class="progress">
        ${this.total > 0 ? `${this.index + 1} / ${this.total}` : ''}
      </div>
    `;
  }

  render() {
    return this._renderContent();
  }
}

customElements.define('orp-display', OrpDisplay);
