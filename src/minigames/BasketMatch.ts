import { Group, Mesh, MeshBasicMaterial, Plane, SphereGeometry, Vector3, type Object3D } from 'three';
import { modelInstance } from '../core/assets';
import { wordForModel } from '../core/content';
import { disposeObject } from '../core/dispose';
import { pick, rayFrom, type GamePointerEvent } from '../core/input';
import { theme } from '../core/theme';
import { ease, tweens } from '../core/tween';
import type { LetterDef } from '../core/types';
import { glyphBadge } from '../procedural/glyph';
import { blobShadow, glowDisc, picnicCloth } from '../procedural/props';
import { HINT_IDLE_SECONDS, HINT_MISSES, shuffle, type GameContext, type MiniGame } from './MiniGame';

const ROUNDS = 2;
const SLOTS = [new Vector3(-5.6, 0, 1.4), new Vector3(-2.3, 0, 1.4), new Vector3(1.0, 0, 1.4)];
const BASKET = new Vector3(5.4, 0, 0.6);
const DROP_RADIUS = 2.1;
const OBJECT_HEIGHT = 1.7;
const DRAG_PLANE = new Plane(new Vector3(0, 1, 0), -0.9);

type Item = { model: string; holder: Group; collider: Mesh; slot: Vector3; correct: boolean };

/** Template C: drag the object that starts with the letter into Buzzy's basket (brief §5.4). */
export class BasketMatch implements MiniGame {
  readonly id = 'basketMatch' as const;
  onComplete: () => void = () => undefined;
  private ctx!: GameContext;
  private letter!: LetterDef;
  private group = new Group();
  private items: Item[] = [];
  private dragging: Item | null = null;
  private busy = true;
  private round = 0;
  private misses = 0;
  private idle = 0;
  private glow = glowDisc(2.8);
  private hitGeo = new SphereGeometry(1.35, 10, 8);
  private hitMat = new MeshBasicMaterial();

  async enter(ctx: GameContext, letter: LetterDef): Promise<void> {
    this.ctx = ctx;
    this.letter = letter;
    ctx.stage.root.add(this.group);
    const cloth = picnicCloth(10.5, 4.4);
    cloth.position.set(-2.3, 0.05, 1.4);
    const basket = await modelInstance('basket', 2.1);
    basket.position.copy(BASKET);
    basket.add(blobShadow(2.6));
    const badge = glyphBadge(letter.glyph, theme.petals[2], 1.6);
    badge.position.copy(BASKET).add(new Vector3(0, 3.4, 0));
    this.glow.visible = false;
    this.group.add(cloth, basket, badge, this.glow);

    const pool = letter.matchDistractors.length >= 2 ? letter.matchDistractors : ctx.letters.filter((l) => l.id !== letter.id).map((l) => l.objectModel);
    const models = [letter.objectModel, ...shuffle(pool).slice(0, 2)];
    this.items = await Promise.all(
      models.map(async (model, i) => {
        const holder = await modelInstance(model, OBJECT_HEIGHT);
        const collider = new Mesh(this.hitGeo, this.hitMat);
        collider.position.y = 0.85;
        collider.visible = false;
        holder.add(collider, blobShadow(1.5));
        this.group.add(holder);
        const item: Item = { model, holder, collider, slot: SLOTS[i], correct: i === 0 };
        collider.userData.item = item;
        return item;
      }),
    );
    void ctx.buzzy.flyTo(ctx.stage.at(7.6, 0, 2.4), 0.9);
    await this.setupRound();
    await ctx.say('bm_instruction', { sound: letter.glyph, glyph: letter.glyph });
  }

  /** Positions are reshuffled every round. */
  private async setupRound(): Promise<void> {
    this.busy = true;
    const slots = shuffle(SLOTS);
    this.items.forEach((it, i) => {
      it.slot = slots[i];
      it.holder.position.copy(it.slot);
      it.holder.scale.setScalar(0);
      it.holder.visible = true;
    });
    await Promise.all(this.items.map((it, i) => tweens.wait(i * 0.12).then(() => tweens.to(0.45, (k) => it.holder.scale.setScalar(k), ease.outBack))));
    this.misses = 0;
    this.idle = 0;
    this.busy = false;
  }

  onPointer(e: GamePointerEvent): void {
    if (this.busy) return;
    if (e.kind === 'down') {
      const hit = pick(this.ctx.camera, e.ndc, this.items.map((it) => it.collider));
      if (!hit) return;
      this.dragging = hit.object.userData.item as Item;
      this.idle = 0;
      this.ctx.audio.play('buzz');
      void tweens.to(0.15, (k) => this.dragging?.holder.scale.setScalar(1 + k * 0.15), ease.outCubic);
    } else if (e.kind === 'move' && this.dragging) {
      const p = rayFrom(this.ctx.camera, e.ndc).ray.intersectPlane(DRAG_PLANE, new Vector3());
      if (p) this.dragging.holder.position.copy(this.group.worldToLocal(p)).setY(0.6);
    } else if (e.kind === 'up' && this.dragging) {
      const item = this.dragging;
      this.dragging = null;
      item.holder.scale.setScalar(1);
      const pos = item.holder.position;
      const inBasket = Math.hypot(pos.x - BASKET.x, pos.z - BASKET.z) < DROP_RADIUS;
      if (inBasket && item.correct) void this.correct(item);
      else if (inBasket) void this.wrong(item);
      else void this.hop(item.holder, item.slot, 0.35, 0.4);
    }
  }

  private hop(obj: Object3D, to: Vector3, dur: number, height: number, endScale = 1): Promise<void> {
    const from = obj.position.clone();
    const s0 = obj.scale.x;
    return tweens.to(dur, (k) => {
      obj.position.lerpVectors(from, to, k);
      obj.position.y += Math.sin(k * Math.PI) * height;
      obj.scale.setScalar(s0 + (endScale - s0) * k);
    }, ease.inOutSine);
  }

  private async correct(item: Item): Promise<void> {
    this.busy = true;
    this.glow.visible = false;
    this.ctx.buzzy.stopPointing();
    await this.hop(item.holder, BASKET.clone().setY(0.9), 0.5, 1.4, 0.55);
    this.ctx.audio.play('chime');
    this.ctx.particles.burst(this.ctx.stage.at(BASKET.x, 1.6, BASKET.z), 40);
    await this.ctx.voice.sayText(this.letter.word);
    await this.ctx.say(this.letter.vo.isFor);
    this.round++;
    if (this.round < ROUNDS) {
      await Promise.all(this.items.map((it) => tweens.to(0.3, (k) => it.holder.scale.setScalar((it === item ? 0.55 : 1) * (1 - k)), ease.inOutCubic)));
      await this.setupRound();
      void this.ctx.say('bm_instruction', { sound: this.letter.glyph, glyph: this.letter.glyph });
      return;
    }
    await this.ctx.buzzy.celebrate();
    await this.ctx.praise();
    this.onComplete();
  }

  private async wrong(item: Item): Promise<void> {
    this.busy = true;
    this.ctx.audio.play('boop');
    await this.hop(item.holder, item.slot, 0.45, 1.2);
    this.busy = false;
    this.misses++;
    if (this.misses >= HINT_MISSES) this.showHint();
    await this.ctx.say('thats_a', { word: wordForModel(this.ctx.voice.lang, item.model) });
  }

  private showHint(): void {
    const target = this.items.find((it) => it.correct);
    if (!target || this.glow.visible) return;
    this.glow.position.set(target.slot.x, 0.07, target.slot.z);
    this.glow.visible = true;
    this.ctx.buzzy.pointAt(this.ctx.stage.at(target.slot.x, 0.8, target.slot.z));
  }

  update(dt: number, time: number): void {
    if (this.glow.visible) this.glow.scale.setScalar(2.8 * (1 + Math.sin(time * 5) * 0.15));
    const target = this.items.find((it) => it.correct);
    if (target && this.glow.visible && this.dragging !== target && !this.busy) target.holder.scale.setScalar(1 + Math.sin(time * 6) * 0.06);
    if (this.busy || this.dragging) return;
    this.idle += dt;
    if (this.idle > HINT_IDLE_SECONDS) this.showHint();
  }

  exit(): void {
    this.ctx.buzzy.stopPointing();
    disposeObject(this.group);
    this.hitGeo.dispose();
    this.hitMat.dispose();
    this.items = [];
  }
}
