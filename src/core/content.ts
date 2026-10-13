import en from '../data/letters.en.json';
import ta from '../data/letters.ta.json';
import type { Lang, LetterDef, StrokeDef } from './types';

// Letters are data, not code: adding one is a JSON entry (+ stroke file + model + VO lines).
const letters: Record<Lang, LetterDef[]> = {
  en: en.letters as LetterDef[],
  ta: ta.letters as LetterDef[],
};

const strokeFiles = import.meta.glob<StrokeDef>('../data/strokes/*/*.json', { eager: true, import: 'default' });

export function lettersFor(lang: Lang): LetterDef[] {
  return letters[lang];
}

export function strokesFor(letter: LetterDef): StrokeDef | null {
  return strokeFiles[`../data/strokes/${letter.lang}/${letter.id}.json`] ?? null;
}

/** Spoken name of a model in this language, taken from the letter that owns it. */
export function wordForModel(lang: Lang, modelId: string): string {
  return letters[lang].find((l) => l.objectModel === modelId)?.word ?? '';
}

export function modelIdsFor(lang: Lang): string[] {
  return letters[lang].map((l) => l.objectModel);
}
