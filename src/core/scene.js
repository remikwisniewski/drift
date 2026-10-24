// @ts-check
// Turns the mix into what the night scene should show, so what you hear and what
// you see always agree. Pure numbers; the canvas code only draws them.

/** @typedef {import("./mix.js").Levels} Levels */

/**
 * @typedef {object} SceneState
 * @property {number} dawn       0 = deep night, 1 = first light (birds bring the sunrise)
 * @property {number} cloud      how overcast it is
 * @property {number} stars      star visibility
 * @property {number} raindrops  rain streaks on screen
 * @property {number} ripples    rain ripples on the lake per second
 * @property {number} wind       sway of grass and drift of clouds
 * @property {number} waves      height of the swell on the lake
 * @property {number} fire       campfire size and glow
 * @property {number} fireflies  how many fireflies wander about
 * @property {number} aurora     soft light in the sky while keys play
 * @property {number} flashes    how bright lightning can get
 */

const MAX_RAINDROPS = 260;
const MAX_FIREFLIES = 28;

/**
 * @param {Levels} levels
 * @returns {SceneState}
 */
export function sceneFromLevels(levels) {
  const { rain, thunder, wind, waves, fire, crickets, birds, keys } = levels;
  const cloud = Math.min(1, Math.max(rain * 0.9, thunder));
  const dawn = birds * 0.85;
  return {
    dawn,
    cloud,
    stars: Math.max(0, 1 - cloud * 1.1) * (1 - dawn),
    raindrops: Math.round(rain * MAX_RAINDROPS),
    ripples: rain * 14,
    wind: Math.min(1, wind + thunder * 0.25),
    waves,
    fire,
    fireflies: Math.round(crickets * MAX_FIREFLIES * (1 - rain * 0.8)),
    aurora: keys * (1 - cloud * 0.7),
    flashes: thunder,
  };
}

/**
 * Linear blend between two colours given as [r, g, b].
 * @param {readonly number[]} a
 * @param {readonly number[]} b
 * @param {number} t
 */
export function mixColor(a, b, t) {
  const k = Math.min(1, Math.max(0, t));
  return `rgb(${a.map((v, i) => Math.round(v + (b[i] - v) * k)).join(", ")})`;
}
