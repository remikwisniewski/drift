import { describe, expect, it } from "vitest";
import { createMix } from "../src/core/mix.js";
import { mixColor, sceneFromLevels } from "../src/core/scene.js";

const scene = (levels) => sceneFromLevels(createMix(levels).levels);

describe("sceneFromLevels", () => {
  it("shows a clear, starry night when it is quiet", () => {
    const s = scene({});
    expect(s.stars).toBe(1);
    expect(s.cloud).toBe(0);
    expect(s.raindrops).toBe(0);
    expect(s.dawn).toBe(0);
  });

  it("clouds over and hides the stars as rain and thunder build", () => {
    const light = scene({ rain: 0.3 });
    const storm = scene({ rain: 1, thunder: 1 });
    expect(storm.cloud).toBeGreaterThan(light.cloud);
    expect(storm.stars).toBeLessThan(light.stars);
    expect(storm.stars).toBe(0);
    expect(storm.raindrops).toBeGreaterThan(light.raindrops);
    expect(storm.flashes).toBe(1);
  });

  it("brings the sunrise with the birds", () => {
    expect(scene({ birds: 1 }).dawn).toBeGreaterThan(0.5);
    expect(scene({ birds: 1 }).stars).toBeLessThan(0.5);
  });

  it("lets crickets bring fireflies, but rain keeps them in", () => {
    expect(scene({ crickets: 1 }).fireflies).toBeGreaterThan(20);
    expect(scene({ crickets: 1, rain: 1 }).fireflies).toBeLessThan(10);
  });

  it("maps fire, waves, wind and keys straight through", () => {
    const s = scene({ fire: 0.6, waves: 0.4, wind: 0.3, keys: 0.5 });
    expect(s.fire).toBe(0.6);
    expect(s.waves).toBe(0.4);
    expect(s.wind).toBe(0.3);
    expect(s.aurora).toBe(0.5);
  });

  it("caps wind even in a storm", () => {
    expect(scene({ wind: 1, thunder: 1, rain: 1 }).wind).toBe(1);
  });
});

describe("mixColor", () => {
  it("blends and clamps", () => {
    expect(mixColor([0, 0, 0], [100, 200, 50], 0.5)).toBe("rgb(50, 100, 25)");
    expect(mixColor([0, 0, 0], [100, 200, 50], 2)).toBe("rgb(100, 200, 50)");
    expect(mixColor([10, 10, 10], [100, 200, 50], -1)).toBe("rgb(10, 10, 10)");
  });
});
