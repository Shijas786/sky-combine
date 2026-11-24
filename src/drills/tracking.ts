import * as THREE from 'three';
import { range } from '../core/rng';
import { scoreTracking } from '../core/scoring';
import { SKY, type Target } from '../scene/arena';
import type { Drill, DrillContext, DrillResult } from './types';

const DURATION = 15;
const LOCKED = 0x7dffb0;

export class TrackingDrill implements Drill {
  readonly id = 'tracking';
  readonly title = 'TRACKING';
  readonly brief = 'Keep your crosshair on the drone. No clicking: just stay glued to it.';
  readonly mood = LOCKED;
  private ctx!: DrillContext;
  private t = 0;
  private on = 0;
  private target!: Target;
  private phase = [0, 0, 0];
  private freq = [0, 0, 0];
  private sparkle = 0;
  private wasOn = false;

  start(ctx: DrillContext): void {
    this.ctx = ctx;
    ctx.arena.setMood(0x1fa7a0, 1.2);
    ctx.hud.prompt('', 'neutral');
    this.phase = [range(ctx.rng, 0, 6.28), range(ctx.rng, 0, 6.28), range(ctx.rng, 0, 6.28)];
    this.freq = [range(ctx.rng, 0.9, 1.3), range(ctx.rng, 1.4, 1.9), range(ctx.rng, 2.3, 3.1)];
    this.target = ctx.arena.spawn('drone', this.position(0), 0.95, SKY);
  }

  private position(t: number): THREE.Vector3 {
    const b = this.ctx.arena.bounds();
    const ramp = 0.75 + (t / DURATION) * 0.6;
    const x = Math.sin(t * this.freq[0] * ramp + this.phase[0]) * 0.62 + Math.sin(t * this.freq[2] * ramp + this.phase[2]) * 0.16;
    const y = Math.sin(t * this.freq[1] * ramp + this.phase[1]) * 0.5 + Math.cos(t * this.freq[2] * 0.7 * ramp) * 0.12;
    return new THREE.Vector3(x * b.x * 0.92, b.cy + y * b.y * 0.9, 0);
  }

  update(dt: number): void {
    if (this.done()) return;
    this.t += dt;
    const { arena, pointer, hud, sfx } = this.ctx;
    this.target.group.position.copy(this.position(this.t));
    const locked = arena.pick(pointer.x, pointer.y, 1.25) === this.target;
    const color = locked ? LOCKED : SKY;
    (this.target.core.material as THREE.MeshStandardMaterial).color.setHex(color);
    (this.target.core.material as THREE.MeshStandardMaterial).emissive.setHex(color);
    (this.target.ring.material as THREE.MeshBasicMaterial).color.setHex(color);
    if (locked) {
      this.on += dt;
      this.sparkle -= dt;
      if (this.sparkle <= 0) {
        this.sparkle = 0.09;
        arena.burst(this.target.group.position, LOCKED, 4, 4);
        sfx.statTick(40 + (this.on / DURATION) * 60);
      }
      if (!this.wasOn) arena.pulse(0.5);
    } else if (this.wasOn) sfx.miss();
    this.wasOn = locked;
    hud.counter(`${Math.round((this.on / Math.max(this.t, 0.001)) * 100)}% LOCKED`);
  }

  click(): void {}

  progress(): number {
    return Math.min(1, this.t / DURATION);
  }

  done(): boolean {
    return this.t >= DURATION;
  }

  result(): DrillResult {
    return {
      score: scoreTracking(this.on, this.t),
      headline: `${Math.round((this.on / Math.max(this.t, 0.001)) * 100)}%`,
      detail: 'time locked on target',
    };
  }

  dispose(): void {
    this.ctx.arena.clearTargets();
  }
}
