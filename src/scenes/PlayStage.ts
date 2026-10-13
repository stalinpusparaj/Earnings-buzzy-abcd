import { Group, Vector3 } from 'three';
import type { Pose } from '../core/cameraRig';
import { makeIsland } from '../procedural/island';
import { makeBush, makeFlowers, makeRock } from '../procedural/nature';
import { blobShadow } from '../procedural/props';

/** World position of the play meadow, behind the garden camera so the two never overlap. */
export const STAGE = new Vector3(0, 0, 95);

/** Small floating meadow where the mini-games are played. */
export class PlayStage {
  readonly root = new Group();

  constructor() {
    this.root.position.copy(STAGE);
    this.root.add(makeIsland(13, 21));
    const back: [number, number, number, 'rock' | 'bush'][] = [
      [-10, -6, 1.2, 'bush'],
      [-6.5, -9, 0.9, 'rock'],
      [7, -8.5, 1.1, 'bush'],
      [10.5, -4.5, 0.8, 'rock'],
      [0, -10.5, 1.0, 'bush'],
    ];
    back.forEach(([x, z, s, kind], i) => {
      const m = kind === 'rock' ? makeRock(500 + i, s) : makeBush(600 + i, s);
      m.position.set(x, 0, z);
      if (kind === 'bush') m.add(blobShadow(2));
      this.root.add(m);
    });
    const flowers = Array.from({ length: 26 }, (_, i) => {
      const a = (i / 26) * Math.PI * 2;
      const r = 10.5 + (i % 3) * 0.6;
      return { x: Math.cos(a) * r, z: Math.sin(a) * r, scale: 1.1, rot: i };
    });
    this.root.add(makeFlowers(flowers, 77));
  }

  /** World-space point on the meadow from local x/y/z. */
  at(x: number, y: number, z: number): Vector3 {
    return STAGE.clone().add(new Vector3(x, y, z));
  }

  pose(aspect: number): Pose {
    const k = Math.max(1, (16 / 9 / aspect) * 0.95);
    return { pos: this.at(0, 6.5 * k, 12.5 * k), target: this.at(0, 2.2, 0) };
  }
}
