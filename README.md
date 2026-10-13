# Buzzy ABC Garden

A browser-based 3D letter garden for children aged 3–6, in English and Tamil. Buzzy the bee flies around a floating island; each flower bud holds a letter. Tap a bud to **hear** the letter, **play** a short mini-game, and **watch** the bud bloom into the letter's object.

Built with Vite + TypeScript + three.js (WebGL2). No frameworks, no third-party requests, no personal data.

## Run

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # unit tests: trace rules, content + i18n checks
npm run e2e        # Playwright end-to-end tests (uses your installed Google Chrome)
npm run build      # type-check + production build into dist/ (service worker included) + budget check
npm run optimize-assets   # process new/changed GLBs in public/assets/models (see below)
npm run check-budgets     # full budget report against dist/ (the build runs it with --quiet)
```

### End-to-end tests

`npm run e2e` builds an e2e variant (`vite build --mode e2e`, production-optimised plus a test hook) and serves it under `/play/`. It then runs `tests/e2e/` in Chrome:

- a full play session makes only same-origin requests (service-worker fetches included)
- the garden stays within 80 draw calls; the child HUD has no text
- all three templates play end to end (A, B, C) and in Tamil (அ). Wrong answers never block, cheat taps and off-path drags are ignored in tracing, Home abandons a letter, and progress survives a reload
- 200 random taps never open the parent gate; a 3 s hold plus the right answer does; three wrong answers close it; parent settings apply
- the game plays when `localStorage` throws or is missing
- after one online visit, the game loads and plays offline, in both languages
- the manifest and icons are served, and portrait screens show the rotate prompt
- quality step-down: 60 ms of artificial work per frame drops high → mid → low (pixel ratio 2 → 1.5 → 1) one tier per 3 s and never back up; a single 400 ms hitch changes nothing
- **Tamil glyph screenshots** (`glyphs.spec.ts`): each of அ ஆ இ ஈ உ ஊ as bubble, badge and 3D-letter face, plus the ஆ/உ tracing boards, compared against approved baselines. A separate check proves every glyph has real ink, isn't the missing-glyph box, and differs from the others.

Screenshot baselines live in `tests/e2e/glyphs.spec.ts-snapshots/` and are per platform, because Tamil fonts differ by OS. The committed ones are `*-darwin.png` (macOS, Tamil Sangam MN). A Linux CI runner needs its own baselines, made once with `--update-snapshots` on that runner, plus a Tamil font such as `fonts-noto-core`. After an intended change (for example new Tamil strokes), review `/?dev=glyphs`, then run `npx playwright test glyphs --update-snapshots`.

The tests drive the game through `tests/e2e/harness.js`, which projects 3D objects to screen space and dispatches real pointer events. Speech is stubbed so voice lines finish instantly. To use Playwright's bundled Chromium instead of Chrome, remove `channel: 'chrome'` from `playwright.config.ts` and run `npx playwright install chromium`.

### Offline (PWA)

Production builds include a service worker (`vite-plugin-pwa`, `sw.js`) and a web app manifest. The app shell (HTML, JS, CSS, icons, manifest, privacy page) is precached. Models and recorded audio are cached the first time they load. On a first visit the game waits up to 4 s for the worker to take control before loading models, so every model is downloaded once and kept. After one full online visit, both languages play in airplane mode. Icons are drawn by `npm run icons` (`scripts/make-icons.mjs`, no dependencies).

Testing on phones and tablets: `npm run qa` builds the QA version and serves it to your Wi-Fi network. Then work through [docs/QA_CHECKLIST.md](docs/QA_CHECKLIST.md).

Dev-only tools (stripped from production builds; also in the QA build):

- `/?dev=perf`: fps, draw calls, triangles, GPU memory, quality tier and pixel ratio, and `ready` (seconds until the Play button appears)
- `/?dev=models`: Model Gallery. All 18 GLBs in a grid with the game's toon shading; add `&spin=0` to freeze. Use it after `npm run optimize-assets`.
- `/?dev=glyphs`: Glyph Sheet. Every letter drawn exactly as the game draws it (bubble, badge, 3D-letter face, tracing board). Use it for the Tamil review. Also available in the e2e build.
- `/?dev=strokes`: Stroke Editor. Pick a letter, click to place points, Enter ends a stroke, Export copies the JSON for `src/data/strokes/{lang}/{id}.json`.

## Quality tiers

The game picks a render tier at boot and steps down by itself on slow devices (`src/core/quality.ts`, `src/core/qualityGovernor.ts`):

| Tier | Pixel ratio | Particles | Decorative flowers |
|---|---|---|---|
| high | up to 2 | 200 | all |
| mid | up to 1.5 | 200 | all |
| low | 1 | 100 (60 with reduced motion) | 40% |

1. **Start:** device hints (`deviceMemory`, CPU cores), and GPUs with a max texture size under 4096 start on low.
2. **Boot probe:** while the Play button waits, 2 s of frame timing (after 0.5 s of warm-up). An average over 33 ms drops one tier; over 45 ms drops two.
3. **While playing:** if the average frame time stays above 40 ms for 3 s, drop one tier. The next step needs a fresh 3 s window. Quality never steps back up, so it can't flicker.

Each step logs `[quality] …` to the console, and `/?dev=perf` shows the current tier.

## Deploy to a subpath

All URLs are relative (`base: './'`), so `dist/` works under any path, e.g. `https://example.com/play/`. Copy `dist/` to the server folder; no server config is needed. Serve over HTTPS (or localhost) so the service worker can install, and don't cache `sw.js` for long, so updates arrive promptly.

## What's in the game

- **Garden hub:** a procedurally built floating island with an S-curve path, 6 buds per language, the gazebo, trees, pond, rocks, bushes, grass and flowers. The suggested next bud pulses; nothing is locked.
- **Letter loop:** intro (the 3D letter rises out of the bud, "A is for Apple!") → mini-game → bloom (the flower opens, the object grows beside it, progress is saved).
- **Mini-games (data-driven templates):**
  - Pollen Pop: pop the 3 bubbles carrying the letter.
  - Trace the Trail: trace the strokes in order; Buzzy follows the finger only while it's on the path.
  - Basket Match: drag the object that starts with the letter into Buzzy's basket, over 2 rounds.
- **Sing-along:** tap the gazebo. Until the recorded song exists, the camera visits every bud in order and Buzzy says each line.
- **Grown-ups:** hold the top-right button for 3 s, then solve the number challenge. Inside: language, tracing difficulty, volume, reset progress, letters learned, privacy note.
- **Gentle stop:** after 6 letters or 15 minutes, Buzzy yawns. Nothing is blocked.

## Asset pipeline

1. Drop a GLB from an AI 3D tool (Higgsfield, Meshy, Tripo…) into `public/assets/models/{id}.glb`.
2. Add its triangle budget to `scripts/model-budgets.json` (the default is 3,000).
3. Run `npm run optimize-assets`. Per file, in place: dedup + weld, simplify only if it's over budget, textures to WebP at most 512², meshopt geometry compression. Processed files are stamped, so re-runs skip them (`--force` redoes them, `npm run optimize-assets -- gazebo` limits the run).
4. Check it in `/?dev=models`, then `npm run build`. The build fails if any budget in brief §7.4 is exceeded (JS, transfer to start and to playable, letter packs, GLB size, triangles, texture size). Draw calls are checked by the e2e suite.

The game's loader decodes meshopt with the decoder bundled in the JS. That's why the CSP allows `'wasm-unsafe-eval'` (WebAssembly only, not JavaScript eval).

## Add a letter (no code changes)

1. Add an entry to `src/data/letters.{lang}.json` (see `LetterDef` in `src/core/types.ts`).
2. Add the object model to `public/assets/models/{objectModel}.glb` and run `npm run optimize-assets`.
3. For a `traceTrail` letter, add `src/data/strokes/{lang}/{id}.json` (author it with `/?dev=strokes`).
4. Add `{id}_sound` and `{id}_isfor` lines to `src/data/vo-manifest.json`.
5. Run `npm test`. The content test checks every field, model, stroke file and voice line.

## Add a language

Add `letters.{lang}.json`, extend `Lang` in `src/core/types.ts`, add a `text{Lang}` column to `vo-manifest.json`, and register the file in `src/core/content.ts`.

## White-label build

Edit `src/data/brand.config.json` (`partnerName`, `partnerLogo`, `accentColor`, `parentSiteUrl`, `appStoreUrl`, `playStoreUrl`). The loading screen shows "presented by {partnerName}"; store and site links appear only in the grown-ups area. The child area stays unbranded.

## Assets

- **Higgsfield (AI-generated):** Buzzy, apple, bee, cat, duck, egg, fish, squirrel, goat, leaf, fly, ural, swing, bud, bloom, basket, gazebo and tree. Run through `optimize-assets`: 1.4 MB in total, each within its triangle budget.
- **Built in code** (`src/procedural/`): island, path, pond, sky, clouds, rocks, bushes, grass, flowers, glyphs, bubbles, picnic cloth, tracing board and shadows.
- **Synthesised in code** (`src/core/audio.ts`): all sound effects and the background music.
- **Voice-over:** the browser's speech synthesis until recorded files are listed in `vo-manifest.json`.

## Layout

```
src/core/        renderer, loop, input, tweens, audio, voice, storage, assets, camera rig
src/scenes/      garden, play meadow, letter intro, bloom, sing-along
src/minigames/   template interface + registry, PollenPop, TraceTrail, BasketMatch, traceMath
src/entities/    Buzzy, Bud, Bubble, PollenParticles
src/procedural/  programmatic models (geo toolkit, nature, island, glyphs, props)
src/ui/          HUD, start screen, parent gate, parent zone
src/data/        letters, strokes, voice-over manifest, brand config
tests/unit/      trace rules, content and i18n validation
```

See `DECISIONS.md` for what was chosen, why, and what isn't built yet.
