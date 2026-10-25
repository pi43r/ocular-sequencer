import p5 from 'p5';
import { initMidi, selectOutput, panic } from './midi.js';
import { state, DEFAULTS } from './state.js';
import { createSketch } from './sketch.js';
import { SCALES, NOTE_NAMES } from './scales.js';
import { ccToValue } from './detection.js';
import { PRESETS, DIVISIONS, divisionLabel } from './performance.js';
const $ = id => document.getElementById(id);
const controls = [
  ['rangeLow', 'strength from', 0, 100, 1, 'range-controls', v => `${v}%`],
  ['rangeHigh', 'to', 0, 100, 1, 'range-controls', v => `${v}%`],
  ['edgeGain', 'edge gain', 1, 8, 0.1, 'edge-controls', v => `${v.toFixed(1)}×`],
  ['steps', 'division', 0, DIVISIONS.length - 1, 1, 'rhythm-controls', divisionLabel],
  ['speedBpm', 'scan tempo', 30, 240, 1, 'rhythm-controls', v => `${v} bpm`],
  ['density', 'rhythmic density', 0, 100, 1, 'expression-controls', v => `${Math.round(state.steps * v / 100)} / ${state.steps} steps`],
  ['imageLevel', 'image level', 0, 100, 1, 'radar-controls', v => `${v}%`],
  ['gate', 'note length', 10, 95, 1, 'rhythm-controls', v => `${v}% of step`],
  ['dynamics', 'dynamics', 0, 100, 1, 'expression-controls', v => v ? `${v}%` : 'fixed velocity'],
  ['voices', 'notes', 1, 16, 1, 'harmony-controls', v => `${v}`],
  ['curve', 'spatial spread', -1, 1, 0.01, 'harmony-controls', v => v === 0 ? 'even' : `${Math.round(Math.abs(v) * 100)}% ${v < 0 ? 'center' : 'edge'}`],
];
let learning = null, mappings = {}, mappingMode = false, previousSource = 'bright';
try {
  const saved = JSON.parse(localStorage.getItem('ocular-midi-mappings') || '{}');
  for (const [key, m] of Object.entries(saved || {})) {
    if (controls.some(c => c[0] === key) && typeof m.port === 'string' && Number.isInteger(m.cc) && m.cc >= 0 && m.cc < 120 && Number.isInteger(m.channel) && m.channel >= 1 && m.channel <= 16) mappings[key] = m;
  }
} catch { /* Storage may be unavailable. MIDI still works in this session. */ }
function saveMappings() {
  try { localStorage.setItem('ocular-midi-mappings', JSON.stringify(mappings)); } catch { /* Session-only fallback. */ }
}
function syncUI() {
  for (const [key, , , , , , format] of controls) {
    $(`${key}-slider`).value = key === 'steps' ? DIVISIONS.indexOf(state.steps) : state[key];
    $(`${key}-value`).textContent = format(state[key]);
    $(`${key}-slider`).setAttribute('aria-valuetext', format(state[key]));
    const button = $(`${key}-learn`), m = mappings[key];
    button.textContent = learning === key ? 'cancel' : m ? `cc ${m.cc}` : 'learn';
    button.classList.toggle('active', learning === key);
    button.setAttribute('aria-pressed', String(learning === key));
    button.title = m ? `channel ${m.channel}, CC ${m.cc} · click to relearn` : 'learn a MIDI knob';
  }
  for (const mode of ['bright', 'dark', 'edges']) {
    $(`btn-${mode}`).classList.toggle('active', state.mode === mode);
    $(`btn-${mode}`).setAttribute('aria-pressed', String(state.mode === mode));
  }
  const mode = state.mode === 'edges' ? 'edge strength' : state.mode === 'bright' ? 'brightness' : 'darkness';
  $('range-hint').textContent = state.mode === 'edges' ? 'play boundaries · raise gain for faint structures' : 'select an intensity band · 0–100%';
  $('edge-controls').hidden = state.mode !== 'edges';
  for (const key of ['density', 'gate']) $(`${key}-slider`).closest('.slider-control').hidden = state.steps === 0;
  $('rhythm-hint').textContent = state.steps ? 'one sweep = four beats' : 'free scan · enter to play, leave to release';
  $('range-band').style.left = `${state.rangeLow}%`;
  $('range-band').style.width = `${state.rangeHigh - state.rangeLow}%`;
  $('range-band').parentElement.classList.toggle('dark', state.mode === 'dark');
  $('legend-range').textContent = `${mode} ${state.rangeLow}–${state.rangeHigh}%`;
  $('legend-rhythm').textContent = `${state.speedBpm} bpm / ${divisionLabel(state.steps)}`;
  $('play-btn').textContent = state.playing ? 'pause' : 'play';
  $('freeze-btn').textContent = state.frozen ? 'unfreeze scene' : 'freeze scene';
  $('freeze-btn').setAttribute('aria-pressed', String(state.frozen));
  $('freeze-btn').classList.toggle('active', state.frozen);
  for (const [id, key] of [['scale-select', 'scale'], ['root-note', 'rootNote'], ['root-octave', 'rootOctave']]) $(id).value = state[key];
}
function setSlider(key, value) {
  state[key] = key === 'steps' ? DIVISIONS[value] : value;
  $('preset-select').value = '';
  if (key === 'rangeLow') state.rangeHigh = Math.max(value, state.rangeHigh);
  if (key === 'rangeHigh') state.rangeLow = Math.min(value, state.rangeLow);
  syncUI();
}
for (const [key, label, min, max, step, group] of controls) {
  const el = document.createElement('div'); el.className = 'slider-control';
  el.innerHTML = `<div class="control-label"><label for="${key}-slider">${label}</label><output id="${key}-value" for="${key}-slider"></output><button class="learn" id="${key}-learn" aria-label="learn MIDI for ${label}">learn</button></div><input type="range" id="${key}-slider" min="${min}" max="${max}" step="${step}">`;
  $(group).append(el);
  $(`${key}-slider`).addEventListener('input', e => setSlider(key, Number(e.target.value)));
  $(`${key}-slider`).addEventListener('dblclick', () => setSlider(key, key === 'steps' ? DIVISIONS.indexOf(DEFAULTS[key]) : DEFAULTS[key]));
  $(`${key}-learn`).addEventListener('click', () => {
    learning = learning === key ? null : key;
    $('learn-status').textContent = learning ? `move a knob for ${label}… click cancel or press Escape to stop.` : 'learning canceled.';
    syncUI();
  });
}
function receiveCC(message) {
  if (message.cc >= 120) return; // Channel mode messages are not controller knobs.
  if (learning) {
    for (const [key, m] of Object.entries(mappings)) {
      if (m.port === message.port && m.channel === message.channel && m.cc === message.cc) delete mappings[key];
    }
    mappings[learning] = { port: message.port, channel: message.channel, cc: message.cc };
    $('learn-status').textContent = `mapped ${controls.find(c => c[0] === learning)[1]} to cc ${message.cc} · ch ${message.channel}.`;
    learning = null; saveMappings(); syncUI();
  }
  for (const [key, m] of Object.entries(mappings)) {
    if (m.port !== message.port || m.channel !== message.channel || m.cc !== message.cc) continue;
    const [, , min, max, step] = controls.find(c => c[0] === key);
    setSlider(key, Number(ccToValue(message.value, min, max, step).toFixed(2)));
  }
}
function populate(id, values, key) {
  for (const [value, label] of values) $(id).add(new Option(label, value));
  $(id).value = state[key];
  $(id).addEventListener('change', e => {
    $('preset-select').value = '';
    panic(); state[key] = typeof DEFAULTS[key] === 'number' ? Number(e.target.value) : e.target.value; syncUI();
  });
}
populate('scale-select', Object.keys(SCALES).map(n => [n, n.toLowerCase()]), 'scale');
populate('root-note', NOTE_NAMES.map((n, i) => [i, n]), 'rootNote');
populate('root-octave', Array.from({ length: 7 }, (_, i) => [i + 1, i + 1]), 'rootOctave');
populate('channel-select', Array.from({ length: 16 }, (_, i) => [i + 1, i + 1]), 'midiChannel');
function setSource(mode) {
  if (state.mode !== 'edges') previousSource = state.mode;
  state.mode = mode; $('preset-select').value = ''; syncUI();
}
for (const mode of ['bright', 'dark', 'edges']) $(`btn-${mode}`).addEventListener('click', () => setSource(mode));
$('map-btn').addEventListener('click', () => {
  mappingMode = !mappingMode;
  $('ui-controls').classList.toggle('mapping', mappingMode);
  $('map-btn').setAttribute('aria-pressed', String(mappingMode));
  $('map-btn').classList.toggle('active', mappingMode);
  if (!mappingMode) learning = null;
  $('learn-status').textContent = mappingMode ? 'choose learn, then move a knob. open a section to map more controls.' : '';
  syncUI();
});
$('play-btn').addEventListener('click', () => { state.playing = !state.playing; if (!state.playing) panic(); syncUI(); });
$('panic-btn').addEventListener('click', () => { state.playing = false; panic(); syncUI(); });
document.addEventListener('transportchange', syncUI);
$('clear-midi').addEventListener('click', () => { mappings = {}; learning = null; saveMappings(); syncUI(); $('learn-status').textContent = 'all mappings cleared.'; });
document.addEventListener('keydown', e => { if (e.key === 'Escape' && learning) { learning = null; syncUI(); $('learn-status').textContent = 'learning canceled.'; } });
$('output-select').addEventListener('change', e => selectOutput(e.target.value));
$('panel-toggle').addEventListener('click', () => {
  const collapsed = $('ui-controls').classList.toggle('collapsed');
  state.panelOpen = !collapsed;
  $('panel-toggle').textContent = collapsed ? '+' : '−';
  $('panel-toggle').setAttribute('aria-expanded', String(!collapsed));
  $('panel-toggle').title = collapsed ? 'open controls' : 'collapse controls';
});
function freezeScene() {
  state.frozen = !state.frozen;
  $('performance-status').textContent = state.frozen ? 'scene held / the same image plays each revolution.' : 'camera live / movement changes the music.';
  syncUI();
}
function restartBar() { panic(); state.restart++; $('performance-status').textContent = 'bar restarted / sweep returns to twelve o’clock.'; }
$('freeze-btn').addEventListener('click', freezeScene);
$('restart-btn').addEventListener('click', restartBar);
$('labels-toggle').addEventListener('change', e => { state.showLabels = e.target.checked; });
$('preset-select').addEventListener('change', e => {
  const preset = PRESETS[e.target.value];
  if (!preset) return;
  panic(); Object.assign(state, preset); state.restart++;
  $('performance-status').textContent = `${e.target.value} loaded / root and midi mappings preserved.`;
  syncUI();
});
document.addEventListener('keydown', e => {
  if (e.repeat || e.ctrlKey || e.metaKey || e.altKey || $('start-screen').classList.contains('hidden') === false || !infoOverlay.classList.contains('hidden')) return;
  if (e.target.closest('input, select, button, summary, [contenteditable]')) return;
  if (e.code === 'Space') { e.preventDefault(); $('play-btn').click(); }
  if (e.key.toLowerCase() === 'f') freezeScene();
  if (e.key.toLowerCase() === 'r') restartBar();
  if (e.key.toLowerCase() === 'e') setSource(state.mode === 'edges' ? previousSource : 'edges');
});
syncUI();
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
  const shown = groups.slice(-4).reverse();

  el.innerHTML = shown
    .map((g) => {
      const age = (now - g.time) / 1000;
      const alpha = Math.max(0.15, 1 - age / 8);
      const label = [...new Set(g.notes)].join(" ");
      return `<span class="pr-note" style="opacity:${alpha.toFixed(2)}">${label}</span>`;
    })
    .join("");
}


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

$('start-btn').addEventListener('click', async () => {
  $('start-btn').disabled = true;
  try {
    await initMidi((outputs, selected, inputs) => {
      $('output-select').replaceChildren();
      if (!outputs.length) $('output-select').add(new Option('no outputs connected', ''));
      for (const port of outputs) $('output-select').add(new Option(port.name || port.id, port.id));
      $('output-select').value = selected || '';
      $('midi-status').textContent = `${outputs.length} outputs · ${inputs} controller inputs`;
    }, receiveCC);
  } catch (error) { $('midi-status').textContent = `midi: ${error.message}`; }
  $('start-screen').classList.add('hidden');
  $('ui-controls').classList.remove('hidden');
  $('info-btn').classList.remove('hidden');
  new p5(createSketch());
  setInterval(renderPianoRoll, 100);
});
