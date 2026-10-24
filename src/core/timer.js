// @ts-check
// The sleep timer: play for a while, then fade out gently instead of stopping dead.

/** Minutes offered in the timer menu; 0 means off. */
export const SLEEP_OPTIONS = Object.freeze([0, 15, 30, 45, 60, 90]);

/** How long the fade at the end lasts. */
export const FADE_MS = 60_000;

/**
 * Volume multiplier for the time left: 1 until the fade starts, then an eased
 * curve down to 0, so the last minute drifts away rather than dropping off.
 * @param {number} remainingMs
 * @param {number} [fadeMs]
 */
export function fadeGain(remainingMs, fadeMs = FADE_MS) {
  if (!(remainingMs > 0)) return 0;
  if (remainingMs >= fadeMs) return 1;
  const t = remainingMs / fadeMs;
  return t * t * (3 - 2 * t);
}

/**
 * "29:59", or "1:05:00" for timers over an hour. Rounds up, so the display
 * never shows 0:00 while sound is still playing.
 * @param {number} remainingMs
 */
export function formatRemaining(remainingMs) {
  const total = Math.max(0, Math.ceil(remainingMs / 1000));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = String(total % 60).padStart(2, "0");
  return hours > 0 ? `${hours}:${String(minutes).padStart(2, "0")}:${seconds}` : `${minutes}:${seconds}`;
}

/**
 * A timer that knows when it ends. Time is passed in, which keeps it testable.
 * @param {number} minutes
 * @param {number} now
 */
export function createSleepTimer(minutes, now) {
  const endsAt = now + minutes * 60_000;
  return {
    minutes,
    endsAt,
    /** @param {number} t */
    remaining: (t) => Math.max(0, endsAt - t),
    /** @param {number} t */
    gain: (t) => fadeGain(endsAt - t),
    /** @param {number} t */
    done: (t) => t >= endsAt,
  };
}
