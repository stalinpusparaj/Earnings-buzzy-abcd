import { Vector3 } from 'three';
import type { AudioEngine } from './core/audio';
import { preload } from './core/assets';
import type { CameraRig } from './core/cameraRig';
import { lettersFor, modelIdsFor } from './core/content';
import { prefetchSong, songFor } from './core/cues';
import { pick, type GamePointerEvent, type Input } from './core/input';
import type { Loop } from './core/loop';
import type { Quality } from './core/quality';
import type { RenderContext } from './core/renderer';
import { writeSave, type SaveData } from './core/storage';
import { tweens } from './core/tween';
import type { Lang, Tolerance } from './core/types';
import type { Voice } from './core/voice';
import type { Bud } from './entities/Bud';
import type { Buzzy } from './entities/Buzzy';
import type { PollenParticles } from './entities/PollenParticles';
import type { GameContext, MiniGame } from './minigames/MiniGame';
import { miniGames } from './minigames/registry';
import { playBloom } from './scenes/Bloom';
import type { GardenScene } from './scenes/GardenScene';
import { playLetterIntro } from './scenes/LetterIntro';
import type { PlayStage } from './scenes/PlayStage';
import { playSingAlong } from './scenes/SingAlong';
import { playSongSingAlong, type SongResult } from './scenes/SongSingAlong';
import type { Hud } from './ui/hud';
import { openParentGate } from './ui/parentGate';
import { openParentZone } from './ui/parentZone';

export type GameDeps = {
  rc: RenderContext;
  loop: Loop;
  input: Input;
  rig: CameraRig;
  garden: GardenScene;
  stage: PlayStage;
  buzzy: Buzzy;
  particles: PollenParticles;
  audio: AudioEngine;
  voice: Voice;
  hud: Hud;
  quality: Quality;
  save: SaveData;
  overlay: HTMLElement;
};

type Mode = 'start' | 'garden' | 'letter' | 'sing' | 'busy' | 'parent';
const SLEEPY_LETTERS = 6;
const SLEEPY_MS = 15 * 60 * 1000;

/** State machine for the letter loop (brief §5.1): Garden → Intro → MiniGame → Bloom → Garden. */
export class Game {
  private mode: Mode = 'start';
  private flowId = 0; // bumping it cancels whatever flow is running
  private mini: MiniGame | null = null;
  private skipIntro = false;
  private introSkippable = false;
  private completed = 0;
  private readonly startedAt = performance.now();
  private sleepyDone = false;
  private bloomed: Set<string>;
  /** Cues fired in the last song sing-along, with the song time each fired at (QA and tests). */
  readonly singLog: { id: string; t: number; at: number }[] = [];
  private lastVolume: number;

  constructor(private d: GameDeps) {
    this.bloomed = new Set(d.save.bloomed);
    this.lastVolume = d.save.volume || 1;
    d.input.on((e) => this.onPointer(e));
    d.loop.add((dt, t) => this.update(dt, t));
    d.rc.onResize.add(() => this.mode === 'garden' && d.rig.jump(this.overview()));
    d.loop.onPauseChange = (paused) => {
      if (paused) {
        d.audio.suspend();
        d.voice.stop();
      } else void d.audio.resume();
    };
  }

  private get aspect(): number {
    return this.d.rc.camera.aspect;
  }

  private overview() {
    return this.d.garden.overviewPose(this.aspect);
  }

  private say = (id: string, vars?: Record<string, string>) => this.d.voice.say(id, vars);
  private praise = () => this.say(`great_${1 + Math.floor(Math.random() * 3)}`);

  private persist(): void {
    this.d.save.bloomed = [...this.bloomed];
    writeSave(this.d.save);
  }

  private setMode(mode: Mode): void {
    this.mode = mode;
    this.d.hud.setMode(mode === 'garden' || mode === 'busy' || mode === 'parent' ? 'garden' : mode === 'start' ? 'hidden' : mode);
  }

  /** Where Buzzy waits in the garden: beside the suggested bud. */
  private buzzyHome(): Vector3 {
    const next = this.d.garden.buds.find((b) => !b.bloomed) ?? this.d.garden.buds[0];
    return next ? next.root.position.clone().add(new Vector3(-1.9, 0, 1.6)) : new Vector3(0, 0, 14);
  }

  async begin(): Promise<void> {
    this.d.audio.startMusic();
    this.d.hud.setLang(this.d.save.lang);
    this.setMode('garden');
    await this.d.buzzy.flyTo(this.buzzyHome());
    if (this.mode !== 'garden') return;
    await this.say('welcome');
    if (this.mode === 'garden') await this.say('pick_flower');
  }

  private onPointer(e: GamePointerEvent): void {
    if (this.mode === 'garden' && e.kind === 'down') {
      const hit = pick(this.d.rc.camera, e.ndc, this.d.garden.colliders);
      if (!hit) return;
      const bud = hit.object.userData.bud as Bud | undefined;
      if (bud) void this.playLetter(bud);
      else if (hit.object === this.d.garden.gazeboCollider) void this.singAlong();
    } else if (this.mode === 'letter') {
      if (this.mini) this.mini.onPointer(e);
      else if (e.kind === 'down' && this.introSkippable && !this.skipIntro) {
        this.skipIntro = true; // intros are skippable after the first viewing
        this.d.voice.stop();
        tweens.finishAll();
      }
    }
  }

  private context(): GameContext {
    const { rc, stage, buzzy, particles, audio, voice, save, quality } = this.d;
    return { camera: rc.camera, stage, buzzy, particles, audio, voice, tolerance: save.tolerance, reducedMotion: quality.reducedMotion, letters: lettersFor(save.lang), say: this.say, praise: this.praise };
  }

  private async playLetter(bud: Bud): Promise<void> {
    const { rig, buzzy, audio, garden, stage, save, rc, particles } = this.d;
    const id = ++this.flowId;
    const alive = () => id === this.flowId;
    this.setMode('letter');
    bud.tapJuice();
    audio.play('buzz');
    const letter = bud.letter;
    this.skipIntro = false;
    this.introSkippable = save.introsSeen.includes(letter.id);
    const closeUp = garden.closeUpPose(bud, this.aspect);
    await playLetterIntro(bud, { scene: rc.scene, camera: rc.camera, rig, buzzy, audio, say: this.say, closeUp, skipping: () => this.skipIntro, alive });
    this.introSkippable = false;
    if (!alive()) return;
    if (!save.introsSeen.includes(letter.id)) save.introsSeen.push(letter.id);
    this.persist();

    // Mini-game on the play meadow.
    audio.play('whoosh');
    buzzy.placeAt(stage.at(0, 0, 6));
    await rig.moveTo(stage.pose(this.aspect));
    if (!alive()) return;
    const mini = miniGames[letter.template]();
    const done = new Promise<void>((resolve) => (mini.onComplete = resolve));
    this.mini = mini;
    await mini.enter(this.context(), letter);
    await done;
    if (!alive()) return;
    mini.exit();
    this.mini = null;

    // Bloom back in the garden. Saved first so leaving mid-animation still keeps it.
    this.bloomed.add(letter.id);
    this.completed++;
    this.persist();
    audio.play('whoosh');
    await playBloom(bud, { rig, buzzy, particles, audio, say: this.say, closeUp: garden.closeUpPose(bud, this.aspect) });
    if (!alive()) return;
    await this.returnToGarden(id);
  }

  private async returnToGarden(id: number): Promise<void> {
    this.d.garden.refreshSuggestion();
    this.setMode('busy');
    await Promise.all([this.d.rig.moveTo(this.overview()), this.d.buzzy.flyTo(this.buzzyHome())]);
    if (id !== this.flowId) return;
    this.setMode('garden');
    await this.maybeSleepy();
  }

  /** Gazebo: the language's song with its cues when both exist, otherwise the spoken stand-in. */
  private async singAlong(): Promise<void> {
    const { rig, buzzy, audio, particles, garden, rc, loop, save } = this.d;
    const id = ++this.flowId;
    const alive = () => id === this.flowId;
    this.setMode('sing');
    audio.play('buzz');
    this.singLog.length = 0;
    const closeUp = (b: Bud) => garden.closeUpPose(b, this.aspect);
    const song = songFor(save.lang);
    let result: SongResult = 'unavailable';
    if (song) {
      result = await playSongSingAlong(garden.buds, song, {
        scene: rc.scene, camera: rc.camera, loop, rig, buzzy, particles, audio, say: this.say,
        overview: () => this.overview(), closeUp, alive,
        onCue: (c, at) => this.singLog.push({ id: c.id, t: c.t, at }),
      });
    }
    if (result === 'unavailable' && alive()) {
      await playSingAlong(garden.buds, { rig, buzzy, particles, audio, say: this.say, closeUp, alive, skipIntro: !!song });
    }
    if (alive()) await this.returnToGarden(id);
  }

  /** Home icon: abandon the current flow (no penalty) and glide back to the garden. */
  goHome(): void {
    if (this.mode === 'garden' || this.mode === 'start') return;
    const id = ++this.flowId;
    this.d.voice.stop();
    this.d.audio.stopSong();
    this.d.audio.holdMusic(false);
    if (this.mini) {
      this.mini.exit();
      this.mini = null;
    }
    tweens.finishAll();
    this.d.buzzy.setSize(1.3);
    this.d.buzzy.stopPointing();
    this.d.buzzy.placeAt(this.buzzyHome());
    this.setMode('busy');
    this.d.garden.refreshSuggestion();
    void this.d.rig.moveTo(this.overview()).then(() => id === this.flowId && this.mode === 'busy' && this.setMode('garden'));
  }

  /** P7 gentle stop: after 6 letters or 15 minutes Buzzy yawns. Nothing is blocked. */
  private async maybeSleepy(): Promise<void> {
    if (this.sleepyDone || this.mode !== 'garden') return;
    if (this.completed < SLEEPY_LETTERS && performance.now() - this.startedAt < SLEEPY_MS) return;
    this.sleepyDone = true;
    await Promise.all([this.d.buzzy.yawn(), this.say('sleepy')]);
  }

  async toggleLang(): Promise<void> {
    if (this.mode !== 'garden') return;
    await this.setLang(this.d.save.lang === 'en' ? 'ta' : 'en');
  }

  async setLang(lang: Lang): Promise<void> {
    const { save, voice, hud, garden, buzzy } = this.d;
    if (save.lang === lang) return;
    save.lang = lang;
    voice.lang = lang;
    hud.setLang(lang);
    this.persist();
    const before = this.mode;
    this.setMode('busy');
    await preload(modelIdsFor(lang));
    prefetchSong(lang);
    await garden.setLanguage(lang, this.bloomed);
    this.d.audio.play('bloom');
    this.setMode(before === 'parent' ? 'parent' : 'garden');
    await buzzy.flyTo(this.buzzyHome());
    if (this.mode === 'garden') void this.say('pick_flower');
  }

  toggleMute(): void {
    const v = this.d.save.volume > 0 ? 0 : this.lastVolume;
    this.setVolume(v);
  }

  private setVolume(v: number): void {
    if (v > 0) this.lastVolume = v;
    this.d.save.volume = v;
    this.d.audio.setVolume(v);
    this.d.voice.volume = v;
    if (v === 0) this.d.voice.stop();
    this.d.hud.setMuted(v === 0);
    this.persist();
  }

  parentTap(): void {
    void this.say('parent_gate_hint');
  }

  async parentHold(): Promise<void> {
    if (this.mode === 'parent') return;
    this.goHome();
    this.setMode('parent');
    const ok = await openParentGate(this.d.overlay);
    if (ok) {
      await openParentZone(
        this.d.overlay,
        { lang: this.d.save.lang, tolerance: this.d.save.tolerance, volume: this.d.save.volume, bloomed: this.bloomed },
        {
          setLang: (l) => void this.setLang(l),
          setTolerance: (t: Tolerance) => {
            this.d.save.tolerance = t;
            this.persist();
          },
          setVolume: (v) => this.setVolume(v),
          resetProgress: () => {
            this.bloomed.clear();
            this.d.save.introsSeen = [];
            this.persist();
            void this.d.garden.setLanguage(this.d.save.lang, this.bloomed);
          },
        },
      );
    }
    this.setMode('garden');
  }

  private update(dt: number, time: number): void {
    this.d.garden.update(dt, time);
    this.d.buzzy.update(dt, time);
    this.d.particles.update(dt);
    this.mini?.update(dt, time);
    if (this.mode === 'garden' && !this.sleepyDone && performance.now() - this.startedAt > SLEEPY_MS) void this.maybeSleepy();
  }
}
