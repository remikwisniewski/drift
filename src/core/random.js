// @ts-check
// Seeded randomness, so noise, scenery and event timing can be reproduced in tests.

/**
 * Mulberry32: a tiny, fast 32-bit generator with good statistical quality.
 * @param {number} seed
 * @returns {() => number} Uniform numbers in [0, 1).
 */
export function createRng(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * @param {() => number} rng
 * @param {number} min
 * @param {number} max
 */
export const between = (rng, min, max) => min + (max - min) * rng();

/**
 * @template T
 * @param {() => number} rng
 * @param {readonly T[]} items
 * @returns {T}
 */
export const pick = (rng, items) => items[Math.floor(rng() * items.length) % items.length];

/**
 * Seconds until the next event of a Poisson process, e.g. raindrops or crackles
 * that arrive at random but average `ratePerSecond`.
 * @param {() => number} rng
 * @param {number} ratePerSecond
 * @returns {number} Infinity when the rate is zero.
 */
export function poissonGap(rng, ratePerSecond) {
  if (!(ratePerSecond > 0)) return Infinity;
  return -Math.log(1 - rng()) / ratePerSecond;
}
