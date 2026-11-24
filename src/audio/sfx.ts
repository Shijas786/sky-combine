/** All sound is synthesised at runtime with WebAudio: no samples, no licences. */
export class Sfx {
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private musicGain!: GainNode;
  private musicTimer: number | null = null;
  private step = 0;
  private nextTime = 0;
  private intensity = 0;
  muted = false;

  unlock(): void {
    if (this.ctx) {
      void this.ctx.resume();
      return;
    }
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;
    this.ctx = new Ctor();
    const comp = this.ctx.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.ratio.value = 6;
    this.master = this.ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 0.8;
    this.master.connect(comp).connect(this.ctx.destination);
    this.musicGain = this.ctx.createGain();
    this.musicGain.gain.value = 0.0;
    this.musicGain.connect(this.master);
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    if (this.ctx) this.master.gain.setTargetAtTime(muted ? 0 : 0.8, this.ctx.currentTime, 0.03);
  }

  private tone(freq: number, dur: number, opts: { type?: OscillatorType; gain?: number; to?: number; delay?: number; dest?: AudioNode } = {}): void {
    if (!this.ctx) return;
    const t = this.ctx.currentTime + (opts.delay ?? 0);
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = opts.type ?? 'sine';
    osc.frequency.setValueAtTime(freq, t);
    if (opts.to) osc.frequency.exponentialRampToValueAtTime(opts.to, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(opts.gain ?? 0.2, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g).connect(opts.dest ?? this.master);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  private noise(dur: number, opts: { gain?: number; freq?: number; q?: number; delay?: number; type?: BiquadFilterType; dest?: AudioNode } = {}): void {
    if (!this.ctx) return;
    const t = this.ctx.currentTime + (opts.delay ?? 0);
    const len = Math.max(1, Math.floor(this.ctx.sampleRate * dur));
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const filter = this.ctx.createBiquadFilter();
    filter.type = opts.type ?? 'bandpass';
    filter.frequency.value = opts.freq ?? 2000;
    filter.Q.value = opts.q ?? 1;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(opts.gain ?? 0.2, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(filter).connect(g).connect(opts.dest ?? this.master);
    src.start(t);
  }

  hover(): void {
    this.tone(1400, 0.04, { type: 'sine', gain: 0.04 });
  }
  click(): void {
    this.tone(660, 0.07, { type: 'triangle', gain: 0.14, to: 990 });
  }
  key(): void {
    this.tone(520 + Math.random() * 120, 0.05, { type: 'square', gain: 0.05 });
  }
  shot(): void {
    this.noise(0.09, { gain: 0.22, freq: 1800, q: 0.7 });
    this.tone(220, 0.09, { type: 'sawtooth', gain: 0.1, to: 70 });
  }
  /** Pitch climbs with the streak so a hot run sounds like one. */
  hit(streak = 0): void {
    const base = 660 * Math.pow(2, Math.min(streak, 12) / 12);
    this.tone(base, 0.12, { type: 'triangle', gain: 0.22 });
    this.tone(base * 1.5, 0.16, { type: 'sine', gain: 0.12, delay: 0.03 });
    this.noise(0.12, { gain: 0.12, freq: 5200, q: 2 });
  }
  miss(): void {
    this.tone(180, 0.14, { type: 'square', gain: 0.07, to: 110 });
  }
  bad(): void {
    this.tone(160, 0.3, { type: 'sawtooth', gain: 0.2, to: 60 });
    this.tone(169, 0.3, { type: 'sawtooth', gain: 0.16, to: 64 });
  }
  tick(): void {
    this.tone(880, 0.06, { type: 'square', gain: 0.07 });
  }
  count(final: boolean): void {
    if (final) {
      this.tone(880, 0.5, { type: 'triangle', gain: 0.25 });
      this.tone(1320, 0.5, { type: 'sine', gain: 0.14 });
      this.noise(0.4, { gain: 0.12, freq: 6000, q: 0.5, type: 'highpass' });
    } else this.tone(440, 0.16, { type: 'triangle', gain: 0.2 });
  }
  go(): void {
    this.tone(523, 0.1, { type: 'square', gain: 0.1 });
    this.tone(1046, 0.35, { type: 'triangle', gain: 0.24, delay: 0.02 });
  }
  whoosh(): void {
    this.noise(0.5, { gain: 0.14, freq: 900, q: 0.6 });
    this.tone(120, 0.5, { type: 'sine', gain: 0.12, to: 480 });
  }
  ping(i = 0): void {
    this.tone(880 + i * 110, 0.3, { type: 'sine', gain: 0.18 });
    this.tone(1760 + i * 220, 0.2, { type: 'sine', gain: 0.06, delay: 0.02 });
  }
  drillEnd(): void {
    [523, 659, 784].forEach((f, i) => this.tone(f, 0.22, { type: 'triangle', gain: 0.18, delay: i * 0.07 }));
  }
  statTick(v: number): void {
    this.tone(300 + v * 9, 0.03, { type: 'square', gain: 0.035 });
  }
  fanfare(big: boolean): void {
    const notes = big ? [523, 659, 784, 1046, 1318, 1568] : [392, 523, 659, 784];
    notes.forEach((f, i) => {
      this.tone(f, 0.5, { type: 'triangle', gain: 0.2, delay: i * 0.09 });
      this.tone(f / 2, 0.5, { type: 'sawtooth', gain: 0.05, delay: i * 0.09 });
    });
    this.noise(1.2, { gain: 0.1, freq: 7000, q: 0.4, type: 'highpass', delay: notes.length * 0.09 });
  }

  /** 0 = ambient pad (attract), 1 = full drill groove. */
  setMusic(intensity: number): void {
    this.intensity = intensity;
    if (!this.ctx) return;
    this.musicGain.gain.setTargetAtTime(0.5, this.ctx.currentTime, 0.4);
    if (this.musicTimer === null) {
      this.nextTime = this.ctx.currentTime + 0.05;
      this.musicTimer = window.setInterval(() => this.schedule(), 50);
    }
  }

  private schedule(): void {
    if (!this.ctx) return;
    const stepDur = 60 / 124 / 4;
    while (this.nextTime < this.ctx.currentTime + 0.15) {
      this.playStep(this.step, this.nextTime - this.ctx.currentTime, stepDur);
      this.nextTime += stepDur;
      this.step = (this.step + 1) % 64;
    }
  }

  private playStep(step: number, delay: number, stepDur: number): void {
    const dest = this.musicGain;
    const roots = [110, 87.31, 130.81, 98];
    const root = roots[(step >> 4) % 4];
    const s = step % 16;
    if (s === 0) {
      [1, 1.5, 2, 2.4].forEach((m) => this.tone(root * 2 * m, stepDur * 16, { type: 'sine', gain: 0.035, delay, dest }));
    }
    if (this.intensity < 0.5) {
      if (s % 8 === 4) this.tone(root * 4 * [1, 1.2, 1.5, 2][(step >> 3) % 4], 0.5, { type: 'sine', gain: 0.03, delay, dest });
      return;
    }
    if (s % 4 === 0) this.tone(150, 0.16, { type: 'sine', gain: 0.32, to: 42, delay, dest });
    if (s % 8 === 4) this.noise(0.12, { gain: 0.1, freq: 1900, q: 0.8, delay, dest });
    if (s % 2 === 1) this.noise(0.03, { gain: 0.035, freq: 9000, q: 1, type: 'highpass', delay, dest });
    const bass = [1, 0, 1, 0, 0, 1, 0, 1.5, 1, 0, 0, 1, 0, 2, 0, 1.5][s];
    if (bass) this.tone(root * bass, stepDur * 0.9, { type: 'sawtooth', gain: 0.07, delay, dest });
    const arp = [2, 3, 4, 3, 2.4, 3, 4, 6][s % 8];
    if (s % 2 === 0) this.tone(root * 2 * arp, 0.1, { type: 'square', gain: 0.018, delay, dest });
  }
}
