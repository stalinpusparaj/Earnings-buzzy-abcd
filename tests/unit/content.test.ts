import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import en from '../../src/data/letters.en.json';
import ta from '../../src/data/letters.ta.json';
import manifest from '../../src/data/vo-manifest.json';
import cuesEn from '../../src/data/cues.en.json';
import cuesTa from '../../src/data/cues.ta.json';
import songs from '../../src/data/songs.json';
import { validateCues } from '../../src/core/cues';
import type { LetterDef } from '../../src/core/types';

const root = join(__dirname, '../..');
const lines = manifest.lines as Record<string, { textEn: string; textTa: string }>;
const all: LetterDef[] = [...(en.letters as LetterDef[]), ...(ta.letters as LetterDef[])];
const SHARED = ['tap_to_start', 'welcome', 'pick_flower', 'pp_instruction', 'tt_instruction', 'bm_instruction', 'great_1', 'great_2', 'great_3', 'try_again', 'look_here', 'letter_is_for', 'sing_intro', 'sleepy', 'parent_gate_hint'];
const TEMPLATES = ['pollenPop', 'traceTrail', 'basketMatch'];

/** Validates one letter entry; returns a list of problems (empty = valid). */
function problems(l: LetterDef): string[] {
  const out: string[] = [];
  if (!l.id || !/^[A-Za-z0-9_]+$/.test(l.id)) out.push('id must be ASCII');
  if (!['en', 'ta'].includes(l.lang)) out.push('bad lang');
  if (!l.glyph || !l.word) out.push('glyph and word required');
  if (!TEMPLATES.includes(l.template)) out.push(`unknown template ${l.template}`);
  if (!existsSync(join(root, 'public/assets/models', `${l.objectModel}.glb`))) out.push(`missing model ${l.objectModel}.glb`);
  for (const m of l.matchDistractors) if (!existsSync(join(root, 'public/assets/models', `${m}.glb`))) out.push(`missing distractor model ${m}`);
  if (l.template === 'pollenPop' && l.distractors.length < 1) out.push('pollenPop needs distractors');
  if (l.template === 'traceTrail' && !existsSync(join(root, 'src/data/strokes', l.lang, `${l.id}.json`))) out.push('traceTrail needs a stroke file');
  for (const key of Object.values(l.vo)) {
    const line = lines[key];
    if (!line) out.push(`missing VO line ${key}`);
    else if (!(l.lang === 'ta' ? line.textTa : line.textEn)) out.push(`empty VO text ${key}`);
  }
  return out;
}

describe('letter content', () => {
  it.each(all.map((l) => [`${l.lang}/${l.id}`, l] as const))('%s is valid', (_, l) => {
    expect(problems(l)).toEqual([]);
  });

  it('has unique ids', () => {
    expect(new Set(all.map((l) => l.id)).size).toBe(all.length);
  });

  it('stroke files are normalised polylines', () => {
    for (const lang of ['en', 'ta']) {
      for (const f of readdirSync(join(root, 'src/data/strokes', lang))) {
        const def = JSON.parse(readFileSync(join(root, 'src/data/strokes', lang, f), 'utf8')) as { strokes: number[][][] };
        expect(def.strokes.length).toBeGreaterThan(0);
        for (const s of def.strokes) {
          expect(s.length).toBeGreaterThan(1);
          for (const [x, y] of s) {
            expect(x).toBeGreaterThanOrEqual(0);
            expect(x).toBeLessThanOrEqual(1);
            expect(y).toBeGreaterThanOrEqual(0);
            expect(y).toBeLessThanOrEqual(1);
          }
        }
      }
    }
  });
});

describe('i18n completeness', () => {
  it.each(SHARED)('%s exists in both languages', (id) => {
    expect(lines[id]?.textEn).toBeTruthy();
    expect(lines[id]?.textTa).toBeTruthy();
  });
});

describe('adding a letter needs no code', () => {
  it('a JSON-only fixture letter validates with the same rules', () => {
    // Letter G as a test fixture: one JSON entry reusing existing assets.
    const G: LetterDef = { id: 'G', lang: 'en', glyph: 'G', word: 'Goat', objectModel: 'goat', template: 'basketMatch', distractors: [], matchDistractors: ['cat', 'fish'], vo: { intro: 'A_isfor', isFor: 'A_isfor', sound: 'A_sound' } };
    expect(problems(G)).toEqual([]);
  });
});

describe('sing-along data', () => {
  it('cue files are valid for their language', () => {
    expect(validateCues(cuesEn, en.letters)).toEqual([]);
    expect(validateCues(cuesTa, ta.letters)).toEqual([]);
  });

  it('listed songs exist under public/', () => {
    for (const lang of ['en', 'ta'] as const) {
      const path = (songs as Record<string, string | null>)[lang];
      if (path) expect(existsSync(join(root, 'public', path)), path).toBe(true);
    }
  });
});
