export const DIVISIONS = [0, 4, 8, 16, 32, 64];
export const divisionLabel = steps => steps ? `1/${steps}` : 'off · free';

// Evenly distribute a repeatable number of pulses across each bar.
export function isPulse(step, steps, density) {
  const pulses = Math.round(steps * density / 100);
  return pulses > 0 && ((step % steps) * pulses) % steps < pulses;
}

export function radarLayout(width, height, panelOpen) {
  const sidePanel = panelOpen && width > 800;
  const bottomPanel = panelOpen && width <= 800;
  const areaWidth = sidePanel ? width - 310 : width;
  const areaHeight = bottomPanel ? height * 0.52 : height;
  return {
    x: areaWidth / 2,
    y: areaHeight / 2,
    radius: Math.max(24, Math.min(areaWidth * 0.4, areaHeight * 0.4 - 12)),
  };
}

export const PRESETS = {
  drift: { scale: 'Pentatonic Minor', speedBpm: 72, steps: 8, voices: 5, gate: 90, dynamics: 75, density: 50, curve: -0.25, rangeLow: 45, rangeHigh: 100, mode: 'bright' },
  pulse: { scale: 'Dorian', speedBpm: 112, steps: 16, voices: 6, gate: 40, dynamics: 45, density: 75, curve: 0, rangeLow: 55, rangeHigh: 100, mode: 'bright' },
  shadows: { scale: 'Pentatonic Major', speedBpm: 88, steps: 16, voices: 8, gate: 65, dynamics: 85, density: 38, curve: 0.3, rangeLow: 60, rangeHigh: 100, mode: 'dark' },
};
