import { Vector3 } from 'three';
import type { AudioEngine } from '../core/audio';
import type { CameraRig, Pose } from '../core/cameraRig';
import { theme } from '../core/theme';
import { tweens } from '../core/tween';
import type { Bud } from '../entities/Bud';
import type { Buzzy } from '../entities/Buzzy';
import type { PollenParticles } from '../entities/PollenParticles';

export type BloomDeps = {
  rig: CameraRig;
  buzzy: Buzzy;
  particles: PollenParticles;
  audio: AudioEngine;
  say: (id: string) => Promise<void>;
  closeUp: Pose;
};

/** Bloom (~5 s): the bud opens into a big flower, its object grows beside it, confetti, Buzzy celebrates. */
export async function playBloom(bud: Bud, d: BloomDeps): Promise<void> {
  const side = new Vector3().subVectors(d.closeUp.pos, bud.root.position).setY(0).normalize();
  const right = new Vector3(side.z, 0, -side.x);
  d.buzzy.placeAt(bud.root.position.clone().addScaledVector(right, -2.4).addScaledVector(side, 1.4));
  await d.rig.moveTo(d.closeUp, 1.0);
  d.audio.play('bloom');
  await bud.bloom(d.particles);
  d.audio.play('celebrate');
  const head = bud.headPosition;
  for (let i = 0; i < 3; i++) {
    d.particles.burst(head.clone().add(new Vector3((i - 1) * 1.2, 0.5, 0)), 30, theme.petals[(i * 2) % theme.petals.length], 5.5);
  }
  await Promise.all([d.buzzy.celebrate(), d.say(bud.letter.vo.isFor)]);
  await tweens.wait(0.8);
}
