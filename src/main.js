import {
  CHANNELS,
  PRESETS,
  applyPreset,
  decodeMix,
  defaultMix,
  describeMix,
  encodeMix,
  isSilent,
  matchingPreset,
  randomMix,
  withLevel,
} from "./core/mix.js";
import { createRng } from "./core/random.js";
import { SLEEP_OPTIONS, createSleepTimer, formatRemaining } from "./core/timer.js";
import { SoundEngine } from "./audio/engine.js";
import { createNightScene } from "./scene/night.js";
import { icon } from "./ui/icons.js";

/** @typedef {import("./core/mix.js").Mix} Mix */
/** @typedef {import("./core/mix.js").ChannelId} ChannelId */

const STORAGE_KEY = "drift:mix";
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const $ = (/** @type {string} */ selector) => /** @type {HTMLElement} */ (document.querySelector(selector));

for (const el of document.querySelectorAll("[data-icon]")) {
  el.outerHTML = icon(/** @type {any} */ (el.getAttribute("data-icon")));
}

// ---------- State ----------

/** @returns {Mix} */
function loadMix() {
  const fromLink = decodeMix(location.hash);
  if (fromLink) return fromLink;
  try {
    const saved = decodeMix(localStorage.getItem(STORAGE_KEY) ?? "");
    if (saved) return saved;
  } catch {
    // Storage can be blocked; the default mix is fine.
  }
  return defaultMix();
}

let mix = loadMix();
/** Levels to restore when a muted sound is switched back on. */
const lastOn = /** @type {Record<ChannelId, number>} */ ({});
/** @type {ReturnType<typeof createSleepTimer> | null} */
let sleep = null;
const rng = createRng(Date.now());

const scene = createNightScene(/** @type {HTMLCanvasElement} */ ($("[data-scene]")), { reducedMotion });
const engine = new SoundEngine({
  onFlash: ({ intensity }) => scene.flash(intensity),
  onNote: () => scene.note(),
});

// ---------- Rendering ----------

const channelList = $("[data-channels]");
channelList.innerHTML = CHANNELS.map(
  (c, i) => `
  <li class="channel" data-channel="${c.id}">
    <button class="channel__toggle" type="button" data-toggle="${c.id}" aria-pressed="false"
      aria-label="${c.label}" title="${c.hint} (${i + 1})">${icon(c.id)}</button>
    <label class="channel__label" for="level-${c.id}">${c.label}</label>
    <input class="channel__slider" id="level-${c.id}" type="range" min="0" max="100" step="1" data-level="${c.id}" />
  </li>`
).join("");

const presetBar = $("[data-presets]");
presetBar.innerHTML = PRESETS.map(
  (p) => `<button class="chip" type="button" data-preset="${p.id}" aria-pressed="false">${p.name}</button>`
).join("");

const sleepSelect = /** @type {HTMLSelectElement} */ ($("[data-sleep]"));
sleepSelect.innerHTML = SLEEP_OPTIONS.map(
  (m) => `<option value="${m}">${m === 0 ? "No timer" : `Stop in ${m} min`}</option>`
).join("");

const master = /** @type {HTMLInputElement} */ ($("[data-master]"));

function render() {
  for (const c of CHANNELS) {
    const level = mix.levels[c.id];
    const slider = /** @type {HTMLInputElement} */ (channelList.querySelector(`[data-level="${c.id}"]`));
    slider.value = String(Math.round(level * 100));
    slider.style.setProperty("--fill", `${level * 100}%`);
    slider.setAttribute("aria-valuetext", level > 0 ? `${Math.round(level * 100)} percent` : "off");
    const row = /** @type {HTMLElement} */ (channelList.querySelector(`[data-channel="${c.id}"]`));
    row.classList.toggle("is-on", level > 0);
    row.querySelector("[data-toggle]")?.setAttribute("aria-pressed", String(level > 0));
  }
  master.value = String(Math.round(mix.master * 100));
  master.style.setProperty("--fill", `${mix.master * 100}%`);

  const preset = matchingPreset(mix);
  for (const chip of presetBar.querySelectorAll("[data-preset]")) {
    chip.setAttribute("aria-pressed", String(chip.getAttribute("data-preset") === preset?.id));
  }
  $("[data-mix-name]").textContent = preset ? preset.name : describeMix(mix);
}

function renderPlaying() {
  const playing = engine.playing;
  const button = $("[data-play]");
  button.innerHTML = icon(playing ? "pause" : "play");
  button.setAttribute("aria-label", playing ? "Pause" : "Play");
  button.setAttribute("aria-pressed", String(playing));
  document.body.classList.toggle("is-playing", playing);
  $("[data-state]").textContent = playing
    ? "Now playing"
    : isSilent(mix)
      ? "Turn a sound up"
      : "Press play to begin";
  if ("mediaSession" in navigator) {
    navigator.mediaSession.playbackState = playing ? "playing" : "paused";
  }
}

// ---------- Changes ----------

let saveTimer = 0;
/** @param {Mix} next */
function setMix(next) {
  mix = next;
  render();
  scene.setLevels(mix.levels);
  engine.setMix(mix);
  renderPlaying();
  updateMediaSession();
  // Keep the address bar shareable and remember the mix, without spamming history.
  clearTimeout(saveTimer);
  saveTimer = window.setTimeout(() => {
    const hash = encodeMix(mix);
    history.replaceState(null, "", hash);
    try {
      localStorage.setItem(STORAGE_KEY, hash);
    } catch {
      // Not saved; it still works for this visit.
    }
  }, 300);
}

async function togglePlay() {
  if (engine.playing) await engine.pause();
  else await engine.play(mix);
  renderPlaying();
}

/** @param {ChannelId} id */
function toggleChannel(id) {
  const level = mix.levels[id];
  if (level > 0) {
    lastOn[id] = level;
    setMix(withLevel(mix, id, 0));
  } else {
    setMix(withLevel(mix, id, lastOn[id] || 0.5));
  }
}

channelList.addEventListener("input", (event) => {
  const target = /** @type {HTMLInputElement} */ (event.target);
  const id = /** @type {ChannelId | undefined} */ (target.dataset.level);
  if (id) setMix(withLevel(mix, id, Number(target.value) / 100));
});

channelList.addEventListener("click", (event) => {
  const button = /** @type {HTMLElement} */ (event.target).closest("[data-toggle]");
  if (button) toggleChannel(/** @type {ChannelId} */ (button.getAttribute("data-toggle")));
});

presetBar.addEventListener("click", (event) => {
  const chip = /** @type {HTMLElement} */ (event.target).closest("[data-preset]");
  const preset = PRESETS.find((p) => p.id === chip?.getAttribute("data-preset"));
  if (preset) setMix(applyPreset(mix, preset));
});

master.addEventListener("input", () => setMix({ ...mix, master: Number(master.value) / 100 }));

$("[data-play]").addEventListener("click", togglePlay);
$("[data-random]").addEventListener("click", () => setMix(randomMix(rng, mix.master)));

// ---------- Sleep timer ----------

const remainingEl = $("[data-remaining]");
sleepSelect.addEventListener("change", () => {
  const minutes = Number(sleepSelect.value);
  sleep = minutes > 0 ? createSleepTimer(minutes, Date.now()) : null;
  engine.setFade(1);
  updateTimer();
});

async function updateTimer() {
  if (!sleep) {
    remainingEl.hidden = true;
    return;
  }
  const t = Date.now();
  remainingEl.hidden = false;
  remainingEl.textContent = formatRemaining(sleep.remaining(t));
  engine.setFade(sleep.gain(t));
  if (sleep.done(t)) {
    sleep = null;
    sleepSelect.value = "0";
    remainingEl.hidden = true;
    if (engine.playing) await engine.pause();
    engine.setFade(1);
    renderPlaying();
  }
}
setInterval(updateTimer, 1000);

// ---------- Share ----------

const shareLabel = $("[data-share-label]");
$("[data-share]").addEventListener("click", async () => {
  const url = `${location.origin}${location.pathname}${encodeMix(mix)}`;
  try {
    if (navigator.share && matchMedia("(pointer: coarse)").matches) {
      await navigator.share({ title: `Drift: ${describeMix(mix)}`, url });
      return;
    }
    await navigator.clipboard.writeText(url);
    shareLabel.textContent = "Link copied";
  } catch {
    shareLabel.textContent = "Copy the address bar";
  }
  setTimeout(() => (shareLabel.textContent = "Share mix"), 2200);
});

// ---------- About ----------

const about = /** @type {HTMLDialogElement} */ ($("[data-about-dialog]"));
$("[data-about]").addEventListener("click", () => about.showModal());
about.addEventListener("click", (event) => {
  if (event.target === about) about.close();
});

// ---------- Keyboard ----------

document.addEventListener("keydown", (event) => {
  if (event.metaKey || event.ctrlKey || event.altKey || about.open) return;
  const target = event.target instanceof Element ? event.target : document.body;
  const inControl = target.matches("input, select, textarea, button");
  const inText = target.matches("select, textarea");
  if (event.code === "Space" && !inControl) {
    event.preventDefault();
    togglePlay();
  } else if (/^[1-8]$/.test(event.key) && !inText) {
    toggleChannel(CHANNELS[Number(event.key) - 1].id);
  } else if (event.key.toLowerCase() === "r" && !inText) {
    setMix(randomMix(rng, mix.master));
  }
});

window.addEventListener("hashchange", () => {
  const linked = decodeMix(location.hash);
  if (linked) setMix(linked);
});

// ---------- Media controls (lock screen, headphones, keyboard media keys) ----------

function updateMediaSession() {
  if (!("mediaSession" in navigator)) return;
  navigator.mediaSession.metadata = new MediaMetadata({
    title: matchingPreset(mix)?.name ?? describeMix(mix),
    artist: "Drift",
    album: "Ambient soundscapes",
  });
}
if ("mediaSession" in navigator) {
  navigator.mediaSession.setActionHandler("play", () => !engine.playing && togglePlay());
  navigator.mediaSession.setActionHandler("pause", () => engine.playing && togglePlay());
}

render();
renderPlaying();
scene.setLevels(mix.levels);
updateMediaSession();
