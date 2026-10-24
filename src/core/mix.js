// @ts-check
// The mix: how loud each sound is. Everything else (audio, scene, URL, storage)
// is derived from this one small object.

import { between, pick } from "./random.js";

/** @typedef {"rain" | "thunder" | "wind" | "waves" | "fire" | "crickets" | "birds" | "keys"} ChannelId */
/** @typedef {{ id: ChannelId, label: string, hint: string }} Channel */
/** @typedef {Record<ChannelId, number>} Levels */
/** @typedef {{ levels: Levels, master: number }} Mix */
/** @typedef {{ id: string, name: string, levels: Partial<Levels> }} Preset */

/** @type {readonly Channel[]} */
export const CHANNELS = Object.freeze([
  { id: "rain", label: "Rain", hint: "Steady rain and drips" },
  { id: "thunder", label: "Thunder", hint: "Distant storms rolling in" },
  { id: "wind", label: "Wind", hint: "Gusts through the trees" },
  { id: "waves", label: "Waves", hint: "Surf on the shore" },
  { id: "fire", label: "Campfire", hint: "Crackling logs" },
  { id: "crickets", label: "Crickets", hint: "A warm summer night" },
  { id: "birds", label: "Birds", hint: "Early morning song" },
  { id: "keys", label: "Keys", hint: "Slow, soft piano notes" },
]);

/** @type {readonly ChannelId[]} */
export const CHANNEL_IDS = Object.freeze(CHANNELS.map((c) => c.id));

/** @type {readonly Preset[]} */
export const PRESETS = Object.freeze([
  { id: "rainy-night", name: "Rainy night", levels: { rain: 0.7, wind: 0.2, keys: 0.35 } },
  { id: "thunderstorm", name: "Thunderstorm", levels: { rain: 0.9, thunder: 0.75, wind: 0.45 } },
  { id: "campfire", name: "Campfire", levels: { fire: 0.75, crickets: 0.35, wind: 0.15 } },
  { id: "seaside", name: "Seaside", levels: { waves: 0.8, wind: 0.3, birds: 0.15 } },
  { id: "summer-night", name: "Summer night", levels: { crickets: 0.8, fire: 0.4, keys: 0.35 } },
  { id: "first-light", name: "First light", levels: { birds: 0.85, waves: 0.45, keys: 0.4 } },
]);

export const DEFAULT_MASTER = 0.8;

/** @param {number} value */
export const clampLevel = (value) => (Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0);

/** @returns {Levels} */
export function silentLevels() {
  return /** @type {Levels} */ (Object.fromEntries(CHANNEL_IDS.map((id) => [id, 0])));
}

/**
 * @param {Partial<Levels>} [levels]
 * @param {number} [master]
 * @returns {Mix}
 */
export function createMix(levels = {}, master = DEFAULT_MASTER) {
  const out = silentLevels();
  for (const id of CHANNEL_IDS) out[id] = clampLevel(levels[id] ?? 0);
  return { levels: out, master: clampLevel(master) };
}

/** The mix a first-time visitor hears. */
export const defaultMix = () => createMix(PRESETS[0].levels);

/**
 * @param {Mix} mix
 * @param {ChannelId} id
 * @param {number} level
 * @returns {Mix} A new mix; the old one is left untouched.
 */
export const withLevel = (mix, id, level) => ({
  ...mix,
  levels: { ...mix.levels, [id]: clampLevel(level) },
});

/**
 * @param {Mix} mix
 * @param {Preset} preset
 */
export const applyPreset = (mix, preset) => createMix(preset.levels, mix.master);

/**
 * Which preset, if any, the mix matches exactly (to two decimal places).
 * @param {Mix} mix
 * @returns {Preset | undefined}
 */
export function matchingPreset(mix) {
  const same = (/** @type {number} */ a, /** @type {number} */ b) =>
    Math.round(a * 100) === Math.round(b * 100);
  return PRESETS.find((preset) => CHANNEL_IDS.every((id) => same(mix.levels[id], preset.levels[id] ?? 0)));
}

/** @param {Mix} mix */
export const isSilent = (mix) => mix.master === 0 || CHANNEL_IDS.every((id) => mix.levels[id] === 0);

/**
 * Perceived loudness grows roughly with the square of the gain, so a squared
 * curve makes the middle of each slider feel like the middle.
 * @param {number} level
 */
export const levelToGain = (level) => clampLevel(level) ** 2;

/**
 * A random but pleasant mix: two to four sounds, never thunder without rain.
 * @param {() => number} rng
 * @param {number} [master]
 */
export function randomMix(rng, master = DEFAULT_MASTER) {
  const count = 2 + Math.floor(rng() * 3);
  const pool = [...CHANNEL_IDS];
  /** @type {Partial<Levels>} */
  const levels = {};
  while (Object.keys(levels).length < count) {
    const id = pick(rng, pool);
    pool.splice(pool.indexOf(id), 1);
    levels[id] = Math.round(between(rng, 0.25, 0.85) * 20) / 20;
  }
  if (levels.thunder && !levels.rain) levels.rain = Math.max(0.5, levels.thunder);
  return createMix(levels, master);
}

/**
 * A short, readable summary such as "Rain, wind and keys".
 * @param {Mix} mix
 */
export function describeMix(mix) {
  const names = CHANNELS.filter((c) => mix.levels[c.id] > 0).map((c) => c.label.toLowerCase());
  if (names.length === 0) return "Silence";
  const text = names.length === 1 ? names[0] : `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`;
  return text[0].toUpperCase() + text.slice(1);
}

/**
 * The mix as a short, shareable URL hash: "#rain=70&wind=20&master=80".
 * @param {Mix} mix
 */
export function encodeMix(mix) {
  const params = new URLSearchParams();
  for (const id of CHANNEL_IDS) {
    const percent = Math.round(mix.levels[id] * 100);
    if (percent > 0) params.set(id, String(percent));
  }
  params.set("master", String(Math.round(mix.master * 100)));
  return `#${params.toString()}`;
}

/**
 * Reads a hash made by encodeMix. Unknown keys and bad numbers are ignored, and
 * a hash with no sounds in it returns null so the caller can fall back.
 * @param {string} hash
 * @returns {Mix | null}
 */
export function decodeMix(hash) {
  const params = new URLSearchParams(hash.replace(/^#/, ""));
  /** @type {Partial<Levels>} */
  const levels = {};
  let found = false;
  for (const id of CHANNEL_IDS) {
    const raw = params.get(id);
    if (raw === null) continue;
    const value = Number(raw);
    if (!Number.isFinite(value)) continue;
    levels[id] = value / 100;
    found = found || value > 0;
  }
  if (!found) return null;
  const master = Number(params.get("master"));
  return createMix(levels, params.has("master") && Number.isFinite(master) ? master / 100 : DEFAULT_MASTER);
}
