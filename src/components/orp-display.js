/**
 * orp-display — LitElement web component for the saccadic word display.
 *
 * Shows one word at a time with:
 *   - a horizontal guide line above the word
 *   - a horizontal guide line below the word
 *   - a vertical indicator pointing at the focal (ORP) letter
 *   - the focal letter highlighted in the accent colour
 *
 * The important detail: the word is SHIFTED so the focal letter always lands
 * on the same x position. That fixed point is the whole purpose of RSVP — the
 * eye parks there and never saccades between words. Centring the word instead
 * (the obvious-looking approach) makes the focal letter wander with every word
 * length and defeats the technique.
 */

import { LitElement, html, css } from 'https://cdn.jsdelivr.net/gh/lit/dist@3/core/lit-core.min.js';
import { calculateORP } from '../utils/orp.js';

class OrpDisplay extends LitElement {
  static properties = {
    word:    { type: String },
    active:  { type: Boolean },
    index:   { type: Number },
    total:   { type: Number },
  };

  static styles = css`
    :host {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 0;
      width: 100%;
      user-select: none;
      -webkit-user-select: none;

      /* Letter advance = 1ch + tracking. Used to place the focal letter. */
      --sacc-tracking: 0.05em;
    }

    .orp-container {
      position: relative;
      width: 100%;
      min-height: 132px;
      /* Long words extend past the focal point; clip rather than let them
         force horizontal scrolling on narrow screens. */
      overflow: hidden;
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

    /* Vertical indicator — points at the focal letter from above and below.
       Anchored to the container's centre, which is exactly where the focal
       letter is pinned. */
    .focal-tick {
      position: absolute;
      left: 50%;
      width: 2px;
      height: 14px;
      margin-left: -1px;
      background: var(--sacc-orp, #ff4444);
      pointer-events: none;
    }
    .focal-tick.top    { top:    0; }
    .focal-tick.bottom { bottom: 0; }

    /* The word itself, translated so the focal letter sits at left: 50%. */
    .word-wrapper {
      position: absolute;
      top: 50%;
      left: 50%;
      display: flex;
      align-items: center;
      font-family: var(--sacc-font, 'IBM Plex Mono', 'Space Mono', monospace);
      font-size: clamp(1.75rem, 7.5vw, 3.5rem);
      font-weight: 700;
      line-height: 1;
      color: var(--sacc-text, #e6edf3);
      letter-spacing: var(--sacc-tracking);
      white-space: pre;
      text-shadow: var(--sacc-shadow-text, none);
    }

    .letter {
      display: inline-block;
      transition: color 80ms ease;
    }

    .letter.orp {
      color: var(--sacc-orp, #ff4444);
    }

    .placeholder {
      position: absolute;
      inset: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      font-family: var(--sacc-font, monospace);
      font-size: clamp(0.875rem, 3vw, 1.125rem);
      color: var(--sacc-muted, #7d8590);
      text-align: center;
      padding: 0 1rem;
    }

    .progress {
      font-family: var(--sacc-font, monospace);
      font-size: 0.875rem;
      color: var(--sacc-muted, #7d8590);
      margin-top: 1rem;
      letter-spacing: 0.1em;
      min-height: 1.5em;
      font-variant-numeric: tabular-nums;
    }

    /* Screen-reader-only announcements. */
    .sr-only {
      position: absolute;
      width: 1px;
      height: 1px;
      padding: 0;
      margin: -1px;
      overflow: hidden;
      clip: rect(0 0 0 0);
      clip-path: inset(50%);
      white-space: nowrap;
      border: 0;
    }

    @media (max-width: 480px) {
      .orp-container { min-height: 104px; }
      .focal-tick    { height: 10px; }
      .progress {
        font-size: 0.75rem;
        margin-top: 0.625rem;
      }
    }

    /* Respect users who ask for less motion. */
    @media (prefers-reduced-motion: reduce) {
      .letter { transition: none; }
    }
  `;

  constructor() {
    super();
    this.word   = '';
    this.active = false;
    this.index  = 0;
    this.total  = 0;
  }

  /**
   * Offset that puts the centre of the focal letter at x = 0 (i.e. at the
   * container's 50% line). Each glyph advances 1ch plus the tracking, and we
   * add half a glyph to reach the letter's centre rather than its left edge.
   */
  _focalTransform(orpIndex) {
    return `translate(calc(-1 * (${orpIndex} * (1ch + var(--sacc-tracking)) + 0.5ch)), -50%)`;
  }

  _renderWord() {
    const chars = [...this.word];
    const orpIdx = calculateORP(this.word);
    return html`
      <div class="word-wrapper" style=${`transform: ${this._focalTransform(orpIdx)}`} aria-hidden="true">
        ${chars.map((ch, i) => html`<span class="letter ${i === orpIdx ? 'orp' : ''}">${ch}</span>`)}
      </div>
    `;
  }

  render() {
    const hasWord = !!this.word;
    return html`
      <div
        class="orp-container"
        role="img"
        aria-label=${hasWord ? `Current word: ${this.word}` : 'Word display, empty'}
      >
        <div class="line-top" aria-hidden="true"></div>
        <div class="line-bottom" aria-hidden="true"></div>
        ${hasWord ? html`
          <div class="focal-tick top" aria-hidden="true"></div>
          <div class="focal-tick bottom" aria-hidden="true"></div>
          ${this._renderWord()}
        ` : html`<div class="placeholder">Paste or speak some text to begin</div>`}
      </div>

      <div class="progress" aria-hidden="true">
        ${this.total > 0 ? `${Math.min(this.index + 1, this.total)} / ${this.total}` : ''}
      </div>

      <!-- Words flash far too fast to announce individually; a screen reader
           would be flooded. Progress is announced only while paused. -->
      <div class="sr-only" aria-live="polite">
        ${!this.active && hasWord && this.total > 0
          ? `Paused on word ${this.index + 1} of ${this.total}: ${this.word}`
          : ''}
      </div>
    `;
  }
}

customElements.define('orp-display', OrpDisplay);
