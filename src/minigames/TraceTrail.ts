import { BoxGeometry, Group, Mesh, MeshBasicMaterial, PlaneGeometry, RingGeometry, Vector3 } from 'three';
import { toon } from '../core/assets';
import { strokesFor } from '../core/content';
import { disposeObject } from '../core/dispose';
import { pick, type GamePointerEvent } from '../core/input';
import { theme } from '../core/theme';
import type { LetterDef } from '../core/types';
import { HINT_IDLE_SECONDS, type GameContext, type MiniGame } from './MiniGame';
import { TraceBoard } from './traceBoard';
import { TOLERANCE, TraceState, defaultTraceConfig } from './traceMath';

const FACE = 6.4; // board face size in world units
const BOARD_Y = 3.5;
const TILT = -0.36; // faces the play-meadow camera

/** Template B: trace the letter's strokes in order; Buzzy follows the trail (brief §5.3). */
export class TraceTrail implements MiniGame {
  readonly id = 'traceTrail' as const;
  onComplete: () => void = () => undefined;
  private ctx!: GameContext;
  private letter!: LetterDef;
  private group = new Group();
  private face!: Mesh;
  private marker!: Mesh;
  private board: TraceBoard | null = null;
  private state: TraceState | null = null;
  private dirty = true;
  private idle = 0;
  private finished = false;
  private sparkleTimer = 0;
  private buzzyGoal = new Vector3();

  async enter(ctx: GameContext, letter: LetterDef): Promise<void> {
    this.ctx = ctx;
    this.letter = letter;
    const def = strokesFor(letter);
    if (!def || def.strokes.length === 0) {
      console.warn(`TODO(content): no strokes for ${letter.lang}/${letter.id}; skipping tracing`);
      await ctx.say(letter.vo.isFor);
      this.onComplete();
      return;
    }
    const tol = TOLERANCE[ctx.tolerance];
    this.state = new TraceState(def.strokes, { ...defaultTraceConfig, tolerance: tol });
    this.board = new TraceBoard(letter.glyph, def.strokes);

    // Raised garden plot: wooden frame + canvas soil face.
    this.group.position.set(0, BOARD_Y, -0.5);
    this.group.rotation.x = TILT;
    const frame = new Mesh(new BoxGeometry(FACE + 0.7, FACE + 0.7, 0.5), toon('#B07A4A'));
    frame.position.z = -0.26;
    this.face = new Mesh(new PlaneGeometry(FACE, FACE), new MeshBasicMaterial({ map: this.board.texture }));
    this.face.position.z = 0.01;
    this.marker = new Mesh(new RingGeometry(0.28, 0.42, 24), new MeshBasicMaterial({ color: theme.startDot, transparent: true, opacity: 0.9, depthWrite: false }));
    this.marker.position.z = 0.05;
    const posts = [-FACE / 2 + 0.6, FACE / 2 - 0.6].map((x) => {
      const post = new Mesh(new BoxGeometry(0.45, BOARD_Y, 0.45), toon('#8A5A36'));
      post.position.set(x, -FACE / 2 - BOARD_Y / 2 + 0.6, -0.4);
      return post;
    });
    this.group.add(frame, this.face, this.marker, ...posts);
    ctx.stage.root.add(this.group);
    this.group.updateWorldMatrix(true, true); // boardPoint() needs world matrices before the next render

    ctx.buzzy.setSize(0.8);
    this.updateBuzzyGoal();
    await ctx.buzzy.flyTo(this.buzzyGoal, 0.9);
    await ctx.say('tt_instruction', { glyph: letter.glyph });
  }

  /** World point on the board face for a glyph-box point, nudged toward the camera. */
  private boardPoint(u: number, v: number, lift: number): Vector3 {
    const [x, y] = TraceBoard.fromBox([u, v], FACE);
    return this.face.localToWorld(new Vector3(x, y, lift));
  }

  private updateBuzzyGoal(): void {
    if (!this.state) return;
    const [u, v] = this.state.progressPoint();
    const p = this.boardPoint(u, v, 0.7);
    p.y -= 0.75; // root sits below the hovering body
    this.buzzyGoal.copy(p);
    const [mx, my] = TraceBoard.fromBox([u, v], FACE);
    this.marker.position.set(mx, my, 0.05);
  }

  onPointer(e: GamePointerEvent): void {
    const state = this.state;
    if (!state || this.finished || !e.pressed || e.kind === 'up') return;
    const hit = pick(this.ctx.camera, e.ndc, [this.face]);
    if (!hit) return;
    const local = this.face.worldToLocal(hit.point.clone());
    const result = state.feed(TraceBoard.toBox(local.x, local.y, FACE));
    if (result === 'offPath' || result === 'none') return;
    this.idle = 0;
    this.dirty = true;
    this.updateBuzzyGoal();
    if (result === 'progress') {
      this.sparkleTimer -= 1;
      if (this.sparkleTimer <= 0) {
        this.sparkleTimer = 4;
        this.ctx.particles.burst(this.boardPoint(...state.progressPoint(), 0.3), 3, theme.pollen, 1.2);
      }
    } else if (result === 'strokeDone') {
      this.ctx.audio.play('chime');
      this.ctx.buzzy.boing();
    } else if (result === 'letterDone') {
      void this.finish();
    }
  }

  private async finish(): Promise<void> {
    this.finished = true;
    this.ctx.audio.play('celebrate');
    this.ctx.particles.burst(this.group.getWorldPosition(new Vector3()), 60, theme.pollen, 5);
    await this.ctx.buzzy.celebrate();
    await this.ctx.say(this.letter.vo.sound);
    await this.ctx.praise();
    this.onComplete();
  }

  update(dt: number, time: number): void {
    if (!this.state || !this.board) return;
    if (this.dirty) {
      this.board.draw(this.state.strokeIndex, this.state.progress, this.state.done);
      this.dirty = false;
    }
    // Buzzy glides to the last valid point on the trail (never to an off-path finger).
    const root = this.ctx.buzzy.root.position;
    root.lerp(this.buzzyGoal, Math.min(1, dt * 8));
    if (this.finished) {
      this.marker.visible = false;
      return;
    }
    this.idle += dt;
    const nudge = !this.state.lastOnPath || this.idle > HINT_IDLE_SECONDS;
    const s = nudge ? 1 + Math.sin(time * 8) * 0.35 : 1 + Math.sin(time * 3) * 0.08;
    this.marker.scale.setScalar(s);
  }

  exit(): void {
    this.ctx.buzzy.setSize(1.3);
    disposeObject(this.group);
    this.board?.texture.dispose();
    this.board = null;
    this.state = null;
  }
}
