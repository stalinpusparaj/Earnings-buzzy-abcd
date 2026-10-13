import { Vector3, type Camera, type Object3D, type Scene } from 'three';
import type { AudioEngine } from '../core/audio';
import { modelInstance } from '../core/assets';
import type { CameraRig, Pose } from '../core/cameraRig';
import { disposeObject } from '../core/dispose';
import { ease, tweens } from '../core/tween';
import type { Bud } from '../entities/Bud';
import type { Buzzy } from '../entities/Buzzy';
import { makeGlyph3D } from '../procedural/glyph';

export type IntroDeps = {
  scene: Scene;
  camera: Camera;
  rig: CameraRig;
  buzzy: Buzzy;
  audio: AudioEngine;
  say: (id: string) => Promise<void>;
  closeUp: Pose;
  /** True once the child has asked to skip (only offered after the first viewing). */
  skipping: () => boolean;
  /** False once Home was pressed: stop as soon as possible. */
  alive: () => boolean;
};

/**
 * LetterIntro (8–12 s): Buzzy flies to the bud, the bud opens a little, the big
 * 3D glyph rises out of it, the voice says "A is for Apple!" and the object pops in.
 */
export async function playLetterIntro(bud: Bud, d: IntroDeps): Promise<void> {
  const fast = () => d.skipping() || !d.alive();
  const t = (s: number) => (fast() ? 0 : s);
  const letter = bud.letter;
  const side = new Vector3().subVectors(d.closeUp.pos, bud.root.position).setY(0).normalize();
  const right = new Vector3(side.z, 0, -side.x);
  await Promise.all([d.rig.moveTo(d.closeUp, t(1.0)), d.buzzy.flyTo(bud.root.position.clone().addScaledVector(right, -2.4).addScaledVector(side, 1.2), t(1.2))]);
  if (!d.alive()) return;

  const glyph = makeGlyph3D(letter.glyph, bud.color, 2.0);
  bud.setBadgeVisible(false);
  const start = bud.headPosition;
  const top = start.clone().add(new Vector3(0, 1.5, 0)).addScaledVector(side, 0.9);
  glyph.position.copy(start);
  glyph.scale.setScalar(0.01);
  glyph.lookAt(d.camera.position.x, start.y, d.camera.position.z);
  d.scene.add(glyph);

  let object: Object3D | null = null;
  try {
    d.audio.play('whoosh');
    await Promise.all([
      bud.openALittle(),
      tweens.to(t(0.9), (k) => {
        glyph.position.lerpVectors(start, top, k);
        glyph.scale.setScalar(Math.max(0.01, k));
      }, ease.outBack),
    ]);
    if (!d.alive()) return;
    d.audio.play('chime');
    object = await modelInstance(letter.objectModel, 1.6);
    object.position.copy(bud.root.position).addScaledVector(right, 2.6).addScaledVector(side, 1.0);
    object.lookAt(d.camera.position.x, 0, d.camera.position.z);
    object.scale.setScalar(0.01);
    d.scene.add(object);
    const obj = object;
    const pop = tweens.to(t(0.5), (k) => obj.scale.setScalar(Math.max(0.01, k)), ease.outBack);
    await Promise.all([pop, fast() ? Promise.resolve() : d.say(letter.vo.isFor)]);
    await tweens.wait(t(0.6));
  } finally {
    const obj = object;
    await tweens.to(t(0.3), (k) => {
      glyph.scale.setScalar(Math.max(0.01, 1 - k));
      obj?.scale.setScalar(Math.max(0.01, 1 - k));
    }, ease.inOutCubic);
    disposeObject(glyph);
    bud.setBadgeVisible(true);
    if (obj) disposeObject(obj);
  }
}
