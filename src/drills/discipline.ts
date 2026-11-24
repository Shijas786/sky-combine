import * as THREE from 'three';
import { range } from '../core/rng';
import { scoreDiscipline } from '../core/scoring';
import { HOSTILE, SKY, type Target } from '../scene/arena';
import type { Drill, DrillContext, DrillResult } from './types';

const DURATION = 15;
const LIFE = 1.05;

export class DisciplineDrill implements Drill {
  readonly id = 'discipline';
  readonly title = 'DISCIPLINE';
  readonly brief = 'Shoot the solid RED targets. Never shoot the hollow BLUE teammates.';
  readonly mood = HOSTILE;
  private ctx!: DrillContext;
  private t = 0;
  private spawnIn = 0.3;
  private hostiles = 0;
  private hostileHits = 0;
  private friendlyHits = 0;
  private stray = 0;
  private streak = 0;

  start(ctx: DrillContext): void {
    this.ctx = ctx;
    ctx.arena.setMood(0x6a3fd6, 1.3);
    ctx.hud.prompt('', 'neutral');
  }

  private spawn(): void {
    const { arena, rng } = this.ctx;
    const b = arena.bounds();
    const pos = new THREE.Vector3();
    for (let i = 0; i < 12; i++) {
      pos.set(range(rng, -b.x, b.x) * 0.74, b.cy + range(rng, -b.y, b.y) * 0.62, range(rng, -1, 1));
      if (arena.targets.every((t) => t.group.position.distanceTo(pos) > 2.6)) break;
    }
    const friendly = rng() < 0.34;
    const target = arena.spawn(friendly ? 'friendly' : 'hostile', pos, 0.72, friendly ? SKY : HOSTILE);
    if (friendly) {
      target.core.scale.setScalar(0.38);
      target.ring.scale.setScalar(1.05);
    } else this.hostiles++;
  }

  update(dt: number): void {
    if (this.done()) return;
    this.t += dt;
    const { arena, hud } = this.ctx;
    this.spawnIn -= dt;
    if (this.spawnIn <= 0 && this.t < DURATION - LIFE) {
      this.spawn();
      const pace = 0.78 - (this.t / DURATION) * 0.3;
      this.spawnIn = range(this.ctx.rng, pace * 0.8, pace * 1.15);
    }
    for (const t of [...arena.targets] as Target[]) {
      if (t.age > LIFE) {
        if (t.kind === 'hostile') this.streak = 0;
        arena.remove(t);
      }
    }
    hud.counter(`${this.hostileHits} / ${this.hostiles}`);
  }

  click(): void {
    if (this.done()) return;
    const { arena, sfx, hud, pointer } = this.ctx;
    sfx.shot();
    const hit = arena.pick(pointer.x, pointer.y);
    if (!hit) {
      this.stray++;
      this.streak = 0;
      sfx.miss();
      hud.float('MISS', pointer.px, pointer.py - 24, 'bad');
    } else if (hit.kind === 'friendly') {
      this.friendlyHits++;
      this.streak = 0;
      sfx.bad();
      hud.flash('bad');
      arena.shake(0.5);
      hud.float('TEAMMATE!', pointer.px, pointer.py - 24, 'bad');
      arena.remove(hit, true);
    } else {
      this.hostileHits++;
      this.streak++;
      sfx.hit(this.streak);
      arena.pulse(0.6);
      hud.float(this.streak >= 3 ? `x${this.streak}` : '+1', pointer.px, pointer.py - 24, this.streak >= 5 ? 'gold' : 'good');
      arena.remove(hit, true);
    }
  }

  progress(): number {
    return Math.min(1, this.t / DURATION);
  }

  done(): boolean {
    return this.t >= DURATION;
  }

  result(): DrillResult {
    return {
      score: scoreDiscipline(this.hostileHits, this.hostiles, this.friendlyHits, this.stray),
      headline: `${this.hostileHits} / ${this.hostiles}`,
      detail: this.friendlyHits ? `${this.friendlyHits} teammate${this.friendlyHits > 1 ? 's' : ''} hit` : 'zero friendly fire',
    };
  }

  dispose(): void {
    this.ctx.arena.clearTargets();
  }
}
