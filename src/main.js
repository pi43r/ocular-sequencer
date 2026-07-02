// ─── Ocular Sequencer — Entry Point ─────────────────────────────────────────
import p5 from "p5";
window.p5 = p5;

import { initMidi } from "./midi.js";
import { state, DEFAULTS } from "./state.js";
import { createSketch } from "./sketch.js";
import { SCALES, NOTE_NAMES } from "./scales.js";

const $ = (id) => document.getElementById(id);

// ─── Helpers ────────────────────────────────────────────────────────────────

function spreadLabel(curve) {
  if (curve < -0.5) return "center";
  if (curve < -0.15) return "center·ish";
  if (curve < 0.15) return "linear";
  if (curve < 0.5) return "edge·ish";
  return "edge";
}

function updateLegend() {
  $("legend-thresh").textContent = state.threshold;
  $("legend-spread").textContent = spreadLabel(state.curve);
  $("legend-voices").textContent = state.voices;
}

function syncUIFromState() {
  $("voices-slider").value = state.voices;
  $("voices-display").textContent = state.voices;
  $("spread-slider").value = state.curve * 100;
  $("spread-display").textContent = spreadLabel(state.curve);
  $("threshold-slider").value = state.threshold;
  $("threshold-display").textContent = state.threshold;
  $("brightness-slider").value = state.imgBrightness;
  $("brightness-display").textContent = state.imgBrightness;
  $("saturation-slider").value = state.imgSaturation;
  $("saturation-display").textContent = state.imgSaturation;
  $("contrast-slider").value = state.imgContrast;
  $("contrast-display").textContent = state.imgContrast;
  $("speed-slider").value = state.speedBpm;
  $("bpm-display").textContent = state.speedBpm;
  updateLegend();
}

function bindSlider(id, stateKey, displayId, format) {
  const slider = $(id);
  const display = displayId ? $(displayId) : null;
  slider.addEventListener("input", () => {
    const val = parseInt(slider.value);
    state[stateKey] = stateKey === "curve" ? val / 100 : val;
    if (display) display.textContent = format ? format(val, state) : val;
    updateLegend();
  });
  slider.addEventListener("dblclick", () => {
    const def = DEFAULTS[stateKey];
    slider.value = stateKey === "curve" ? def * 100 : def;
    state[stateKey] = def;
    if (display)
      display.textContent = format
        ? format(def * (stateKey === "curve" ? 100 : 1), state)
        : def;
    updateLegend();
  });
}

// ─── Piano roll ─────────────────────────────────────────────────────────────

const CHORD_WINDOW_MS = 50; // notes within this window are grouped as a chord

function renderPianoRoll() {
  const el = $("piano-roll");
  if (!el) return;
  const notes = state.recentNotes;
  if (notes.length === 0) {
    el.innerHTML = '<span class="pr-empty">—</span>';
    return;
  }

  // Group notes that fired within CHORD_WINDOW_MS
  const groups = [];
  for (const n of notes) {
    const last = groups[groups.length - 1];
    if (last && n.time - last.time < CHORD_WINDOW_MS) {
      last.notes.push(n.name);
      last.time = n.time; // keep freshest timestamp
    } else {
      groups.push({ notes: [n.name], time: n.time });
    }
  }

  const now = performance.now();
  const shown = groups.slice(-12).reverse();

  el.innerHTML = shown
    .map((g) => {
      const age = (now - g.time) / 1000;
      const alpha = Math.max(0.15, 1 - age / 8);
      const label = [...new Set(g.notes)].join(" ");
      return `<span class="pr-note" style="opacity:${alpha.toFixed(2)}">${label}</span>`;
    })
    .join("");
}

// ─── Populate dropdowns ─────────────────────────────────────────────────────

const scaleSelect = $("scale-select");
for (const name of Object.keys(SCALES)) {
  const opt = document.createElement("option");
  opt.value = name;
  opt.textContent = name.toLowerCase();
  if (name === state.scale) opt.selected = true;
  scaleSelect.appendChild(opt);
}

const rootNoteSelect = $("root-note");
NOTE_NAMES.forEach((name, i) => {
  const opt = document.createElement("option");
  opt.value = i;
  opt.textContent = name;
  if (i === state.rootNote) opt.selected = true;
  rootNoteSelect.appendChild(opt);
});

const rootOctaveSelect = $("root-octave");
for (let oct = 1; oct <= 7; oct++) {
  const opt = document.createElement("option");
  opt.value = oct;
  opt.textContent = oct;
  if (oct === state.rootOctave) opt.selected = true;
  rootOctaveSelect.appendChild(opt);
}

// ─── Toggles ────────────────────────────────────────────────────────────────

$("btn-bright").addEventListener("click", () => setMode("bright"));
$("btn-dark").addEventListener("click", () => setMode("dark"));
function setMode(m) {
  state.mode = m;
  $("btn-bright").classList.toggle("active", m === "bright");
  $("btn-dark").classList.toggle("active", m === "dark");
}
setMode(state.mode);

$("btn-gate").addEventListener("click", () => setHold(false));
$("btn-hold").addEventListener("click", () => setHold(true));
function setHold(v) {
  state.holdNotes = v;
  $("btn-gate").classList.toggle("active", !v);
  $("btn-hold").classList.toggle("active", v);
}
setHold(state.holdNotes);

$("panel-toggle").addEventListener("click", () => {
  $("ui-controls").classList.toggle("collapsed");
});

// ─── Dropdowns ──────────────────────────────────────────────────────────────
scaleSelect.addEventListener("change", (e) => {
  state.scale = e.target.value;
});
rootNoteSelect.addEventListener("change", (e) => {
  state.rootNote = parseInt(e.target.value);
});
rootOctaveSelect.addEventListener("change", (e) => {
  state.rootOctave = parseInt(e.target.value);
});

$("channel-select").addEventListener("change", (e) => {
  state.midiChannel = parseInt(e.target.value);
  const ms = $("midi-status");
  if (ms.classList.contains("connected")) {
    const name = ms.textContent.replace(/^midi ch\\d+ · /, "");
    ms.textContent = `midi ch${state.midiChannel} · ${name}`;
  }
});

// ─── Sliders ────────────────────────────────────────────────────────────────
bindSlider("voices-slider", "voices", "voices-display");
bindSlider("spread-slider", "curve", "spread-display", (val) =>
  spreadLabel(val / 100),
);
bindSlider("threshold-slider", "threshold", "threshold-display");
bindSlider("brightness-slider", "imgBrightness", "brightness-display");
bindSlider("saturation-slider", "imgSaturation", "saturation-display");
bindSlider("contrast-slider", "imgContrast", "contrast-display");
bindSlider("speed-slider", "speedBpm", "bpm-display");

syncUIFromState();

// ─── Fullscreen toggle ──────────────────────────────────────────────────────
$("fs-btn").addEventListener("click", () => {
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen();
  } else {
    document.exitFullscreen();
  }
});

// ─── Info modal ──────────────────────────────────────────────────────────────
const infoOverlay = $("info-overlay");

function showInfo() {
  infoOverlay.classList.remove("hidden");
}

function hideInfo() {
  infoOverlay.classList.add("hidden");
}

$("start-info-btn").addEventListener("click", showInfo);
$("info-btn").addEventListener("click", showInfo);
$("info-close").addEventListener("click", hideInfo);

// Close modal when clicking the backdrop (outside the modal box)
infoOverlay.addEventListener("click", (e) => {
  if (e.target === infoOverlay) hideInfo();
});

// Close modal with Escape key
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && !infoOverlay.classList.contains("hidden")) {
    hideInfo();
  }
});

// ─── Launch ─────────────────────────────────────────────────────────────────
$("start-btn").addEventListener("click", async () => {
  await initMidi($("midi-status"));
  $("start-screen").classList.add("hidden");
  $("ui-controls").classList.remove("hidden");
  $("info-btn").classList.remove("hidden");
  updateLegend();
  new p5(createSketch());
  setInterval(renderPianoRoll, 100);
});
