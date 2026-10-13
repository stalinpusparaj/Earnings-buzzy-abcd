import {
  CanvasTexture,
  CircleGeometry,
  Mesh,
  MeshBasicMaterial,
  MeshToonMaterial,
  PlaneGeometry,
  SRGBColorSpace,
  type Texture,
} from 'three';
import { toonRamp } from '../core/assets';

function canvasTexture(size: number, draw: (ctx: CanvasRenderingContext2D, s: number) => void): CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  draw(c.getContext('2d')!, size);
  const tex = new CanvasTexture(c);
  tex.colorSpace = SRGBColorSpace;
  return tex;
}

function radial(inner: string, outer: string): Texture {
  return canvasTexture(128, (ctx, s) => {
    const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    g.addColorStop(0, inner);
    g.addColorStop(1, outer);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, s, s);
  });
}

// Blob shadows instead of shadow maps (low tier, brief §4). Geometry/material shared.
const shadowGeo = new CircleGeometry(0.5, 20).rotateX(-Math.PI / 2);
shadowGeo.userData.shared = true;
const shadowMat = new MeshBasicMaterial({ map: radial('rgba(40,60,20,0.38)', 'rgba(40,60,20,0)'), transparent: true, depthWrite: false });
shadowMat.userData.shared = true;

export function blobShadow(diameter: number): Mesh {
  const m = new Mesh(shadowGeo, shadowMat);
  m.scale.setScalar(diameter);
  m.position.y = 0.06;
  m.renderOrder = 1;
  return m;
}

/** Soft yellow halo used to point at the right answer (no shared material is touched). */
export function glowDisc(diameter: number): Mesh {
  const mat = new MeshBasicMaterial({ map: radial('rgba(255,224,102,0.9)', 'rgba(255,224,102,0)'), transparent: true, depthWrite: false });
  const m = new Mesh(new CircleGeometry(0.5, 24).rotateX(-Math.PI / 2), mat);
  m.scale.setScalar(diameter);
  m.position.y = 0.07;
  m.renderOrder = 2;
  return m;
}

/** Red-and-white gingham picnic cloth. */
export function picnicCloth(width: number, depth: number): Mesh {
  const tex = canvasTexture(256, (ctx, s) => {
    const n = 8;
    const cell = s / n;
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, s, s);
    ctx.fillStyle = 'rgba(255,107,107,0.55)';
    for (let i = 0; i < n; i += 2) {
      ctx.fillRect(i * cell, 0, cell, s);
      ctx.fillRect(0, i * cell, s, cell);
    }
    ctx.strokeStyle = '#FF6B6B';
    ctx.lineWidth = 10;
    ctx.strokeRect(5, 5, s - 10, s - 10);
  });
  const mat = new MeshToonMaterial({ map: tex, gradientMap: toonRamp });
  const m = new Mesh(new PlaneGeometry(width, depth).rotateX(-Math.PI / 2), mat);
  m.position.y = 0.05;
  return m;
}

/** Shared round sprite texture for pollen particles. */
export const dotTexture = radial('rgba(255,255,255,1)', 'rgba(255,255,255,0)');
dotTexture.userData.shared = true;
