# Buzzy ABC Garden

A browser-based 3D letter garden for children aged 3–6, in English and Tamil. Buzzy the bee flies around a floating island; each flower bud holds a letter. Tap a bud to **hear** the letter, **play** a short mini-game, and **watch** the bud bloom into the letter's object.

Built with Vite + TypeScript + three.js (WebGL2). No frameworks, no third-party requests, no personal data.

## Run

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # unit tests: trace rules, content + i18n checks
npm run build      # type-check + production build into dist/
```

Dev-only tools (stripped from production builds):

- `/?dev=perf`: fps, draw calls, triangles, GPU memory
- `/?dev=strokes`: Stroke Editor. Pick a letter, click to place points, Enter ends a stroke, Export copies the JSON for `src/data/strokes/{lang}/{id}.json`.

## Deploy to a subpath

All URLs are relative (`base: './'`), so `dist/` works under any path, e.g. `https://example.com/play/`. Copy `dist/` to the server folder; no server config is needed.

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

## Add a letter (no code changes)

1. Add an entry to `src/data/letters.{lang}.json` (see `LetterDef` in `src/core/types.ts`).
2. Add the object model to `public/assets/models/{objectModel}.glb`.
3. For a `traceTrail` letter, add `src/data/strokes/{lang}/{id}.json` (author it with `/?dev=strokes`).
4. Add `{id}_sound` and `{id}_isfor` lines to `src/data/vo-manifest.json`.
5. Run `npm test`. The content test checks every field, model, stroke file and voice line.

## Add a language

Add `letters.{lang}.json`, extend `Lang` in `src/core/types.ts`, add a `text{Lang}` column to `vo-manifest.json`, and register the file in `src/core/content.ts`.

## White-label build

Edit `src/data/brand.config.json` (`partnerName`, `partnerLogo`, `accentColor`, `parentSiteUrl`, `appStoreUrl`, `playStoreUrl`). The loading screen shows "presented by {partnerName}"; store and site links appear only in the grown-ups area. The child area stays unbranded.

## Assets

- **Higgsfield (AI-generated):** Buzzy, apple, bee, cat, duck, egg, fish, squirrel, goat, leaf, fly, ural, swing, bud, bloom, basket, gazebo and tree, as GLBs with textures shrunk to 512².
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
