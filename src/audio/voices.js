// The eight sounds. Each voice builds a small Web Audio graph and, if it has
// one-off events (drops, crackles, chirps, notes), books them on the audio clock.
// Nothing here is a recording: every sound is noise or oscillators, shaped.

import { bookAhead } from "../core/schedule.js";
import { between, pick, poissonGap } from "../core/random.js";
import { ROOTS, midiToHz, nextStep, stepToMidi } from "../core/music.js";

/**
 * @typedef {object} Env
 * @property {BaseAudioContext} ac
 * @property {{ white: AudioBuffer, pink: AudioBuffer, brown: AudioBuffer }} buffers
 * @property {AudioNode} reverb   send bus into the shared reverb
 * @property {() => number} rng
 * @property {(event: { time: number, intensity: number }) => void} onFlash
 * @property {(event: { time: number, pitch: number }) => void} onNote
 */

/**
 * @typedef {object} Voice
 * @property {AudioNode} output
 * @property {(level: number) => void} setLevel
 * @property {(now: number, horizon: number) => void} tick
 */

// ---------- Small graph helpers ----------

/** @param {Env} env @param {number} value */
const gain = (env, value = 1) => {
  const node = env.ac.createGain();
  node.gain.value = value;
  return node;
};

/** @param {Env} env @param {BiquadFilterType} type @param {number} frequency @param {number} [q] */
const filter = (env, type, frequency, q = 0.7) => {
  const node = env.ac.createBiquadFilter();
  node.type = type;
  node.frequency.value = frequency;
  node.Q.value = q;
  return node;
};

/** @param {Env} env @param {number} pan */
const panner = (env, pan) => {
  const node = env.ac.createStereoPanner();
  node.pan.value = pan;
  return node;
};

/** Chain nodes left to right and return the last one. @param {AudioNode[]} nodes */
const chain = (...nodes) => {
  for (let i = 0; i < nodes.length - 1; i++) nodes[i].connect(nodes[i + 1]);
  return nodes[nodes.length - 1];
};

/**
 * An endlessly looping noise source, started at a random point so two voices
 * using the same buffer never line up.
 * @param {Env} env @param {"white" | "pink" | "brown"} colour
 */
function loop(env, colour) {
  const source = env.ac.createBufferSource();
  source.buffer = env.buffers[colour];
  source.loop = true;
  source.start(0, env.rng() * source.buffer.duration);
  return source;
}

/**
 * A short burst of noise with an envelope: a drip, a crackle, a crack.
 * @param {Env} env @param {AudioNode} dest @param {number} time
 * @param {{ colour?: "white" | "pink" | "brown", type?: BiquadFilterType, frequency: number, q?: number,
 *   peak: number, attack?: number, decay: number, pan?: number }} o
 */
function burst(env, dest, time, o) {
  const { ac, buffers, rng } = env;
  const source = ac.createBufferSource();
  source.buffer = buffers[o.colour ?? "white"];
  const shape = filter(env, o.type ?? "bandpass", o.frequency, o.q ?? 1);
  const amp = gain(env, 0);
  const attack = o.attack ?? 0.002;
  amp.gain.setValueAtTime(0, time);
  amp.gain.linearRampToValueAtTime(o.peak, time + attack);
  amp.gain.exponentialRampToValueAtTime(0.0001, time + attack + o.decay);
  chain(source, shape, amp, panner(env, o.pan ?? 0), dest);
  const length = attack + o.decay + 0.05;
  source.start(time, rng() * (source.buffer.duration - length), length);
  source.onended = () => amp.disconnect();
}

/**
 * Shared plumbing: an output gain, the current level, and a scheduler that only
 * runs while the voice is audible.
 * @param {Env} env
 * @param {(now: number, horizon: number, level: number) => void} [book]
 * @returns {Voice}
 */
function voice(env, book) {
  const output = gain(env, 1);
  let level = 0;
  return {
    output,
    setLevel: (value) => {
      level = value;
    },
    tick: (now, horizon) => {
      if (level > 0 && book) book(now, horizon, level);
    },
  };
}

// ---------- Rain: a soft bed of pink noise plus individual drops ----------

/** @param {Env} env */
export function createRain(env) {
  let next = Infinity;
  const v = voice(env, (now, horizon, level) => {
    next = bookAhead(
      next,
      now,
      horizon,
      () => poissonGap(env.rng, 8 + level * 45),
      (t) =>
        burst(env, v.output, t, {
          frequency: between(env.rng, 1800, 7500),
          q: between(env.rng, 2, 9),
          peak: between(env.rng, 0.05, 0.35) ** 1.5,
          decay: between(env.rng, 0.015, 0.07),
          pan: between(env.rng, -0.85, 0.85),
        })
    );
  });
  chain(
    loop(env, "pink"),
    filter(env, "highpass", 450, 0.5),
    filter(env, "lowpass", 6500),
    gain(env, 0.5),
    v.output
  );
  chain(loop(env, "brown"), filter(env, "lowpass", 380), gain(env, 0.35), v.output);
  return v;
}

// ---------- Thunder: a flash first, then a rumble that rolls away ----------

/** @param {Env} env */
export function createThunder(env) {
  let next = Infinity;
  const v = voice(env, (now, horizon, level) => {
    // The first strike comes soon after the slider goes up, so you know it worked.
    if (next === Infinity) next = now + between(env.rng, 2, 6);
    next = bookAhead(
      next,
      now,
      horizon,
      () => poissonGap(env.rng, level / 11),
      (t) => strike(t)
    );
  });

  /** @param {number} time */
  function strike(time) {
    const { rng } = env;
    const distance = rng();
    const intensity = 1 - distance * 0.65;
    env.onFlash({ time, intensity });

    // Light arrives first; sound follows about three seconds per kilometre.
    const t = time + 0.35 + distance * 3;
    const length = between(rng, 5, 9);
    const source = loop(env, "brown");
    const low = filter(env, "lowpass", 260 + (1 - distance) * 900, 0.6);
    low.frequency.setValueAtTime(low.frequency.value, t);
    low.frequency.exponentialRampToValueAtTime(70, t + length);
    const amp = gain(env, 0);
    amp.gain.setValueAtTime(0, t);
    amp.gain.linearRampToValueAtTime(intensity, t + between(rng, 0.08, 0.45));
    // A couple of rolls as the sound echoes off clouds and hills.
    for (let i = 0; i < 3; i++) {
      const at = t + between(rng, 0.6, length * 0.6);
      amp.gain.setTargetAtTime(intensity * between(rng, 0.45, 0.95), at, 0.25);
    }
    amp.gain.setTargetAtTime(0, t + length * 0.55, length / 5);
    chain(source, low, amp, v.output);
    source.stop(t + length + 2);
    source.onended = () => amp.disconnect();

    if (distance < 0.35) {
      burst(env, v.output, t, {
        type: "highpass",
        frequency: 700,
        peak: 0.5 * intensity,
        attack: 0.004,
        decay: 0.45,
        pan: between(rng, -0.4, 0.4),
      });
    }
  }
  return v;
}

// ---------- Wind: brown noise through a band that wanders, in gusts ----------

/** @param {Env} env */
export function createWind(env) {
  const band = filter(env, "bandpass", 420, 0.6);
  const gust = gain(env, 0.6);
  const leaves = gain(env, 0.05);
  let next = Infinity;
  const v = voice(env, (now, horizon) => {
    next = bookAhead(
      next,
      now,
      horizon,
      () => between(env.rng, 1.5, 4),
      (t) => {
        const strength = between(env.rng, 0.3, 1);
        band.frequency.setTargetAtTime(220 + strength * 520, t, 1.2);
        gust.gain.setTargetAtTime(0.25 + strength * 0.75, t, 1.4);
        leaves.gain.setTargetAtTime(0.02 + strength * 0.08, t, 1.4);
      }
    );
  });
  chain(loop(env, "brown"), band, gust, v.output);
  chain(loop(env, "pink"), filter(env, "highpass", 2800), leaves, v.output);
  return v;
}

// ---------- Waves: swells of filtered pink noise over a low undertow ----------

/** @param {Env} env */
export function createWaves(env) {
  const swell = gain(env, 0.15);
  const tone = filter(env, "lowpass", 500, 0.5);
  const foam = gain(env, 0.02);
  let next = Infinity;
  const v = voice(env, (now, horizon) => {
    next = bookAhead(
      next,
      now,
      horizon,
      () => between(env.rng, 6, 11),
      (t) => {
        const size = between(env.rng, 0.55, 1);
        swell.gain.setTargetAtTime(size, t, 1.1);
        tone.frequency.setTargetAtTime(900 + size * 1300, t, 1);
        foam.gain.setTargetAtTime(size * 0.12, t + 1.6, 0.6);
        const fall = t + between(env.rng, 2.6, 3.6);
        swell.gain.setTargetAtTime(0.12, fall, 1.9);
        tone.frequency.setTargetAtTime(480, fall, 1.6);
        foam.gain.setTargetAtTime(0.01, fall, 1.2);
      }
    );
  });
  chain(loop(env, "pink"), tone, swell, v.output);
  chain(loop(env, "white"), filter(env, "highpass", 3200), foam, v.output);
  chain(loop(env, "brown"), filter(env, "lowpass", 200), gain(env, 0.4), v.output);
  return v;
}

// ---------- Campfire: a low roar that breathes, and crackling ----------

/** @param {Env} env */
export function createFire(env) {
  const roar = gain(env, 0.5);
  let nextFlicker = Infinity;
  let nextCrackle = Infinity;
  const v = voice(env, (now, horizon, level) => {
    nextFlicker = bookAhead(
      nextFlicker,
      now,
      horizon,
      () => between(env.rng, 0.25, 0.9),
      (t) => roar.gain.setTargetAtTime(between(env.rng, 0.3, 0.75), t, 0.2)
    );
    nextCrackle = bookAhead(
      nextCrackle,
      now,
      horizon,
      () => poissonGap(env.rng, 3 + level * 13),
      (t) => {
        // Now and then a log pops several times in quick succession.
        const pops = env.rng() < 0.15 ? 2 + Math.floor(env.rng() * 4) : 1;
        for (let i = 0; i < pops; i++) {
          burst(env, v.output, t + i * between(env.rng, 0.008, 0.03), {
            type: "highpass",
            frequency: between(env.rng, 1200, 5200),
            peak: between(env.rng, 0.15, 0.8) ** 2,
            attack: 0.001,
            decay: between(env.rng, 0.004, 0.03),
            pan: between(env.rng, -0.35, 0.35),
          });
        }
      }
    );
  });
  chain(loop(env, "brown"), filter(env, "lowpass", 420), roar, v.output);
  return v;
}

// ---------- Crickets: high sine tones gated into chirps ----------

/** @param {Env} env */
export function createCrickets(env) {
  const output = gain(env, 1);
  const crickets = [-0.7, -0.2, 0.35, 0.8].map((pan, i) => {
    const osc = env.ac.createOscillator();
    osc.frequency.value = between(env.rng, 4300, 5100);
    const amp = gain(env, 0);
    const far = i % 2 === 1;
    const out = chain(osc, amp, panner(env, pan), gain(env, far ? 0.35 : 1));
    out.connect(output);
    if (far) out.connect(env.reverb);
    osc.start();
    return { amp, period: between(env.rng, 0.55, 1), pulses: env.rng() < 0.5 ? 3 : 4, next: Infinity };
  });
  let level = 0;
  return {
    output,
    setLevel: (value) => {
      level = value;
    },
    tick: (now, horizon) => {
      if (level <= 0) return;
      for (const c of crickets) {
        c.next = bookAhead(
          c.next,
          now,
          horizon,
          () => c.period * between(env.rng, 0.92, 1.08),
          (t) => {
            for (let p = 0; p < c.pulses; p++) {
              const at = t + p * 0.034;
              c.amp.gain.setValueAtTime(0, at);
              c.amp.gain.linearRampToValueAtTime(0.5, at + 0.005);
              c.amp.gain.linearRampToValueAtTime(0, at + 0.022);
            }
          }
        );
      }
    },
  };
}

// ---------- Birds: short songs of gliding sine notes ----------

/** @param {Env} env */
export function createBirds(env) {
  let next = Infinity;
  const v = voice(env, (now, horizon, level) => {
    next = bookAhead(
      next,
      now,
      horizon,
      () => poissonGap(env.rng, 0.12 + level * 0.55),
      (t) => song(t)
    );
  });

  /** @param {number} time */
  function song(time) {
    const { ac, rng } = env;
    const osc = ac.createOscillator();
    const amp = gain(env, 0);
    const out = chain(osc, amp, panner(env, between(rng, -0.9, 0.9)), gain(env, between(rng, 0.4, 1)));
    out.connect(v.output);
    out.connect(env.reverb);

    const kind = pick(rng, ["whistle", "trill", "chirp"]);
    let t = time;
    /** @param {number} from @param {number} to @param {number} length */
    const note = (from, to, length) => {
      osc.frequency.setValueAtTime(from, t);
      osc.frequency.exponentialRampToValueAtTime(to, t + length);
      amp.gain.setValueAtTime(0, t);
      amp.gain.linearRampToValueAtTime(0.25, t + Math.min(0.02, length / 3));
      amp.gain.linearRampToValueAtTime(0, t + length);
    };
    if (kind === "whistle") {
      const notes = 2 + Math.floor(rng() * 3);
      for (let i = 0; i < notes; i++) {
        const from = between(rng, 2200, 3800);
        const length = between(rng, 0.12, 0.26);
        note(from, from * between(rng, 0.8, 1.3), length);
        t += length + between(rng, 0.05, 0.12);
      }
    } else if (kind === "trill") {
      const base = between(rng, 3800, 5200);
      const notes = 6 + Math.floor(rng() * 7);
      for (let i = 0; i < notes; i++) {
        note(base * (i % 2 ? 1.08 : 1), base * (i % 2 ? 1.02 : 0.97), 0.04);
        t += 0.055;
      }
    } else {
      const repeats = 2 + Math.floor(rng() * 2);
      for (let i = 0; i < repeats; i++) {
        note(between(rng, 4600, 5600), between(rng, 2300, 3000), 0.07);
        t += between(rng, 0.12, 0.2);
      }
    }
    osc.start(time);
    osc.stop(t + 0.1);
    osc.onended = () => amp.disconnect();
  }
  return v;
}

// ---------- Keys: slow pentatonic notes over a soft bass, in a big room ----------

const BEAT = 0.85;

/** @param {Env} env */
export function createKeys(env) {
  const dry = gain(env, 0.6);
  const wet = gain(env, 0.8);
  let next = Infinity;
  let step = 5;
  let beats = 0;
  const v = voice(env, (now, horizon) => {
    next = bookAhead(
      next,
      now,
      horizon,
      () => BEAT * pick(env.rng, [1, 2, 2, 3, 4]),
      (t) => {
        step = nextStep(step, pick(env.rng, [-2, -1, -1, 1, 1, 2, 0]));
        tone(t, midiToHz(stepToMidi(step)), 0.28, between(env.rng, 2.5, 4.5));
        if (env.rng() < 0.2) tone(t, midiToHz(stepToMidi(step - 2)), 0.16, 3);
        if (beats % 8 === 0) tone(t, midiToHz(ROOTS[(beats / 8) % ROOTS.length]), 0.22, 6);
        beats += 1;
        env.onNote({ time: t, pitch: step / 12 });
      }
    );
  });
  dry.connect(v.output);
  wet.connect(env.reverb);

  /** A soft electric-piano tone: a few sine partials that fade at different rates. */
  function tone(/** @type {number} */ t, /** @type {number} */ hz, /** @type {number} */ peak, length = 3) {
    const { ac } = env;
    const amp = gain(env, 0);
    amp.gain.setValueAtTime(0, t);
    amp.gain.linearRampToValueAtTime(peak, t + 0.012);
    amp.gain.exponentialRampToValueAtTime(0.0001, t + length);
    const soft = filter(env, "lowpass", 2600, 0.3);
    chain(amp, soft);
    soft.connect(dry);
    soft.connect(wet);
    [
      [1, 1],
      [2, 0.22],
      [3, 0.06],
    ].forEach(([ratio, level]) => {
      const osc = ac.createOscillator();
      osc.frequency.value = hz * ratio;
      osc.detune.value = between(env.rng, -4, 4);
      const partial = gain(env, level);
      chain(osc, partial, amp);
      osc.start(t);
      osc.stop(t + length + 0.1);
    });
    setTimeout(() => amp.disconnect(), (t - ac.currentTime + length + 0.5) * 1000);
  }
  return v;
}

export const VOICES = {
  rain: createRain,
  thunder: createThunder,
  wind: createWind,
  waves: createWaves,
  fire: createFire,
  crickets: createCrickets,
  birds: createBirds,
  keys: createKeys,
};
