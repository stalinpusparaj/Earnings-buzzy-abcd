import { DirectionalLight, HemisphereLight, PerspectiveCamera, Scene, WebGLRenderer } from 'three';
import type { Quality } from './quality';

export type RenderContext = {
  renderer: WebGLRenderer;
  scene: Scene;
  camera: PerspectiveCamera;
  onResize: Set<() => void>;
};

export function createRenderContext(container: HTMLElement, quality: Quality): RenderContext {
  const renderer = new WebGLRenderer({ antialias: quality.tier !== 'low', powerPreference: 'high-performance' });
  renderer.setPixelRatio(quality.dpr);
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.domElement.className = 'game-canvas';
  container.appendChild(renderer.domElement);

  const scene = new Scene();
  const camera = new PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 900);

  // One hemisphere + one directional light (brief §4). No shadow maps: blob decals instead.
  scene.add(new HemisphereLight('#ffffff', '#cfe9a8', 1.5));
  const sun = new DirectionalLight('#fff6e0', 1.6);
  sun.position.set(10, 18, 12);
  scene.add(sun);

  const onResize = new Set<() => void>();
  window.addEventListener('resize', () => {
    renderer.setSize(window.innerWidth, window.innerHeight);
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    for (const fn of onResize) fn();
  });

  return { renderer, scene, camera, onResize };
}
