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
| 2026-10-13 | Tamil stroke files for ஆ and உ are placeholders. | Brief: the owner authors Tamil stroke order with `/?dev=strokes`. | — |

## Not built yet (from the brief)

- PWA / offline caching (`vite-plugin-pwa`) and the airplane-mode test
- Playwright e2e tests (same-origin network test, 200 random taps on the gate, screenshot tests)
- `scripts/check-budgets.ts`, `scripts/optimize-assets.ts` (gltf-transform + meshopt), `scripts/build-letters.ts`
- Automatic quality-tier downgrade while playing (a tier is picked at boot)
- Cue Recorder (`/?dev=cues`) and the recorded song
- Tamil text for the grown-ups area and `privacy.html`
- Separately animated Buzzy wings and eyes (the GLB has them fused to the body)
