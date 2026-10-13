import type { Lang, Tolerance } from './types';

// Local-only progress (brief §7.3). Every call is wrapped: the game must work if storage throws.
export type SaveData = {
  lang: Lang;
  bloomed: string[];
  introsSeen: string[];
  tolerance: Tolerance;
  volume: number;
};

const KEY = 'buzzyabc:v1';

export const defaultSave = (): SaveData => ({ lang: 'en', bloomed: [], introsSeen: [], tolerance: 'little', volume: 1 });

const strings = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []);

export function loadSave(): SaveData {
  const data = defaultSave();
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return data;
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    if (parsed.lang === 'en' || parsed.lang === 'ta') data.lang = parsed.lang;
    data.bloomed = strings(parsed.bloomed);
    data.introsSeen = strings(parsed.introsSeen);
    if (parsed.tolerance === 'little' || parsed.tolerance === 'big') data.tolerance = parsed.tolerance;
    if (typeof parsed.volume === 'number' && parsed.volume >= 0 && parsed.volume <= 1) data.volume = parsed.volume;
  } catch {
    // Private mode, blocked storage or corrupt JSON: play with defaults.
  }
  return data;
}

export function writeSave(data: SaveData): void {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(data));
  } catch {
    // Ignore: progress just won't survive a reload.
  }
}
