/**
 * SaccadicReader — orchestrates word-by-word RSVP display with timing.
 * Not a web component — a plain JS class that components can observe.
 */

import { tokenize, wpmToMs } from './orp.js';

// WPM range: 150 (8th-grade reading baseline) → 500 (trained speed reader cap).
// Step of 25 gives 14 stops across the range — fine-grained without feeling stiff.
export const DEFAULT_WPM = 150;
export const MIN_WPM = 150;
export const MAX_WPM = 500;
export const WPM_STEP = 25;

export class SaccadicReader {
  constructor() {
    this._words = [];
    this._currentIndex = 0;
    this._wpm = DEFAULT_WPM;
    this._playing = false;
    this._timerId = null;
    this._onWord = null;      // callback(index, word)
    this._onEnd = null;       // callback()
    this._onProgress = null;   // callback(index, total)

    // Keyboard shortcut handler
    this._boundKeyHandler = this._handleKey.bind(this);
  }

  /** Load text into the reader. Resets position. */
  loadText(text) {
    this._words = tokenize(text);
    this._currentIndex = 0;
    this._stop();
    return this;
  }

  /** Start or resume playing. */
  play() {
    if (this._words.length === 0) return;
    if (this._currentIndex >= this._words.length) {
      this._currentIndex = 0; // restart from beginning
    }
    this._playing = true;
    this._scheduleNext();
  }

  /** Pause playback. */
  pause() {
    this._playing = false;
    this._clearTimer();
  }

  /** Toggle play/pause. */
  toggle() {
    if (this._playing) this.pause();
    else this.play();
  }

  /** Stop and reset to beginning. */
  stop() {
    this._stop();
    this._currentIndex = 0;
  }

  _stop() {
    this._playing = false;
    this._clearTimer();
  }

  _clearTimer() {
    if (this._timerId !== null) {
      clearTimeout(this._timerId);
      this._timerId = null;
    }
  }

  _scheduleNext() {
    if (!this._playing) return;
    if (this._currentIndex >= this._words.length) {
      this._playing = false;
      this._onEnd?.();
      return;
    }

    const word = this._words[this._currentIndex];
    this._onWord?.(this._currentIndex, word);
    this._onProgress?.(this._currentIndex, this._words.length);

    const delay = wpmToMs(this._wpm);

    this._timerId = setTimeout(() => {
      this._currentIndex++;
      this._scheduleNext();
    }, delay);
  }

  /** Speed up by WPM_STEP. */
  speedUp() {
    this._wpm = Math.min(this._wpm + WPM_STEP, MAX_WPM);
    return this._wpm;
  }

  /** Speed down by WPM_STEP. */
  speedDown() {
    this._wpm = Math.max(this._wpm - WPM_STEP, MIN_WPM);
    return this._wpm;
  }

  /** Set WPM directly. Clamped to [MIN_WPM, MAX_WPM]. */
  setWpm(wpm) {
    this._wpm = Math.max(MIN_WPM, Math.min(wpm, MAX_WPM));
    return this._wpm;
  }

  // --- Accessors ---
  get wpm() { return this._wpm; }
  get playing() { return this._playing; }
  get currentIndex() { return this._currentIndex; }
  get totalWords() { return this._words.length; }
  get hasText() { return this._words.length > 0; }

  // --- Event registration ---
  onWord(fn) { this._onWord = fn; return this; }
  onEnd(fn) { this._onEnd = fn; return this; }
  onProgress(fn) { this._onProgress = fn; return this; }

  // --- Keyboard shortcuts ---
  /** Attach keyboard shortcut listener to window. */
  attachKeyboard() {
    window.addEventListener('keydown', this._boundKeyHandler);
  }

  /** Remove keyboard shortcut listener. */
  detachKeyboard() {
    window.removeEventListener('keydown', this._boundKeyHandler);
  }

  _handleKey(e) {
    // Don't fire when typing in an input
    if (e.target.tagName === 'TEXTAREA' || e.target.tagName === 'INPUT' || e.target.isContentEditable) return;
    switch (e.key.toLowerCase()) {
      case ' ':
        e.preventDefault();
        this.toggle();
        break;
      case 'z':
        this.speedUp();
        break;
      case 'x':
        this.speedDown();
        break;
    }
  }
}
