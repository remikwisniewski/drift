import { describe, expect, it } from "vitest";
import { FADE_MS, SLEEP_OPTIONS, createSleepTimer, fadeGain, formatRemaining } from "../src/core/timer.js";

describe("fadeGain", () => {
  it("is full volume until the last minute, then eases to silence", () => {
    expect(fadeGain(FADE_MS * 5)).toBe(1);
    expect(fadeGain(FADE_MS)).toBe(1);
    expect(fadeGain(FADE_MS / 2)).toBeCloseTo(0.5, 5);
    expect(fadeGain(0)).toBe(0);
    expect(fadeGain(-10)).toBe(0);
  });

  it("only ever gets quieter as time runs out", () => {
    let last = 1;
    for (let ms = FADE_MS; ms >= 0; ms -= 500) {
      const gain = fadeGain(ms);
      expect(gain).toBeLessThanOrEqual(last);
      last = gain;
    }
  });
});

describe("formatRemaining", () => {
  it("formats minutes and hours and rounds up", () => {
    expect(formatRemaining(30 * 60_000)).toBe("30:00");
    expect(formatRemaining(61_500)).toBe("1:02");
    expect(formatRemaining(90 * 60_000)).toBe("1:30:00");
    expect(formatRemaining(1)).toBe("0:01");
    expect(formatRemaining(-5)).toBe("0:00");
  });
});

describe("createSleepTimer", () => {
  it("counts down, fades and finishes", () => {
    const timer = createSleepTimer(15, 1000);
    expect(timer.remaining(1000)).toBe(15 * 60_000);
    expect(timer.gain(1000)).toBe(1);
    expect(timer.done(timer.endsAt - 1)).toBe(false);
    expect(timer.gain(timer.endsAt - FADE_MS / 2)).toBeCloseTo(0.5, 5);
    expect(timer.done(timer.endsAt)).toBe(true);
    expect(timer.remaining(timer.endsAt + 5000)).toBe(0);
  });

  it("offers an off option first", () => {
    expect(SLEEP_OPTIONS[0]).toBe(0);
  });
});
