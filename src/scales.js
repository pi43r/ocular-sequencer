// ─── Musical Scales ─────────────────────────────────────────────────────────
// Each scale is an array of semitone intervals from the root.
// The intervals extend across multiple octaves so the "voices" slider
// can pick anywhere from 1–16 notes up the scale.

export const SCALES = {
  'Chromatic':        [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16],
  'Major':            [0, 2, 4, 5, 7, 9, 11, 12, 14, 16, 17, 19, 21, 23, 24, 26],
  'Minor':            [0, 2, 3, 5, 7, 8, 10, 12, 14, 15, 17, 19, 20, 22, 24, 26],
  'Harmonic Minor':   [0, 2, 3, 5, 7, 8, 11, 12, 14, 15, 17, 19, 20, 23, 24, 26],
  'Melodic Minor':    [0, 2, 3, 5, 7, 9, 11, 12, 14, 15, 17, 19, 21, 23, 24, 26],
  'Pentatonic Major': [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24, 26, 28, 31, 33, 36],
  'Pentatonic Minor': [0, 3, 5, 7, 10, 12, 15, 17, 19, 22, 24, 27, 29, 31, 34, 36],
  'Blues':            [0, 3, 5, 6, 7, 10, 12, 15, 17, 18, 19, 22, 24, 27, 29, 30],
  'Dorian':           [0, 2, 3, 5, 7, 9, 10, 12, 14, 15, 17, 19, 21, 22, 24, 26],
  'Phrygian':         [0, 1, 3, 5, 7, 8, 10, 12, 13, 15, 17, 19, 20, 22, 24, 25],
  'Lydian':           [0, 2, 4, 6, 7, 9, 11, 12, 14, 16, 18, 19, 21, 23, 24, 26],
  'Mixolydian':       [0, 2, 4, 5, 7, 9, 10, 12, 14, 16, 17, 19, 21, 22, 24, 26],
  'Locrian':          [0, 1, 3, 5, 6, 8, 10, 12, 13, 15, 17, 18, 20, 22, 24, 25],
  'Whole Tone':       [0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22, 24, 26, 28, 30],
  'Diminished':       [0, 2, 3, 5, 6, 8, 9, 11, 12, 14, 15, 17, 18, 20, 21, 23],
};

/** Note names for display and root selection. */
export const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

/**
 * Convert a MIDI note number (0–127) to a human-readable name like "C3".
 * MIDI 60 = C4 (middle C).
 */
export function midiToNoteName(midi) {
  const octave = Math.floor(midi / 12) - 1; // 60 → C4
  const name = NOTE_NAMES[midi % 12];
  return `${name}${octave}`;
}
