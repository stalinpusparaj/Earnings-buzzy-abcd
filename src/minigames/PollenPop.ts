import { Group, Vector3 } from 'three';
import { disposeObject } from '../core/dispose';
import { pick, type GamePointerEvent } from '../core/input';
import type { LetterDef } from '../core/types';
import { Bubble, bubbleKit, type BubbleKit } from '../entities/Bubble';
import { HINT_IDLE_SECONDS, HINT_MISSES, shuffle, type GameContext, type MiniGame } from './MiniGame';

const TARGETS = 3;
const DISTRACTORS = 4;
const TOP = 6.8;
const BOTTOM = -0.6;

type Floater = { bubble: Bubble; baseX: number; z: number; y: number; speed: number; phase: number };

/** Template A: pop the bubbles that carry the target letter (brief §5.2). */
export class PollenPop implements MiniGame {
  readonly id = 'pollenPop' as const;
  onComplete: () => void = () => undefined;
  private ctx!: GameContext;
  private letter!: LetterDef;
  private group = new Group();
  private kit: BubbleKit | null = null;
  private floaters: Floater[] = [];
  private popped = 0;
  private misses = 0;
  private idle = 0;
  private hinting = false;
  private finished = false;
  private ready = false;

  async enter(ctx: GameContext, letter: LetterDef): Promise<void> {
    this.ctx = ctx;
    this.letter = letter;
    this.kit = bubbleKit();
    ctx.stage.root.add(this.group);
    const pool = letter.distractors.length > 0 ? letter.distractors : ctx.letters.filter((l) => l.id !== letter.id).map((l) => l.glyph);
    const mixed = shuffle(pool);
    const distractors = Array.from({ length: DISTRACTORS }, (_, i) => mixed[i % mixed.length]);
    const glyphs = shuffle([...Array<string>(TARGETS).fill(letter.glyph), ...distractors]);
    const lanes = glyphs.length;
    glyphs.forEach((g, i) => {
      const bubble = new Bubble(g, g === letter.glyph, this.kit!);
      const f: Floater = {
        bubble,
        baseX: -6.2 + (12.4 * i) / (lanes - 1) + (Math.random() - 0.5) * 0.5,
        z: Math.random() * 1.5 - 0.5,
        y: 0.8 + ((i * 2.3) % 5.2),
        speed: 0.5 + Math.random() * 0.3,
        phase: Math.random() * Math.PI * 2,
      };
      this.floaters.push(f);
      this.group.add(bubble.root);
    });
    void ctx.buzzy.flyTo(ctx.stage.at(-6.9, 0, 3), 0.9);
    this.ready = true;
    await ctx.say('pp_instruction', { glyph: letter.glyph });
  }

  onPointer(e: GamePointerEvent): void {
    if (e.kind !== 'down' || !this.ready || this.finished) return;
    const live = this.floaters.filter((f) => !f.bubble.popped).map((f) => f.bubble.collider);
    const hit = pick(this.ctx.camera, e.ndc, live);
    if (!hit) return;
    const bubble = hit.object.userData.bubble as Bubble;
    this.idle = 0;
    if (bubble.isTarget) void this.popTarget(bubble);
    else {
      bubble.wobbleOnce();
      this.ctx.audio.play('boop');
      this.misses++;
      if (this.misses >= HINT_MISSES) this.startHint();
    }
  }

  private async popTarget(bubble: Bubble): Promise<void> {
    const at = bubble.root.getWorldPosition(new Vector3());
    this.ctx.particles.burst(at, 34);
    this.ctx.audio.play('pop');
    this.stopHint();
    this.misses = 0;
    this.popped++;
    void bubble.pop();
    void this.ctx.say(this.letter.vo.sound);
    if (this.popped < TARGETS) return;
    this.finished = true;
    await this.ctx.buzzy.celebrate();
    await this.ctx.praise();
    this.onComplete();
  }

  private startHint(): void {
    if (this.hinting) return;
    this.hinting = true;
    for (const f of this.floaters) f.bubble.hinting = f.bubble.isTarget && !f.bubble.popped;
    void this.ctx.say('look_here');
  }

  private stopHint(): void {
    this.hinting = false;
    for (const f of this.floaters) f.bubble.hinting = false;
    this.ctx.buzzy.stopPointing();
  }

  update(dt: number, time: number): void {
    if (!this.ready) return;
    for (const f of this.floaters) {
      f.y += f.speed * dt;
      if (f.y > TOP) f.y = BOTTOM;
      f.bubble.root.position.set(f.baseX + Math.sin(time * 0.9 + f.phase) * 0.35, f.y, f.z);
      f.bubble.update(time);
    }
    if (this.finished) return;
    this.idle += dt;
    if (this.idle > HINT_IDLE_SECONDS) this.startHint();
    if (this.hinting) {
      const buzzyPos = this.ctx.buzzy.root.position;
      const targets = this.floaters.filter((f) => f.bubble.isTarget && !f.bubble.popped).map((f) => f.bubble.root.getWorldPosition(new Vector3()));
      targets.sort((a, b) => a.distanceTo(buzzyPos) - b.distanceTo(buzzyPos));
      if (targets[0]) this.ctx.buzzy.pointAt(targets[0]);
    }
  }

  exit(): void {
    this.ready = false;
    this.ctx.buzzy.stopPointing();
    disposeObject(this.group);
    if (this.kit) for (const r of Object.values(this.kit)) r.dispose();
    this.kit = null;
    this.floaters = [];
  }
}
