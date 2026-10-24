import { describe, expect, it } from "vitest";
import {
  CHANNEL_IDS,
  CHANNELS,
  DEFAULT_MASTER,
  PRESETS,
  applyPreset,
  clampLevel,
  createMix,
  decodeMix,
  defaultMix,
  describeMix,
  encodeMix,
  isSilent,
  levelToGain,
  matchingPreset,
  randomMix,
  silentLevels,
  withLevel,
} from "../src/core/mix.js";
import { createRng } from "../src/core/random.js";

describe("channels and presets", () => {
  it("has eight unique channels", () => {
    expect(CHANNELS).toHaveLength(8);
    expect(new Set(CHANNEL_IDS).size).toBe(8);
  });

  it("only uses known channels and valid levels in presets", () => {
    const ids = new Set(PRESETS.map((p) => p.id));
    expect(ids.size).toBe(PRESETS.length);
    for (const preset of PRESETS) {
      for (const [id, level] of Object.entries(preset.levels)) {
        expect(CHANNEL_IDS).toContain(id);
        expect(level).toBeGreaterThan(0);
        expect(level).toBeLessThanOrEqual(1);
      }
    }
  });

  it("never has thunder without rain", () => {
    for (const preset of PRESETS) if (preset.levels.thunder) expect(preset.levels.rain).toBeGreaterThan(0);
  });
});

describe("createMix", () => {
  it("fills every channel and clamps levels", () => {
    const mix = createMix({ rain: 2, wind: -1, fire: Number.NaN }, 5);
    expect(Object.keys(mix.levels)).toEqual(CHANNEL_IDS);
    expect(mix.levels.rain).toBe(1);
    expect(mix.levels.wind).toBe(0);
    expect(mix.levels.fire).toBe(0);
    expect(mix.master).toBe(1);
  });

  it("starts first-time visitors on the first preset", () => {
    expect(matchingPreset(defaultMix())).toBe(PRESETS[0]);
    expect(defaultMix().master).toBe(DEFAULT_MASTER);
  });
});

describe("editing a mix", () => {
  it("changes one level without mutating the original", () => {
    const mix = createMix({ rain: 0.5 });
    const louder = withLevel(mix, "rain", 0.9);
    expect(louder.levels.rain).toBe(0.9);
    expect(mix.levels.rain).toBe(0.5);
  });

  it("applies a preset and keeps the master volume", () => {
    const mix = applyPreset(createMix({ fire: 1 }, 0.3), PRESETS[1]);
    expect(mix.master).toBe(0.3);
    expect(mix.levels.fire).toBe(0);
    expect(matchingPreset(mix)).toBe(PRESETS[1]);
  });

  it("stops matching a preset once a slider moves", () => {
    const mix = withLevel(applyPreset(createMix(), PRESETS[0]), "rain", 0.1);
    expect(matchingPreset(mix)).toBeUndefined();
  });

  it("knows when nothing would play", () => {
    expect(isSilent(createMix())).toBe(true);
    expect(isSilent(createMix({ rain: 1 }, 0))).toBe(true);
    expect(isSilent(createMix({ rain: 1 }))).toBe(false);
  });
});

describe("levelToGain", () => {
  it("uses a squared curve between 0 and 1", () => {
    expect(levelToGain(0)).toBe(0);
    expect(levelToGain(0.5)).toBe(0.25);
    expect(levelToGain(1)).toBe(1);
    expect(levelToGain(3)).toBe(1);
  });
});

describe("randomMix", () => {
  it("picks two to four sounds at audible levels", () => {
    const rng = createRng(11);
    for (let i = 0; i < 200; i++) {
      const mix = randomMix(rng);
      const on = CHANNEL_IDS.filter((id) => mix.levels[id] > 0);
      expect(on.length).toBeGreaterThanOrEqual(2);
      expect(on.length).toBeLessThanOrEqual(5);
      if (mix.levels.thunder > 0) expect(mix.levels.rain).toBeGreaterThan(0);
      for (const id of on) expect(mix.levels[id]).toBeGreaterThanOrEqual(0.25);
    }
  });
});

describe("describeMix", () => {
  it("lists the sounds in plain English", () => {
    expect(describeMix(createMix())).toBe("Silence");
    expect(describeMix(createMix({ rain: 0.5 }))).toBe("Rain");
    expect(describeMix(createMix({ rain: 0.5, wind: 0.2 }))).toBe("Rain and wind");
    expect(describeMix(createMix({ rain: 0.5, wind: 0.2, keys: 0.1 }))).toBe("Rain, wind and keys");
  });
});

describe("share links", () => {
  it("round-trips a mix through the URL hash", () => {
    const mix = createMix({ rain: 0.7, thunder: 0.25, keys: 0.05 }, 0.6);
    const hash = encodeMix(mix);
    expect(hash).toBe("#rain=70&thunder=25&keys=5&master=60");
    expect(decodeMix(hash)).toEqual(mix);
  });

  it("ignores unknown keys and bad values, and uses the default master", () => {
    const mix = decodeMix("#rain=50&lasers=100&wind=abc");
    expect(mix?.levels.rain).toBe(0.5);
    expect(mix?.levels.wind).toBe(0);
    expect(mix?.master).toBe(DEFAULT_MASTER);
  });

  it("clamps out-of-range values", () => {
    expect(decodeMix("rain=500&master=-20")).toEqual(createMix({ rain: 1 }, 0));
  });

  it("returns null when the hash holds no sound", () => {
    expect(decodeMix("")).toBeNull();
    expect(decodeMix("#master=80")).toBeNull();
    expect(decodeMix("#rain=0")).toBeNull();
  });

  it("still returns a silent-but-valid levels object", () => {
    expect(Object.values(silentLevels()).every((v) => v === 0)).toBe(true);
    expect(clampLevel(Infinity)).toBe(0);
  });
});
