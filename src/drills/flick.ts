import * as THREE from 'three';
import { range } from '../core/rng';
import { scoreFlick } from '../core/scoring';
import { GOLD } from '../scene/arena';
import type { Drill, DrillContext, DrillResult } from './types';

const DURATION = 15;

export class FlickDrill implements Drill {
  readonly id = 'flick';
  readonly title = 'FLICK';
  readonly brief = 'Snap to each target and click it. Speed and accuracy both count.';
  readonly mood = GOLD;
  private ctx!: DrillContext;
  private t = 0;
  private hits = 0;
  private shots = 0;
  private streak = 0;
  private last = new THREE.Vector3(0, 2.2, 0);

  start(ctx: DrillContext): void {
    this.ctx = ctx;
    ctx.arena.setMood(0x2a7fd6, 1.4);
    ctx.hud.prompt('', 'neutral');
    this.next();
  }

  private next(): void {
    const { arena, rng } = this.ctx;
    const b = arena.bounds();
    const pos = new THREE.Vector3();
    for (let i = 0; i < 12; i++) {
      pos.set(range(rng, -b.x, b.x) * 0.78, b.cy + range(rng, -b.y, b.y) * 0.66, range(rng, -1.5, 1.5));
      if (pos.distanceTo(this.last) > 4.5) break;
    }
    this.last.copy(pos);
    arena.spawn('flick', pos, range(rng, 0.5, 0.72), GOLD);
  }

  update(dt: number): void {
    this.t += dt;
    this.ctx.hud.counter(`${this.hits} HITS`);
  }

  click(): void {
    if (this.done()) return;
    const { arena, sfx, hud, pointer } = this.ctx;
    this.shots++;
    sfx.shot();
    const hit = arena.pick(pointer.x, pointer.y);
    if (hit) {
      this.hits++;
      this.streak++;
      sfx.hit(this.streak);
      arena.pulse(0.6);
      hud.float(this.streak >= 3 ? `x${this.streak}` : '+1', pointer.px, pointer.py - 24, this.streak >= 5 ? 'gold' : 'good');
      arena.remove(hit, true);
      this.next();
    } else {
      this.streak = 0;
      sfx.miss();
      hud.float('MISS', pointer.px, pointer.py - 24, 'bad');
    }
  }

  progress(): number {
    return Math.min(1, this.t / DURATION);
  }

  done(): boolean {
    return this.t >= DURATION;
  }

  result(): DrillResult {
    const acc = this.shots ? Math.round((this.hits / this.shots) * 100) : 0;
    return { score: scoreFlick(this.hits, this.shots), headline: `${this.hits} hits`, detail: `${acc}% accuracy` };
  }

  dispose(): void {
    this.ctx.arena.clearTargets();
  }
}
