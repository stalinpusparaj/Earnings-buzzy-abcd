import { CatmullRomCurve3, Vector3 } from 'three';
import { rng } from '../procedural/geo';
import type { Scatter } from '../procedural/nature';

// Where everything sits on the 40 × 40 island. Pure data so it is easy to tweak.

export const ISLAND_RADIUS = 20;

/** Winding S-curve path from the front of the island to the gazebo at the back. */
export const pathCurve = new CatmullRomCurve3(
  [
    new Vector3(-1, 0, 17.5),
    new Vector3(-7.5, 0, 11),
    new Vector3(-6, 0, 4),
    new Vector3(3, 0, 1),
    new Vector3(8.5, 0, -4.5),
    new Vector3(5, 0, -10),
    new Vector3(0, 0, -12.5),
  ],
  false,
  'centripetal',
);

export const GAZEBO_POS = new Vector3(0, 0, -15);
export const POND_POS = new Vector3(-10.5, 0, -6);
export const POND_RADIUS = 2.8;

const BUD_T = [0.07, 0.23, 0.39, 0.55, 0.71, 0.86];

/** Six bud spots alongside the path, alternating sides. */
export function budSpots(): Vector3[] {
  const up = new Vector3(0, 1, 0);
  return BUD_T.map((t, i) => {
    const p = pathCurve.getPointAt(t);
    const side = pathCurve.getTangentAt(t).cross(up).normalize();
    return p.add(side.multiplyScalar(i % 2 === 0 ? 2.6 : -2.6));
  });
}

export const TREE_SPOTS = [new Vector3(-14, 0, 2), new Vector3(12.5, 0, 7), new Vector3(-6.5, 0, -14), new Vector3(14, 0, -8.5), new Vector3(6, 0, 13.5)];
export const TREE_SIZES = [4.6, 4.2, 4.0, 4.4, 3.6];
export const ROCK_SPOTS: [number, number, number][] = [
  [-16, 7, 1.1],
  [10, 12, 0.8],
  [16.5, 1, 1.2],
  [-3, -7.5, 0.7],
  [11, -13, 0.9],
  [-15, -10, 1.0],
  [3.5, 8, 0.6],
];
export const BUSH_SPOTS: [number, number, number][] = [
  [-11, 13, 1.1],
  [14.5, 12.5, 0.9],
  [-16, -3, 1.2],
  [9, -15, 1.0],
  [-4.5, -16, 0.9],
  [16, -3.5, 0.8],
  [1, 6.5, 0.7],
];

/** Random grass/flower spots that keep clear of the path, pond, buds and gazebo. */
export function scatter(count: number, seed: number, clear: Vector3[], scale: [number, number]): Scatter[] {
  const rand = rng(seed);
  const pathPts = pathCurve.getSpacedPoints(80);
  const out: Scatter[] = [];
  let guard = 0;
  while (out.length < count && guard++ < count * 30) {
    const a = rand() * Math.PI * 2;
    const r = Math.sqrt(rand()) * (ISLAND_RADIUS - 1.2);
    const x = Math.cos(a) * r;
    const z = Math.sin(a) * r;
    if (pathPts.some((p) => Math.hypot(p.x - x, p.z - z) < 1.8)) continue;
    if (Math.hypot(POND_POS.x - x, POND_POS.z - z) < POND_RADIUS + 0.8) continue;
    if (Math.hypot(GAZEBO_POS.x - x, GAZEBO_POS.z - z) < 4) continue;
    if (clear.some((c) => Math.hypot(c.x - x, c.z - z) < 1.8)) continue;
    out.push({ x, z, scale: scale[0] + rand() * (scale[1] - scale[0]), rot: rand() * Math.PI * 2 });
  }
  return out;
}
