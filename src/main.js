// ─── Circular Rhythms — Entry Point ─────────────────────────────────────────
// Wires up DOM controls, initializes MIDI, and launches the p5 sketch.

import p5 from "p5";
window.p5 = p5; // p5 internal reference for loadPixels

import { initMidi } from "./midi.js";
import { state } from "./state.js";
import { createSketch } from "./sketch.js";
import { SCALES, NOTE_NAMES } from "./scales.js";

// ─── DOM refs ───────────────────────────────────────────────────────────────
const $ = (id) => document.getElementById(id);
const startBtn = $("start-btn");
const startScreen = $("start-screen");
const uiControls = $("ui-controls");
const midiStatus = $("midi-status");

// ─── Populate scale dropdown ────────────────────────────────────────────────
const scaleSelect = $("scale-select");
for (const name of Object.keys(SCALES)) {
  const opt = document.createElement("option");
  opt.value = name;
  opt.textContent = name;
  if (name === state.scale) opt.selected = true;
  scaleSelect.appendChild(opt);
}

// ─── Populate root note dropdown ────────────────────────────────────────────
const rootNoteSelect = $("root-note");
NOTE_NAMES.forEach((name, i) => {
  const opt = document.createElement("option");
  opt.value = i;
  opt.textContent = name;
  if (i === state.rootNote) opt.selected = true;
  rootNoteSelect.appendChild(opt);
});

// ─── Bind controls ──────────────────────────────────────────────────────────

// Mode: bright / dark
$("btn-bright").addEventListener("click", () => setMode("bright"));
$("btn-dark").addEventListener("click", () => setMode("dark"));

function setMode(mode) {
  state.mode = mode;
  $("btn-bright").classList.toggle("active", mode === "bright");
  $("btn-dark").classList.toggle("active", mode === "dark");
}
setMode(state.mode); // init visual

// Trigger: gate / hold
$("btn-gate").addEventListener("click", () => setHold(false));
$("btn-hold").addEventListener("click", () => setHold(true));

function setHold(val) {
  state.holdNotes = val;
  $("btn-gate").classList.toggle("active", !val);
  $("btn-hold").classList.toggle("active", val);
}
setHold(state.holdNotes);

// Scale
scaleSelect.addEventListener("change", (e) => {
  state.scale = e.target.value;
});

// Root
rootNoteSelect.addEventListener("change", (e) => {
  state.rootNote = parseInt(e.target.value);
});
$("root-octave").addEventListener("change", (e) => {
  state.rootOctave = parseInt(e.target.value);
});

// Voices
$("voices-slider").addEventListener("input", (e) => {
  state.voices = parseInt(e.target.value);
  $("voices-display").textContent = state.voices;
});

// Threshold
$("threshold-slider").addEventListener("input", (e) => {
  state.threshold = parseInt(e.target.value);
  $("threshold-display").textContent = state.threshold;
});

// Image filters
$("brightness-slider").addEventListener("input", (e) => {
  state.imgBrightness = parseInt(e.target.value);
});
$("saturation-slider").addEventListener("input", (e) => {
  state.imgSaturation = parseInt(e.target.value);
});
$("contrast-slider").addEventListener("input", (e) => {
  state.imgContrast = parseInt(e.target.value);
});

// Speed
$("speed-slider").addEventListener("input", (e) => {
  state.speedBpm = parseInt(e.target.value);
  $("bpm-display").textContent = state.speedBpm;
});

// ─── Launch ─────────────────────────────────────────────────────────────────
startBtn.addEventListener("click", async () => {
  await initMidi(midiStatus);

  startScreen.classList.add("hidden");
  uiControls.classList.remove("hidden");

  new p5(createSketch());
});
