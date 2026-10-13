import { Raycaster, Vector2, type Camera, type Intersection, type Object3D } from 'three';

export type GamePointerEvent = { kind: 'down' | 'move' | 'up'; ndc: Vector2; pressed: boolean };
type Handler = (e: GamePointerEvent) => void;

/**
 * Pointer Events only, so mouse and touch share one path (P2). Only the primary
 * pointer counts: a second finger is ignored instead of breaking a drag.
 */
export class Input {
  private handlers = new Set<Handler>();
  private pressed = false;
  private readonly ndc = new Vector2();
  enabled = true;

  constructor(private el: HTMLElement) {
    el.style.touchAction = 'none';
    el.addEventListener('pointerdown', (e) => {
      if (!e.isPrimary) return;
      try {
        el.setPointerCapture(e.pointerId);
      } catch {
        // Capture is a nicety (drags that leave the canvas); never let it block input.
      }
      this.pressed = true;
      this.emit('down', e);
    });
    el.addEventListener('pointermove', (e) => {
      if (e.isPrimary) this.emit('move', e);
    });
    const end = (e: PointerEvent) => {
      if (!e.isPrimary || !this.pressed) return;
      this.pressed = false;
      this.emit('up', e);
    };
    el.addEventListener('pointerup', end);
    el.addEventListener('pointercancel', end);
    el.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  on(fn: Handler): () => void {
    this.handlers.add(fn);
    return () => this.handlers.delete(fn);
  }

  private emit(kind: GamePointerEvent['kind'], e: PointerEvent): void {
    if (!this.enabled) return;
    const rect = this.el.getBoundingClientRect();
    this.ndc.set(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
    const ev: GamePointerEvent = { kind, ndc: this.ndc.clone(), pressed: this.pressed };
    for (const fn of this.handlers) fn(ev);
  }
}

const raycaster = new Raycaster();

/** Raycast against hit colliders only (never complex meshes). Colliders may be invisible. */
export function pick(camera: Camera, ndc: Vector2, colliders: Object3D[]): Intersection | null {
  raycaster.setFromCamera(ndc, camera);
  const hits = raycaster.intersectObjects(colliders, false);
  return hits[0] ?? null;
}

export function rayFrom(camera: Camera, ndc: Vector2): Raycaster {
  raycaster.setFromCamera(ndc, camera);
  return raycaster;
}
