// The night scene behind the mixer: a lake under the sky, hills, a campfire on
// the shore. It reads a SceneState (see core/scene.js) and eases towards it, so
// moving a slider slowly changes the weather instead of snapping.

import { mixColor, sceneFromLevels } from "../core/scene.js";
import { between, createRng } from "../core/random.js";
import { silentLevels } from "../core/mix.js";

/** @typedef {import("../core/scene.js").SceneState} SceneState */
/** @typedef {import("../core/mix.js").Levels} Levels */

// Colours as [r, g, b]: night first, dawn second.
const SKY_TOP = [
  [10, 12, 34],
  [74, 96, 156],
];
const SKY_LOW = [
  [52, 36, 82],
  [246, 172, 128],
];
const OVERCAST_TOP = [32, 36, 50];
const OVERCAST_LOW = [62, 62, 78];
const HILLS_FAR = [
  [32, 28, 64],
  [118, 98, 134],
];
const HILLS_NEAR = [
  [18, 17, 38],
  [66, 56, 82],
];
const GROUND = [
  [9, 10, 20],
  [36, 34, 48],
];

const HORIZON = 0.63;
const SHORE = 0.8;

/**
 * @param {HTMLCanvasElement} canvas
 * @param {{ reducedMotion?: boolean, seed?: number }} [options]
 */
export function createNightScene(canvas, { reducedMotion = false, seed = 7 } = {}) {
  const ctx = /** @type {CanvasRenderingContext2D} */ (canvas.getContext("2d"));
  const rng = createRng(seed);
  /** @type {SceneState} */
  let target = sceneFromLevels(silentLevels());
  /** @type {SceneState} */
  const now = { ...target };
  let w = 0;
  let h = 0;
  let flash = 0;
  let bolt = /** @type {number[][] | null} */ (null);
  let aurora = 0;
  let last = performance.now();
  let raf = 0;

  // ---- Scenery generated once, in 0–1 coordinates ----
  const stars = Array.from({ length: 170 }, () => ({
    x: rng(),
    y: rng() ** 1.6 * HORIZON * 0.95,
    r: between(rng, 0.4, 1.4),
    phase: rng() * Math.PI * 2,
    speed: between(rng, 0.6, 2),
  }));
  const ridge = (/** @type {number} */ base, /** @type {number} */ height) => {
    const waves = Array.from({ length: 4 }, (_, i) => ({
      f: (i + 1) * between(rng, 1.4, 2.6),
      p: rng() * 6.28,
    }));
    return Array.from({ length: 61 }, (_, i) => {
      const x = i / 60;
      const y = waves.reduce((sum, wv, k) => sum + Math.sin(x * wv.f * Math.PI + wv.p) / (k + 1), 0);
      return [x, base - height * (0.5 + y * 0.32)];
    });
  };
  const farHills = ridge(HORIZON, 0.085);
  const nearHills = ridge(HORIZON + 0.01, 0.05).map(([x, y]) => [x, y + Math.abs(x - 0.45) * 0.06]);
  const clouds = Array.from({ length: 8 }, (_, i) => ({
    x: i / 8 + rng() * 0.1,
    y: between(rng, 0.04, 0.34),
    s: between(rng, 0.7, 1.4),
    puffs: Array.from({ length: 5 }, () => [
      between(rng, -0.09, 0.09),
      between(rng, -0.025, 0.02),
      between(rng, 0.04, 0.08),
    ]),
  }));
  const grass = Array.from({ length: 240 }, () => ({
    x: rng(),
    y: rng() < 0.55 ? SHORE + rng() * 0.02 : between(rng, SHORE + 0.02, 1),
    len: between(rng, 0.012, 0.045),
    phase: rng() * 6.28,
  })).sort((a, b) => a.y - b.y);
  const drops = Array.from({ length: 260 }, () => ({
    x: rng(),
    y: rng(),
    len: between(rng, 0.6, 1.2),
    v: between(rng, 0.9, 1.3),
  }));
  const flies = Array.from({ length: 28 }, () => ({
    x: rng(),
    y: between(rng, 0.62, 0.95),
    phase: rng() * 6.28,
    speed: between(rng, 0.2, 0.5),
  }));
  /** @type {{ x: number, y: number, age: number }[]} */
  let ripples = [];
  /** @type {{ x: number, y: number, vx: number, vy: number, age: number }[]} */
  let sparks = [];
  /** @type {{ x: number, y: number, v: number, phase: number }[]} */
  let birds = [];
  let rippleDebt = 0;
  let sparkDebt = 0;
  let birdClock = 0;

  const FIRE_X = 0.7;
  const FIRE_Y = 0.875;

  // ---- Drawing ----

  /** @param {number} t seconds */
  function draw(t) {
    const s = now;
    const dawn = s.dawn;
    const overcast = s.cloud * 0.75;

    // Sky
    const sky = ctx.createLinearGradient(0, 0, 0, h * HORIZON);
    const top = mixColor(SKY_TOP[0], SKY_TOP[1], dawn);
    const low = mixColor(SKY_LOW[0], SKY_LOW[1], dawn);
    sky.addColorStop(0, blend(top, rgb(OVERCAST_TOP), overcast));
    sky.addColorStop(1, blend(low, rgb(OVERCAST_LOW), overcast));
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, w, h * HORIZON + 1);

    // Sunrise glow on the horizon
    if (dawn > 0.02) {
      const glow = ctx.createRadialGradient(w * 0.3, h * HORIZON, 0, w * 0.3, h * HORIZON, w * 0.6);
      glow.addColorStop(0, `rgba(255, 196, 140, ${0.55 * dawn * (1 - overcast)})`);
      glow.addColorStop(1, "rgba(255, 196, 140, 0)");
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, w, h * HORIZON);
    }

    // Stars
    if (s.stars > 0.01) {
      for (const star of stars) {
        const twinkle = reducedMotion ? 0.8 : 0.55 + 0.45 * Math.sin(t * star.speed + star.phase);
        ctx.globalAlpha = s.stars * twinkle;
        ctx.fillStyle = "#fff8ec";
        ctx.beginPath();
        ctx.arc(star.x * w, star.y * h, star.r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }

    // Aurora while the keys play: soft ribbons that brighten with each note
    const auroraLevel = s.aurora * (0.6 + aurora * 0.8);
    if (auroraLevel > 0.01) drawAurora(t, auroraLevel);

    // Moon
    const moonAlpha = (1 - dawn * 0.8) * (1 - s.cloud * 0.85);
    const mx = w * 0.78;
    const my = h * 0.18;
    const mr = Math.min(w, h) * 0.032;
    const halo = ctx.createRadialGradient(mx, my, mr * 0.5, mx, my, mr * 6);
    halo.addColorStop(0, `rgba(255, 238, 210, ${0.25 * moonAlpha})`);
    halo.addColorStop(1, "rgba(255, 238, 210, 0)");
    ctx.fillStyle = halo;
    ctx.fillRect(mx - mr * 6, my - mr * 6, mr * 12, mr * 12);
    ctx.fillStyle = `rgba(255, 244, 222, ${0.95 * moonAlpha})`;
    ctx.beginPath();
    ctx.arc(mx, my, mr, 0, Math.PI * 2);
    ctx.fill();

    // Clouds
    if (s.cloud > 0.01) {
      for (const cloud of clouds) {
        const x = ((((cloud.x + t * (0.004 + s.wind * 0.02)) % 1.3) + 1.3) % 1.3) - 0.15;
        for (const [dx, dy, r] of cloud.puffs) {
          const cx = (x + dx * cloud.s) * w;
          const cy = (cloud.y + dy * cloud.s) * h;
          const rad = r * cloud.s * w;
          const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, rad);
          const shade = dawn > 0.3 ? "120, 110, 130" : "44, 46, 64";
          g.addColorStop(0, `rgba(${shade}, ${0.75 * s.cloud})`);
          g.addColorStop(1, `rgba(${shade}, 0)`);
          ctx.fillStyle = g;
          ctx.fillRect(cx - rad, cy - rad, rad * 2, rad * 2);
        }
      }
    }

    // Lightning
    if (bolt && flash > 0.35) {
      ctx.strokeStyle = `rgba(240, 240, 255, ${flash})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      bolt.forEach(([x, y], i) => (i ? ctx.lineTo(x * w, y * h) : ctx.moveTo(x * w, y * h)));
      ctx.stroke();
    }
    if (flash > 0.01) {
      ctx.fillStyle = `rgba(210, 215, 255, ${flash * 0.45})`;
      ctx.fillRect(0, 0, w, h * HORIZON);
    }

    // Birds at dawn
    if (birds.length) {
      ctx.strokeStyle = `rgba(30, 26, 44, ${0.75})`;
      ctx.lineWidth = 1.4;
      for (const bird of birds) {
        const flap = Math.sin(t * 9 + bird.phase) * 0.6;
        const bx = bird.x * w;
        const by = bird.y * h;
        const span = Math.min(w, h) * 0.012;
        ctx.beginPath();
        ctx.moveTo(bx - span, by - span * flap);
        ctx.quadraticCurveTo(bx - span * 0.4, by - span * 0.2, bx, by);
        ctx.quadraticCurveTo(bx + span * 0.4, by - span * 0.2, bx + span, by - span * flap);
        ctx.stroke();
      }
    }

    // Hills
    fillRidge(farHills, mixColor(HILLS_FAR[0], HILLS_FAR[1], dawn), HORIZON + 0.05);
    fillRidge(nearHills, mixColor(HILLS_NEAR[0], HILLS_NEAR[1], dawn), HORIZON + 0.05);

    drawLake(t, s, low, mx, mr, moonAlpha);
    drawGround(t, s);
    if (s.fire > 0.02) drawFire(t, s.fire);
    drawGrass(t, s);
    if (s.fireflies > 0.5) drawFireflies(t, s.fireflies);
    if (s.raindrops > 0.5) drawRain(s);

    // A light veil when lightning strikes, so the whole scene flickers.
    if (flash > 0.01) {
      ctx.fillStyle = `rgba(200, 205, 255, ${flash * 0.12})`;
      ctx.fillRect(0, 0, w, h);
    }
  }

  /** @param {number} t @param {number} level */
  function drawAurora(t, level) {
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    for (let band = 0; band < 3; band++) {
      const baseY = h * (0.12 + band * 0.07);
      const hue = band === 1 ? "160, 120, 255" : "90, 230, 190";
      for (let i = 0; i <= 60; i++) {
        const x = (i / 60) * w;
        const y = baseY + Math.sin(i * 0.18 + t * 0.25 + band * 2) * h * 0.035;
        const height = h * (0.08 + 0.05 * Math.sin(i * 0.31 + t * 0.4 + band));
        const g = ctx.createLinearGradient(0, y - height, 0, y + 4);
        g.addColorStop(0, `rgba(${hue}, 0)`);
        g.addColorStop(1, `rgba(${hue}, ${0.07 * level})`);
        ctx.fillStyle = g;
        ctx.fillRect(x, y - height, w / 60 + 1, height + 4);
      }
    }
    ctx.restore();
  }

  /** @param {number[][]} points @param {string} colour @param {number} bottom */
  function fillRidge(points, colour, bottom) {
    ctx.fillStyle = colour;
    ctx.beginPath();
    ctx.moveTo(0, bottom * h);
    for (const [x, y] of points) ctx.lineTo(x * w, y * h);
    ctx.lineTo(w, bottom * h);
    ctx.closePath();
    ctx.fill();
  }

  /**
   * @param {number} t @param {SceneState} s @param {string} skyLow
   * @param {number} mx @param {number} mr @param {number} moonAlpha
   */
  function drawLake(t, s, skyLow, mx, mr, moonAlpha) {
    const y0 = h * (HORIZON + 0.015);
    const y1 = h * SHORE;
    const water = ctx.createLinearGradient(0, y0, 0, y1);
    water.addColorStop(0, blend(skyLow, "rgb(10, 12, 26)", 0.45));
    water.addColorStop(1, "rgb(8, 10, 22)");
    ctx.fillStyle = water;
    ctx.fillRect(0, y0, w, y1 - y0);

    // Shimmering swell lines, taller and faster with the waves slider
    const swell = 0.25 + s.waves * 0.75;
    ctx.strokeStyle = `rgba(200, 210, 255, ${0.05 + s.waves * 0.12})`;
    ctx.lineWidth = 1;
    for (let row = 0; row < 26; row++) {
      const k = row / 25;
      const y = y0 + (y1 - y0) * k * k;
      ctx.beginPath();
      for (let i = 0; i <= 40; i++) {
        const x = (i / 40) * w;
        const dy = Math.sin(i * 0.9 + t * (0.6 + s.waves * 1.2) + row * 1.7) * swell * (1 + k * 4);
        if (i === 0) ctx.moveTo(x, y + dy);
        else ctx.lineTo(x, y + dy);
      }
      ctx.stroke();
    }

    // The moon's reflection, broken up by the water
    if (moonAlpha > 0.02) {
      ctx.fillStyle = `rgba(255, 240, 214, ${0.5 * moonAlpha})`;
      for (let i = 0; i < 18; i++) {
        const k = i / 17;
        const y = y0 + (y1 - y0) * k;
        const wobble = Math.sin(t * (1 + s.waves * 2) + i * 1.3) * mr * (0.6 + s.waves * 1.5);
        const width = mr * (1.4 - k * 0.6) * (0.6 + 0.4 * Math.sin(t * 2 + i));
        ctx.fillRect(mx - width / 2 + wobble, y, width, 1.5 + k * 2);
      }
    }

    // Rain ripples
    ctx.lineWidth = 1;
    for (const ripple of ripples) {
      const r = ripple.age * w * 0.018;
      ctx.strokeStyle = `rgba(210, 220, 255, ${0.35 * (1 - ripple.age)})`;
      ctx.beginPath();
      ctx.ellipse(ripple.x * w, ripple.y * h, r, r * 0.28, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  /** @param {number} t @param {SceneState} s */
  function drawGround(t, s) {
    const y0 = h * SHORE;
    ctx.fillStyle = mixColor(GROUND[0], GROUND[1], s.dawn);
    ctx.beginPath();
    ctx.moveTo(0, y0 + 4);
    for (let i = 0; i <= 20; i++) ctx.lineTo((i / 20) * w, y0 + Math.sin(i * 1.3) * 3);
    ctx.lineTo(w, h);
    ctx.lineTo(0, h);
    ctx.fill();

    // Firelight on the ground and the tent
    if (s.fire > 0.02) {
      const flicker = reducedMotion ? 1 : 0.85 + 0.15 * Math.sin(t * 13) * Math.sin(t * 7.1);
      const fx = FIRE_X * w;
      const fy = FIRE_Y * h;
      const radius = w * (0.12 + s.fire * 0.2);
      const glow = ctx.createRadialGradient(fx, fy, 0, fx, fy, radius);
      glow.addColorStop(0, `rgba(255, 150, 70, ${0.45 * s.fire * flicker})`);
      glow.addColorStop(1, "rgba(255, 150, 70, 0)");
      ctx.fillStyle = glow;
      ctx.fillRect(fx - radius, fy - radius, radius * 2, radius * 2);
    }

    // Tent
    const tx = (FIRE_X + 0.085) * w;
    const ty = FIRE_Y * h + h * 0.012;
    const tw = Math.min(w, h) * 0.09;
    ctx.fillStyle = mixColor([22, 20, 36], [70, 60, 80], s.dawn);
    ctx.beginPath();
    ctx.moveTo(tx - tw / 2, ty);
    ctx.lineTo(tx, ty - tw * 0.7);
    ctx.lineTo(tx + tw / 2, ty);
    ctx.fill();
    if (s.fire > 0.02) {
      ctx.fillStyle = `rgba(255, 150, 80, ${0.35 * s.fire})`;
      ctx.beginPath();
      ctx.moveTo(tx - tw / 2, ty);
      ctx.lineTo(tx, ty - tw * 0.7);
      ctx.lineTo(tx - tw * 0.08, ty);
      ctx.fill();
    }
  }

  /** @param {number} t @param {number} level */
  function drawFire(t, level) {
    const fx = FIRE_X * w;
    const fy = FIRE_Y * h;
    const size = Math.min(w, h) * 0.05 * (0.5 + level);
    // Logs
    ctx.strokeStyle = "rgb(40, 26, 20)";
    ctx.lineWidth = Math.max(3, size * 0.14);
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(fx - size * 0.7, fy + size * 0.12);
    ctx.lineTo(fx + size * 0.7, fy - size * 0.05);
    ctx.moveTo(fx - size * 0.6, fy - size * 0.05);
    ctx.lineTo(fx + size * 0.65, fy + size * 0.14);
    ctx.stroke();
    // Flames
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    for (let i = 0; i < 5; i++) {
      const sway = reducedMotion ? 0 : Math.sin(t * (6 + i) + i * 2) * size * 0.12;
      const height = size * (0.9 + 0.5 * Math.sin(t * (9 + i * 1.7) + i)) * (i === 2 ? 1.5 : 1);
      const x = fx + (i - 2) * size * 0.2;
      const g = ctx.createLinearGradient(0, fy, 0, fy - height);
      g.addColorStop(0, "rgba(255, 200, 90, 0.9)");
      g.addColorStop(0.5, "rgba(255, 110, 40, 0.55)");
      g.addColorStop(1, "rgba(255, 60, 20, 0)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(x - size * 0.22, fy);
      ctx.quadraticCurveTo(x - size * 0.25, fy - height * 0.5, x + sway, fy - height);
      ctx.quadraticCurveTo(x + size * 0.25, fy - height * 0.5, x + size * 0.22, fy);
      ctx.fill();
    }
    // Sparks
    ctx.fillStyle = "rgba(255, 190, 110, 0.9)";
    for (const spark of sparks) {
      ctx.globalAlpha = 1 - spark.age;
      ctx.fillRect(spark.x * w, spark.y * h, 2, 2);
    }
    ctx.restore();
  }

  /** @param {number} t @param {SceneState} s */
  function drawGrass(t, s) {
    ctx.strokeStyle = mixColor([14, 16, 26], [44, 48, 52], s.dawn);
    ctx.lineWidth = 1.3;
    const lean = s.wind * 0.6;
    for (const blade of grass) {
      const bx = blade.x * w;
      const by = blade.y * h;
      const len = blade.len * h * (0.6 + blade.y);
      const sway = reducedMotion
        ? 0
        : Math.sin(t * (1.2 + s.wind * 2.5) + blade.phase + blade.x * 6) * (0.1 + s.wind * 0.35);
      const tip = (lean + sway) * len;
      ctx.beginPath();
      ctx.moveTo(bx, by);
      ctx.quadraticCurveTo(bx + tip * 0.3, by - len * 0.6, bx + tip, by - len);
      ctx.stroke();
    }
  }

  /** @param {number} t @param {number} count */
  function drawFireflies(t, count) {
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    const n = Math.round(count);
    for (let i = 0; i < n; i++) {
      const fly = flies[i];
      const x = (fly.x + Math.sin(t * fly.speed + fly.phase) * 0.03) * w;
      const y = (fly.y + Math.cos(t * fly.speed * 1.3 + fly.phase) * 0.02) * h;
      const pulse = reducedMotion ? 0.7 : Math.max(0, Math.sin(t * 1.6 + fly.phase * 3));
      const r = 8;
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, `rgba(220, 255, 140, ${0.9 * pulse})`);
      g.addColorStop(1, "rgba(220, 255, 140, 0)");
      ctx.fillStyle = g;
      ctx.fillRect(x - r, y - r, r * 2, r * 2);
    }
    ctx.restore();
  }

  /** @param {SceneState} s */
  function drawRain(s) {
    const n = Math.min(drops.length, Math.round(s.raindrops));
    const slant = s.wind * 0.35;
    ctx.strokeStyle = s.dawn > 0.4 ? "rgba(70, 76, 110, 0.45)" : "rgba(180, 195, 255, 0.32)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = 0; i < n; i++) {
      const d = drops[i];
      const len = d.len * h * 0.03;
      const x = d.x * w;
      const y = d.y * h;
      ctx.moveTo(x, y);
      ctx.lineTo(x - slant * len, y + len);
    }
    ctx.stroke();
  }

  // ---- Motion ----

  /** @param {number} dt */
  function step(dt, /** @type {number} */ t) {
    const ease = 1 - Math.exp(-dt * 1.8);
    for (const key of /** @type {(keyof SceneState)[]} */ (Object.keys(target))) {
      now[key] += (target[key] - now[key]) * ease;
    }
    flash = Math.max(0, flash - dt * 2.4);
    aurora = Math.max(0, aurora - dt * 0.6);

    for (const d of drops) {
      d.y += dt * d.v * 1.4;
      d.x -= dt * now.wind * 0.35 * d.v * 0.5;
      if (d.y > 1) {
        d.y -= 1.05;
        d.x = rng();
      }
      if (d.x < 0) d.x += 1;
    }

    rippleDebt += now.ripples * dt;
    while (rippleDebt >= 1) {
      rippleDebt -= 1;
      ripples.push({ x: rng(), y: between(rng, HORIZON + 0.03, SHORE - 0.01), age: 0 });
    }
    ripples = ripples.filter((r) => (r.age += dt * 0.8) < 1);

    sparkDebt += now.fire * 10 * dt;
    while (sparkDebt >= 1) {
      sparkDebt -= 1;
      sparks.push({
        x: FIRE_X + between(rng, -0.01, 0.01),
        y: FIRE_Y - 0.02,
        vx: between(rng, -0.01, 0.01),
        vy: between(rng, 0.05, 0.12),
        age: 0,
      });
    }
    sparks = sparks.filter((sp) => {
      sp.x += (sp.vx + Math.sin(t * 3 + sp.y * 40) * 0.004 + now.wind * 0.02) * dt;
      sp.y -= sp.vy * dt;
      sp.age += dt * 0.7;
      return sp.age < 1;
    });

    birdClock += dt;
    if (now.dawn > 0.2 && birdClock > 4 / now.dawn && birds.length < 6) {
      birdClock = 0;
      const fromLeft = rng() < 0.5;
      birds.push({
        x: fromLeft ? -0.05 : 1.05,
        y: between(rng, 0.12, 0.4),
        v: (fromLeft ? 1 : -1) * between(rng, 0.03, 0.06),
        phase: rng() * 6,
      });
    }
    birds = birds.filter((b) => {
      b.x += b.v * dt;
      b.y += Math.sin(t + b.phase) * 0.002 * dt;
      return b.x > -0.1 && b.x < 1.1;
    });
  }

  function frame(/** @type {number} */ time) {
    const dt = Math.min(0.1, (time - last) / 1000);
    last = time;
    step(dt, time / 1000);
    draw(time / 1000);
    raf = requestAnimationFrame(frame);
  }

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    w = canvas.clientWidth;
    h = canvas.clientHeight;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (reducedMotion) draw(0);
  }

  new ResizeObserver(resize).observe(canvas);
  resize();

  if (!reducedMotion) raf = requestAnimationFrame(frame);

  return {
    /** @param {Levels} levels */
    setLevels(levels) {
      target = sceneFromLevels(levels);
      if (reducedMotion) {
        Object.assign(now, target);
        draw(0);
      }
    },
    /** @param {number} intensity */
    flash(intensity) {
      if (reducedMotion) return;
      flash = Math.max(flash, intensity);
      if (intensity > 0.6) {
        let x = between(rng, 0.15, 0.85);
        bolt = [[x, 0.05]];
        for (let y = 0.05; y < HORIZON - 0.05; y += between(rng, 0.03, 0.07)) {
          x += between(rng, -0.03, 0.03);
          bolt.push([x, y]);
        }
      } else bolt = null;
    },
    note() {
      aurora = Math.min(1, aurora + 0.5);
    },
    stop() {
      cancelAnimationFrame(raf);
    },
  };
}

/** @param {readonly number[]} c */
const rgb = (c) => `rgb(${c.join(", ")})`;

/** Blend two "rgb(r, g, b)" strings. @param {string} a @param {string} b @param {number} t */
function blend(a, b, t) {
  const pa = a.match(/\d+/g)?.map(Number) ?? [0, 0, 0];
  const pb = b.match(/\d+/g)?.map(Number) ?? [0, 0, 0];
  return mixColor(pa, pb, t);
}
