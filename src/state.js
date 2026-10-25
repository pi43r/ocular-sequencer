import { SCALES, extendIntervals } from './scales.js';

export const DEFAULTS = {
  mode: 'bright', rangeLow: 55, rangeHigh: 100, previewEdges: false,
  scale: 'Pentatonic Minor', rootNote: 0, rootOctave: 3,
  voices: 8, curve: 0, speedBpm: 100, steps: 16,
  gate: 70, dynamics: 65, midiChannel: 1, density: 100, imageLevel: 85, edgeGain: 3,
};
export const state = { ...DEFAULTS, playing: true, frozen: false, panelOpen: true, showLabels: false, restart: 0, recentNotes: [] };
export const getRootMidi = () => (state.rootOctave + 1) * 12 + state.rootNote;
export const getScaleIntervals = () => extendIntervals(SCALES[state.scale] || SCALES.Chromatic, state.voices, getRootMidi());
export function applyCurve(t, curve) {
  return Math.pow(t, Math.pow(2, -curve * 2));
}
export function getNoteForRing(index) {
  const intervals = getScaleIntervals();
  return getRootMidi() + intervals[Math.min(index, intervals.length - 1)];
}
