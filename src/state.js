// ─── Application State ──────────────────────────────────────────────────────

import { SCALES, extendIntervals } from "./scales.js";

export const DEFAULTS = {
  threshold: 200,
  mode: "bright",
  holdNotes: false,
  scale: "Chromatic",
  rootNote: 0,
  rootOctave: 3,
  voices: 12,
  curve: 0,
  imgBrightness: 100,
  imgSaturation: 0,
  imgContrast: 150,
  speedBpm: 120,
  midiChannel: 1,
};

export const state = {
  ...DEFAULTS,
  /** Recent note triggers for the piano-roll display. */
  recentNotes: [],
};

// ─── Derived ────────────────────────────────────────────────────────────────

export function getRootMidi() {
  return (state.rootOctave + 1) * 12 + state.rootNote;
}

export function getScaleIntervals() {
  const base = SCALES[state.scale] || SCALES["Chromatic"];
  return extendIntervals(base, state.voices, getRootMidi());
}

export function applyCurve(t, curve) {
  if (curve === 0 || t <= 0 || t >= 1) return t;
  const k = Math.pow(2, -curve * 2);
  return Math.pow(t, k);
}

export function getNoteForRing(curvedT) {
  const intervals = getScaleIntervals();
  if (intervals.length === 0) return getRootMidi();
  const index = Math.min(
    Math.floor(curvedT * intervals.length),
    intervals.length - 1,
  );
  const note = getRootMidi() + intervals[index];
  return Math.max(0, Math.min(127, Math.round(note)));
}
