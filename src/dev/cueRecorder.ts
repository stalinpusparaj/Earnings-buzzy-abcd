import songs from '../data/songs.json';
import { lettersFor } from '../core/content';
import { CueTracker, cuesFor, roundCueTime, uncuedLetters, validateCues, type Cue } from '../core/cues';
import { loadGlyphFonts } from '../core/fonts';
import type { Lang } from '../core/types';
import { drawWave, songPeaks } from './cueWaveform';

/**
 * Dev Cue Recorder (/?dev=cues, brief §5.6). Load the song, press Record, and tap each
 * letter's key (1–6, or A–F in English) as it is sung. Preview replays the song and
 * reports how late each cue fires. Export writes src/data/cues.{lang}.json.
 */

type Mode = 'idle' | 'recording' | 'preview';
const songPath = (lang: Lang) => (songs as Record<string, unknown>)[lang] as string | null;
const DRAFT = (lang: Lang) => `buzzy-cues-draft:${lang}`;

const CSS = `
.cue-rec { position: fixed; inset: 0; overflow: auto; background: #14110f; color: #f3ece3; font: 15px/1.45 system-ui, sans-serif; padding: 16px; display: grid; gap: 14px; align-content: start; -webkit-user-select: text; user-select: text; }
.cue-rec h1 { margin: 0; font: 800 22px "Buzzy Glyph", system-ui, sans-serif; }
.cue-rec .bar { display: flex; flex-wrap: wrap; gap: 8px 12px; align-items: center; }
.cue-rec button, .cue-rec select, .cue-rec input, .cue-rec textarea { font: inherit; color: inherit; background: #2a241f; border: 1px solid #4a3f37; border-radius: 8px; padding: 6px 10px; }
.cue-rec button { cursor: pointer; min-height: 38px; }
.cue-rec button.on { background: #FFD23F; color: #231c16; border-color: #FFD23F; font-weight: 700; }
.cue-rec button.rec.on { background: #e5534b; border-color: #e5534b; color: #fff; }
.cue-rec canvas { width: 100%; height: 130px; border-radius: 10px; cursor: pointer; display: block; }
.cue-rec .time { font: 600 18px ui-monospace, monospace; font-variant-numeric: tabular-nums; }
.cue-rec .tiles { display: grid; grid-template-columns: repeat(auto-fill, minmax(110px, 1fr)); gap: 8px; }
.cue-rec .tile { display: grid; justify-items: center; gap: 2px; padding: 10px; border-radius: 12px; background: #2a241f; border: 2px solid transparent; cursor: pointer; transition: transform 0.08s, border-color 0.2s; }
.cue-rec .tile .g { font: 800 40px/1 "Buzzy Glyph", system-ui, sans-serif; }
.cue-rec .tile .k { font: 12px ui-monospace, monospace; color: #bbad9f; }
.cue-rec .tile.flash { border-color: #FFD23F; transform: scale(1.06); }
.cue-rec table { border-collapse: collapse; width: 100%; max-width: 560px; font-variant-numeric: tabular-nums; }
.cue-rec td, .cue-rec th { padding: 4px 8px; border-bottom: 1px solid #3b322a; text-align: left; }
.cue-rec td input { width: 7em; font-family: ui-monospace, monospace; }
.cue-rec textarea { width: 100%; max-width: 560px; min-height: 120px; font: 13px ui-monospace, monospace; }
.cue-rec .ok { color: #6cd188; } .cue-rec .bad { color: #ff8a80; } .cue-rec .muted { color: #bbad9f; }
.cue-rec .cols { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 16px; align-items: start; }
`;

export async function mountCueRecorder(root: HTMLElement): Promise<void> {
  await loadGlyphFonts();
  const style = document.createElement('style');
  style.textContent = CSS;
  document.head.appendChild(style);
  root.innerHTML = `
    <div class="cue-rec">
      <div class="bar"><h1>Cue Recorder</h1>
        <label>Language <select id="cr-lang"><option value="en">English</option><option value="ta">தமிழ்</option></select></label>
        <label>Song <input type="file" id="cr-file" accept="audio/*"></label>
        <span class="muted" id="cr-song">No song loaded</span></div>
      <canvas id="cr-wave" aria-label="Song waveform with cue markers. Click to seek."></canvas>
      <div class="bar">
        <button id="cr-play">Play</button><button id="cr-rec" class="rec">Record</button><button id="cr-preview">Preview</button>
        <span class="time" id="cr-time">0.00 / 0.00 s</span>
        <label>Shift all by <input id="cr-shift" type="number" step="10" value="-120" style="width:6em"> ms</label><button id="cr-shift-go">Shift</button>
        <span id="cr-report" class="muted" role="status"></span></div>
      <div class="tiles" id="cr-tiles"></div>
      <p class="muted">Keys: <b>1–6</b> (or the letter in English) add a cue while recording · <b>Space</b> play/pause · <b>Backspace</b> undo the last cue · click the waveform to seek. Reaction time makes cues late: Preview, then shift them.</p>
      <div class="cols">
        <div><h2>Cues</h2><table><thead><tr><th>#</th><th>Letter</th><th>Time (s)</th><th></th></tr></thead><tbody id="cr-rows"></tbody></table></div>
        <div><h2>Export <span class="muted">→ src/data/cues.<span id="cr-lang-name">en</span>.json</span></h2>
          <textarea id="cr-json" readonly></textarea>
          <div class="bar"><button id="cr-copy">Copy</button><button id="cr-save">Save file</button><span id="cr-valid" role="status"></span></div>
          <h2>Import</h2><textarea id="cr-import" placeholder='[{"id": "A", "t": 4.2}, …]'></textarea>
          <div class="bar"><button id="cr-import-go">Replace cues with this</button><button id="cr-reset">Reload saved file</button></div></div>
      </div>
    </div>`;
  const $ = <T extends HTMLElement>(id: string) => root.querySelector('#' + id) as T;
  const audio = new Audio();
  audio.preload = 'auto';
  let lang: Lang = 'en';
  let letters = lettersFor(lang);
  let cues: Cue[] = [];
  let mode: Mode = 'idle';
  let peaks: Float32Array | null = null;
  let tracker: CueTracker | null = null;
  const report = { expected: 0, fired: 0, maxLateMs: 0 };
  const tiles: Record<string, HTMLElement> = {};

  const keyFor = (i: number) => String(i + 1) + (lang === 'en' ? ` / ${letters[i].glyph}` : '');
  const glyphOf = (id: string) => letters.find((l) => l.id === id)?.glyph ?? '?';
  const saveDraft = () => { try { localStorage.setItem(DRAFT(lang), JSON.stringify(cues)); } catch { /* ignore */ } };

  function flash(id: string): void {
    const t = tiles[id];
    if (!t) return;
    t.classList.add('flash');
    window.setTimeout(() => t.classList.remove('flash'), 180);
  }

  function setMode(m: Mode): void {
    mode = m;
    $('cr-rec').classList.toggle('on', m === 'recording');
    $('cr-preview').classList.toggle('on', m === 'preview');
  }

  function render(): void {
    const rows = $('cr-rows');
    rows.innerHTML = '';
    cues.forEach((c, i) => {
      const tr = document.createElement('tr');
      tr.innerHTML = `<td>${i + 1}</td><td></td><td><input type="number" step="0.01" min="0"></td><td><button aria-label="Delete cue">✕</button></td>`;
      tr.children[1].textContent = glyphOf(c.id) === c.id ? c.id : `${glyphOf(c.id)}  ${c.id}`;
      const inp = tr.querySelector('input')!;
      inp.value = c.t.toFixed(2);
      inp.addEventListener('change', () => { c.t = roundCueTime(Math.max(0, Number(inp.value) || 0)); cues.sort((a, b) => a.t - b.t); saveDraft(); render(); });
      tr.querySelector('button')!.addEventListener('click', () => { cues.splice(i, 1); saveDraft(); render(); });
      rows.appendChild(tr);
    });
    $<HTMLTextAreaElement>('cr-json').value = '[\n' + cues.map((c) => `  { "id": "${c.id}", "t": ${roundCueTime(c.t)} }`).join(',\n') + '\n]\n';
    const problems = validateCues(cues, letters, audio.duration > 0 ? audio.duration : undefined);
    const missing = uncuedLetters(cues, letters);
    const v = $('cr-valid');
    v.className = problems.length ? 'bad' : 'ok';
    v.textContent = problems.length ? problems.join(' ') : `Valid: ${cues.length} cues` + (missing.length ? ` (no cue yet for ${missing.join(', ')})` : '');
  }

  function loadLang(next: Lang): void {
    lang = next;
    letters = lettersFor(lang);
    $('cr-lang-name').textContent = lang;
    let draft: Cue[] | null = null;
    try { draft = JSON.parse(localStorage.getItem(DRAFT(lang)) ?? 'null') as Cue[] | null; } catch { draft = null; }
    cues = draft && validateCues(draft, letters).length === 0 ? draft : cuesFor(lang);
    const box = $('cr-tiles');
    box.innerHTML = '';
    letters.forEach((l, i) => {
      const t = document.createElement('button');
      t.className = 'tile';
      t.type = 'button';
      t.innerHTML = '<span class="g"></span><span class="k"></span>';
      t.querySelector('.g')!.textContent = l.glyph;
      t.querySelector('.k')!.textContent = keyFor(i);
      t.addEventListener('pointerdown', () => cueLetter(l.id));
      box.appendChild(t);
      tiles[l.id] = t;
    });
    const path = songPath(lang);
    if (path) void setSong(`${import.meta.env.BASE_URL}${path}`, path);
    else clearSong();
    render();
  }

  function clearSong(): void {
    audio.pause();
    audio.removeAttribute('src');
    audio.load();
    peaks = null;
    $('cr-song').textContent = `No ${lang === 'ta' ? 'Tamil' : 'English'} song yet: pick a file, or put it in public/assets/audio/ and list it in src/data/songs.json`;
  }

  async function setSong(url: string, name: string): Promise<void> {
    setMode('idle');
    audio.src = url;
    $('cr-song').textContent = name;
    peaks = null;
    audio.addEventListener('loadedmetadata', render, { once: true });
    peaks = await songPeaks(url, 1200);
  }

  function cueLetter(id: string): void {
    flash(id);
    if (mode !== 'recording' || audio.paused) return;
    cues.push({ id, t: roundCueTime(audio.currentTime) });
    saveDraft();
    render();
  }

  function start(m: Mode): void {
    if (!audio.getAttribute('src')) return;
    if (m === 'recording') cues = [];
    tracker = m === 'preview' ? new CueTracker(cues) : null;
    Object.assign(report, { expected: cues.length, fired: 0, maxLateMs: 0 });
    $('cr-report').textContent = m === 'preview' ? 'Previewing…' : '';
    setMode(m);
    audio.currentTime = 0;
    tracker?.seek(-1);
    void audio.play();
    render();
  }

  audio.addEventListener('pause', () => {
    if (mode === 'preview') $('cr-report').textContent = `Preview: ${report.fired}/${report.expected} cues fired, latest ${report.maxLateMs.toFixed(0)} ms after its time`;
    setMode('idle');
    $('cr-play').textContent = 'Play';
  });
  audio.addEventListener('play', () => ($('cr-play').textContent = 'Pause'));

  $('cr-lang').addEventListener('change', (e) => loadLang((e.target as HTMLSelectElement).value as Lang));
  $<HTMLInputElement>('cr-file').addEventListener('change', (e) => {
    const f = (e.target as HTMLInputElement).files?.[0];
    if (f) void setSong(URL.createObjectURL(f), f.name);
  });
  $('cr-play').addEventListener('click', () => (audio.paused ? void audio.play() : audio.pause()));
  $('cr-rec').addEventListener('click', () => (mode === 'recording' ? audio.pause() : start('recording')));
  $('cr-preview').addEventListener('click', () => (mode === 'preview' ? audio.pause() : start('preview')));
  $('cr-shift-go').addEventListener('click', () => {
    const ms = Number($<HTMLInputElement>('cr-shift').value) || 0;
    cues = cues.map((c) => ({ id: c.id, t: roundCueTime(Math.max(0, c.t + ms / 1000)) }));
    saveDraft();
    render();
  });
  $('cr-wave').addEventListener('click', (e) => {
    const r = $('cr-wave').getBoundingClientRect();
    if (audio.duration > 0) audio.currentTime = ((e.clientX - r.left) / r.width) * audio.duration;
  });
  $('cr-copy').addEventListener('click', () => void navigator.clipboard?.writeText($<HTMLTextAreaElement>('cr-json').value).catch(() => $<HTMLTextAreaElement>('cr-json').select()));
  $('cr-save').addEventListener('click', () => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([$<HTMLTextAreaElement>('cr-json').value], { type: 'application/json' }));
    a.download = `cues.${lang}.json`;
    a.click();
  });
  $('cr-import-go').addEventListener('click', () => {
    let parsed: unknown;
    try { parsed = JSON.parse($<HTMLTextAreaElement>('cr-import').value); } catch { $('cr-valid').className = 'bad'; $('cr-valid').textContent = 'That isn\'t valid JSON.'; return; }
    const problems = validateCues(parsed, letters);
    if (problems.length) { $('cr-valid').className = 'bad'; $('cr-valid').textContent = problems.join(' '); return; }
    cues = (parsed as Cue[]).map((c) => ({ id: c.id, t: roundCueTime(c.t) }));
    saveDraft();
    render();
  });
  $('cr-reset').addEventListener('click', () => { cues = cuesFor(lang); try { localStorage.removeItem(DRAFT(lang)); } catch { /* ignore */ } render(); });
  document.addEventListener('keydown', (e) => {
    if ((e.target as HTMLElement).closest('input, textarea, select')) return;
    if (e.key === ' ') { e.preventDefault(); if (audio.paused) void audio.play(); else audio.pause(); return; }
    if (e.key === 'Backspace') { e.preventDefault(); cues.pop(); saveDraft(); render(); return; }
    const n = Number(e.key);
    const byNumber = Number.isInteger(n) && n >= 1 && n <= letters.length ? letters[n - 1] : undefined;
    const byLetter = lang === 'en' ? letters.find((l) => l.glyph.toLowerCase() === e.key.toLowerCase()) : undefined;
    const l = byNumber ?? byLetter;
    if (l) { e.preventDefault(); cueLetter(l.id); }
  });

  const tick = () => {
    if (mode === 'preview' && tracker && !audio.paused) {
      for (const c of tracker.update(audio.currentTime)) {
        report.fired++;
        report.maxLateMs = Math.max(report.maxLateMs, (audio.currentTime - c.t) * 1000);
        flash(c.id);
      }
    }
    $('cr-time').textContent = `${audio.currentTime.toFixed(2)} / ${(audio.duration > 0 ? audio.duration : 0).toFixed(2)} s`;
    drawWave($<HTMLCanvasElement>('cr-wave'), { peaks, duration: audio.duration, time: audio.currentTime, cues, glyphOf });
    requestAnimationFrame(tick);
  };
  loadLang('en');
  requestAnimationFrame(tick);
  Object.assign(window, { __cueRecorder: { state: () => ({ mode, lang, cues: cues.map((c) => ({ ...c })), report: { ...report }, duration: audio.duration }), ready: true } });
}
