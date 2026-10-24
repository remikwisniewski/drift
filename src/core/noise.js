// @ts-check
// Noise colours and a reverb impulse, generated as plain sample arrays. The audio
// engine copies them into AudioBuffers; every natural sound in Drift starts here.

/**
 * White noise: equal energy at every frequency. Hiss, drips, crackles.
 * @param {Float32Array} out
 * @param {() => number} rng
 */
export function fillWhite(out, rng) {
  for (let i = 0; i < out.length; i++) out[i] = rng() * 2 - 1;
  return out;
}

/**
 * Pink noise: energy falls 3 dB per octave, which sounds even to the ear. Rain, surf.
 * Paul Kellet's refined filter of white noise.
 * @param {Float32Array} out
 * @param {() => number} rng
 */
export function fillPink(out, rng) {
  let b0 = 0;
  let b1 = 0;
  let b2 = 0;
  let b3 = 0;
  let b4 = 0;
  let b5 = 0;
  let b6 = 0;
  for (let i = 0; i < out.length; i++) {
    const white = rng() * 2 - 1;
    b0 = 0.99886 * b0 + white * 0.0555179;
    b1 = 0.99332 * b1 + white * 0.0750759;
    b2 = 0.969 * b2 + white * 0.153852;
    b3 = 0.8665 * b3 + white * 0.3104856;
    b4 = 0.55 * b4 + white * 0.5329522;
    b5 = -0.7616 * b5 - white * 0.016898;
    out[i] = b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362;
    b6 = white * 0.115926;
  }
  return normalize(out);
}

/**
 * Brown noise: energy falls 6 dB per octave. Deep rumbles: wind, distant surf, thunder.
 * A leaky integrator of white noise, so it wanders without drifting off.
 * @param {Float32Array} out
 * @param {() => number} rng
 */
export function fillBrown(out, rng) {
  let last = 0;
  for (let i = 0; i < out.length; i++) {
    last = (last + 0.02 * (rng() * 2 - 1)) / 1.02;
    out[i] = last;
  }
  return normalize(out);
}

/**
 * Scale samples so the loudest is at `peak`, leaving silence untouched.
 * @param {Float32Array} out
 * @param {number} [peak]
 */
export function normalize(out, peak = 0.95) {
  let max = 0;
  for (let i = 0; i < out.length; i++) max = Math.max(max, Math.abs(out[i]));
  if (max > 0) {
    const scale = peak / max;
    for (let i = 0; i < out.length; i++) out[i] *= scale;
  }
  return out;
}

/**
 * A room reverb's impulse response: noise that decays exponentially.
 * @param {number} length samples
 * @param {number} decay higher values die away faster
 * @param {() => number} rng
 */
export function impulseResponse(length, decay, rng) {
  const out = new Float32Array(length);
  for (let i = 0; i < length; i++) {
    out[i] = (rng() * 2 - 1) * Math.pow(1 - i / length, decay);
  }
  return out;
}

/**
 * Average sample-to-sample change: a quick, test-friendly proxy for brightness.
 * White noise jumps around the most, brown noise the least.
 * @param {Float32Array} samples
 */
export function roughness(samples) {
  let sum = 0;
  for (let i = 1; i < samples.length; i++) sum += Math.abs(samples[i] - samples[i - 1]);
  return sum / Math.max(1, samples.length - 1);
}
