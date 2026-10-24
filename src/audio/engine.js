// Owns the AudioContext: builds the noise, the reverb and the eight voices, mixes
// them, and keeps their events booked ahead on the audio clock.

import { CHANNEL_IDS, levelToGain } from "../core/mix.js";
import { fillBrown, fillPink, fillWhite, impulseResponse } from "../core/noise.js";
import { createRng } from "../core/random.js";
import { LOOKAHEAD } from "../core/schedule.js";
import { VOICES } from "./voices.js";

/** @typedef {import("../core/mix.js").Mix} Mix */
/** @typedef {import("../core/mix.js").ChannelId} ChannelId */

/**
 * Per-voice trims so every slider at the same position sounds about as loud.
 * Measured by rendering each voice offline and matching their loudness.
 * @type {Record<ChannelId, number>}
 */
export const TRIMS = {
  rain: 0.78,
  thunder: 1.2,
  wind: 1.1,
  waves: 0.84,
  fire: 0.74,
  crickets: 0.42,
  birds: 1.05,
  keys: 1.1,
};

const NOISE_SECONDS = 8;
const TICK_MS = 250;

/**
 * @param {BaseAudioContext} ac
 * @param {(out: Float32Array, rng: () => number) => Float32Array} fill
 * @param {number} seed
 */
function noiseBuffer(ac, fill, seed) {
  const length = Math.floor(ac.sampleRate * NOISE_SECONDS);
  const buffer = ac.createBuffer(2, length, ac.sampleRate);
  // Different noise in each ear makes the sound wide instead of coming from the middle.
  for (let ch = 0; ch < 2; ch++)
    buffer.copyToChannel(fill(new Float32Array(length), createRng(seed + ch)), ch);
  return buffer;
}

/** @param {BaseAudioContext} ac */
function reverbBuffer(ac) {
  const length = Math.floor(ac.sampleRate * 3.5);
  const buffer = ac.createBuffer(2, length, ac.sampleRate);
  for (let ch = 0; ch < 2; ch++) buffer.copyToChannel(impulseResponse(length, 3, createRng(90 + ch)), ch);
  return buffer;
}

export class SoundEngine {
  /**
   * @param {{
   *   onFlash?: (e: { time: number, intensity: number }) => void,
   *   onNote?: (e: { time: number, pitch: number }) => void,
   *   seed?: number,
   * }} [options]
   */
  constructor({ onFlash = () => {}, onNote = () => {}, seed = Date.now() } = {}) {
    this.onFlash = onFlash;
    this.onNote = onNote;
    this.seed = seed;
    /** @type {BaseAudioContext | null} */
    this.ac = null;
    /** @type {Partial<Record<ChannelId, { voice: import("./voices.js").Voice, gain: GainNode }>>} */
    this.channels = {};
    /** @type {ReturnType<typeof setInterval> | undefined} */
    this.timer = undefined;
    this.outputGain = 1;
  }

  get playing() {
    return this.ac instanceof AudioContext && this.ac.state === "running";
  }

  /**
   * Builds the graph on a context. Called with a live AudioContext from a click,
   * or with an OfflineAudioContext to render a mix for testing.
   * @param {BaseAudioContext} ac
   */
  build(ac) {
    this.ac = ac;
    const rng = createRng(this.seed);
    const buffers = {
      white: noiseBuffer(ac, fillWhite, this.seed + 1),
      pink: noiseBuffer(ac, fillPink, this.seed + 3),
      brown: noiseBuffer(ac, fillBrown, this.seed + 5),
    };

    this.master = ac.createGain();
    this.fade = ac.createGain();
    const limiter = ac.createDynamicsCompressor();
    limiter.threshold.value = -16;
    limiter.knee.value = 12;
    limiter.ratio.value = 3;
    this.master.connect(limiter).connect(this.fade).connect(ac.destination);

    const reverb = ac.createConvolver();
    reverb.buffer = reverbBuffer(ac);
    const send = ac.createGain();
    const wet = ac.createGain();
    wet.gain.value = 0.35;
    send.connect(reverb).connect(wet).connect(this.master);

    const env = {
      ac,
      buffers,
      reverb: send,
      rng,
      // Events are booked ahead, so tell the page when they actually happen.
      onFlash: (/** @type {{ time: number, intensity: number }} */ e) =>
        this.at(e.time, () => this.onFlash(e)),
      onNote: (/** @type {{ time: number, pitch: number }} */ e) => this.at(e.time, () => this.onNote(e)),
    };
    for (const id of CHANNEL_IDS) {
      const voice = VOICES[id](env);
      const gain = ac.createGain();
      gain.gain.value = 0;
      voice.output.connect(gain).connect(this.master);
      this.channels[id] = { voice, gain };
    }
    return this;
  }

  /** Run `fn` when the audio clock reaches `time`. */
  at(/** @type {number} */ time, /** @type {() => void} */ fn) {
    if (!this.ac) return;
    setTimeout(fn, Math.max(0, (time - this.ac.currentTime) * 1000));
  }

  /** Book upcoming events for every audible voice. */
  tick(horizon = LOOKAHEAD) {
    if (!this.ac) return;
    const now = this.ac.currentTime;
    for (const id of CHANNEL_IDS) this.channels[id]?.voice.tick(now, horizon);
  }

  /**
   * Start or resume. Must be called from a user gesture the first time.
   * @param {Mix} mix
   */
  async play(mix) {
    if (!this.ac) this.build(new AudioContext({ latencyHint: "playback" }));
    this.setMix(mix, 0);
    if (this.ac instanceof AudioContext) await this.ac.resume();
    this.tick();
    clearInterval(this.timer);
    this.timer = setInterval(() => this.tick(), TICK_MS);
  }

  async pause() {
    clearInterval(this.timer);
    if (this.ac instanceof AudioContext) await this.ac.suspend();
  }

  /**
   * @param {Mix} mix
   * @param {number} [smoothing] seconds; sliders glide instead of clicking
   */
  setMix(mix, smoothing = 0.15) {
    if (!this.ac || !this.master) return;
    const now = this.ac.currentTime;
    for (const id of CHANNEL_IDS) {
      const channel = this.channels[id];
      if (!channel) continue;
      const level = mix.levels[id];
      channel.voice.setLevel(level);
      const target = levelToGain(level) * TRIMS[id];
      if (smoothing > 0) channel.gain.gain.setTargetAtTime(target, now, smoothing);
      else channel.gain.gain.setValueAtTime(target, now);
    }
    const master = levelToGain(mix.master);
    if (smoothing > 0) this.master.gain.setTargetAtTime(master, now, smoothing);
    else this.master.gain.setValueAtTime(master, now);
  }

  /** The sleep timer's fade, applied after everything else. @param {number} value */
  setFade(value) {
    if (!this.ac || !this.fade) return;
    this.fade.gain.setTargetAtTime(value, this.ac.currentTime, 0.5);
  }
}
