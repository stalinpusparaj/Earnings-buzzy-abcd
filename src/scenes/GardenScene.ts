import { Group, Mesh, MeshBasicMaterial, CylinderGeometry, Vector3, type InstancedMesh, type Object3D } from 'three';
import { modelInstance } from '../core/assets';
import type { Pose } from '../core/cameraRig';
import { lettersFor } from '../core/content';
import { theme } from '../core/theme';
import type { Lang } from '../core/types';
import { Bud } from '../entities/Bud';
import { makeIsland, makePath, makePond, makeSky } from '../procedural/island';
import { makeBush, makeCloud, makeFlowers, makeGrassTufts, makeRock } from '../procedural/nature';
import { blobShadow } from '../procedural/props';
import { BUSH_SPOTS, GAZEBO_POS, POND_POS, POND_RADIUS, ROCK_SPOTS, TREE_SIZES, TREE_SPOTS, budSpots, pathCurve, scatter } from './gardenLayout';

const OVERVIEW_TARGET = new Vector3(0, 0, 2.5);

/** The garden hub: floating island, path, six letter buds and the sing-along gazebo. */
export class GardenScene {
  readonly root = new Group();
  readonly gazeboCollider: Mesh;
  buds: Bud[] = [];
  private budGroup = new Group();
  private clouds: Object3D[] = [];
  private flowers: InstancedMesh;
  private flowerTotal: number;
  private readonly spots = budSpots();

  constructor() {
    this.root.add(makeSky(500), makeIsland(20, 7), makePath(pathCurve, 2.4), this.budGroup);
    const pond = makePond(POND_RADIUS, 11);
    pond.position.copy(POND_POS);
    this.root.add(pond);
    ROCK_SPOTS.forEach(([x, z, s], i) => {
      const rock = makeRock(100 + i, s);
      rock.position.set(x, 0, z);
      this.root.add(rock);
    });
    BUSH_SPOTS.forEach(([x, z, s], i) => {
      const bush = makeBush(200 + i, s);
      bush.position.set(x, 0, z);
      bush.add(blobShadow(2.2));
      this.root.add(bush);
    });
    const keepClear = [...this.spots, ...TREE_SPOTS, ...ROCK_SPOTS.map(([x, z]) => new Vector3(x, 0, z)), ...BUSH_SPOTS.map(([x, z]) => new Vector3(x, 0, z))];
    this.flowers = makeFlowers(scatter(90, 5, keepClear, [0.9, 1.4]), 9);
    this.flowerTotal = this.flowers.count;
    this.root.add(makeGrassTufts(scatter(220, 3, keepClear, [0.8, 1.4])), this.flowers);
    // Clouds drift below and behind the island, so it reads as floating in the sky.
    for (let i = 0; i < 8; i++) {
      const cloud = makeCloud(300 + i, 1.6 + (i % 3) * 0.5);
      cloud.position.set(-48 + i * 13, -9 + (i % 3) * 4, -14 - (i % 4) * 9);
      this.clouds.push(cloud);
      this.root.add(cloud);
    }
    // Gazebo hit collider (the visual GLB loads in loadModels).
    this.gazeboCollider = new Mesh(new CylinderGeometry(3.6, 3.6, 6.5, 12), new MeshBasicMaterial());
    this.gazeboCollider.position.copy(GAZEBO_POS).setY(3.2);
    this.gazeboCollider.visible = false;
    this.root.add(this.gazeboCollider);
  }

  /** Share of the decorative flowers drawn (quality tier). Grass stays: it's cheap and reads as ground. */
  setDecorDensity(share: number): void {
    this.flowers.count = Math.round(this.flowerTotal * Math.max(0, Math.min(1, share)));
  }

  /** GLB scenery: gazebo and trees. */
  async loadModels(): Promise<void> {
    const gazebo = await modelInstance('gazebo', 6.2);
    gazebo.position.copy(GAZEBO_POS);
    gazebo.add(blobShadow(7));
    this.root.add(gazebo);
    await Promise.all(
      TREE_SPOTS.map(async (p, i) => {
        const tree = await modelInstance('tree', TREE_SIZES[i]);
        tree.position.copy(p);
        tree.rotation.y = i * 1.7;
        tree.add(blobShadow(TREE_SIZES[i] * 0.85));
        this.root.add(tree);
      }),
    );
  }

  /** (Re)build the six buds for a language. */
  async setLanguage(lang: Lang, bloomed: ReadonlySet<string>): Promise<void> {
    for (const b of this.buds) b.dispose();
    const letters = lettersFor(lang).slice(0, this.spots.length);
    const buds = letters.map((l, i) => new Bud(l, theme.petals[i % theme.petals.length]));
    await Promise.all(buds.map((b) => b.build(bloomed.has(b.letter.id))));
    buds.forEach((b, i) => {
      b.root.position.copy(this.spots[i]);
      this.budGroup.add(b.root);
    });
    this.buds = buds;
    this.refreshSuggestion();
  }

  /** The first unbloomed bud gently pulses. Nothing is ever locked. */
  refreshSuggestion(): Bud | null {
    const next = this.buds.find((b) => !b.bloomed) ?? null;
    for (const b of this.buds) b.setSuggested(b === next);
    return next;
  }

  get colliders(): Object3D[] {
    return [...this.buds.map((b) => b.collider), this.gazeboCollider];
  }

  /** Whole island in frame; pulls back on narrower screens. */
  overviewPose(aspect: number): Pose {
    const dist = 41 * Math.max(1, (16 / 9 / aspect) * 0.92);
    const elev = (36 * Math.PI) / 180;
    return { pos: new Vector3(0, Math.sin(elev) * dist, Math.cos(elev) * dist).add(OVERVIEW_TARGET), target: OVERVIEW_TARGET.clone() };
  }

  /** Close-up rail for a bud, looking at it from the side the overview camera is on. */
  closeUpPose(bud: Bud, aspect: number): Pose {
    const p = bud.root.position;
    const dir = new Vector3(-p.x * 0.3, 0, 30 - p.z).normalize();
    const dist = 9 * Math.max(1, (16 / 9 / aspect) * 0.9);
    return { pos: p.clone().add(dir.multiplyScalar(dist)).setY(5.0), target: p.clone().setY(2.4) };
  }

  gazeboPose(): Pose {
    return { pos: GAZEBO_POS.clone().add(new Vector3(0, 6, 16)), target: GAZEBO_POS.clone().add(new Vector3(0, 2.5, 0)) };
  }

  update(dt: number, time: number): void {
    for (const b of this.buds) b.update(dt, time);
    for (const c of this.clouds) {
      c.position.x += dt * 0.6;
      if (c.position.x > 56) c.position.x = -56;
    }
  }
}
