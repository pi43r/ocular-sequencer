// ─── p5.js Sketch ───────────────────────────────────────────────────────────
// Creates and returns the sketch function for the p5 instance.
// Separated from DOM wiring so main.js handles app init cleanly.

import { state, getNoteForRing } from './state.js';
import { sendNoteOn, sendNoteOff } from './midi.js';
import { isOverThreshold, proximityToThreshold, HOLD_MS, APPROACH_ZONE } from './detection.js';
import { drawSamplePoint, drawRadarLine, drawLegend } from './draw.js';

/**
 * Build the p5 sketch closure.
 * All external dependencies (state, MIDI, drawing) are imported at module level.
 */
export function createSketch() {
  return (p) => {
    let capture;   // webcam feed
    let pg;        // offscreen buffer (circular clip + CSS filters)
    let angle = 0; // radar angle in radians

    // Per-ring tracking
    //   trackStates[i] = currently-sounding MIDI note number, or null
    //   ringStates[i]  = { active: bool, lastDetectMs: number, latched: bool }
    let trackStates = {};
    let ringStates = {};

    p.setup = () => {
      const canvas = p.createCanvas(p.windowWidth, p.windowHeight);
      canvas.parent('canvas-container');

      capture = p.createCapture(p.VIDEO);
      capture.size(640, 480);
      capture.hide();

      p.angleMode(p.RADIANS);
    };

    p.draw = () => {
      p.background(10, 10, 10); // solid dark background (no trail)

      if (!capture.loadedmetadata) return;

      // ── One-time offscreen buffer init ────────────────────────────────
      if (!pg) {
        pg = p.createGraphics(capture.width, capture.height);
        pg.pixelDensity(1);
        pg.elt.getContext('2d', { willReadFrequently: true });
      }

      const imgW = capture.width;
      const imgH = capture.height;
      const radius = Math.min(imgW, imgH) / 2;

      // ── Render webcam → offscreen buffer ──────────────────────────────
      pg.push();
      pg.clear();
      pg.translate(imgW / 2, imgH / 2);

      // Circular clip
      pg.drawingContext.beginPath();
      pg.drawingContext.arc(0, 0, radius, 0, Math.PI * 2);
      pg.drawingContext.clip();

      // Image filters
      pg.drawingContext.filter =
        `brightness(${state.imgBrightness}%) ` +
        `saturate(${state.imgSaturation}%) ` +
        `contrast(${state.imgContrast}%)`;

      // Mirror horizontally
      pg.scale(-1, 1);
      pg.imageMode(p.CENTER);
      pg.image(capture, 0, 0, imgW, imgH);
      pg.pop();

      pg.loadPixels();

      // ── Draw to main canvas ───────────────────────────────────────────
      p.push();
      p.translate(p.width / 2, p.height / 2);

      // Circular webcam image with subtle border
      p.imageMode(p.CENTER);
      p.image(pg, 0, 0);

      // Thin border ring around the circle
      p.noFill();
      p.stroke(255, 20);
      p.strokeWeight(1);
      p.circle(0, 0, radius * 2);

      // Radar line
      drawRadarLine(p, angle, radius);

      // ── Sample points ─────────────────────────────────────────────────
      const numVoices = Math.min(state.voices, 16);
      const mode = state.mode;
      const threshold = state.threshold;
      const holdNotes = state.holdNotes;
      const now = p.millis();

      for (let i = 1; i <= numVoices; i++) {
        const normalizedR = i / numVoices;
        const r = normalizedR * radius;
        const px = p.cos(angle) * r;
        const py = p.sin(angle) * r;

        // Map to offscreen buffer pixel coords
        const pgX = p.floor(px + imgW / 2);
        const pgY = p.floor(py + imgH / 2);

        let brightness = null;
        let detected = false;

        // ── 1. Sample pixel ──────────────────────────────────────────
        if (pgX >= 0 && pgX < imgW && pgY >= 0 && pgY < imgH) {
          const idx = (pgY * imgW + pgX) * 4;
          const rVal = pg.pixels[idx];
          const gVal = pg.pixels[idx + 1];
          const bVal = pg.pixels[idx + 2];
          const aVal = pg.pixels[idx + 3];

          if (aVal > 0) {
            brightness = (rVal + gVal + bVal) / 3;
          }
        }

        // ── 2. Hysteresis ────────────────────────────────────────────
        if (!ringStates[i]) ringStates[i] = {};
        const wasActive = ringStates[i].active || false;

        if (brightness !== null) {
          detected = isOverThreshold(brightness, threshold, mode, wasActive);
        }

        // ── 3. Min-hold debounce ─────────────────────────────────────
        if (detected) {
          ringStates[i].lastDetectMs = now;
        }

        const isTriggered =
          detected ||
          (ringStates[i].lastDetectMs != null &&
            now - ringStates[i].lastDetectMs < HOLD_MS);

        // ── 4. Visual state ──────────────────────────────────────────
        const note = getNoteForRing(normalizedR);
        const prox =
          brightness !== null
            ? proximityToThreshold(brightness, threshold, mode)
            : 1.0;

        const isApproaching =
          !isTriggered &&
          brightness !== null &&
          Math.abs(prox) * 255 < APPROACH_ZONE;

        drawSamplePoint(p, px, py, {
          triggered: isTriggered,
          approaching: isApproaching,
          note,
          brightness,
        });

        // ── 5. MIDI state machine ────────────────────────────────────
        if (holdNotes) {
          // HOLD: note sustains until the next trigger on this ring.
          if (isTriggered && !ringStates[i].latched) {
            if (trackStates[i]) sendNoteOff(trackStates[i]);
            sendNoteOn(note);
            trackStates[i] = note;
            ringStates[i].latched = true;
          } else if (!isTriggered) {
            ringStates[i].latched = false;
          }
        } else {
          // GATE: note plays only while the point is over a blob.
          if (isTriggered) {
            if (!trackStates[i]) {
              sendNoteOn(note);
              trackStates[i] = note;
            }
          } else {
            if (trackStates[i]) {
              sendNoteOff(trackStates[i]);
              trackStates[i] = null;
            }
          }
        }

        // Persist active state for next frame's hysteresis
        ringStates[i].active = isTriggered;
      }

      p.pop();

      // ── Legend ───────────────────────────────────────────────────────
      drawLegend(p);

      // ── Update angle (1 rotation = 4 beats at BPM) ───────────────────
      const rps = state.speedBpm / 240; // rotations per second
      angle += rps * p.TWO_PI * (p.deltaTime / 1000);
    };

    p.windowResized = () => {
      p.resizeCanvas(p.windowWidth, p.windowHeight);
    };
  };
}
