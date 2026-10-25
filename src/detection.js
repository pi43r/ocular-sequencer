// Perceptual luminance, normalized to a useful 0–100 intensity control.
export function intensity(r, g, b, mode) {
  const light = (2126 * r + 7152 * g + 722 * b) / 25500;
  return mode === 'dark' ? 100 - light : light;
}
export function inRange(value, low, high, active = false) {
  const margin = active ? 3 : 0;
  return value !== null && value >= low - margin && value <= high + margin;
}
export function velocityFor(value, low, high, dynamics) {
  const strength = Math.max(0, Math.min(1, (value - low) / Math.max(1, high - low)));
  return Math.round(100 + (35 + strength * 92 - 100) * dynamics / 100);
}
export function ccToValue(value, min, max, step = 1) {
  return Math.max(min, Math.min(max, min + Math.round((value / 127 * (max - min)) / step) * step));
}

// Local Sobel gradient: read only the neighborhoods of the sampling points.
// Two-pixel spacing catches microscope structure without a full-frame filter.
export function edgeIntensity(pixels, width, height, x, y, gain = 3) {
  const light = (dx, dy) => {
    const sx = Math.max(0, Math.min(width - 1, x + dx * 2));
    const sy = Math.max(0, Math.min(height - 1, y + dy * 2));
    const i = (sy * width + sx) * 4;
    return intensity(pixels[i], pixels[i + 1], pixels[i + 2], 'bright');
  };
  const a = light(-1, -1), b = light(0, -1), c = light(1, -1);
  const d = light(-1, 0), f = light(1, 0);
  const g = light(-1, 1), h = light(0, 1), i = light(1, 1);
  const gx = (c - a) + 2 * (f - d) + (i - g);
  const gy = (g - a) + 2 * (h - b) + (i - c);
  return Math.min(100, Math.hypot(gx, gy) / 4 * gain);
}
