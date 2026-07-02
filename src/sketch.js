// ─── p5.js Sketch ───────────────────────────────────────────────────────────

import { state, getNoteForRing, applyCurve } from "./state.js";
import { midiToNoteName } from "./scales.js";
import { sendNoteOn, sendNoteOff } from "./midi.js";
import {
  isOverThreshold,
  proximityToThreshold,
  HOLD_MS,
  APPROACH_ZONE,
} from "./detection.js";
import { drawSamplePoint, drawRadarLine } from "./draw.js";

const CIRCLE_SCALE = 0.8;

export function createSketch() {
  return (p) => {
    let capture;
    let pg;
    let angle = 0;
    let cosA = 1;
    let sinA = 0;

    let trackStates = {};
    let ringStates = {};
    let trails = {};
    let heldPins = {}; // fixed markers for hold mode

    p.setup = () => {
      const canvas = p.createCanvas(p.windowWidth, p.windowHeight);
      canvas.parent("canvas-container");
      p.textFont('"JetBrains Mono", "Fira Code", "Cascadia Code", monospace');

      capture = p.createCapture(p.VIDEO);
      capture.size(640, 480);
      capture.hide();

      p.angleMode(p.RADIANS);
    };

    p.draw = () => {
      p.background(10, 10, 10);

      if (!capture.loadedmetadata) return;

      // ── Init offscreen buffer ────────────────────────────────────────
      if (!pg) {
        pg = p.createGraphics(capture.width, capture.height);
        pg.pixelDensity(1);
        pg.elt.getContext("2d", { willReadFrequently: true });
      }

      const imgW = capture.width;
      const imgH = capture.height;
      const pgRadius = Math.min(imgW, imgH) / 2;

      const maxDim = Math.min(p.width, p.height);
      const displayRadius = (maxDim * CIRCLE_SCALE) / 2;
      const scale = displayRadius / pgRadius;

      // ── Pre-compute trig ─────────────────────────────────────────────
      cosA = p.cos(angle);
      sinA = p.sin(angle);

      // ── Render webcam → offscreen buffer ─────────────────────────────
      pg.push();
      pg.clear();
      pg.translate(imgW / 2, imgH / 2);
      pg.drawingContext.beginPath();
      pg.drawingContext.arc(0, 0, pgRadius, 0, Math.PI * 2);
      pg.drawingContext.clip();
      pg.drawingContext.filter =
        `brightness(${state.imgBrightness}%) ` +
        `saturate(${state.imgSaturation}%) ` +
        `contrast(${state.imgContrast}%)`;
      pg.scale(-1, 1);
      pg.imageMode(p.CENTER);
      pg.image(capture, 0, 0, imgW, imgH);
      pg.pop();
      pg.loadPixels();

      // ── Main canvas ─────────────────────────────────────────────────
      p.push();
      p.translate(p.width / 2, p.height / 2);

      // Clip to a perfect circle so no anti-aliased fringe escapes
      p.drawingContext.save();
      p.drawingContext.beginPath();
      p.drawingContext.arc(0, 0, displayRadius, 0, Math.PI * 2);
      p.drawingContext.clip();

      p.imageMode(p.CENTER);
      p.image(pg, 0, 0, imgW * scale, imgH * scale);

      p.drawingContext.restore();

      // Outline — two strokes that sandwich the circle edge perfectly
      p.noFill();
      p.stroke(10, 10, 10, 220);
      p.strokeWeight(2);
      p.circle(0, 0, displayRadius * 2);
      p.stroke(255, 45);
      p.strokeWeight(1);
      p.circle(0, 0, displayRadius * 2);

      // Radar
      drawRadarLine(p, cosA, sinA, displayRadius);

      // ── Sample points ───────────────────────────────────────────────
      const mode = state.mode;
      const threshold = state.threshold;
      const holdNotes = state.holdNotes;
      const curve = state.curve;
      const numVoices = state.voices;
      const now = p.millis();

      if (!holdNotes) heldPins = {}; // clear pins when gating

      for (let i = 1; i <= numVoices; i++) {
        const linearT = i / numVoices;
        const curvedT = applyCurve(linearT, curve);
        const r = curvedT * displayRadius;
        const px = cosA * r;
        const py = sinA * r;

        const pgX = Math.floor(px / scale + imgW / 2);
        const pgY = Math.floor(py / scale + imgH / 2);

        let brightness = null;
        let detected = false;

        if (pgX >= 0 && pgX < imgW && pgY >= 0 && pgY < imgH) {
          const idx = (pgY * imgW + pgX) * 4;
          const aVal = pg.pixels[idx + 3];
          if (aVal > 0) {
            brightness =
              (pg.pixels[idx] + pg.pixels[idx + 1] + pg.pixels[idx + 2]) / 3;
          }
        }

        if (!ringStates[i]) ringStates[i] = {};
        const wasActive = ringStates[i].active || false;

        if (brightness !== null) {
          detected = isOverThreshold(brightness, threshold, mode, wasActive);
        }

        if (detected) ringStates[i].lastDetectMs = now;

        const isTriggered =
          detected ||
          (ringStates[i].lastDetectMs != null &&
            now - ringStates[i].lastDetectMs < HOLD_MS);

        const note = getNoteForRing(curvedT);
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

        // ── Ghost trails (diamonds, mode-aware color) ──────────────
        const rotTimeMs = (240 / state.speedBpm) * 1000;
        const trailMs = Math.max(1000, rotTimeMs * 2);
        const trailGray = mode === "dark" ? 200 : 140; // darker trail in bright mode for contrast
        if (trails[i]) {
          for (let t = trails[i].length - 1; t >= 0; t--) {
            const tp = trails[i][t];
            const age = now - tp.time;
            if (age > trailMs) {
              trails[i].splice(t, 1);
              continue;
            }
            const a = 1 - age / trailMs;
            const alpha = a * a * 0.45;
            const tcos = Math.cos(tp.angle);
            const tsin = Math.sin(tp.angle);
            const tx = tcos * r;
            const ty = tsin * r;
            const ds = 3 + a * 2.5;
            p.noStroke();
            p.fill(trailGray, alpha * 255);
            p.quad(tx, ty - ds, tx + ds, ty, tx, ty + ds, tx - ds, ty);
          }
        }
        if (detected) {
          if (!trails[i]) trails[i] = [];
          trails[i].push({ angle, time: now });
        }

        // ── MIDI + record ────────────────────────────────────────────
        if (holdNotes) {
          if (isTriggered && !ringStates[i].latched) {
            if (trackStates[i]) sendNoteOff(trackStates[i]);
            sendNoteOn(note);
            trackStates[i] = note;
            ringStates[i].latched = true;
            heldPins[i] = { r, angle, note }; // pin at trigger position
            recordTrigger(note);
          } else if (!isTriggered) {
            ringStates[i].latched = false;
          }
        } else {
          if (isTriggered) {
            if (!trackStates[i]) {
              sendNoteOn(note);
              trackStates[i] = note;
              recordTrigger(note);
            }
          } else {
            if (trackStates[i]) {
              sendNoteOff(trackStates[i]);
              trackStates[i] = null;
            }
          }
        }
        ringStates[i].active = isTriggered;
      }

      // ── Draw held-note pins (static markers on the circle) ──────────
      for (const pin of Object.values(heldPins)) {
        const ppx = Math.cos(pin.angle) * pin.r;
        const ppy = Math.sin(pin.angle) * pin.r;
        p.noStroke();
        p.fill(255, 40);
        p.circle(ppx, ppy, 16);
        p.fill(255, 160);
        const hs = 5;
        p.quad(ppx, ppy - hs, ppx + hs, ppy, ppx, ppy + hs, ppx - hs, ppy);
        const label = midiToNoteName(pin.note);
        p.fill(0, 180);
        const tw = p.textWidth(label);
        p.rect(ppx + 9, ppy - 7, tw + 8, 14);
        p.fill(255, 200);
        p.textSize(10);
        p.textAlign(p.LEFT, p.CENTER);
        p.text(label, ppx + 13, ppy);
      }

      p.pop();

      // ── Angle step ──────────────────────────────────────────────────
      const rps = state.speedBpm / 240;
      angle += rps * p.TWO_PI * (p.deltaTime / 1000);
    };

    p.windowResized = () => {
      p.resizeCanvas(p.windowWidth, p.windowHeight);
    };
  };
}

// ─── Piano-roll recording ───────────────────────────────────────────────────

function recordTrigger(midiNote) {
  state.recentNotes.push({
    name: midiToNoteName(midiNote),
    time: performance.now(),
  });
  if (state.recentNotes.length > 24) {
    state.recentNotes = state.recentNotes.slice(-24);
  }
}
