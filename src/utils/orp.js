/**
 * ORP (Optimal Recognition Point) calculator for RSVP saccadic reading.
 *
 * The ORP is the letter in a word where fixation should occur for
 * the fastest visual recognition. Research shows:
 * - Short words (1-4 chars): first letter
 * - Longer words: left-of-center (~1/3 into the word)
 */

/**
 * Calculate the ORP index for a word.
 * @param {string} word - A single word (punctuation stripped internally)
 * @returns {number} - Index of the ORP letter (0-based)
 */
export function calculateORP(word) {
  const clean = word.replace(/[^a-zA-Z]/g, '');
  const len = clean.length;

  if (len <= 1) return 0;
  if (len <= 4) return 0;
  return Math.floor((len - 1) / 2);
}

/**
 * Get the ORP letter itself from a word.
 * @param {string} word
 * @returns {{ letter: string, index: number, orpIndex: number }}
 */
export function getORPInfo(word) {
  const clean = word.replace(/[^a-zA-Z]/g, '');
  const orpIndex = calculateORP(word);
  return {
    letter: clean[orpIndex] || '',
    index: orpIndex,
    orpIndex,
  };
}

/**
 * Split raw text into an array of words.
 * @param {string} text
 * @returns {string[]}
 */
export function tokenize(text) {
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
