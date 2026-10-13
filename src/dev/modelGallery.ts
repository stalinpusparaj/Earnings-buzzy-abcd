import { Color, DirectionalLight, Group, HemisphereLight, PerspectiveCamera, Scene, Vector3, WebGLRenderer } from 'three';
import { modelInstance } from '../core/assets';

/**
 * Dev/e2e Model Gallery (/?dev=models): every GLB in a grid with the game's toon
 * shading, to eyeball models after `npm run optimize-assets`. Add &spin=0 to freeze.
 */
const MODELS = ['buzzy', 'bud', 'bloom', 'gazebo', 'tree', 'basket', 'apple', 'bee', 'cat', 'duck', 'egg', 'fish', 'squirrel', 'goat', 'leaf', 'fly', 'ural', 'swing'];
const COLS = 6;
const GAP = 2.4;

export async function mountModelGallery(root: HTMLElement): Promise<void> {
  const spin = new URLSearchParams(location.search).get('spin') !== '0';
  const renderer = new WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setSize(innerWidth, innerHeight);
  renderer.domElement.className = 'game-canvas';
  root.appendChild(renderer.domElement);

  const scene = new Scene();
  scene.background = new Color('#E0F4FF');
  scene.add(new HemisphereLight('#ffffff', '#cfe9a8', 1.5));
  const sun = new DirectionalLight('#fff6e0', 1.6);
  sun.position.set(10, 18, 12);
  scene.add(sun);

  const rows = Math.ceil(MODELS.length / COLS);
  const grid = new Group();
  const labels = document.createElement('div');
  labels.style.cssText = 'position:fixed;inset:0;pointer-events:none;font:600 13px system-ui,sans-serif;color:#1f2933';
  root.appendChild(labels);
  const items = await Promise.all(
    MODELS.map(async (id, i) => {
      const m = await modelInstance(id, 1.7);
      m.position.set(((i % COLS) - (COLS - 1) / 2) * GAP, -Math.floor(i / COLS) * GAP * 1.15, 0);
      grid.add(m);
      const label = document.createElement('span');
      label.textContent = id;
      label.style.cssText = 'position:absolute;transform:translateX(-50%)';
      labels.appendChild(label);
      return { m, label };
    }),
  );
  grid.position.y = ((rows - 1) * GAP * 1.15) / 2 - 0.85;
  scene.add(grid);

  const camera = new PerspectiveCamera(35, innerWidth / innerHeight, 0.1, 100);
  camera.position.set(0, 2.2, 15.5);
  camera.lookAt(0, 0, 0);
  const placeLabels = () => {
    for (const { m, label } of items) {
      const p = m.getWorldPosition(new Vector3()).project(camera);
      label.style.left = `${((p.x + 1) / 2) * innerWidth}px`;
      label.style.top = `${((1 - p.y) / 2) * innerHeight + 6}px`;
    }
  };
  addEventListener('resize', () => {
    renderer.setSize(innerWidth, innerHeight);
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
  });
  let t = 0;
  renderer.setAnimationLoop(() => {
    t += 1 / 60;
    for (const { m } of items) m.rotation.y = spin ? Math.sin(t * 0.6) * 0.9 : 0;
    renderer.render(scene, camera);
    placeLabels();
  });
  Object.assign(window, { __modelGallery: { ready: true } });
}
