import manifest from '../data/vo-manifest.json';
import type { Lang } from './types';

export type VoEntry = { en: string | null; ta: string | null; textEn: string; textTa: string };

export const voLines: Record<string, VoEntry> = manifest.lines;

/** Text for a VO id with {glyph}/{word}/{sound} filled in. Missing ids return '' (never throw mid-game). */
export function voText(id: string, lang: Lang, vars: Record<string, string> = {}): string {
  const entry = voLines[id];
  if (!entry) return '';
  const template = lang === 'ta' ? entry.textTa : entry.textEn;
  return template.replace(/\{(\w+)\}/g, (_, key: string) => vars[key] ?? '');
}

/** Recorded file for a VO id, once Phase 6 audio exists. */
export function voFile(id: string, lang: Lang): string | null {
  const entry = voLines[id];
  if (!entry) return null;
  return lang === 'ta' ? entry.ta : entry.en;
}
