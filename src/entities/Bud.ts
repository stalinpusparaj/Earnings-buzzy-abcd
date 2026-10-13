import { Group, Mesh, MeshBasicMaterial, SphereGeometry, Vector3, type Object3D, type Sprite } from 'three';
import { modelInstance } from '../core/assets';
import { disposeObject } from '../core/dispose';
import { ease, tweens } from '../core/tween';
import type { LetterDef } from '../core/types';
import { glyphBadge } from '../procedural/glyph';
import { blobShadow, glowDisc } from '../procedural/props';
import type { PollenParticles } from './PollenParticles';

const BUD_HEIGHT = 2.4;
const BLOOM_HEIGHT = 2.9;
const OBJECT_HEIGHT = 1.5;

/** One letter's flower: a bud until its letter is played, then a bloom with its object beside it. */
export class Bud {
  readonly root = new Group();
  readonly collider: Mesh;
  bloomed = false;
  private flower = new Group();
  private budModel: Object3D | null = null;
  private object: Object3D | null = null;
  private badge: Sprite;
  private glow = glowDisc(3.4);
  private suggested = false;
  private juice = 1;

  constructor(
    readonly letter: LetterDef,
    readonly color: string,
  ) {
    // Invisible hit collider, larger than the visual (P3).
    this.collider = new Mesh(new SphereGeometry(1.9, 10, 8), new MeshBasicMaterial());
    this.collider.position.y = 1.4;
    this.collider.visible = false;
    this.collider.userData.bud = this;
    this.badge = glyphBadge(letter.glyph, color, 1.25);
    this.badge.position.y = BUD_HEIGHT + 0.85;
    this.glow.visible = false;
    this.root.add(this.flower, this.collider, this.badge, this.glow, blobShadow(2.2));
  }

  async build(bloomed: boolean): Promise<void> {
    this.bloomed = bloomed;
    if (bloomed) await this.showBloom(false);
    else {
      this.budModel = await modelInstance('bud', BUD_HEIGHT);
      this.flower.add(this.budModel);
    }
  }

  get headPosition(): Vector3 {
    return this.root.localToWorld(new Vector3(0, (this.bloomed ? BLOOM_HEIGHT : BUD_HEIGHT) * 0.8, 0));
  }

  get objectSpot(): Vector3 {
    return this.root.localToWorld(new Vector3(1.7, 0, 0.6));
  }

  setBadgeVisible(visible: boolean): void {
    this.badge.visible = visible;
  }

  setSuggested(on: boolean): void {
    this.suggested = on && !this.bloomed;
    this.glow.visible = this.suggested;
  }

  /** Squash-and-stretch so every tap gets a visible response (≤100 ms). */
  tapJuice(): void {
    void tweens.to(0.45, (k) => (this.juice = 1 + Math.sin(k * Math.PI * 2.5) * 0.14 * (1 - k)), ease.linear);
  }

  /** The bud opens a little as the letter rises out of it. */
  async openALittle(): Promise<void> {
    await tweens.to(0.6, (k) => (this.juice = 1 + Math.sin(k * Math.PI) * 0.2), ease.inOutSine);
    this.juice = 1;
  }

  /** Bud → bloom with its object growing beside it. */
  async bloom(particles: PollenParticles): Promise<void> {
    this.bloomed = true;
    this.setSuggested(false);
    const bud = this.budModel;
    if (bud) await tweens.to(0.3, (k) => bud.scale.setScalar(1 - k), ease.inOutCubic);
    if (bud) disposeObject(bud);
    this.budModel = null;
    particles.burst(this.headPosition, 60, this.color, 5);
    await this.showBloom(true);
  }

  private async showBloom(animate: boolean): Promise<void> {
    const [bloom, object] = await Promise.all([modelInstance('bloom', BLOOM_HEIGHT), modelInstance(this.letter.objectModel, OBJECT_HEIGHT)]);
    this.object = object;
    object.position.set(1.7, 0, 0.6);
    object.add(blobShadow(1.4));
    this.flower.add(bloom);
    this.root.add(object);
    this.badge.position.y = BLOOM_HEIGHT + 0.7;
    if (!animate) return;
    bloom.scale.setScalar(0);
    object.scale.setScalar(0);
    await tweens.to(0.7, (k) => bloom.scale.setScalar(k), ease.outBack);
    await tweens.to(0.6, (k) => object.scale.setScalar(k), ease.outBack);
  }

  update(_dt: number, time: number): void {
    const pulse = this.suggested ? 1 + Math.sin(time * 4) * 0.05 : 1;
    const s = this.juice * pulse;
    this.flower.scale.set(1 / Math.sqrt(s), s, 1 / Math.sqrt(s));
    if (this.suggested) {
      this.glow.scale.setScalar(3.4 * (1 + Math.sin(time * 4) * 0.12));
      this.badge.scale.setScalar(1.25 * (1 + Math.sin(time * 4) * 0.08));
    }
    if (this.object && this.bloomed) this.object.rotation.y = Math.sin(time * 0.8 + this.root.position.x) * 0.25;
  }

  dispose(): void {
    disposeObject(this.root);
  }
}
