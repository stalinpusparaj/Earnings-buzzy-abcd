import { CatmullRomCurve3, Group, MathUtils, Vector3, type Camera, type Object3D } from 'three';
import { modelInstance } from '../core/assets';
import { ease, tweens } from '../core/tween';
import { blobShadow } from '../procedural/props';

const HOVER = 1.1; // body height above the ground while idling

/**
 * Buzzy: the GLB mascot plus the five brief animations (idle bob, fly-to with
 * banking, celebrate, point, yawn). `root` sits on the ground; the body hovers.
 */
export class Buzzy {
  readonly root = new Group();
  private readonly pivot = new Group(); // yaw + roll
  private readonly body = new Group(); // bob, squash, lean
  private readonly shadow = blobShadow(0.9);
  private model: Object3D | null = null;
  private flying = false;
  private spin = 0;
  private lean = 0;
  private leanTarget = 0; // yawn lean; pointing overrides it
  private yawTarget = 0;
  private squash = 1;
  private hoverHeight = HOVER;
  private pointTarget: Vector3 | null = null;
  faceCamera: Camera | null = null;

  constructor(private size = 1.3) {
    this.root.add(this.shadow, this.pivot);
    this.pivot.add(this.body);
  }

  async load(): Promise<void> {
    this.model = await modelInstance('buzzy', this.size);
    this.body.add(this.model);
  }

  setSize(size: number): void {
    const k = size / this.size;
    this.body.scale.setScalar(k);
    this.shadow.scale.setScalar(0.9 * k);
    this.hoverHeight = HOVER * Math.max(0.6, k);
  }

  placeAt(p: Vector3): void {
    this.root.position.copy(p);
  }

  /** CatmullRom flight with an arc and banking into the turn (1.2 s). */
  async flyTo(target: Vector3, duration = 1.2): Promise<void> {
    const from = this.root.position.clone();
    if (from.distanceTo(target) < 0.05) return;
    const mid = from.clone().lerp(target, 0.5);
    mid.y = Math.max(from.y, target.y) + Math.min(3, 0.6 + from.distanceTo(target) * 0.25);
    const side = new Vector3().subVectors(target, from).cross(new Vector3(0, 1, 0)).normalize().multiplyScalar(from.distanceTo(target) * 0.12);
    mid.add(side);
    const curve = new CatmullRomCurve3([from, mid, target.clone()]);
    this.flying = true;
    let lastYaw = this.pivot.rotation.y;
    await tweens.to(
      duration,
      (k) => {
        const p = curve.getPoint(k);
        this.root.position.copy(p);
        const tan = curve.getTangent(Math.min(0.999, Math.max(0.001, k)));
        if (Math.hypot(tan.x, tan.z) > 0.05) {
          const yaw = Math.atan2(tan.x, tan.z);
          this.pivot.rotation.y = yaw;
          const turn = MathUtils.euclideanModulo(yaw - lastYaw + Math.PI, Math.PI * 2) - Math.PI;
          this.pivot.rotation.z = MathUtils.lerp(this.pivot.rotation.z, MathUtils.clamp(-turn * 8, -0.5, 0.5), 0.3);
          lastYaw = yaw;
        }
      },
      ease.inOutCubic,
    );
    this.pivot.rotation.z = 0;
    this.flying = false;
  }

  /** 360° spin plus a small jump. */
  async celebrate(): Promise<void> {
    await tweens.to(0.8, (k) => {
      this.spin = k * Math.PI * 2;
      this.body.position.y = this.hoverHeight + Math.sin(k * Math.PI) * 0.9;
      this.squash = 1 + Math.sin(k * Math.PI * 2) * 0.12;
    }, ease.outCubic);
    this.spin = 0;
    this.squash = 1;
  }

  /** Lean toward a hint target until stopPointing(). */
  pointAt(target: Vector3): void {
    this.pointTarget = target.clone();
  }

  stopPointing(): void {
    this.pointTarget = null;
  }

  async yawn(): Promise<void> {
    await tweens.to(2.2, (k) => {
      const s = Math.sin(k * Math.PI);
      this.squash = 1 + s * 0.18;
      this.leanTarget = -s * 0.35;
    }, ease.inOutSine);
    this.squash = 1;
    this.leanTarget = 0;
  }

  /** Quick squash-and-stretch response to a tap (juice). */
  boing(): void {
    void tweens.to(0.35, (k) => (this.squash = 1 + Math.sin(k * Math.PI * 2) * 0.15 * (1 - k)), ease.linear);
  }

  update(dt: number, time: number): void {
    // Idle bob ±0.15 at 0.8 Hz.
    if (!this.flying && this.spin === 0) this.body.position.y = this.hoverHeight + Math.sin(time * Math.PI * 2 * 0.8) * 0.15;
    if (this.flying) this.body.position.y = MathUtils.lerp(this.body.position.y, this.hoverHeight, 0.2);
    this.body.scale.y = this.body.scale.x * this.squash;
    this.body.rotation.y = this.spin;

    if (!this.flying) {
      const look = this.pointTarget ?? this.faceCamera?.position ?? null;
      if (look) this.yawTarget = Math.atan2(look.x - this.root.position.x, look.z - this.root.position.z);
      const diff = MathUtils.euclideanModulo(this.yawTarget - this.pivot.rotation.y + Math.PI, Math.PI * 2) - Math.PI;
      this.pivot.rotation.y += diff * Math.min(1, dt * 5);
    }
    const lean = this.pointTarget ? 0.35 : this.leanTarget;
    this.lean = MathUtils.lerp(this.lean, lean, Math.min(1, dt * 6));
    this.body.rotation.x = this.lean;

    // Shadow stays on the ground under the body and shrinks as Buzzy climbs.
    this.shadow.position.y = 0.06 - this.root.position.y + this.groundY;
    const lift = this.root.position.y - this.groundY + this.body.position.y;
    this.shadow.scale.setScalar(Math.max(0.3, 0.9 - lift * 0.05) * (this.body.scale.x || 1));
  }

  /** Ground height under Buzzy (0 in the garden, stage height on the play meadow). */
  groundY = 0;
}
