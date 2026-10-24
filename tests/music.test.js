import { describe, expect, it } from "vitest";
import { ROOTS, SCALE, TOP_STEP, midiToHz, nextStep, stepToMidi } from "../src/core/music.js";

describe("music", () => {
  it("converts MIDI notes to hertz", () => {
    expect(midiToHz(69)).toBe(440);
    expect(midiToHz(81)).toBe(880);
    expect(midiToHz(62)).toBeCloseTo(293.66, 2);
  });

  it("walks the D major pentatonic scale across octaves", () => {
    expect([0, 1, 2, 3, 4, 5].map(stepToMidi)).toEqual([50, 52, 54, 57, 59, 62]);
    expect(stepToMidi(-1)).toBe(47);
  });

  it("only ever plays notes from the scale", () => {
    for (let step = 0; step <= TOP_STEP; step++) {
      expect(SCALE).toContain((stepToMidi(step) - 50 + 120) % 12);
    }
  });

  it("keeps the melody in range", () => {
    expect(nextStep(0, -2)).toBe(0);
    expect(nextStep(TOP_STEP, 2)).toBe(TOP_STEP);
    expect(nextStep(5, 1)).toBe(6);
  });

  it("uses bass roots from the key", () => {
    for (const root of ROOTS) expect([2, 11, 7, 9]).toContain(root % 12);
  });
});
