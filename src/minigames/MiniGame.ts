import type { PerspectiveCamera } from 'three';
import type { AudioEngine } from '../core/audio';
import type { GamePointerEvent } from '../core/input';
import type { LetterDef, Tolerance, TemplateId } from '../core/types';
import type { Voice } from '../core/voice';
import type { Buzzy } from '../entities/Buzzy';
import type { PollenParticles } from '../entities/PollenParticles';
import type { PlayStage } from '../scenes/PlayStage';

/** Everything a mini-game may use. Templates never reach into the garden or the HUD. */
export type GameContext = {
  camera: PerspectiveCamera;
  stage: PlayStage;
  buzzy: Buzzy;
  particles: PollenParticles;
  audio: AudioEngine;
  voice: Voice;
  tolerance: Tolerance;
  reducedMotion: boolean;
  letters: LetterDef[]; // every letter of the current language
  say(id: string, vars?: Record<string, string>): Promise<void>;
  praise(): Promise<void>;
};

export interface MiniGame {
  readonly id: TemplateId;
  enter(ctx: GameContext, letter: LetterDef): Promise<void>; // build scene objects, start VO
  update(dt: number, time: number): void;
  onPointer(e: GamePointerEvent): void;
  exit(): void; // dispose geometries/materials/textures — no leaks
  onComplete: () => void; // set by the state machine
}

export const HINT_IDLE_SECONDS = 6;
export const HINT_MISSES = 2;

export function shuffle<T>(items: T[]): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
