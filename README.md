# Drift

[![CI](https://github.com/remikwisniewski/drift/actions/workflows/ci.yml/badge.svg)](https://github.com/remikwisniewski/drift/actions/workflows/ci.yml)
![Vanilla JS](https://img.shields.io/badge/JavaScript-ES2022-f7df1e?logo=javascript&logoColor=000)
![Web Audio](https://img.shields.io/badge/Web%20Audio-API-ffb27a)

**Live:** [remikwisniewski.github.io/drift](https://remikwisniewski.github.io/drift/)

An ambient soundscape mixer for focusing, reading or falling asleep. Blend rain, thunder, wind, waves, a campfire, crickets, birds and soft piano, over a night scene that changes with the mix.

There are no audio files. Every sound is synthesised live in the browser with the Web Audio API, from noise and oscillators.

## What you can do

- **Mix eight sounds** with a slider each, or click a sound's icon to switch it on and off.
- **Start from a preset:** Rainy night, Thunderstorm, Campfire, Seaside, Summer night or First light. Or press **Surprise me** for a random mix.
- **Watch the scene follow along.** Rain brings clouds and ripples on the lake, thunder flashes before it rumbles, wind sways the grass, the campfire lights the shore, crickets bring fireflies, birds bring the sunrise, and the keys light a soft aurora.
- **Set a sleep timer** for 15 to 90 minutes. The sound fades out over the last minute instead of stopping dead.
- **Share a mix.** The address bar always holds the current mix (`#rain=70&wind=20&keys=35&master=80`), so a link opens exactly what you hear.
- **Use the keyboard:** Space to play or pause, 1–8 to toggle a sound, R for a surprise. Media keys and lock-screen controls work too.

## How the sounds are made

| Sound    | Made from                                                                                                                                                                                        |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Rain     | Pink noise, band-limited, for the steady bed; plus up to about 50 individual drops a second, each a short burst of white noise through a random band-pass filter, panned across the stereo field |
| Thunder  | A flash first, then brown noise through a falling low-pass filter, 0.3–3.4 s later depending on distance; close strikes add a sharp crack                                                        |
| Wind     | Brown noise through a band-pass filter whose centre and level wander in gusts, plus a quiet layer of high "leaves"                                                                               |
| Waves    | Pink noise whose level and brightness swell every 6–11 seconds, a little white-noise foam on each crest, over a low undertow                                                                     |
| Campfire | A low brown-noise roar that breathes, and crackles that arrive at random, sometimes in bursts                                                                                                    |
| Crickets | Four sine tones near 4.5 kHz, gated into chirps of three or four pulses, two of them far away in the reverb                                                                                      |
| Birds    | Single oscillators swept into whistles, trills and chirps                                                                                                                                        |
| Keys     | A soft electric-piano tone (three sine partials) wandering through D major pentatonic over a slow D–Bm–G–A bass, in a large reverb                                                               |

Noise is generated once as stereo buffers (white, Paul Kellet's pink, and leaky-integrated brown), with different noise in each ear so the sound is wide. The reverb is a convolver with a generated, exponentially decaying impulse.

### Timing that survives a background tab

Browsers slow timers in hidden tabs to about once a second, and a soundscape mostly plays in a hidden tab. So events aren't triggered "now"; a scheduler books every drop, crackle, chirp and note on the audio clock 1.5 seconds ahead. Random events follow a Poisson process, so the rain never falls in a pattern. After a long pause, missed events are skipped rather than played all at once.

### Balanced levels

Each voice was rendered on its own in an `OfflineAudioContext` and measured, and per-voice trims bring them to similar loudness, so the middle of every slider means the same thing. Sliders use a squared curve, which matches how loudness is perceived. A gentle compressor on the master keeps the loudest mix (everything at full) from clipping.

## Engineering

- **Pure, typed core** (`src/core`): the mix model, presets, share-link encoding, noise generation, the scheduler, the sleep timer, music theory and the mix-to-scene mapping. No DOM and no Web Audio, with JSDoc types checked by TypeScript in strict mode.
- **53 unit tests at 100% coverage of the core:**
  - share links round-trip, and bad or hostile hashes are clamped or ignored
  - noise colours stay in range and get darker from white to pink to brown
  - the scheduler books exactly the events inside its window, caps a runaway rate and skips missed events
  - the fade only ever gets quieter, and the timer display never shows 0:00 while sound is playing
  - every melody note is in the scale, and the scene clouds over as rain and thunder build
- **Canvas scene** drawn from seeded scenery that eases towards the mix, so moving a slider changes the weather gradually. It respects `prefers-reduced-motion`.
- **Accessible:** labelled sliders with spoken values, toggle buttons with `aria-pressed`, a polite live region for the mix name, and full keyboard control.
- **CI and CD:** GitHub Actions lints, checks formatting, type-checks, tests with coverage thresholds and builds on every push, then deploys to GitHub Pages.

## Run it

Requires Node.js 20.19 or newer.

```bash
npm install
npm run dev
```

| Script             | What it does                             |
| ------------------ | ---------------------------------------- |
| `npm run dev`      | Start the Vite dev server                |
| `npm test`         | Run the test suite                       |
| `npm run coverage` | Tests with a coverage report             |
| `npm run check`    | Lint, format check, type-check and tests |
| `npm run build`    | Production build to `dist/`              |

## Project layout

```
src/
  core/        pure, typed, tested
    mix.js       channels, presets, share links
    noise.js     white, pink and brown noise; reverb impulse
    schedule.js  look-ahead booking on the audio clock
    random.js    seeded generator and Poisson gaps
    timer.js     sleep timer and fade
    music.js     pentatonic scale and bass roots
    scene.js     what the scene shows for a mix
  audio/       Web Audio graph and the eight voices
  scene/       the canvas night scene
  ui/          icons
  main.js      wires the mixer, audio, scene and keyboard
tests/         Vitest suites
```

## License

MIT © Remigiusz Wisniewski
