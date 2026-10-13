# Decisions

| Date | Decision | Why | Alternative rejected |
|---|---|---|---|
| 2026-10-13 | `three@0.186.1`, pinned. The only runtime dependency (~150 KB of the 185 KB gzip bundle). | Rendering engine required by the brief. | WebGPU renderer: weaker reach on low-end Android and older iPads. |
| 2026-10-13 | Dev-only dependencies, 0 KB shipped: `vite@8.3.4`, `vitest@5.0.4`, `typescript@7.0.2`, `@types/three@0.186.0`, `@types/node@24.19.2`. | Build, test, types. | — |
| 2026-10-13 | Content validation is a hand-written check in `tests/unit/content.test.ts`. | Zero dependencies, runs in CI, and also covers file existence (models, strokes, VO lines). | `zod`: an extra dependency for the same checks. |
| 2026-10-13 | Remaining 3D assets are built in code (`src/procedural/`), not with Higgsfield: rock, bush, island, path, pond, sky, clouds, grass, flowers. | Owner's decision; credits ran out after 18 GLBs. Low-poly merged meshes, one draw call each. | Generating the rock and bush with Higgsfield (30 credits each). |
| 2026-10-13 | Glyphs are drawn with the platform font on canvas; the "3D" letter is a stack of glyph-shaped layers (2 draw calls). | Works for Latin and Tamil with no font files or outline extraction; Tamil uses Tamil Sangam MN / Noto Sans Tamil. | `opentype.js` + `build-letters.ts`: needs self-hosted font files first. **TODO:** self-host Baloo 2 / Baloo Thambi 2 (OFL). |
| 2026-10-13 | Mini-games run on a separate play meadow (world z = 95), not at the bud. | Clean, predictable layout for every template; the garden never occludes the game. | Playing in place at each bud. |
| 2026-10-13 | All SFX and the music loop are synthesised with Web Audio. Music ducks to 0.12 while VO plays. | No audio assets exist yet; zero bytes to download. | Shipping placeholder audio files. |
| 2026-10-13 | VO uses `speechSynthesis` (en-IN, ta-IN when available, otherwise a chime). Recorded files plug in through `vo-manifest.json` with no code change. | Brief §6.4 placeholder plan. | — |
| 2026-10-13 | Basket Match says the letter name ("Which one starts with C?") rather than a phoneme. | TTS reads phoneme spellings badly; recorded VO can switch `{sound}` to the real sound. | Phonetic spellings such as "kuh". |
| 2026-10-13 | Sing-along stand-in: a camera rail past every bud with spoken lines. | No song or cue file exists yet. **TODO(content):** song + `cues.{lang}.json` + Cue Recorder. | Leaving the gazebo inert. |
| 2026-10-13 | GLB textures shrunk to 512² JPEG (q85) before import. | Brings every model under 400 KB except the gazebo (519 KB, geometry-heavy), which needs meshopt in `optimize-assets`. | Shipping the raw 1.2–3.6 MB GLBs. |
| 2026-10-13 | No `ASSETS.md` licence log, by the owner's choice. | Owner instruction. Brief §10.6 asks for one before shipping to schools. | — |
| 2026-10-13 | `vite-plugin-pwa@2.0.0` (dev; pulls `workbox-build`/`workbox-window` 7.4.1). Ships `sw.js` 0.9 KB + Workbox runtime 7.1 KB gzip. | The brief's choice; supports Vite 8; generates the precache manifest from the build. | A hand-written service worker: less tooling, but the precache list and revisioning would need maintaining by hand. |
| 2026-10-13 | Precache the app shell only (13 files); models and audio use runtime CacheFirst (`buzzy-packs`). On a first visit the game waits ≤ 4 s for the worker to control the page before loading models. | Each model is downloaded once, and all 18 are cached after one visit (the other language warms in the background). | Precaching every GLB: downloads ~3.9 MB twice on the first visit. |
| 2026-10-13 | Service worker registered by hand (`src/core/offline.ts`); `injectRegister: false`. | The plugin's inline register script would violate the `script-src 'self'` CSP. | `injectRegister: 'inline'`. |
| 2026-10-13 | PWA icons drawn by `scripts/make-icons.mjs` (Node zlib, no dependencies). | Reproducible, no design tool or extra package. | `@vite-pwa/assets-generator` (adds sharp). |
| 2026-10-13 | `@playwright/test@1.64.0` (dev) on the installed Google Chrome (`channel: 'chrome'`). | No ~150 MB browser download; GitHub's runners have Chrome preinstalled. | Bundled Chromium (`npx playwright install chromium`), one config line away. |
| 2026-10-13 | E2E runs a production-optimised `--mode e2e` build that exposes `window.__buzzy`; the test hook is compiled out of the real production bundle. | Lets tests drive moving 3D targets reliably without shipping test code. | Testing the dev server (no service worker, unminified code). |
| 2026-10-13 | Tamil glyph screenshot tests capture a static 2D Glyph Sheet (`/?dev=glyphs`) drawn with the game's own glyph functions, not the 3D scene. Plus an ink-signature check (has ink, isn't the missing-glyph box, all six distinct). | Deterministic pixels; the WebGL scene animates and its anti-aliasing varies by GPU. The signature check catches a broken font even if someone accepts a bad baseline. | Screenshotting the running game. |
| 2026-10-13 | Screenshot baselines are per platform (`*-darwin.png` committed); 1% pixel tolerance, and tighter per-pixel colour matching on the tracing boards because the letter is faint there. | Fonts differ by OS. A mutation check (ஆ swapped for அ) fails three tests. | One cross-platform baseline: needs a self-hosted font first (Baloo Thambi 2), which would also make CI baselines match macOS. |
| 2026-10-13 | Tamil stroke files for ஆ and உ are placeholders. | Brief: the owner authors Tamil stroke order with `/?dev=strokes`. | — |

## Not built yet (from the brief)

- Lighthouse / installability check in CI
- `scripts/check-budgets.ts`, `scripts/optimize-assets.ts` (gltf-transform + meshopt), `scripts/build-letters.ts`
- Automatic quality-tier downgrade while playing (a tier is picked at boot)
- Cue Recorder (`/?dev=cues`) and the recorded song
- Tamil text for the grown-ups area and `privacy.html`
- Separately animated Buzzy wings and eyes (the GLB has them fused to the body)
