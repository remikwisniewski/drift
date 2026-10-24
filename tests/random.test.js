import { describe, expect, it } from "vitest";
import { between, createRng, pick, poissonGap } from "../src/core/random.js";

describe("createRng", () => {
  it("is reproducible for the same seed and differs between seeds", () => {
    const a = createRng(42);
    const b = createRng(42);
    const c = createRng(7);
    const first = [a(), a(), a()];
    expect([b(), b(), b()]).toEqual(first);
    expect([c(), c(), c()]).not.toEqual(first);
  });

  it("stays in [0, 1) with a sensible mean", () => {
    const rng = createRng(1);
    let sum = 0;
    for (let i = 0; i < 20000; i++) {
      const x = rng();
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThan(1);
      sum += x;
    }
    expect(sum / 20000).toBeCloseTo(0.5, 1);
  });
});

describe("between and pick", () => {
  it("keeps values in range and picks from the list", () => {
    const rng = createRng(3);
    for (let i = 0; i < 500; i++) {
      const v = between(rng, 2, 5);
      expect(v).toBeGreaterThanOrEqual(2);
      expect(v).toBeLessThan(5);
      expect(["a", "b", "c"]).toContain(pick(rng, ["a", "b", "c"]));
    }
  });
});

describe("poissonGap", () => {
  it("averages one over the rate", () => {
    const rng = createRng(9);
    let total = 0;
    const n = 20000;
    for (let i = 0; i < n; i++) total += poissonGap(rng, 4);
    expect(total / n).toBeCloseTo(0.25, 1);
  });

  it("never fires when the rate is zero or invalid", () => {
    const rng = createRng(1);
    expect(poissonGap(rng, 0)).toBe(Infinity);
    expect(poissonGap(rng, -1)).toBe(Infinity);
    expect(poissonGap(rng, Number.NaN)).toBe(Infinity);
  });
});
