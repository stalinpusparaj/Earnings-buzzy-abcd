import { Vector3, type PerspectiveCamera } from 'three';
import { ease, tweens } from './tween';

export type Pose = { pos: Vector3; target: Vector3 };

/** Guided camera (P6): no free orbit. It only ever tweens between poses. */
export class CameraRig {
  readonly target = new Vector3();
  private moveId = 0;

  constructor(
    private camera: PerspectiveCamera,
    private reducedMotion: boolean,
  ) {}

  jump(pose: Pose): void {
    this.moveId++;
    this.camera.position.copy(pose.pos);
    this.target.copy(pose.target);
    this.camera.lookAt(this.target);
  }

  /** 1.0 s easeInOutCubic by default; halved under prefers-reduced-motion. */
  async moveTo(pose: Pose, duration = 1.0): Promise<void> {
    const id = ++this.moveId;
    const fromPos = this.camera.position.clone();
    const fromTarget = this.target.clone();
    const d = this.reducedMotion ? duration * 0.5 : duration;
    await tweens.to(
      d,
      (k) => {
        if (id !== this.moveId) return;
        this.camera.position.lerpVectors(fromPos, pose.pos, k);
        this.target.lerpVectors(fromTarget, pose.target, k);
        this.camera.lookAt(this.target);
      },
      ease.inOutCubic,
    );
  }
}
