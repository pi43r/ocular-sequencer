// ─── Brightness Detection ───────────────────────────────────────────────────
// Pure functions for threshold comparison with hysteresis.

/** Hysteresis offset — brightness units the effective threshold shifts
 *  to make it easier to STAY triggered than to BECOME triggered. */
const HYSTERESIS = 15;

/** Minimum time (ms) a trigger is held after the last raw detection,
 *  to prevent flicker/jitter. */
export const HOLD_MS = 100;

/** Brightness range (0–255) used for proximity normalization. */
const BRIGHTNESS_RANGE = 255;

/** Zone (in brightness units) considered "approaching" the threshold. */
export const APPROACH_ZONE = 25;

/**
 * Check whether a pixel brightness value crosses the threshold for the given mode.
 *
 * Hysteresis: once a point is "on", the effective threshold relaxes by
 * HYSTERESIS units so small brightness wobbles don't cause rapid toggling.
 *
 * @param {number} brightness — 0–255 average of R,G,B
 * @param {number} threshold  — user-set threshold 0–255
 * @param {'bright'|'dark'} mode
 * @param {boolean} wasActive — was this point triggered last frame?
 * @returns {boolean}
 */
export function isOverThreshold(brightness, threshold, mode, wasActive) {
  let effective = threshold;

  if (mode === 'bright') {
    // Trigger when brightness > threshold.
    // Active:  lower threshold (easier to stay on)
    // Inactive: raise threshold (harder to turn on)
    effective += wasActive ? -HYSTERESIS : HYSTERESIS;
    return brightness > effective;
  } else {
    // Dark mode: trigger when brightness < threshold.
    // Active:  raise threshold (easier to stay on)
    // Inactive: lower threshold (harder to turn on)
    effective += wasActive ? HYSTERESIS : -HYSTERESIS;
    return brightness < effective;
  }
}

/**
 * Normalized proximity to the threshold.
 *   0.0 = exactly at threshold
 *   positive = hasn't crossed yet (approaching from the "safe" side)
 *   negative = crossed (triggered side)
 *
 * @param {number} brightness
 * @param {number} threshold
 * @param {'bright'|'dark'} mode
 * @returns {number} range roughly -1..+1
 */
export function proximityToThreshold(brightness, threshold, mode) {
  if (mode === 'bright') {
    return (threshold - brightness) / BRIGHTNESS_RANGE;
  } else {
    return (brightness - threshold) / BRIGHTNESS_RANGE;
  }
}
