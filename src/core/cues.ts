import type { Lang, LetterDef } from './types';

// Sing-along cues (brief §5.6): src/data/cues.{lang}.json → [{ "id": "A", "t": 4.20 }, …],
// seconds into that language's song. Recorded with the Cue Recorder (/?dev=cues).

export type Cue = { id: string; t: number };

const files = import.meta.glob<Cue[]>('../data/cues.*.json', { eager: true, import: 'default' });

/** The cues for a language, in time order ([] until a song has been cued). */
export function cuesFor(lang: Lang): Cue[] {
  return [...(files[`../data/cues.${lang}.json`] ?? [])].sort((a, b) => a.t - b.t);
}

export const roundCueTime = (t: number) => Math.round(t * 100) / 100;

/**
 * Problems that make a cue list unusable (empty when valid): not an array, unknown letter
 * ids, bad times, out of order, or past the end of the song when its duration is known.
 */
export function validateCues(cues: unknown, letters: readonly Pick<LetterDef, 'id'>[], duration?: number): string[] {
  if (!Array.isArray(cues)) return ['Cues must be a JSON array of { "id", "t" } objects.'];
  const ids = new Set(letters.map((l) => l.id));
  const problems: string[] = [];
  let prev = -Infinity;
  cues.forEach((c: unknown, i) => {
    const cue = c as Partial<Cue> | null;
    const at = `Cue ${i + 1}`;
    if (!cue || typeof cue !== 'object') return void problems.push(`${at} is not an object.`);
    if (typeof cue.id !== 'string' || !ids.has(cue.id)) problems.push(`${at}: "${String(cue.id)}" is not a letter of this language.`);
    if (typeof cue.t !== 'number' || !Number.isFinite(cue.t) || cue.t < 0) return void problems.push(`${at}: time must be a number of seconds ≥ 0.`);
    if (duration !== undefined && cue.t > duration) problems.push(`${at}: ${cue.t} s is past the end of the song (${duration.toFixed(2)} s).`);
    if (cue.t < prev) problems.push(`${at}: times must be in order (${cue.t} s comes after ${prev} s).`);
    prev = cue.t;
  });
  return problems;
}

/** Letters with no cue at all (a warning, not an error: a song may skip one). */
export function uncuedLetters(cues: readonly Cue[], letters: readonly Pick<LetterDef, 'id'>[]): string[] {
  const cued = new Set(cues.map((c) => c.id));
  return letters.filter((l) => !cued.has(l.id)).map((l) => l.id);
}

/**
 * Fires cues as playback time passes them: call update(currentTime) every frame and act
 * on what it returns. Each cue fires once; several can fire in one frame; seeking back
 * re-arms the cues after the new position.
 */
export class CueTracker {
  private readonly cues: Cue[];
  private next = 0;
  private last = -Infinity;

  constructor(cues: readonly Cue[]) {
    this.cues = [...cues].sort((a, b) => a.t - b.t);
  }

  update(time: number): Cue[] {
    if (time < this.last) this.seek(time);
    const fired: Cue[] = [];
    while (this.next < this.cues.length && this.cues[this.next].t <= time) fired.push(this.cues[this.next++]);
    this.last = time;
    return fired;
  }

  seek(time: number): void {
    this.next = this.cues.findIndex((c) => c.t > time);
    if (this.next < 0) this.next = this.cues.length;
    this.last = time;
  }
}
