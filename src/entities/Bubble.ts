import { Group, IcosahedronGeometry, Mesh, MeshBasicMaterial, MeshToonMaterial, SphereGeometry, Sprite, SpriteMaterial } from 'three';
import { toonRamp } from '../core/assets';
import { ease, tweens } from '../core/tween';
import { theme } from '../core/theme';
import { glyphTexture } from '../procedural/glyph';

export const BUBBLE_RADIUS = 0.95;

/** Shared bubble resources, created per mini-game visit and disposed in its exit(). */
export function bubbleKit() {
  const shell = new SphereGeometry(BUBBLE_RADIUS, 20, 14);
  const shine = new IcosahedronGeometry(0.17, 1);
  const hit = new SphereGeometry(BUBBLE_RADIUS * 1.5, 8, 6);
  const shellMat = new MeshToonMaterial({ color: '#BDEBFF', gradientMap: toonRamp, transparent: true, opacity: 0.5, depthWrite: false });
  const shineMat = new MeshBasicMaterial({ color: '#FFFFFF' });
  return { shell, shine, hit, shellMat, shineMat, hitMat: new MeshBasicMaterial() };
}
export type BubbleKit = ReturnType<typeof bubbleKit>;

/** A floating bubble with a glyph inside (Pollen Pop). */
export class Bubble {
  readonly root = new Group();
  readonly collider: Mesh;
  popped = false;
  hinting = false;
  private body = new Group();
  private wobble = 0;

  constructor(
    readonly glyph: string,
    readonly isTarget: boolean,
    kit: BubbleKit,
  ) {
    const shell = new Mesh(kit.shell, kit.shellMat);
    shell.renderOrder = 2;
    const shine = new Mesh(kit.shine, kit.shineMat);
    shine.position.set(-0.42, 0.45, 0.6);
    const label = new Sprite(new SpriteMaterial({ map: glyphTexture(glyph, { fill: theme.glyphFill, outline: theme.glyphOutline, outlineFrac: 0.14 }), depthWrite: false }));
    label.scale.setScalar(1.35);
    label.renderOrder = 3;
    this.body.add(shell, shine, label);
    this.collider = new Mesh(kit.hit, kit.hitMat);
    this.collider.visible = false;
    this.collider.userData.bubble = this;
    this.root.add(this.body, this.collider);
  }

  /** Soft wobble for a wrong tap (never a red X). */
  wobbleOnce(): void {
    void tweens.to(0.5, (k) => (this.wobble = Math.sin(k * Math.PI * 4) * (1 - k)), ease.linear);
  }

  async pop(): Promise<void> {
    this.popped = true;
    await tweens.to(0.18, (k) => this.body.scale.setScalar(1 + k * 0.5), ease.outCubic);
    this.root.visible = false;
  }

  update(time: number): void {
    const pulse = this.hinting ? 1 + Math.sin(time * 7) * 0.12 : 1;
    this.body.scale.set(pulse * (1 + this.wobble * 0.18), pulse * (1 - this.wobble * 0.18), pulse);
    this.body.rotation.z = this.wobble * 0.3;
  }
}
