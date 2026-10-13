import {
  BackSide,
  BufferAttribute,
  BufferGeometry,
  CircleGeometry,
  Color,
  ConeGeometry,
  CylinderGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  RingGeometry,
  SphereGeometry,
  Vector3,
  type CatmullRomCurve3,
} from 'three';
import { toon, vertexToon } from '../core/assets';
import { theme } from '../core/theme';
import { facet, lowPoly, merge, paintFaces, rng, vary } from './geo';
import { makeRock } from './nature';

/** Floating island: flat grass top at y=0 over a jagged soil cone. One draw call. */
export function makeIsland(radius: number, seed: number): Mesh {
  const rand = rng(seed);
  const top = new CylinderGeometry(radius, radius * 0.97, 1.2, 40, 1);
  top.translate(0, -0.6, 0);
  // Wobble the rim on x/z only, so the playable top stays perfectly flat.
  const pos = top.getAttribute('position') as BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    const r = Math.hypot(x, z);
    if (r > radius * 0.9) {
      const a = Math.atan2(z, x);
      const k = 1 + Math.sin(a * 7 + seed) * 0.025 + Math.sin(a * 13 + seed * 3) * 0.015;
      pos.setX(i, x * k);
      pos.setZ(i, z * k);
    }
  }
  const topFlat = facet(top);
  paintFaces(topFlat, (c, n) => (n.y > 0.5 ? vary(theme.grass, rand, 0.03) : c.y > -0.35 ? vary(theme.grassDark, rand, 0.04) : vary(theme.soil, rand, 0.05)));

  const under = lowPoly(new ConeGeometry(radius * 0.98, radius * 0.55, 20, 3), 0.22, seed);
  under.rotateX(Math.PI);
  under.translate(0, -1.2 - radius * 0.275, 0);
  const depth = radius * 0.55;
  paintFaces(under, (c) => vary(new Color(theme.soil).lerp(new Color(theme.soilDark), Math.min(1, -(c.y + 1.2) / depth)), rand, 0.05));

  return new Mesh(merge([topFlat, under]), vertexToon);
}

/** Sandy ribbon following the path curve, a hair above the grass. */
export function makePath(curve: CatmullRomCurve3, width: number): Mesh {
  const samples = 160;
  const verts: number[] = [];
  const up = new Vector3(0, 1, 0);
  for (let i = 0; i <= samples; i++) {
    const t = i / samples;
    const p = curve.getPointAt(t);
    const side = curve.getTangentAt(t).cross(up).normalize();
    const w = width * (0.5 + Math.sin(t * 40) * 0.04);
    verts.push(p.x + side.x * w, 0.03, p.z + side.z * w, p.x - side.x * w, 0.03, p.z - side.z * w);
  }
  const index: number[] = [];
  for (let i = 0; i < samples; i++) {
    const a = i * 2;
    index.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
  }
  const geo = new BufferGeometry();
  geo.setAttribute('position', new BufferAttribute(new Float32Array(verts), 3));
  geo.setIndex(index);
  geo.computeVertexNormals();
  return new Mesh(geo, toon(theme.path));
}

/** Pond with a lighter ripple ring and a rim of little stones. */
export function makePond(radius: number, seed: number): Group {
  const g = new Group();
  const water = new Mesh(new CircleGeometry(radius, 24).rotateX(-Math.PI / 2), toon(theme.water));
  water.position.y = 0.04;
  const ripple = new Mesh(new RingGeometry(radius * 0.45, radius * 0.55, 24).rotateX(-Math.PI / 2), toon(theme.waterLight));
  ripple.position.y = 0.05;
  g.add(water, ripple);
  const rand = rng(seed);
  const n = 10;
  const stones = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + rand() * 0.3;
    const rock = makeRock(seed * 31 + i, 0.35 + rand() * 0.2);
    rock.position.set(Math.cos(a) * (radius + 0.15), -0.05, Math.sin(a) * (radius + 0.15));
    rock.updateMatrix();
    stones.push(rock.geometry.applyMatrix4(rock.matrix));
  }
  g.add(new Mesh(merge(stones), vertexToon)); // one draw call for the whole rim
  return g;
}

/** Vertical gradient sky on a big inverted sphere (no skybox texture). */
export function makeSky(radius: number): Mesh {
  const geo = new SphereGeometry(radius, 24, 16);
  const pos = geo.getAttribute('position');
  const top = new Color(theme.skyTop);
  const bottom = new Color(theme.skyBottom);
  const colors = new Float32Array(pos.count * 3);
  const c = new Color();
  for (let i = 0; i < pos.count; i++) {
    const h = pos.getY(i) / radius; // -1..1
    c.copy(bottom).lerp(top, Math.min(1, Math.max(0, (h + 0.05) * 1.6)));
    colors.set([c.r, c.g, c.b], i * 3);
  }
  geo.setAttribute('color', new BufferAttribute(colors, 3));
  const mat = new MeshBasicMaterial({ vertexColors: true, side: BackSide, depthWrite: false });
  const sky = new Mesh(geo, mat);
  sky.renderOrder = -1;
  return sky;
}
