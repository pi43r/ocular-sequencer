import { midiToNoteName } from './scales.js';
export function drawSamplePoint(p, x, y, approaching) {
  p.stroke(0, 150); p.strokeWeight(1); p.fill(255, approaching ? 170 : 75);
  if (approaching) p.quad(x, y - 2, x + 2, y, x, y + 2, x - 2, y);
  else p.circle(x, y, 3);
}
export function drawPin(p, pin, radius, now, showLabels = false) {
  const x = Math.cos(pin.angle) * pin.t * radius;
  const y = Math.sin(pin.angle) * pin.t * radius;
  const fade = Math.max(0, 1 - (now - pin.releasedAt) / pin.life);
  p.stroke(0, 180 * fade); p.strokeWeight(1); p.fill(255, 230 * fade);
  const size = 2 + 2 * fade;
  p.quad(x, y - size, x + size, y, x, y + size, x - size, y);
  // Only the initial attack has a label; the remaining memory is a tiny diamond.
  if (showLabels && now - pin.time < 350) {
    p.textSize(10); p.textAlign(p.LEFT, p.CENTER);
    const label = midiToNoteName(pin.note);
    const lx = x > radius - 45 ? x - p.textWidth(label) - 10 : x + 9;
    p.noStroke(); p.fill(10, 190); p.rect(lx - 3, y - 7, p.textWidth(label) + 6, 14, 3);
    p.fill(255, 230); p.text(label, lx, y);
  }
}
export function drawRadarLine(p, cos, sin, radius) {
  p.stroke(255, 95); p.strokeWeight(1); p.line(0, 0, cos * radius, sin * radius);
  p.noStroke(); p.fill(255, 160); p.circle(cos * radius, sin * radius, 3);
}


export function drawRadarFace(p, radius, phase, state) {
  p.noFill(); p.strokeWeight(1);
  p.stroke(255, 25); p.circle(0, 0, radius * 2);
  p.stroke(255, 12); p.circle(0, 0, radius); // quiet distance reference
  const rim = radius + 12;
  const current = state.steps ? Math.floor(phase * state.steps) % state.steps : 0;
  const pulses = Math.round(state.steps * state.density / 100);
  for (let i = 0; i < state.steps; i++) {
    const angle = i / state.steps * Math.PI * 2 - Math.PI / 2;
    const cos = Math.cos(angle), sin = Math.sin(angle);
    const enabled = pulses > 0 && (i * pulses) % state.steps < pulses;
    const beat = i % (state.steps / 4) === 0;
    p.stroke(255, state.playing && i === current ? 230 : enabled ? 95 : 25);
    p.line(cos * rim, sin * rim, cos * (rim + (beat ? 7 : 3)), sin * (rim + (beat ? 7 : 3)));
  }
  p.noStroke(); p.fill(255, 95); p.circle(0, 0, 3);
  p.textSize(9); p.textAlign(p.CENTER, p.CENTER); p.fill(255, 100);
  p.text(state.frozen ? 'still / looping' : 'live / camera', 0, -radius - 34);
  p.text(`${state.playing ? 'scan' : 'paused'}  /  ${state.steps ? `${String(current + 1).padStart(2, '0')} : ${state.steps}` : 'free'}`, 0, radius + 36);
}
