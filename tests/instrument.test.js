import { test } from 'node:test';
import assert from 'node:assert/strict';
import { intensity, edgeIntensity, inRange, velocityFor, ccToValue } from '../src/detection.js';
import { state, DEFAULTS, getNoteForRing, applyCurve } from '../src/state.js';
import { extendIntervals } from '../src/scales.js';
import { isPulse, radarLayout, PRESETS, DIVISIONS, divisionLabel } from '../src/performance.js';

test('brightness and darkness select complementary bounded ranges', () => {
  assert.equal(intensity(255, 255, 255, 'bright'), 100);
  assert.equal(intensity(0, 0, 0, 'dark'), 100);
  assert.ok(Math.abs(intensity(80, 100, 200, 'bright') + intensity(80, 100, 200, 'dark') - 100) < 1e-10);
  assert.equal(inRange(50, 40, 60), true);
  assert.equal(inRange(70, 40, 60), false);
  assert.equal(inRange(38, 40, 60, true), true);
  assert.equal(inRange(38, 40, 60), false);
  assert.equal(inRange(64, 40, 60, true), false);
  assert.equal(inRange(null, 0, 100), false);
});
test('dynamics and absolute CC values remain in musical bounds', () => {
  assert.equal(velocityFor(50, 50, 100, 0), 100);
  assert.equal(velocityFor(50, 50, 100, 100), 35);
  assert.equal(velocityFor(100, 50, 100, 100), 127);
  assert.equal(velocityFor(50, 50, 50, 100), 35);
  assert.equal(ccToValue(0, 30, 240), 30);
  assert.equal(ccToValue(127, 30, 240), 240);
  assert.equal(ccToValue(127, -1, 1, .01), 1);
  assert.equal(ccToValue(64, 1, 16), 9);
});
test('scale extends with octave roots and spatial spread does not change pitch', () => {
  Object.assign(state, DEFAULTS);
  assert.deepEqual(extendIntervals([0, 3, 5, 7, 10], 8, 48), [0, 3, 5, 7, 10, 12, 15, 17]);
  const notes = Array.from({ length: 8 }, (_, i) => getNoteForRing(i));
  state.curve = -1;
  assert.deepEqual(Array.from({ length: 8 }, (_, i) => getNoteForRing(i)), notes);
  assert.ok(applyCurve(.5, -1) < .5);
  assert.ok(applyCurve(.5, 1) > .5);
  state.rootOctave = 7; state.rootNote = 11; state.voices = 16;
  assert.ok(getNoteForRing(15) <= 127);
  Object.assign(state, DEFAULTS);
});
test('MIDI routes CC input and releases original channels when switching outputs', async () => {
  const sentA = [], sentB = [], received = [];
  const a = { id: 'a', state: 'connected', send: d => sentA.push(d) };
  const b = { id: 'b', state: 'connected', send: d => sentB.push(d) };
  const input = { id: 'knobs', state: 'connected' };
  const access = { outputs: new Map([['a', a], ['b', b]]), inputs: new Map([['knobs', input]]) };
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { requestMIDIAccess: async () => access } });
  const midi = await import('../src/midi.js');
  await midi.initMidi(() => {}, m => received.push(m));
  input.onmidimessage({ data: [0xb2, 74, 127] });
  input.onmidimessage({ data: [0x92, 60, 100] });
  assert.deepEqual(received, [{ port: 'knobs', channel: 3, cc: 74, value: 127 }]);
  midi.sendNoteOn(60, 100, 3);
  midi.selectOutput('b');
  assert.deepEqual(sentA, [[0x92, 60, 100], [0x82, 60, 0]]);
  midi.sendNoteOn(0, 80, 1); midi.panic(); midi.panic();
  assert.deepEqual(sentB, [[0x90, 0, 80], [0x80, 0, 0]]);
  const hotplug = { id: 'new', state: 'connected' };
  access.inputs.set(hotplug.id, hotplug); access.onstatechange();
  assert.equal(typeof hotplug.onmidimessage, 'function');
});
test('sweep retains one onset marker in an active zone and pause releases notes', async () => {
  Object.assign(state, DEFAULTS, { voices: 1, rangeLow: 50, playing: true });
  const sent = [];
  const out = { id: 'test-synth', state: 'connected', send: d => sent.push(d) };
  navigator.requestMIDIAccess = async () => ({ outputs: new Map([[out.id, out]]), inputs: new Map() });
  const midi = await import('../src/midi.js');
  await midi.initMidi(() => {}, () => {});
  const originalDocument = globalThis.document, originalWindow = globalThis.window, originalPerformance = globalThis.performance;
  let now = 0;
  globalThis.performance = { now: () => now };
  globalThis.document = { addEventListener() {}, getElementById: () => ({ textContent: '' }) };
  globalThis.window = { addEventListener() {} };
  try {
    const noop = () => {};
    const context = { save: noop, restore: noop, beginPath: noop, arc: noop, clip: noop };
    let cameraFrames = 0;
    const pg = new Proxy({ image: () => cameraFrames++, pixels: new Uint8ClampedArray(640 * 480 * 4).fill(255) }, { get: (o, k) => o[k] ?? noop });
    const pins = [];
    const p = new Proxy({
      width: 1000, height: 800, windowWidth: 1000, windowHeight: 800, deltaTime: 100,
      drawingContext: context, createCanvas: () => ({ parent: noop }),
      createCapture: () => ({ loadedmetadata: true, size: noop, hide: noop }),
      createGraphics: () => pg, textWidth: () => 18,
      quad: (...coords) => { if (coords[3] - coords[1] > 3) pins.push(coords); },
    }, { get: (o, k) => o[k] ?? noop });
    const { createSketch } = await import('../src/sketch.js');
    createSketch()(p); p.setup(); p.draw();
    const onset = pins[0];
    assert.ok(onset);
    for (let frame = 1; frame <= 6; frame++) { now = frame * 100; p.draw(); }
    assert.ok(sent.filter(d => (d[0] & 0xf0) === 0x90).length > 1);
    assert.equal(pins.length, 7); // one marker per frame, even across rhythmic retriggers
    assert.ok(Math.abs((pins.at(-1)[0]) - onset[0]) < 1e-9);
    assert.ok(Math.abs((pins.at(-1)[3]) - onset[3]) < 1e-9);
    state.frozen = true;
    const framesBeforeFreeze = cameraFrames;
    now += 100; p.draw();
    assert.equal(cameraFrames, framesBeforeFreeze);
    state.frozen = false; now += 100; p.draw();
    assert.equal(cameraFrames, framesBeforeFreeze + 1);
    state.restart++; now += 100; p.draw();
    assert.ok(Math.abs(pins.at(-1)[0] - onset[0]) < 1e-9);
    assert.ok(Math.abs(pins.at(-1)[3] - onset[3]) < 1e-9);
    // Free scan starts immediately, sustains, and releases only on exit.
    state.steps = 0; state.density = 0; now += 10; p.draw();
    const freeOnsets = sent.filter(d => (d[0] & 0xf0) === 0x90).length;
    now += 500; p.draw();
    assert.equal(sent.filter(d => (d[0] & 0xf0) === 0x90).length, freeOnsets);
    assert.equal(sent.at(-1)[0] & 0xf0, 0x90);
    pg.pixels.fill(0); now += 20; p.draw();
    assert.equal(sent.at(-1)[0] & 0xf0, 0x80);
    pg.pixels.fill(255); now += 20; p.draw();
    assert.equal(sent.filter(d => (d[0] & 0xf0) === 0x90).length, freeOnsets + 1);
    pg.pixels.fill(0); now += 20; p.draw();
    assert.equal(sent.at(-1)[0] & 0xf0, 0x90); // minimum hold filters flicker
    now += 100; p.draw();
    assert.equal(sent.at(-1)[0] & 0xf0, 0x80);
    pg.pixels.fill(255); now += 20; p.draw();
    state.steps = 16; state.density = 100; now += 20; p.draw();
    assert.equal(sent.at(-2)[0] & 0xf0, 0x80); // division switch releases free note
    assert.equal(sent.at(-1)[0] & 0xf0, 0x90);
    state.playing = false; now += 10; p.draw();
    assert.equal(sent.at(-1)[0] & 0xf0, 0x80);
  } finally {
    globalThis.document = originalDocument; globalThis.window = originalWindow; globalThis.performance = originalPerformance;
    Object.assign(state, DEFAULTS, { playing: true }); midi.panic();
  }
});

test('density distributes a repeatable pulse count with explicit rests', () => {
  for (const steps of [4, 8, 16, 32]) {
    for (const density of [0, 25, 38, 50, 75, 100]) {
      const pattern = Array.from({ length: steps }, (_, i) => isPulse(i, steps, density));
      assert.equal(pattern.filter(Boolean).length, Math.round(steps * density / 100));
      assert.deepEqual(pattern, Array.from({ length: steps }, (_, i) => isPulse(i + steps, steps, density)));
    }
  }
  assert.deepEqual(Array.from({ length: 8 }, (_, i) => isPulse(i, 8, 50)), [true, false, true, false, true, false, true, false]);
});
test('radar fits beside desktop controls and above mobile controls', () => {
  for (const [width, height] of [[1440, 900], [900, 600], [800, 600], [390, 844], [320, 568]]) {
    const { x, y, radius } = radarLayout(width, height, true);
    const availableWidth = width > 800 ? width - 310 : width;
    const availableHeight = width > 800 ? height : height * .52;
    assert.ok(x - radius - 20 >= 0);
    assert.ok(x + radius + 20 <= availableWidth);
    assert.ok(y - radius - 40 >= 0);
    assert.ok(y + radius + 40 <= availableHeight);
    const expanded = radarLayout(width, height, false);
    assert.ok(expanded.radius >= radius);
  }
});
test('presets preserve the chosen root, output channel, and viewing preferences', () => {
  for (const preset of Object.values(PRESETS)) {
    for (const key of ['rootNote', 'rootOctave', 'midiChannel', 'imageLevel', 'frozen']) assert.equal(key in preset, false);
    assert.ok(preset.rangeLow <= preset.rangeHigh);
  }
});

test('division CC mapping reaches off and each musical division monotonically', () => {
  const values = Array.from({ length: 128 }, (_, cc) => DIVISIONS[ccToValue(cc, 0, DIVISIONS.length - 1)]);
  assert.deepEqual([...new Set(values)], [0, 4, 8, 16, 32, 64]);
  assert.equal(values[0], 0);
  assert.equal(values[127], 64);
  assert.equal(divisionLabel(0), 'off · free');
  assert.equal(divisionLabel(16), '1/16');
});
test('edges reject flat fields and detect horizontal/vertical microscope boundaries', () => {
  const w = 12, h = 12;
  const flat = new Uint8ClampedArray(w * h * 4).fill(128);
  assert.equal(edgeIntensity(flat, w, h, 6, 6), 0);
  assert.equal(edgeIntensity(flat, w, h, 0, 0), 0);
  for (const horizontal of [false, true]) {
    const pixels = new Uint8ClampedArray(w * h * 4);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const v = (horizontal ? y : x) >= 6 ? 150 : 100;
      pixels.set([v, v, v, 255], (y * w + x) * 4);
    }
    const weak = edgeIntensity(pixels, w, h, 6, 6, 1);
    const amplified = edgeIntensity(pixels, w, h, 6, 6, 3);
    assert.ok(weak > 0 && amplified > weak && amplified <= 100);
    assert.equal(edgeIntensity(pixels, w, h, 1, 1, 3), 0);
    assert.equal(edgeIntensity(pixels, w, h, 6, 6, 8), 100);
  }
});
