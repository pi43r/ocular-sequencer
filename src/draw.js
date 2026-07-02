// ─── Visual Rendering ───────────────────────────────────────────────────────
// Draws sample point glyphs, the radar line, and the on-canvas legend.
// All functions receive the p5 instance as their first argument.

import { midiToNoteName } from './scales.js';
import { APPROACH_ZONE } from './detection.js';
import { state } from './state.js';

// ─── Glyphs ─────────────────────────────────────────────────────────────────
// Unicode glyphs for each sample-point state.
const GLYPHS = {
  triggered:   '◆', // U+25C6 black diamond
  approaching: '◈', // U+25C8 diamond with dot
  far:         '·', // U+00B7 middle dot
};

// Brightness readout shown near each sample point.
function drawBrightnessLabel(p, px, py, brightness, colorAlpha) {
  if (brightness === null) return;
  p.fill(255, colorAlpha);
  p.textSize(9);
  p.textAlign(p.CENTER, p.CENTER);
  p.text(`${Math.round(brightness)}`, px, py);
}

// ─── Sample Point ───────────────────────────────────────────────────────────

/**
 * Draw a single sample point on the radar line using glyph markers.
 *
 * Three visual states:
 *   triggered   — ◆ (white, large) — MIDI is firing
 *   approaching — ◈ (gray, medium) — close to threshold, about to fire
 *   far         — · (dim, tiny)    — well outside trigger range
 */
export function drawSamplePoint(p, px, py, opts) {
  const { triggered, approaching, note, brightness } = opts;

  if (triggered) {
    // ── Triggered ──────────────────────────────────────────────────────
    // Large white diamond with glow
    p.noStroke();
    p.fill(255, 255, 255, 40);
    p.textSize(32);
    p.textAlign(p.CENTER, p.CENTER);
    p.text(GLYPHS.triggered, px, py);

    // Solid diamond on top
    p.fill(255);
    p.textSize(20);
    p.text(GLYPHS.triggered, px, py);

    // Accent line from center toward point
    p.stroke(255, 40);
    p.strokeWeight(1);
    p.line(px * 0.8, py * 0.8, px, py);

    // Note name above
    p.noStroke();
    p.fill(255);
    p.textSize(13);
    p.textAlign(p.CENTER, p.BOTTOM);
    p.text(midiToNoteName(note), px, py - 22);

    // Brightness readout below
    drawBrightnessLabel(p, px, py - 8, brightness, 180);
  } else if (approaching) {
    // ── Approaching ────────────────────────────────────────────────────
    p.noStroke();
    p.fill(170);
    p.textSize(16);
    p.textAlign(p.CENTER, p.CENTER);
    p.text(GLYPHS.approaching, px, py);

    drawBrightnessLabel(p, px, py - 13, brightness, 180);
  } else {
    // ── Far ────────────────────────────────────────────────────────────
    p.noStroke();
    p.fill(85);
    p.textSize(10);
    p.textAlign(p.CENTER, p.CENTER);
    p.text(GLYPHS.far, px, py);

    drawBrightnessLabel(p, px, py - 9, brightness, 60);
  }
}

// ─── Radar Line ─────────────────────────────────────────────────────────────

export function drawRadarLine(p, angle, radius) {
  p.stroke(255, 60);
  p.strokeWeight(1);
  const ex = p.cos(angle) * radius;
  const ey = p.sin(angle) * radius;
  p.line(0, 0, ex, ey);

  // Small dot at the tip
  p.noStroke();
  p.fill(255, 100);
  p.circle(ex, ey, 4);
}

// ─── Legend ─────────────────────────────────────────────────────────────────

export function drawLegend(p) {
  const margin = 16;
  const x = margin;
  const y = p.height - 95;
  const lineH = 16;

  // Background panel
  p.noStroke();
  p.fill(10, 180);
  p.rect(x - 6, y - 28, 175, 80, 2);

  p.textSize(10);
  p.textAlign(p.LEFT, p.CENTER);

  // Triggered
  p.fill(255);
  p.textSize(14);
  p.text(GLYPHS.triggered, x + 4, y - 14);
  p.textSize(10);
  p.text('triggered', x + 22, y - 14);

  // Approaching
  p.fill(170);
  p.textSize(12);
  p.text(GLYPHS.approaching, x + 4, y + lineH - 14);
  p.fill(255);
  p.textSize(10);
  p.text('approaching', x + 22, y + lineH - 14);

  // Far
  p.fill(85);
  p.textSize(10);
  p.text(GLYPHS.far, x + 5, y + lineH * 2 - 14);
  p.fill(255);
  p.textSize(10);
  p.text('inactive', x + 22, y + lineH * 2 - 14);

  // Threshold readout
  p.fill(255, 120);
  p.textSize(9);
  p.text(`threshold: ${state.threshold}`, x + 4, y + lineH * 3 - 12);
}
