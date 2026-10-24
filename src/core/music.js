// @ts-check
// The few bits of music theory the Keys voice needs.

/** D major pentatonic, in semitones above D. Any two of these notes sound good together. */
export const SCALE = Object.freeze([0, 2, 4, 7, 9]);

/** Bass roots for a slow D, Bm, G, A progression (MIDI note numbers). */
export const ROOTS = Object.freeze([38, 35, 31, 33]);

/** Highest melody step: two and a half octaves above D3. */
export const TOP_STEP = 12;

/** @param {number} midi */
export const midiToHz = (midi) => 440 * 2 ** ((midi - 69) / 12);

/**
 * A scale step (0 = D3, 5 = D4, ...) as a MIDI note.
 * @param {number} step
 */
export const stepToMidi = (step) =>
  50 + Math.floor(step / SCALE.length) * 12 + SCALE[((step % SCALE.length) + SCALE.length) % SCALE.length];

/**
 * The melody wanders by small steps and stays in range.
 * @param {number} step
 * @param {number} move
 */
export const nextStep = (step, move) => Math.min(TOP_STEP, Math.max(0, step + move));
