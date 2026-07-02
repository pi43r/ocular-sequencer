// ─── Application State ──────────────────────────────────────────────────────
// Single source of truth for all UI-driven parameters.

export const state = {
  // Detection
  threshold: 200,
  mode: 'bright', // 'bright' | 'dark'

  // Trigger behavior
  holdNotes: false, // false = gate (play while over blob), true = hold (sustain until next trigger)

  // Scale
  scale: 'Pentatonic Minor',
  rootNote: 0,  // semitone within octave: 0=C, 1=C#, ..., 11=B
  rootOctave: 3, // C3 = MIDI 48 by default
  voices: 8,     // number of sample points / rings

  // Image filters
  imgBrightness: 100,
  imgSaturation: 0,
  imgContrast: 300,

  // Motion
  speedBpm: 120,
};

// ─── Derived values ─────────────────────────────────────────────────────────

import { SCALES } from './scales.js';

/** Get the MIDI note number for the configured root. */
export function getRootMidi() {
  return (state.rootOctave + 1) * 12 + state.rootNote;
}

/** Get the scale intervals for the currently selected scale. */
export function getScaleIntervals() {
  return SCALES[state.scale] || SCALES['Pentatonic Minor'];
}

/**
 * Map a normalized ring position (0..1) to a MIDI note,
 * using the current root, scale, and voice count.
 */
export function getNoteForRing(normalizedR) {
  const intervals = getScaleIntervals();
  const root = getRootMidi();
  const maxVoices = Math.min(state.voices, intervals.length);
  const index = Math.min(
    Math.floor(normalizedR * maxVoices),
    intervals.length - 1,
  );
  return root + intervals[index];
}
