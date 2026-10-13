import { AdditiveBlending, BufferAttribute, BufferGeometry, Color, Points, PointsMaterial, Vector3, type ColorRepresentation } from 'three';
import { theme } from '../core/theme';
import { dotTexture } from '../procedural/props';

/** Pooled pollen bursts: one Points object, capped at the quality tier's particle budget. */
export class PollenParticles {
  readonly points: Points;
  private pos: Float32Array;
  private col: Float32Array;
  private vel: Float32Array;
  private life: Float32Array;
  private next = 0;

  constructor(private max: number) {
    this.pos = new Float32Array(max * 3);
    this.col = new Float32Array(max * 4);
    this.vel = new Float32Array(max * 3);
    this.life = new Float32Array(max);
    const geo = new BufferGeometry();
    geo.setAttribute('position', new BufferAttribute(this.pos, 3));
    geo.setAttribute('color', new BufferAttribute(this.col, 4));
    const mat = new PointsMaterial({
      size: 0.35,
      map: dotTexture,
      vertexColors: true,
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
    });
    this.points = new Points(geo, mat);
    this.points.frustumCulled = false;
    this.points.renderOrder = 5;
  }

  burst(at: Vector3, count = 30, color: ColorRepresentation = theme.pollen, speed = 3.5): void {
    const c = new Color(color);
    const white = new Color('#ffffff');
    for (let n = 0; n < count; n++) {
      const i = this.next;
      this.next = (this.next + 1) % this.max;
      const theta = Math.random() * Math.PI * 2;
      const up = Math.random() * 0.9 + 0.3;
      const s = speed * (0.4 + Math.random() * 0.6);
      this.pos.set([at.x, at.y, at.z], i * 3);
      this.vel.set([Math.cos(theta) * s, up * s, Math.sin(theta) * s], i * 3);
      const mix = c.clone().lerp(white, Math.random() * 0.4);
      this.col.set([mix.r, mix.g, mix.b, 1], i * 4);
      this.life[i] = 0.9 + Math.random() * 0.5;
    }
  }

  update(dt: number): void {
    let alive = false;
    for (let i = 0; i < this.max; i++) {
      if (this.life[i] <= 0) continue;
      alive = true;
      this.life[i] -= dt;
      this.vel[i * 3 + 1] -= 6 * dt;
      for (let k = 0; k < 3; k++) {
        this.vel[i * 3 + k] *= 1 - 1.5 * dt;
        this.pos[i * 3 + k] += this.vel[i * 3 + k] * dt;
      }
      this.col[i * 4 + 3] = Math.max(0, Math.min(1, this.life[i] * 1.5));
    }
    if (!alive) return;
    this.points.geometry.attributes.position.needsUpdate = true;
    this.points.geometry.attributes.color.needsUpdate = true;
  }
}
