import { describe, expect, it } from "vitest";
import { createRng } from "../src/core/random.js";
import { fillBrown, fillPink, fillWhite, impulseResponse, normalize, roughness } from "../src/core/noise.js";

const N = 44100;
const peak = (samples) => samples.reduce((m, x) => Math.max(m, Math.abs(x)), 0);
const mean = (samples) => samples.reduce((s, x) => s + x, 0) / samples.length;

describe("noise colours", () => {
  const white = fillWhite(new Float32Array(N), createRng(1));
  const pink = fillPink(new Float32Array(N), createRng(1));
  const brown = fillBrown(new Float32Array(N), createRng(1));

  it("stays within [-1, 1]", () => {
    for (const samples of [white, pink, brown]) expect(peak(samples)).toBeLessThanOrEqual(1);
  });

  it("centres on zero", () => {
    expect(Math.abs(mean(white))).toBeLessThan(0.02);
    expect(Math.abs(mean(pink))).toBeLessThan(0.1);
  });

  it("gets darker from white to pink to brown", () => {
    expect(roughness(white)).toBeGreaterThan(roughness(pink));
    expect(roughness(pink)).toBeGreaterThan(roughness(brown));
  });

  it("is reproducible from a seed", () => {
    expect(fillPink(new Float32Array(64), createRng(5))).toEqual(
      fillPink(new Float32Array(64), createRng(5))
    );
  });

  it("normalises pink and brown to the same peak", () => {
    expect(peak(pink)).toBeCloseTo(0.95, 5);
    expect(peak(brown)).toBeCloseTo(0.95, 5);
  });
});

describe("normalize", () => {
  it("scales to the requested peak and leaves silence alone", () => {
    expect([...normalize(Float32Array.from([0.1, -0.2]), 1)]).toEqual([0.5, -1]);
    expect([...normalize(new Float32Array(3))]).toEqual([0, 0, 0]);
  });
});

describe("impulseResponse", () => {
  it("decays towards silence", () => {
    const ir = impulseResponse(10000, 3, createRng(2));
    const start = peak(ir.subarray(0, 1000));
    const end = peak(ir.subarray(9000));
    expect(start).toBeGreaterThan(0.5);
    expect(end).toBeLessThan(start / 50);
  });
});

describe("roughness", () => {
  it("handles tiny inputs", () => {
    expect(roughness(new Float32Array(0))).toBe(0);
    expect(roughness(Float32Array.from([0, 1]))).toBe(1);
  });
});
