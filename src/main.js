import p5 from 'p5';
import { initMidi, selectOutput, getOutputId, getOutputIdentity, panic } from './midi.js';
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
const PRESET_STORAGE_KEY = 'ocular-saved-setups';
const PRESET_VERSION = 1;
const SAVED_STATE_KEYS = [
  'mode', 'rangeLow', 'rangeHigh', 'edgeGain', 'previewEdges', 'steps', 'speedBpm', 'density',
  'gate', 'dynamics', 'scale', 'rootNote', 'rootOctave', 'voices', 'curve',
  'imageLevel', 'showLabels', 'frozen', 'midiChannel',
];
let userPresets = readPresets();
function readPresets() {
  try {
    const parsed = JSON.parse(localStorage.getItem(PRESET_STORAGE_KEY) || '[]');
    return Array.isArray(parsed) ? parsed.filter(p => p && typeof p.id === 'string' && typeof p.name === 'string' && p.version === PRESET_VERSION && p.settings && typeof p.settings === 'object').slice(0, 100) : [];
  } catch { return []; }
}
function persistPresets() {
  try { localStorage.setItem(PRESET_STORAGE_KEY, JSON.stringify(userPresets)); return true; }
  catch { $('preset-status').textContent = 'Could not save: browser storage is unavailable or full.'; return false; }
}
function makePreset(name) {
  const settings = Object.fromEntries(SAVED_STATE_KEYS.map(key => [key, state[key]]));
  return { version: PRESET_VERSION, id: crypto.randomUUID(), name, savedAt: new Date().toISOString(), settings, routing: { outputId: getOutputId() || $('output-select').value, ...getOutputIdentity(), mappings: structuredClone(mappings) } };
}
function refreshPresetList(selectId = '') {
  const select = $('saved-preset-select');
  select.replaceChildren(new Option('choose a setup…', ''));
  for (const preset of userPresets) select.add(new Option(preset.name, preset.id));
  select.value = userPresets.some(p => p.id === selectId) ? selectId : '';
}
function selectedPreset() { return userPresets.find(p => p.id === $('saved-preset-select').value); }
function validatePreset(input) {
  if (!input || input.version !== PRESET_VERSION || typeof input.name !== 'string' || !input.settings || typeof input.settings !== 'object') return null;
  const settings = {};
  for (const key of SAVED_STATE_KEYS) {
    const value = input.settings[key];
    if (key === 'mode' && ['bright', 'dark', 'edges'].includes(value)) settings[key] = value;
    else if (key === 'scale' && Object.hasOwn(SCALES, value)) settings[key] = value;
    else if (key === 'showLabels' || key === 'frozen' || key === 'previewEdges') { if (typeof value !== 'boolean') return null; settings[key] = value; }
    else if (key === 'rootNote' && Number.isInteger(value) && value >= 0 && value <= 11) settings[key] = value;
    else if (key === 'rootOctave' && Number.isInteger(value) && value >= 1 && value <= 7) settings[key] = value;
    else if (key === 'steps' && DIVISIONS.includes(value)) settings[key] = value;
    else if (key === 'midiChannel' && Number.isInteger(value) && value >= 1 && value <= 16) settings[key] = value;
    else if (['rangeLow', 'rangeHigh', 'density', 'imageLevel'].includes(key) && Number.isFinite(value) && value >= 0 && value <= 100) settings[key] = value;
    else if (key === 'edgeGain' && Number.isFinite(value) && value >= 1 && value <= 8) settings[key] = value;
    else if (key === 'speedBpm' && Number.isFinite(value) && value >= 30 && value <= 240) settings[key] = value;
    else if (key === 'gate' && Number.isFinite(value) && value >= 10 && value <= 95) settings[key] = value;
    else if (key === 'dynamics' && Number.isFinite(value) && value >= 0 && value <= 100) settings[key] = value;
    else if (key === 'voices' && Number.isInteger(value) && value >= 1 && value <= 16) settings[key] = value;
    else if (key === 'curve' && Number.isFinite(value) && value >= -1 && value <= 1) settings[key] = value;
    else return null;
  }
  const sourceMappings = input.routing?.mappings || {};
  const safeMappings = {};
  for (const [key, m] of Object.entries(sourceMappings)) {
    if (controls.some(c => c[0] === key) && m && typeof m.port === 'string' && Number.isInteger(m.cc) && m.cc >= 0 && m.cc < 120 && Number.isInteger(m.channel) && m.channel >= 1 && m.channel <= 16) safeMappings[key] = { port: m.port, portName: typeof m.portName === 'string' ? m.portName : '', manufacturer: typeof m.manufacturer === 'string' ? m.manufacturer : '', cc: m.cc, channel: m.channel };
  }
  return { version: PRESET_VERSION, id: typeof input.id === 'string' ? input.id : crypto.randomUUID(), name: input.name.trim().slice(0, 40) || 'imported setup', savedAt: typeof input.savedAt === 'string' ? input.savedAt : new Date().toISOString(), settings, routing: { outputId: typeof input.routing?.outputId === 'string' ? input.routing.outputId : '', name: typeof input.routing?.name === 'string' ? input.routing.name : '', manufacturer: typeof input.routing?.manufacturer === 'string' ? input.routing.manufacturer : '', mappings: safeMappings } };
}
function loadPreset(preset) {
  const valid = validatePreset(preset);
  if (!valid) { $('preset-status').textContent = 'That setup is invalid or uses an unsupported version.'; return false; }
  panic(); Object.assign(state, valid.settings); mappings = valid.routing.mappings; saveMappings();
  state.restart++;
  const outputId = valid.routing.outputId;
  const found = outputId && selectOutput(outputId, valid.routing);
  $('output-select').value = found ? getOutputId() : '';
  if (outputId && !found) $('preset-status').textContent = `Loaded “${valid.name}”; its saved MIDI output is not connected.`;
  else $('preset-status').textContent = `Loaded “${valid.name}”.`;
  $('labels-toggle').checked = state.showLabels;
  $('preset-select').value = '';
  syncUI();
  return true;
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
  $('edge-preview-toggle').checked = state.previewEdges;
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
  for (const [id, key] of [['scale-select', 'scale'], ['root-note', 'rootNote'], ['root-octave', 'rootOctave'], ['channel-select', 'midiChannel']]) $(id).value = state[key];
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
      const sameInput = m.port === message.port || (m.portName && m.portName === message.portName && (!m.manufacturer || m.manufacturer === message.manufacturer));
      if (sameInput && m.channel === message.channel && m.cc === message.cc) delete mappings[key];
    }
    mappings[learning] = { port: message.port, portName: message.portName || '', manufacturer: message.manufacturer || '', channel: message.channel, cc: message.cc };
    $('learn-status').textContent = `mapped ${controls.find(c => c[0] === learning)[1]} to cc ${message.cc} · ch ${message.channel}.`;
    learning = null; saveMappings(); syncUI();
  }
  for (const [key, m] of Object.entries(mappings)) {
    if ((m.port !== message.port && (!m.portName || m.portName !== message.portName || (m.manufacturer && m.manufacturer !== message.manufacturer))) || m.channel !== message.channel || m.cc !== message.cc) continue;
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
refreshPresetList();
$('save-preset').addEventListener('click', () => {
  const name = $('preset-name').value.trim();
  if (!name) { $('preset-status').textContent = 'Enter a name for this setup.'; $('preset-name').focus(); return; }
  if (userPresets.some(p => p.name.toLowerCase() === name.toLowerCase())) { $('preset-status').textContent = 'A setup with that name already exists. Select it and choose update, or use another name.'; return; }
  const preset = makePreset(name.slice(0, 40)), before = userPresets; userPresets = [...userPresets, preset];
  if (persistPresets()) { refreshPresetList(preset.id); $('preset-status').textContent = `Saved “${preset.name}” with its MIDI routing and mappings.`; } else userPresets = before;
});
$('load-preset').addEventListener('click', () => {
  const preset = selectedPreset();
  if (preset) loadPreset(preset); else $('preset-status').textContent = 'Choose a saved setup first.';
});
$('update-preset').addEventListener('click', () => {
  const old = selectedPreset();
  if (!old) { $('preset-status').textContent = 'Choose a saved setup to update.'; return; }
  const name = $('preset-name').value.trim() || old.name;
  if (userPresets.some(p => p.id !== old.id && p.name.toLowerCase() === name.toLowerCase())) { $('preset-status').textContent = 'Another setup already uses that name.'; return; }
  const updated = { ...makePreset(name.slice(0, 40)), id: old.id };
  const before = userPresets; userPresets = userPresets.map(p => p.id === old.id ? updated : p);
  if (persistPresets()) { refreshPresetList(old.id); $('preset-status').textContent = `Updated “${updated.name}” including MIDI routing and mappings.`; } else userPresets = before;
});
$('delete-preset').addEventListener('click', () => {
  const preset = selectedPreset();
  if (!preset) { $('preset-status').textContent = 'Choose a saved setup to delete.'; return; }
  const before = userPresets; userPresets = userPresets.filter(p => p.id !== preset.id);
  if (persistPresets()) { refreshPresetList(); $('preset-name').value = ''; $('preset-status').textContent = `Deleted “${preset.name}”.`; } else userPresets = before;
});
$('saved-preset-select').addEventListener('change', () => {
  const preset = selectedPreset(); $('preset-name').value = preset?.name || '';
});
$('export-presets').addEventListener('click', () => {
  const blob = new Blob([JSON.stringify({ app: 'ocular-sequencer', version: PRESET_VERSION, presets: userPresets }, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob), link = document.createElement('a');
  link.href = url; link.download = 'ocular-setups.json'; link.click(); URL.revokeObjectURL(url);
  $('preset-status').textContent = `Exported ${userPresets.length} setup${userPresets.length === 1 ? '' : 's'}.`;
});
$('import-presets').addEventListener('click', () => $('import-preset-file').click());
$('import-preset-file').addEventListener('change', async e => {
  const file = e.target.files?.[0]; e.target.value = '';
  if (!file) return;
  try {
    if (file.size > 1_000_000) throw new Error('File is larger than 1 MB.');
    const data = JSON.parse(await file.text());
    const incoming = data.app === 'ocular-sequencer' && Array.isArray(data.presets) ? data.presets : [data];
    const valid = incoming.map(validatePreset);
    if (!valid.length || valid.some(p => !p)) throw new Error('The file contains an invalid or unsupported setup.');
    const next = [...userPresets];
    for (const preset of valid) {
      const baseName = preset.name.slice(0, 30);
      let name = baseName, suffix = 2;
      while (next.some(existing => existing.name.toLowerCase() === name.toLowerCase())) {
        name = `${baseName.slice(0, 36 - String(suffix).length)} (import ${suffix++})`;
      }
      preset.id = crypto.randomUUID();
      preset.name = name;
      next.push(preset);
    }
    if (next.length > 100) throw new Error('Import would exceed the 100 setup limit.');
    userPresets = next;
    if (persistPresets()) { refreshPresetList(valid[0].id); $('preset-name').value = valid[0].name; $('preset-status').textContent = `Imported ${valid.length} setup${valid.length === 1 ? '' : 's'}. Select one and load it.`; }
  } catch (error) { $('preset-status').textContent = `Import failed: ${error.message}`; }
});
document.addEventListener('keydown', e => { if (e.key === 'Escape' && learning) { learning = null; syncUI(); $('learn-status').textContent = 'learning canceled.'; } });
$('output-select').addEventListener('change', e => { selectOutput(e.target.value); $('preset-status').textContent = 'MIDI output changed. Save or update the setup to keep it.'; });
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
$('edge-preview-toggle').addEventListener('change', e => { state.previewEdges = e.target.checked; });
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
