import type { WebGLRenderer } from 'three';
import type { Loop } from '../core/loop';

/** Dev-only (/?dev=perf): fps, draw calls, triangles, GPU memory counts. */
export function mountPerfOverlay(parent: HTMLElement, renderer: WebGLRenderer, loop: Loop, status: () => string = () => ''): void {
  const el = document.createElement('pre');
  el.className = 'perf';
  el.id = 'perf';
  parent.appendChild(el);
  let frames = 0;
  let acc = 0;
  loop.add((dt) => {
    frames++;
    acc += dt;
    if (acc < 0.5) return;
    const { render, memory } = renderer.info;
    el.textContent = `fps ${(frames / acc).toFixed(0)}\ncalls ${render.calls}\ntris ${render.triangles}\ngeo ${memory.geometries} tex ${memory.textures}\n${status()}`;
    frames = 0;
    acc = 0;
  });
}
