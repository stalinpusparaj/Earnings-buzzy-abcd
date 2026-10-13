import { Vector3 } from 'three';
import type { AudioEngine } from '../core/audio';
import type { CameraRig, Pose } from '../core/cameraRig';
import { tweens } from '../core/tween';
import type { Bud } from '../entities/Bud';
import type { Buzzy } from '../entities/Buzzy';
import type { PollenParticles } from '../entities/PollenParticles';

export type SingDeps = {
  rig: CameraRig;
  buzzy: Buzzy;
  particles: PollenParticles;
  audio: AudioEngine;
  say: (id: string) => Promise<void>;
  closeUp: (bud: Bud) => Pose;
  alive: () => boolean;
};

/**
 * Sing-along stand-in until the recorded song and cue file exist
 * (TODO(content): song + cues.{lang}.json). The camera rails past every bud in
 * order; each one bounces and Buzzy says its line. Big glyph + object, no karaoke text.
 */
export async function playSingAlong(buds: Bud[], d: SingDeps): Promise<void> {
  await d.say('sing_intro');
  for (const bud of buds) {
    if (!d.alive()) return;
    const pose = d.closeUp(bud);
    const side = new Vector3().subVectors(pose.pos, bud.root.position).setY(0).normalize();
    await Promise.all([d.rig.moveTo(pose, 1.3), d.buzzy.flyTo(bud.root.position.clone().addScaledVector(side, 2).add(new Vector3(-1.5, 0, 0)), 1.2)]);
    if (!d.alive()) return;
    bud.tapJuice();
    d.audio.play('chime');
    d.particles.burst(bud.headPosition, 24, bud.color, 3.5);
    await d.say(bud.letter.vo.isFor);
    await tweens.wait(0.3);
  }
  if (d.alive()) {
    d.audio.play('celebrate');
    await d.buzzy.celebrate();
  }
}
