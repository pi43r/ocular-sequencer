import { state, getNoteForRing, applyCurve } from './state.js';
import { midiToNoteName } from './scales.js';
import { sendNoteOn, sendNoteOff, panic } from './midi.js';
import { intensity, edgeIntensity, inRange, velocityFor } from './detection.js';
import { drawSamplePoint, drawPin, drawRadarLine, drawRadarFace } from './draw.js';

import { isPulse, radarLayout } from './performance.js';

export function createSketch() {
  return p => {
    let capture, pg, phase = 0, lastStep = -1, signature = '', restart = state.restart;
    let pins = [], active = [], started = [], releases = new Map();
    const reset = () => { panic(); releases.clear(); active = []; started = []; lastStep = -1; pins = []; };
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) { state.playing = false; reset(); document.dispatchEvent(new Event('transportchange')); }
    });
    window.addEventListener('pagehide', reset);
    p.setup = () => {
      p.createCanvas(p.windowWidth, p.windowHeight).parent('canvas-container');
      p.textFont('JetBrains Mono, monospace');
      capture = p.createCapture(p.VIDEO, () => { document.getElementById('camera-status').textContent = ''; });
      capture.size(640, 480); capture.hide();
    };
    p.draw = () => {
      p.background(10);
      const now = performance.now();
      if (restart !== state.restart) { reset(); phase = 0; restart = state.restart; }
      const nextSignature = [state.playing, state.scale, state.rootNote, state.rootOctave, state.voices, state.midiChannel, state.mode, state.steps].join(':');
      if (signature !== nextSignature) { reset(); signature = nextSignature; }
      for (const [note, end] of releases) {
        if (now >= end) { sendNoteOff(note, state.midiChannel); releases.delete(note); }
      }
      if (!capture.loadedmetadata) return;
      if (!pg) { pg = p.createGraphics(640, 480); pg.pixelDensity(1); }
      // Freezing retains the exact same pixels for both viewing and sequencing.
      if (!state.frozen || !pg.pixels.length) {
        pg.push(); pg.translate(640, 0); pg.scale(-1, 1); pg.image(capture, 0, 0, 640, 480); pg.pop(); pg.loadPixels();
      }
      const { x: centerX, y: centerY, radius } = radarLayout(p.width, p.height, state.panelOpen);
      const angle = phase * Math.PI * 2 - Math.PI / 2;
      const cos = Math.cos(angle), sin = Math.sin(angle);
      const free = state.steps === 0;
      const step = Math.floor(phase * state.steps);
      const tick = state.playing && (free || step !== lastStep);
      const pulse = free || isPulse(step, state.steps, state.density);
      if (tick) lastStep = step;
      p.push(); p.translate(centerX, centerY);
      p.drawingContext.save(); p.drawingContext.beginPath(); p.drawingContext.arc(0, 0, radius, 0, Math.PI * 2); p.drawingContext.clip();
      p.imageMode(p.CENTER); p.image(pg, 0, 0, radius * 2 * 640 / 480, radius * 2);
      // Visual dimming never alters the luminance used for note detection.
      p.noStroke(); p.fill(10, 255 * (1 - state.imageLevel / 100)); p.circle(0, 0, radius * 2);
      p.drawingContext.restore();
      drawRadarFace(p, radius, phase, state);
      drawRadarLine(p, cos, sin, radius);
      for (let i = 0; i < state.voices; i++) {
        const t = 0.06 + applyCurve((i + 0.5) / state.voices, state.curve) * 0.9;
        const x = Math.floor(320 + cos * t * 240), y = Math.floor(240 + sin * t * 240);
        const idx = (y * 640 + x) * 4;
        const value = state.mode === 'edges'
          ? edgeIntensity(pg.pixels, 640, 480, x, y, state.edgeGain)
          : intensity(pg.pixels[idx], pg.pixels[idx + 1], pg.pixels[idx + 2], state.mode);
        const raw = inRange(value, state.rangeLow, state.rangeHigh, active[i]);
        const detected = raw || (free && active[i] && now - started[i] < 100);
        drawSamplePoint(p, cos * t * radius, sin * t * radius, detected);
        if (tick) {
          const entering = detected && (!active[i] || !pins[i]);
          if (free && active[i] && !detected) sendNoteOff(getNoteForRing(i), state.midiChannel);
          active[i] = detected;
          if (entering && !pulse) pins[i] = null;
          if (detected && pulse && (!free || entering)) {
            const note = getNoteForRing(i);
            sendNoteOn(note, velocityFor(value, state.rangeLow, state.rangeHigh, state.dynamics), state.midiChannel);
            started[i] = now;
            if (!free) {
              const stepMs = 240000 / state.speedBpm / state.steps;
              releases.set(note, now + stepMs * state.gate / 100);
            }
            if (entering) pins[i] = { angle, t, note, time: now, releasedAt: now, life: 1200 };
            if (pins[i]) pins[i].releasedAt = now;
            state.recentNotes.push({ name: midiToNoteName(note), time: now });
          }
        }
        if (pins[i] && active[i] && detected) pins[i].releasedAt = now;
      }
      for (const pin of pins) {
        if (pin && now - pin.releasedAt < pin.life) drawPin(p, pin, radius, now, state.showLabels);
      }
      state.recentNotes = state.recentNotes.slice(-24);
      p.pop();
      if (state.playing) phase += state.speedBpm / 240 * Math.min(p.deltaTime, 100) / 1000;
    };
    p.windowResized = () => p.resizeCanvas(p.windowWidth, p.windowHeight);
  };
}
