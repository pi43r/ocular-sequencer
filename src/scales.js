// ─── Musical Scales ─────────────────────────────────────────────────────────

export const SCALES = {
  Chromatic: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
  Major: [0, 2, 4, 5, 7, 9, 11],
  Minor: [0, 2, 3, 5, 7, 8, 10],
  "Harmonic Minor": [0, 2, 3, 5, 7, 8, 11],
  "Melodic Minor": [0, 2, 3, 5, 7, 9, 11],
  "Pentatonic Major": [0, 2, 4, 7, 9],
  "Pentatonic Minor": [0, 3, 5, 7, 10],
  Blues: [0, 3, 5, 6, 7, 10],
  Dorian: [0, 2, 3, 5, 7, 9, 10],
  Phrygian: [0, 1, 3, 5, 7, 8, 10],
  Lydian: [0, 2, 4, 6, 7, 9, 11],
  Mixolydian: [0, 2, 4, 5, 7, 9, 10],
  Locrian: [0, 1, 3, 5, 6, 8, 10],
  "Whole Tone": [0, 2, 4, 6, 8, 10],
  Diminished: [0, 2, 3, 5, 6, 8, 9, 11],
};

export const NOTE_NAMES = [
  "C",
  "C#",
  "D",
  "D#",
  "E",
  "F",
  "F#",
  "G",
  "G#",
  "A",
  "A#",
  "B",
];

/**
 * Convert a MIDI note number (0–127) to a human-readable name like "C4".
 * MIDI 60 = C4 (middle C).
 */
export function midiToNoteName(midi) {
  const clamped = Math.max(0, Math.min(127, Math.round(midi)));
  const octave = Math.floor(clamped / 12) - 1;
  const name = NOTE_NAMES[clamped % 12];
  return `${name}${octave}`;
}

/**
 * Extend a base scale (intervals within one octave) to at most `count` entries
 * by repeating across higher octaves, stopping at MIDI note 127.
 *
 * @param {number[]} base     — semitone intervals from root (e.g. [0,3,5,7,10])
 * @param {number}   count    — desired number of intervals
 * @param {number}   rootMidi — MIDI number of the root note (used as range ceiling)
 * @returns {number[]}
 */
export function extendIntervals(base, count, rootMidi) {
  const MAX_MIDI = 127;
  const maxSemitones = MAX_MIDI - rootMidi;
  const result = [];
  let octave = 0;

  while (result.length < count) {
    let added = false;
    for (const interval of base) {
      if (result.length >= count) break;
      if (octave > 0 && interval === 0) continue; // skip duplicate root
      const full = interval + octave * 12;
      if (full > maxSemitones) break;
      result.push(full);
      added = true;
    }
    if (!added) break; // can't extend further without exceeding MIDI range
    octave++;
  }

  return result;
}
