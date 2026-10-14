import { Group, Vector3, type Camera, type Object3D, type Scene } from 'three';
import type { AudioEngine } from '../core/audio';
import { modelInstance } from '../core/assets';
import type { CameraRig, Pose } from '../core/cameraRig';
import { CueTracker, type Cue, type Song } from '../core/cues';
import { disposeObject } from '../core/dispose';
import type { Loop } from '../core/loop';
import { ease, tweens } from '../core/tween';
import type { Bud } from '../entities/Bud';
import type { Buzzy } from '../entities/Buzzy';
import type { PollenParticles } from '../entities/PollenParticles';
import { makeGlyph3D } from '../procedural/glyph';

export type SongDeps = {
  scene: Scene;
  camera: Camera;
  loop: Loop;
  rig: CameraRig;
  buzzy: Buzzy;
  particles: PollenParticles;
  audio: AudioEngine;
  say: (id: string) => Promise<void>;
  overview: () => Pose;
  closeUp: (bud: Bud) => Pose;
  alive: () => boolean;
  onCue?: (cue: Cue, songTime: number) => void;
};

/** ended: the song finished · stopped: Home was pressed · unavailable: no song could be played. */
export type SongResult = 'ended' | 'stopped' | 'unavailable';

const FAST_GAP = 1.1; // cues closer than this (a chorus naming A to F) keep the wide shot
const MAX_LEAD = 1.4; // longest approach before a cue, in seconds of song time

type Pop = { root: Group; bud: Bud; anim: number };

/** Each letter's big glyph and object, built before the song so a cue never waits on a load. */
async function buildPops(buds: Bud[], scene: Scene): Promise<Map<string, Pop>> {
  const pops = new Map<string, Pop>();
  for (const b of buds) {
    const root = new Group();
    const glyph = makeGlyph3D(b.letter.glyph, b.color, 1.5);
    root.add(glyph);
    let object: Object3D | null = null;
    try {
      object = await modelInstance(b.letter.objectModel, 0.95);
      object.position.set(1.15, -0.55, 0.2);
      root.add(object);
    } catch {
      // The glyph alone still reads.
    }
    root.position.copy(b.headPosition).add(new Vector3(0, 1.9, 0));
    root.visible = false;
    scene.add(root);
    pops.set(b.letter.id, { root, bud: b, anim: 0 });
  }
  return pops;
}

async function showPop(p: Pop, camera: Camera): Promise<void> {
  const my = ++p.anim;
  p.root.visible = true;
  p.bud.setBadgeVisible(false); // the big letter replaces the bud's small badge while it shows
  p.root.lookAt(camera.position.x, p.root.position.y, camera.position.z);
  await tweens.to(0.25, (k) => p.root.scale.setScalar(Math.max(0.01, k)), ease.outBack);
  await tweens.wait(0.9);
  if (my !== p.anim) return;
  await tweens.to(0.25, (k) => p.root.scale.setScalar(Math.max(0.01, 1 - k)), ease.inOutCubic);
  if (my !== p.anim) return;
  p.root.visible = false;
  p.bud.setBadgeVisible(true);
}

/**
 * Song sing-along (brief §5.6): the song plays; at each cue the matching bud bounces,
 * pollen bursts, and its big glyph and object pop up; Buzzy and the camera arrive at each
 * bud on its cue. Big glyphs and objects, never karaoke text. Music is held during the song.
 */
export async function playSongSingAlong(buds: Bud[], song: Song, d: SongDeps): Promise<SongResult> {
  const byId = new Map(buds.map((b) => [b.letter.id, b]));
  const cues = song.cues.filter((c) => byId.has(c.id)).sort((a, b) => a.t - b.t);
  if (!cues.length) return 'unavailable';

  // Load while Buzzy announces it: VO and the song never overlap.
  const [el] = await Promise.all([d.audio.loadSong(song.url), d.say('sing_intro'), d.rig.moveTo(d.overview())]);
  if (!d.alive()) {
    d.audio.stopSong();
    return 'stopped';
  }
  if (!el) return 'unavailable';
  const pops = await buildPops(buds, d.scene);

  const plan = cues.map((cue, i) => {
    const gap = i === 0 ? cue.t : cue.t - cues[i - 1].t;
    return { cue, lead: Math.min(MAX_LEAD, Math.max(0.3, gap * 0.8)), fast: gap < FAST_GAP, started: false };
  });
  const tracker = new CueTracker(cues);
  let wide = true;
  let remove: () => void = () => undefined;
  d.audio.holdMusic(true);

  const result = await new Promise<SongResult>((resolve) => {
    el.addEventListener('ended', () => resolve('ended'), { once: true });
    remove = d.loop.add(() => {
      if (!d.alive()) return resolve('stopped');
      const t = el.currentTime;
      // Start each approach so Buzzy and the camera arrive on the cue.
      for (const p of plan) {
        if (p.started || t < p.cue.t - p.lead) continue;
        p.started = true;
        const bud = byId.get(p.cue.id)!;
        const dur = Math.max(0.25, p.cue.t - t);
        if (!p.fast) {
          wide = false;
          void d.rig.moveTo(d.closeUp(bud), dur);
        } else if (!wide) {
          wide = true;
          void d.rig.moveTo(d.overview(), Math.min(1, dur));
        }
        void d.buzzy.flyTo(bud.root.position.clone().add(new Vector3(-1.6, 0, 1.4)), dur);
      }
      for (const c of tracker.update(t)) {
        const bud = byId.get(c.id)!;
        bud.tapJuice();
        d.particles.burst(bud.headPosition, 26, bud.color, 4);
        void showPop(pops.get(c.id)!, d.camera);
        d.onCue?.(c, t);
      }
    });
    void el.play().catch(() => resolve('unavailable'));
  });

  remove();
  d.audio.stopSong();
  d.audio.holdMusic(false);
  for (const p of pops.values()) {
    p.bud.setBadgeVisible(true);
    disposeObject(p.root);
  }
  return result;
}
