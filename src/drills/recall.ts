import { mulberry32, range } from '../core/rng';
import { scoreRecall } from '../core/scoring';
import type { Drill, DrillContext, DrillResult } from './types';

interface Point {
  x: number;
  y: number;
}

const ROUNDS = [3, 4, 5];
const SHOW = 2.2;
const PLACE = 6;
const REVEAL = 1.4;
const SIZE = 560;

export class RecallDrill implements Drill {
  readonly id = 'recall';
  readonly title = 'MAP IQ';
  readonly brief = 'Enemy pings flash on the minimap. Memorise them, then click where they were.';
  readonly mood = 0x00aeef;
  private ctx!: DrillContext;
  private root!: HTMLDivElement;
  private canvas!: HTMLCanvasElement;
  private g!: CanvasRenderingContext2D;
  private round = 0;
  private phase: 'show' | 'place' | 'reveal' | 'over' = 'show';
  private timer = 0;
  private elapsed = 0;
  private pings: Point[] = [];
  private guesses: Point[] = [];
  private scores: number[] = [];
  private blocks: Array<{ x: number; y: number; w: number; h: number }> = [];

  start(ctx: DrillContext): void {
    this.ctx = ctx;
    ctx.arena.setMood(0x0b5a8a, 0.5);
    const mapRng = mulberry32(909);
    for (let i = 0; i < 9; i++) {
      this.blocks.push({ x: range(mapRng, 0.06, 0.78), y: range(mapRng, 0.06, 0.78), w: range(mapRng, 0.08, 0.2), h: range(mapRng, 0.08, 0.2) });
    }
    this.root = document.createElement('div');
    this.root.className = 'minimap';
    this.canvas = document.createElement('canvas');
    this.canvas.width = this.canvas.height = SIZE;
    this.root.append(this.canvas);
    ctx.hud.overlay.append(this.root);
    this.g = this.canvas.getContext('2d')!;
    this.canvas.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      this.place(e);
    });
    this.begin();
  }

  private begin(): void {
    const n = ROUNDS[this.round];
    this.pings = [];
    this.guesses = [];
    while (this.pings.length < n) {
      const p = { x: range(this.ctx.rng, 0.12, 0.88), y: range(this.ctx.rng, 0.12, 0.88) };
      if (this.pings.every((q) => Math.hypot(q.x - p.x, q.y - p.y) > 0.2)) this.pings.push(p);
    }
    this.phase = 'show';
    this.timer = SHOW;
    this.elapsed = 0;
    this.ctx.hud.prompt('MEMORISE', 'warn');
    this.ctx.hud.counter(`ROUND ${this.round + 1} / ${ROUNDS.length}`);
    this.pings.forEach((_, i) => window.setTimeout(() => this.ctx.sfx.ping(i), i * 110));
  }

  private place(e: PointerEvent): void {
    if (this.phase !== 'place') return;
    const r = this.canvas.getBoundingClientRect();
    this.guesses.push({ x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height });
    this.ctx.sfx.ping(this.guesses.length);
    if (this.guesses.length >= this.pings.length) this.reveal();
  }

  private reveal(): void {
    const score = scoreRecall(this.pings, this.guesses);
    this.scores.push(score);
    this.phase = 'reveal';
    this.timer = REVEAL;
    this.ctx.hud.prompt(score >= 80 ? 'PERFECT READ' : score >= 50 ? 'GOOD READ' : 'LOST THEM', score >= 50 ? 'go' : 'neutral');
    if (score >= 50) this.ctx.sfx.drillEnd();
    else this.ctx.sfx.miss();
    this.ctx.hud.flash(score >= 50 ? 'good' : 'bad');
  }

  update(dt: number): void {
    this.timer -= dt;
    this.elapsed += dt;
    if (this.phase === 'show' && this.timer <= 0) {
      this.phase = 'place';
      this.timer = PLACE;
      this.ctx.hud.prompt('CLICK WHERE THEY WERE', 'go');
      this.ctx.sfx.whoosh();
    } else if (this.phase === 'place' && this.timer <= 0) {
      this.reveal();
    } else if (this.phase === 'reveal' && this.timer <= 0) {
      this.round++;
      if (this.round >= ROUNDS.length) this.phase = 'over';
      else this.begin();
    }
    this.draw();
  }

  private draw(): void {
    const g = this.g;
    const S = SIZE;
    g.clearRect(0, 0, S, S);
    g.fillStyle = 'rgba(4,14,30,0.92)';
    g.fillRect(0, 0, S, S);
    g.strokeStyle = 'rgba(0,174,239,0.14)';
    g.lineWidth = 1;
    for (let i = 1; i < 8; i++) {
      g.beginPath();
      g.moveTo((i * S) / 8, 0);
      g.lineTo((i * S) / 8, S);
      g.moveTo(0, (i * S) / 8);
      g.lineTo(S, (i * S) / 8);
      g.stroke();
    }
    for (const b of this.blocks) {
      g.fillStyle = 'rgba(0,174,239,0.10)';
      g.strokeStyle = 'rgba(125,249,255,0.45)';
      g.lineWidth = 2;
      g.beginPath();
      g.roundRect(b.x * S, b.y * S, b.w * S, b.h * S, 6);
      g.fill();
      g.stroke();
    }
    const sweep = (this.elapsed * 0.9) % 1;
    const grad = g.createLinearGradient(0, sweep * S - 60, 0, sweep * S);
    grad.addColorStop(0, 'rgba(0,174,239,0)');
    grad.addColorStop(1, 'rgba(0,174,239,0.22)');
    g.fillStyle = grad;
    g.fillRect(0, sweep * S - 60, S, 60);

    const dot = (p: Point, color: string, r: number, ring: number) => {
      g.shadowColor = color;
      g.shadowBlur = 24;
      g.fillStyle = color;
      g.beginPath();
      g.arc(p.x * S, p.y * S, r, 0, Math.PI * 2);
      g.fill();
      g.shadowBlur = 0;
      g.strokeStyle = color;
      g.globalAlpha = Math.max(0, 1 - ring);
      g.lineWidth = 3;
      g.beginPath();
      g.arc(p.x * S, p.y * S, r + ring * 34, 0, Math.PI * 2);
      g.stroke();
      g.globalAlpha = 1;
    };
    const ring = (this.elapsed * 1.6) % 1;
    if (this.phase === 'show' || this.phase === 'reveal') this.pings.forEach((p) => dot(p, '#ff3d6e', 11, ring));
    if (this.phase === 'place' || this.phase === 'reveal') this.guesses.forEach((p) => dot(p, '#7df9ff', 8, 1));
    if (this.phase === 'reveal') {
      const free = [...this.guesses];
      g.setLineDash([6, 6]);
      g.strokeStyle = 'rgba(255,255,255,0.6)';
      g.lineWidth = 2;
      for (const p of this.pings) {
        if (!free.length) break;
        free.sort((a, b) => Math.hypot(a.x - p.x, a.y - p.y) - Math.hypot(b.x - p.x, b.y - p.y));
        const q = free.shift()!;
        g.beginPath();
        g.moveTo(p.x * S, p.y * S);
        g.lineTo(q.x * S, q.y * S);
        g.stroke();
      }
      g.setLineDash([]);
    }
    if (this.phase === 'place') {
      g.fillStyle = '#7df9ff';
      g.fillRect(0, S - 6, S * Math.max(0, this.timer / PLACE), 6);
    }
  }

  private autoIn = 0.5;
  auto(dt: number): void {
    if (this.phase !== 'place') {
      this.autoIn = 0.5;
      return;
    }
    this.autoIn -= dt;
    if (this.autoIn > 0) return;
    this.autoIn = 0.45;
    const p = this.pings[this.guesses.length];
    const j = () => (this.ctx.rng() - 0.5) * 0.09;
    this.guesses.push({ x: p.x + j(), y: p.y + j() });
    this.ctx.sfx.ping(this.guesses.length);
    if (this.guesses.length >= this.pings.length) this.reveal();
  }

  click(): void {}

  progress(): number {
    const per = 1 / ROUNDS.length;
    const within = this.phase === 'show' ? 0.2 : this.phase === 'place' ? 0.6 : 1;
    return Math.min(1, this.round * per + (this.phase === 'over' ? 0 : within * per));
  }

  done(): boolean {
    return this.phase === 'over';
  }

  result(): DrillResult {
    const avg = this.scores.length ? Math.round(this.scores.reduce((a, b) => a + b, 0) / this.scores.length) : 0;
    return { score: avg, headline: `${avg}%`, detail: 'ping placement accuracy' };
  }

  dispose(): void {
    this.root?.remove();
  }
}
