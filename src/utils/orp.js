/**
 * ORP (Optimal Recognition Point) calculator for RSVP saccadic reading.
 *
 * The ORP is the letter a reader should fixate on for fastest recognition.
 * It sits slightly LEFT of centre — roughly 1/3 into the word — which is why
 * RSVP readers pin that letter to a fixed point on screen so the eye never
 * has to travel between words.
 *
 * Offsets follow the well-established Spritz-style table, keyed by the number
 * of alphanumeric characters in the word:
 *
 *   length  1      -> 0
 *   length  2 – 5  -> 1
 *   length  6 – 9  -> 2
 *   length 10 – 13 -> 3
 *   length 14+     -> 4
 */

// Indexed by clean-length. Lengths >= ORP_TABLE.length clamp to ORP_MAX.
const ORP_TABLE = [0, 0, 1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3];
const ORP_MAX = 4;

/** Characters that count toward word length (letters and digits, any script). */
const ALNUM = /[\p{L}\p{N}]/u;

/**
 * ORP offset for a given number of significant characters.
 * @param {number} len
 * @returns {number}
 */
export function orpOffsetForLength(len) {
  if (len <= 0) return 0;
  return len < ORP_TABLE.length ? ORP_TABLE[len] : ORP_MAX;
}

/**
 * Calculate the ORP index for a word, as an index into the RAW string.
 *
 * Punctuation is ignored when deciding *which letter* is the focal point, but
 * the returned index still addresses the original string — so callers can
 * highlight `[...word][calculateORP(word)]` and get the letter we meant.
 * Getting this wrong shifts the highlight on any word carrying a leading
 * quote, bracket, or em dash.
 *
 * @param {string} word
 * @returns {number} index into the raw word
 */
export function calculateORP(word) {
  if (!word) return 0;
  const chars = [...word];

  // Positions of the significant characters within the raw string.
  const positions = [];
  for (let i = 0; i < chars.length; i++) {
    if (ALNUM.test(chars[i])) positions.push(i);
  }

  // Pure punctuation (e.g. "—", "...") — just centre it.
  if (positions.length === 0) return Math.floor(chars.length / 2);

  const offset = Math.min(orpOffsetForLength(positions.length), positions.length - 1);
  return positions[offset];
}

/**
 * Get the ORP letter and its raw index.
 * @param {string} word
 * @returns {{ letter: string, index: number }}
 */
export function getORPInfo(word) {
  const index = calculateORP(word);
  return { letter: [...(word || '')][index] || '', index };
}

/**
 * Split raw text into words, preserving punctuation attached to each word.
 * @param {string} text
 * @returns {string[]}
 */
export function tokenize(text) {
  if (!text) return [];
  return text.trim().split(/\s+/).filter(w => w.length > 0);
}

/**
 * Convert WPM to milliseconds per word.
 * @param {number} wpm
 * @returns {number} ms per word
 */
export function wpmToMs(wpm) {
  return Math.round(60000 / wpm);
}

/**
 * Extra dwell time for a word, in milliseconds.
 *
 * Fixed-interval RSVP reads badly at sentence boundaries: the eye gets no cue
 * that a clause ended. A short pause on terminal punctuation, and a smaller
 * one on long words, measurably improves comprehension without lowering the
 * nominal WPM the user selected.
 *
 * @param {string} word
 * @param {number} baseMs
 * @returns {number} additional ms to hold this word
 */
export function dwellBonusMs(word, baseMs) {
  if (!word) return 0;
  let bonus = 0;
  if (/[.!?…]["')\]]?$/.test(word)) bonus += baseMs * 0.9;
  else if (/[,;:—–]["')\]]?$/.test(word)) bonus += baseMs * 0.45;
  const significant = [...word].filter(c => ALNUM.test(c)).length;
  if (significant > 8) bonus += baseMs * 0.3;
  return Math.round(bonus);
}
