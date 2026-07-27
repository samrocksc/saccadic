/**
 * SaccadicReader — orchestrates word-by-word RSVP display with timing.
 * Not a web component — a plain JS class that components can observe.
 */

import { tokenize, wpmToMs, dwellBonusMs } from './orp.js';

// WPM range: 150 (8th-grade reading baseline) → 500 (trained speed reader cap).
// Step of 25 gives 14 stops across the range — fine-grained without feeling stiff.
export const DEFAULT_WPM = 150;
export const MIN_WPM = 150;
export const MAX_WPM = 500;
export const WPM_STEP = 25;

// User-global WPM preference (issue #7). Same naming family as
// 'saccadic-theme' / 'saccadic-orp-color' / 'saccadic-books'.
const WPM_KEY = 'saccadic-wpm';

/** Restore saved WPM, clamped to [MIN_WPM, MAX_WPM]. DEFAULT_WPM if absent or invalid. */
export function loadSavedWpm() {
  try {
    const raw = localStorage.getItem(WPM_KEY);
    if (raw === null) return DEFAULT_WPM;
    const n = Number(raw);
    if (!Number.isFinite(n)) return DEFAULT_WPM;
    return Math.max(MIN_WPM, Math.min(n, MAX_WPM));
  } catch {
    return DEFAULT_WPM; // storage blocked (private mode etc.) — non-fatal
  }
}

function saveWpm(wpm) {
  try {
    localStorage.setItem(WPM_KEY, String(wpm));
  } catch {
    /* storage unavailable — reading still works, preference just won't stick */
  }
}

export class SaccadicReader {
  constructor() {
    this._words = [];
    this._currentIndex = 0;
    this._wpm = loadSavedWpm(); // user's preferred speed survives sessions (issue #7)
    this._playing = false;
    this._timerId = null;
    this._wordStartedAt = 0;
    this._currentDelay = 0;

    this._onWord = null;       // callback(index, word)
    this._onEnd = null;        // callback()
    this._onProgress = null;   // callback(index, total)
    this._onWpm = null;        // callback(wpm)
    this._onPlayState = null;  // callback(playing)

    this._boundKeyHandler = this._handleKey.bind(this);
  }

  /** Load text into the reader. Resets position. */
  loadText(text) {
    this._words = tokenize(text);
    this._currentIndex = 0;
    this._stop();
    return this;
  }

  /**
   * Append newly transcribed text without disturbing playback position.
   * Live transcription streams in continuously; reloading would yank the
   * reader back to word zero on every final result.
   * @returns {number} new total word count
   */
  appendText(text) {
    const extra = tokenize(text);
    if (extra.length === 0) return this._words.length;
    const wasIdle = this._words.length === 0;
    this._words = this._words.concat(extra);
    // If playback had run past the end, resume from where it stopped.
    if (!this._playing && !wasIdle && this._currentIndex >= this._words.length - extra.length) {
      // leave index where it is; new words are now available ahead of it
    }
    this._onProgress?.(this._currentIndex, this._words.length);
    return this._words.length;
  }

  /** Jump to a word index, clamped into range. */
  seek(index) {
    if (this._words.length === 0) return 0;
    this._currentIndex = Math.max(0, Math.min(index, this._words.length - 1));
    return this._currentIndex;
  }

  /** Start or resume playing. */
  play() {
    if (this._words.length === 0) return;
    if (this._currentIndex >= this._words.length) {
      this._currentIndex = 0; // restart from beginning
    }
    if (this._playing) return;
    this._playing = true;
    this._emitPlayState();
    this._tick();
  }

  /** Pause playback. */
  pause() {
    if (!this._playing) return;
    this._playing = false;
    this._clearTimer();
    this._emitPlayState();
  }

  /** Toggle play/pause. */
  toggle() {
    if (this._playing) this.pause();
    else this.play();
  }

  /** Stop and reset to beginning. */
  stop() {
    const was = this._playing;
    this._stop();
    this._currentIndex = 0;
    if (was) this._emitPlayState();
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

  /** Show the current word and arm the timer for the next one. */
  _tick() {
    if (!this._playing) return;
    if (this._currentIndex >= this._words.length) {
      this._playing = false;
      this._emitPlayState();
      this._onEnd?.();
      return;
    }

    const word = this._words[this._currentIndex];
    this._onWord?.(this._currentIndex, word);
    this._onProgress?.(this._currentIndex, this._words.length);

    const base = wpmToMs(this._wpm);
    this._currentDelay = base + dwellBonusMs(word, base);
    this._wordStartedAt = Date.now();
    this._arm(this._currentDelay);
  }

  _arm(delay) {
    this._clearTimer();
    this._timerId = setTimeout(() => {
      this._currentIndex++;
      this._tick();
    }, Math.max(0, delay));
  }

  /**
   * Re-time the in-flight word after a speed change. Without this, a speed
   * change made mid-word does not take effect until the next word boundary,
   * which at 150 WPM is a visibly laggy 400ms.
   */
  _retimeCurrentWord() {
    if (!this._playing || this._timerId === null) return;
    const word = this._words[this._currentIndex];
    if (word === undefined) return;
    const base = wpmToMs(this._wpm);
    const newDelay = base + dwellBonusMs(word, base);
    const elapsed = Date.now() - this._wordStartedAt;
    this._currentDelay = newDelay;
    this._arm(newDelay - elapsed);
  }

  _applyWpm(next) {
    const clamped = Math.max(MIN_WPM, Math.min(next, MAX_WPM));
    if (clamped === this._wpm) return this._wpm;
    this._wpm = clamped;
    saveWpm(clamped);
    this._emitWpm();
    this._retimeCurrentWord();
    return this._wpm;
  }

  /** Speed up by WPM_STEP. */
  speedUp() {
    return this._applyWpm(this._wpm + WPM_STEP);
  }

  /** Speed down by WPM_STEP. */
  speedDown() {
    return this._applyWpm(this._wpm - WPM_STEP);
  }

  /** Set WPM directly. Clamped to [MIN_WPM, MAX_WPM]. */
  setWpm(wpm) {
    return this._applyWpm(wpm);
  }

  _emitWpm()       { this._onWpm?.(this._wpm); }
  _emitPlayState() { this._onPlayState?.(this._playing); }

  // --- Accessors ---
  get wpm() { return this._wpm; }
  get playing() { return this._playing; }
  get currentIndex() { return this._currentIndex; }
  get totalWords() { return this._words.length; }
  get hasText() { return this._words.length > 0; }
  get words() { return this._words; }
  get currentWord() { return this._words[this._currentIndex] ?? ''; }

  // --- Event registration ---
  onWord(fn)      { this._onWord = fn; return this; }
  onEnd(fn)       { this._onEnd = fn; return this; }
  onProgress(fn)  { this._onProgress = fn; return this; }
  onWpmChange(fn) { this._onWpm = fn; return this; }
  onPlayState(fn) { this._onPlayState = fn; return this; }

  // --- Keyboard shortcuts ---
  /** Attach keyboard shortcut listener to window. */
  attachKeyboard() {
    window.addEventListener('keydown', this._boundKeyHandler);
  }

  /** Remove keyboard shortcut listener. */
  detachKeyboard() {
    window.removeEventListener('keydown', this._boundKeyHandler);
  }

  /**
   * True when the keystroke belongs to a text field.
   *
   * The listener sits on `window`, but the inputs live inside nested shadow
   * roots, so `event.target` is retargeted to the outermost host element
   * (`<saccadic-app>`) and never reports the real field. composedPath() pierces
   * the shadow boundary and gives us the actual originating node. Without this,
   * typing "x" in the paste box changes the speed and pressing space is
   * swallowed by preventDefault.
   */
  _isEditable(e) {
    const node = (e.composedPath && e.composedPath()[0]) || e.target;
    if (!node || node.nodeType !== 1) return false;
    const tag = node.tagName;
    return tag === 'TEXTAREA' || tag === 'INPUT' || tag === 'SELECT' || node.isContentEditable === true;
  }

  _handleKey(e) {
    if (this._isEditable(e)) return;
    // Leave browser/OS chords alone — ctrl+z must stay undo, not speed-up.
    if (e.ctrlKey || e.metaKey || e.altKey) return;

    switch (e.key) {
      case ' ':
      case 'Spacebar': // legacy key name
        e.preventDefault();
        this.toggle();
        break;
      case 'z':
      case 'Z':
        e.preventDefault();
        this.speedUp();
        break;
      case 'x':
      case 'X':
        e.preventDefault();
        this.speedDown();
        break;
    }
  }
}
