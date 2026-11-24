import type { Arena } from '../scene/arena';
import type { Sfx } from '../audio/sfx';
import type { Rng } from '../core/rng';
import type { DrillId } from '../core/scoring';

export interface Pointer {
  /** Normalised device coords, -1..1. */
  x: number;
  y: number;
  /** Pixels. */
  px: number;
  py: number;
}

export interface Hud {
  prompt(text: string, tone?: 'neutral' | 'go' | 'warn'): void;
  counter(text: string): void;
  float(text: string, px: number, py: number, tone?: 'good' | 'bad' | 'gold'): void;
  flash(tone: 'good' | 'bad'): void;
  overlay: HTMLElement;
}

export interface DrillContext {
  arena: Arena;
  sfx: Sfx;
  rng: Rng;
  hud: Hud;
  pointer: Pointer;
}

export interface DrillResult {
  score: number;
  headline: string;
  detail: string;
}

export interface Drill {
  readonly id: DrillId;
  readonly title: string;
  readonly brief: string;
  readonly mood: number;
  start(ctx: DrillContext): void;
  update(dt: number): void;
  click(): void;
  /** 0..1, drives the timer bar. */
  progress(): number;
  done(): boolean;
  result(): DrillResult;
  dispose(): void;
  /** Self-play step for the attract demo. */
  auto?(dt: number): void;
}
