# Device QA checklist

Brief Phase 7: a device matrix covering a **low-end Android phone (Chrome)**, an **iPhone (Safari)**, an **iPad (Safari)** and **desktop Chrome**. It records fps, load time on Fast 4G, and bugs. Allow about 40 minutes per device. Fill in the results table at the end.

## 0. Setup

### Get the QA build onto the device

The QA build is the production-optimised game plus the perf overlay (`?dev=perf`), the glyph sheet (`?dev=glyphs`) and the model gallery (`?dev=models`). It also contains test hooks, so **don't publish it as the real game**.

**A. Same Wi-Fi (quick; offline and install can't be tested).** On the Mac:

```bash
npm run qa
```

Vite prints a **Network** address such as `http://192.168.1.20:4174/`. On the device, open that address with `?dev=perf` on the end. The page is plain http over Wi-Fi, so phones won't run the service worker; section 9 needs option B.

**B. HTTPS (needed for offline and install).** Upload `dist-e2e/` (made by `npm run qa` or `npm run build:e2e`) to any static HTTPS host (Netlify drop, GitHub Pages, or your site under `/play/`). For the release candidate, also check `dist/` (`npm run build`), the real production build with no overlay.

### Before each device

- [ ] Clear the site's data so the device behaves like a new child's. iOS: Settings → Safari → Advanced → Website Data → remove the site. Android Chrome: site settings → Clear & reset.
- [ ] Turn the volume up, and note whether the iPhone/iPad silent switch is on.
- [ ] Optional, to read console lines (`[quality] …`, `[timing] …`, errors):
  - **iPhone/iPad:** Settings → Safari → Advanced → Web Inspector on. Connect by cable, then Mac Safari → Develop → device → page.
  - **Android:** Developer options → USB debugging on. Connect, then Mac Chrome → `chrome://inspect`.

### How to read the overlay (top right)

`fps` frames per second · `calls` draw calls (garden budget 80) · `tris` triangles · `geo`/`tex` GPU objects in memory · `tier`/`dpr` quality tier and pixel ratio · `ready` seconds from opening the page to the Play button.

## 1. Load and start

- [ ] The loading bar moves; no error state (pink bar).
- [ ] **Load time:** `ready` ≤ **5.0 s** on a first visit (site data cleared). Phones: use mobile data with Wi-Fi off. Desktop Chrome: DevTools → Network → Disable cache + throttling **Fast 4G**. Record the value.
- [ ] Portrait shows only the rotating-phone animation; turning to landscape shows the game.
- [ ] Tap Play: music starts within a second.
- [ ] **iPhone/iPad, silent switch ON:** music, sound effects and Buzzy's voice still play. Also check the HUD mute button silences them, and other apps' audio behaves normally after you leave the game. Note the iOS version: 16.4+ uses Safari's Audio Session API; older versions use a silent-loop fallback.
- [ ] Buzzy flies in and says the welcome line, then "Pick a flower!". Note whether an English voice exists.
- [ ] Note the starting `tier`/`dpr`, and whether a `[quality] boot probe` line appeared.

## 2. Performance

- [ ] Garden idle: **fps** ___ (target ≥ 30 on low tier, 60 on mid-range); **calls** ≤ 80.
- [ ] Mini-game fps: Pollen Pop ___ · Trace ___ · Basket ___.
- [ ] Taps feel instant: buds squash, bubbles pop and buttons bounce within about 0.1 s.
- [ ] **Leak check:** in the garden, note `geo` ___ and `tex` ___. Play 5 letters, using Home to leave some early. Back in the garden, the numbers should be about the same, not climbing each round.
- [ ] After 15 minutes: tier ___. Note any `[quality] sustained slow frames` lines, and how warm the device got.

## 3. Touch and input

- [ ] Every target is easy for a small finger: HUD buttons, buds, bubbles, basket objects.
- [ ] No page scrolling, pinch-zoom, text selection or long-press menu anywhere in the child area.
- [ ] **Trace:** the drag is smooth, and Buzzy follows only while the finger is on the path. Lifting the finger and starting again continues the stroke.
- [ ] **Basket:** the object follows the finger, drops into the basket, and glides back if dropped elsewhere.
- [ ] A second finger mid-drag doesn't break or jump the drag.
- [ ] iPhone landscape: no HUD button is hidden under the notch or home indicator.

## 4. Letter loop (English)

The brief's "no failure" rule (P4): wrong answers never block the child.

- [ ] **A, Pollen Pop:** a wrong bubble wobbles and boops. After 2 misses or 6 s idle, the right bubbles pulse and Buzzy points. 3 pops → bloom.
- [ ] **B, Trace:** tapping the end of a stroke does nothing; going off the path pauses. All strokes in order → bloom.
- [ ] **C, Basket:** a wrong object bounces back and is named. After 2 misses the right one glows. 2 rounds → bloom.
- [ ] The bloom stays in the garden, and the next bud pulses.
- [ ] Home mid-game returns to the garden with no penalty; the same bud plays again.
- [ ] The intro can be skipped with a tap, but only on the second visit to a letter.
- [ ] Gazebo: the sing-along visits every bud in order; Home exits it.

## 5. Tamil

- [ ] The A/அ button switches; the buds show அ ஆ இ ஈ உ ஊ. Compare their shapes with `?dev=glyphs` on the same device.
- [ ] Tamil voice: present? If not, a chime plays and play continues. Note which.
- [ ] Play one letter of each kind: அ (Pollen Pop), ஆ (Trace; placeholder paths), இ (Basket).
- [ ] Tamil progress is kept separately from English.

## 6. Audio lifecycle

- [ ] The mute button silences music, sound effects and voice, and stays muted after a reload.
- [ ] Music gets quieter while Buzzy talks.
- [ ] Switch apps or lock the screen for 30 s, then come back: the game and music resume. **Older iOS (< 16.4):** while the game is in the background, no "Now Playing" controls should stay on the lock screen.
- [ ] Optional: an incoming call or another app's audio, then return.

## 7. Grown-ups area

- [ ] A short tap on the grown-ups button plays "Grown-ups only!" and opens nothing.
- [ ] Holding it 3 s fills the ring and shows the number challenge. 3 wrong answers close it.
- [ ] The right answer opens settings with readable text. Language, tracing difficulty and volume apply; Reset progress (after its confirm step) clears the blooms.
- [ ] The privacy page opens and is readable.

## 8. Comfort and accessibility

- [ ] Turn on Reduce Motion (iOS: Accessibility → Motion; Android: Remove animations) and reload: fewer particles, shorter camera moves, no pulsing Play button.
- [ ] Gentle stop: after 6 letters (or 15 minutes) Buzzy yawns and says the sleepy line. Play continues, and nothing starts by itself.

## 9. Offline and install (HTTPS, option B)

- [ ] After one full visit (play a letter, switch language once): airplane mode on, close the tab, reopen the address. It loads to Play, plays a letter, and both languages work.
- [ ] Install it. iOS: Share → Add to Home Screen. Android: menu → Install app. The icon is Buzzy, and it opens full-screen in landscape and plays offline.
- [ ] After a new deploy, the installed app picks up the new version on its next launch.

## 10. Long session and recovery

- [ ] 15 minutes of mixed play without a crash, freeze or black screen.
- [ ] Leave the tab in the background for 5+ minutes. On return the garden still draws (a black screen means the GPU context was lost: file it).
- [ ] Rotate to portrait and back during a mini-game; the game state is intact.

## Results

| Device | OS / browser | RAM | Tier: start → 15 min | Garden fps | Pop / Trace / Basket fps | `ready` (Fast 4G) | Offline | Install | Bugs |
|---|---|---|---|---|---|---|---|---|---|
| Low-end Android | | | | | | | | | |
| iPhone | | | | | | | | | |
| iPad | | | | | | | | | |
| Desktop Chrome | | n/a | | | | | | n/a | |

## Bug report

```
Device / OS / browser:
Build (QA or production) and URL:
Steps to reproduce:
Expected:
Actual:
Overlay at the time (fps, calls, tier, geo/tex):
Console lines ([quality], [timing], errors):
Screenshot or screen recording:
```

## Known, don't file

- The ஆ and உ tracing paths are placeholders, waiting for the owner to redraw them in `/?dev=strokes`.
- Voice is the device's text-to-speech until recorded voice-over exists; Tamil may fall back to a chime.
- The sing-along uses spoken lines; there's no song yet.
- The grown-ups area and privacy page are English only.
- A small darker wedge at the fly's left wing root (from mesh simplification).
