import * as THREE from 'three';
import { range } from '../core/rng';
import { median, scoreReaction } from '../core/scoring';
import { HOSTILE, SKY } from '../scene/arena';
import type { Drill, DrillContext, DrillResult } from './types';

const TRIALS = 5;

export class ReactionDrill implements Drill {
  readonly id = 'reaction';
  readonly title = 'REACTION';
  readonly brief = 'Wait for the sky to turn blue, then click. Do not jump early.';
  readonly mood = HOSTILE;
  private ctx!: DrillContext;
  private phase: 'wait' | 'go' | 'rest' = 'wait';
  private timer = 0;
  private goAt = 0;
  private times: number[] = [];
  private falseStarts = 0;

  start(ctx: DrillContext): void {
    this.ctx = ctx;
    this.arm();
  }

  private arm(): void {
    this.phase = 'wait';
    this.timer = range(this.ctx.rng, 1.1, 2.6);
    this.ctx.arena.setMood(0x7a1f3a, 0.3);
    this.ctx.hud.prompt('HOLD…', 'warn');
    this.ctx.hud.counter(`${this.times.length} / ${TRIALS}`);
  }

  update(dt: number): void {
    this.timer -= dt;
    if (this.phase === 'wait' && this.timer <= 0) {
      this.phase = 'go';
      this.goAt = performance.now();
      this.timer = 1.2;
      this.ctx.arena.setMood(SKY, 3);
      this.ctx.arena.pulse(2.5);
      this.ctx.hud.prompt('CLICK!', 'go');
      this.ctx.sfx.go();
    } else if (this.phase === 'go' && this.timer <= 0) {
      this.record(600, 'TOO SLOW');
    } else if (this.phase === 'rest' && this.timer <= 0 && !this.done()) {
      this.arm();
    }
  }

  private record(ms: number, label: string): void {
    this.times.push(ms);
    this.phase = 'rest';
    this.timer = 0.75;
    const { pointer, hud } = this.ctx;
    hud.float(label, pointer.px, pointer.py - 30, ms < 260 ? 'gold' : ms < 400 ? 'good' : 'bad');
    hud.prompt(label, 'neutral');
    hud.counter(`${this.times.length} / ${TRIALS}`);
  }

  click(): void {
    const { arena, sfx, hud, pointer } = this.ctx;
    if (this.phase === 'wait') {
      this.falseStarts++;
      sfx.bad();
      hud.flash('bad');
      hud.float('TOO EARLY', pointer.px, pointer.py - 30, 'bad');
      arena.shake(0.4);
      this.timer = range(this.ctx.rng, 1.1, 2.4);
    } else if (this.phase === 'go') {
      const ms = Math.round(performance.now() - this.goAt);
      sfx.hit(Math.max(0, Math.round((400 - ms) / 25)));
      arena.burst(arena.pointAt(pointer.x, pointer.y).add(new THREE.Vector3(0, 0, 1)), SKY, 60, 12);
      this.record(ms, `${ms} ms`);
    }
  }

  auto(): void {
    if (this.phase === 'go' && performance.now() - this.goAt > 170 + this.ctx.rng() * 90) this.click();
  }

  progress(): number {
    return this.times.length / TRIALS;
  }

  done(): boolean {
    return this.times.length >= TRIALS && this.timer <= 0;
  }

  result(): DrillResult {
    const med = Math.round(median(this.times));
    return {
      score: scoreReaction(this.times, this.falseStarts),
      headline: `${med} ms`,
      detail: this.falseStarts ? `median · ${this.falseStarts} false start${this.falseStarts > 1 ? 's' : ''}` : 'median reaction time',
    };
  }

  dispose(): void {
    this.ctx.arena.setMood(SKY, 1);
  }
}
