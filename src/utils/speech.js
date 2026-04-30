/**
 * SpeechRecognizer — thin wrapper around the Web Speech API (SpeechRecognition).
 * Listens to the microphone and fires events as speech is transcribed.
 *
 * Events:
 *   'result'   — CustomEvent<{ transcript: string, isFinal: boolean }>
 *   'error'    — CustomEvent<{ error: string }>
 *   'end'      — CustomEvent<{}>   (session ended gracefully)
 *
 * Usage:
 *   const sr = new SpeechRecognizer();
 *   sr.on('result', e => console.log(e.detail.transcript));
 *   sr.on('error', e => console.error(e.detail.error));
 *   sr.on('end',   ()  => console.log('done'));
 *   sr.start();
 */

const SpeechRecognitionAPI = window.SpeechRecognition || window.webkitSpeechRecognition;

export const isSpeechSupported = SpeechRecognitionAPI !== undefined;

export class SpeechRecognizer extends EventTarget {
  constructor() {
    super();
    if (!isSpeechSupported) {
      throw new Error('Speech Recognition is not supported in this browser.');
    }
    this._rec = new SpeechRecognitionAPI();
    this._rec.lang = 'en-US';
    this._rec.continuous = true;
    this._rec.interimResults = true;
    this._rec.maxAlternatives = 1;

    this._rec.onresult = (e) => {
      let transcript = '';
      let isFinal = false;
      for (let i = e.resultIndex; i < e.results.length; i++) {
        transcript += e.results[i][0].transcript;
        if (e.results[i].isFinal) isFinal = true;
      }
      this.dispatchEvent(new CustomEvent('result', { detail: { transcript: transcript.trim(), isFinal } }));
    };

    this._rec.onerror = (e) => {
      this.dispatchEvent(new CustomEvent('error', { detail: { error: e.error } }));
    };

    this._rec.onend = () => {
      this.dispatchEvent(new CustomEvent('end', { detail: {} }));
    };
  }

  /** Start listening. Call after user gesture (browser requirement). */
  start() {
    try { this._rec.start(); } catch (_) { /* already started */ }
  }

  /** Stop listening. */
  stop() {
    try { this._rec.stop(); } catch (_) { /* already stopped */ }
  }

  /** Shortcut: attach a plain callback. Returns this for chaining. */
  onResult(fn)  { this.addEventListener('result', e => fn(e.detail));        return this; }
  onError(fn)   { this.addEventListener('error',  e => fn(e.detail.error));    return this; }
  onEnd(fn)     { this.addEventListener('end',    () => fn());                return this; }
}
