import { describe, expect, it } from "vitest";
import { LOOKAHEAD, bookAhead } from "../src/core/schedule.js";

const collect = (next, now, horizon, gapValue, max) => {
  const times = [];
  const after = bookAhead(
    next,
    now,
    horizon,
    () => gapValue,
    (t) => times.push(t),
    max
  );
  return { times, after };
};

describe("bookAhead", () => {
  it("books every event inside the horizon and returns the next one", () => {
    const { times, after } = collect(10, 10, 1, 0.25);
    expect(times).toEqual([10, 10.25, 10.5, 10.75]);
    expect(after).toBe(11);
  });

  it("books nothing when the next event is beyond the horizon", () => {
    const { times, after } = collect(20, 10, 1, 0.25);
    expect(times).toEqual([]);
    expect(after).toBe(20);
  });

  it("skips events missed while the tab was asleep instead of bunching them", () => {
    const { times } = collect(2, 100, 1, 0.5);
    expect(times[0]).toBeGreaterThanOrEqual(100);
    expect(times.length).toBeLessThanOrEqual(2);
  });

  it("starts a stopped stream when the rate becomes non-zero", () => {
    expect(collect(Infinity, 5, 1, 0.5).times).toEqual([5.5]);
    expect(collect(Infinity, 5, 1, Infinity).times).toEqual([]);
  });

  it("caps how many events one tick can book", () => {
    expect(collect(0, 0, 1, 0.0001, 50).times).toHaveLength(50);
  });

  it("looks further ahead than a throttled background timer", () => {
    expect(LOOKAHEAD).toBeGreaterThan(1);
  });
});
