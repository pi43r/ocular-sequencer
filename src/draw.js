// ─── Visual Rendering ───────────────────────────────────────────────────────
// All drawing uses p5 primitives (no text glyphs) for pixel-perfect alignment.

import { midiToNoteName } from "./scales.js";

// ─── Shape helpers ──────────────────────────────────────────────────────────

/** Filled diamond centered at (x, y). */
function diamond(p, x, y, size) {
  p.quad(x, y - size, x + size, y, x, y + size, x - size, y);
}

// ─── Sample Point ───────────────────────────────────────────────────────────

export function drawSamplePoint(p, px, py, opts) {
  const { triggered, approaching, note, brightness } = opts;

  if (triggered) {
    // Glow
    p.noStroke();
    p.fill(255, 25);
    p.circle(px, py, 28);

    // Solid diamond
    p.fill(255);
    diamond(p, px, py, 5);

    // Accent line from center
    p.stroke(255, 25);
    p.strokeWeight(1);
    p.line(px * 0.82, py * 0.82, px, py);
    p.noStroke();

    // ── Note label with dark pill background ─────────────────────────
    const label = midiToNoteName(note);
    p.textSize(10);
    const tw = p.textWidth(label);
    const lx = px + 14;
    const ly = py;

    p.fill(0, 170);
    p.rect(lx - 2, ly - 7, tw + 8, 14);

    p.fill(255);
    p.textAlign(p.LEFT, p.CENTER);
    p.text(label, lx + 2, py);

    // Brightness
    if (brightness !== null) {
      p.fill(255, 100);
      p.textSize(8);
      p.textAlign(p.CENTER, p.TOP);
      p.text(`${Math.round(brightness)}`, px, py + 13);
    }
  } else if (approaching) {
    p.noStroke();
    p.fill(170);
    diamond(p, px, py, 3);

    if (brightness !== null) {
      p.fill(170, 160);
      p.textSize(9);
      p.textAlign(p.CENTER, p.BOTTOM);
      p.text(`${Math.round(brightness)}`, px, py - 11);
    }
  } else {
    p.noStroke();
    p.fill(85);
    p.circle(px, py, 3);

    if (brightness !== null) {
      p.fill(85);
      p.textSize(8);
      p.textAlign(p.CENTER, p.BOTTOM);
      p.text(`${Math.round(brightness)}`, px, py - 8);
    }
  }
}

// ─── Radar Line ─────────────────────────────────────────────────────────────

export function drawRadarLine(p, cosA, sinA, radius) {
  const ex = cosA * radius;
  const ey = sinA * radius;

  p.stroke(255, 50);
  p.strokeWeight(1);
  p.line(0, 0, ex, ey);

  p.noStroke();
  p.fill(255, 80);
  p.circle(ex, ey, 4);
}
