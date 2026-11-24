import './styles.css';
import * as THREE from 'three';
import { Arena, GOLD, SKY } from './scene/arena';
import { Sfx } from './audio/sfx';
import { mulberry32, pick, type Rng } from './core/rng';
import { DRILL_IDS, DRILL_LABELS, archetypeFor, overallRating, tierFor, type Stats } from './core/scoring';
import { Leaderboard, decodeCard, sanitizeName } from './core/store';
import type { Drill, DrillContext, Hud, Pointer } from './drills/types';
import { ReactionDrill } from './drills/reaction';
import { FlickDrill } from './drills/flick';
import { TrackingDrill } from './drills/tracking';
import { DisciplineDrill } from './drills/discipline';
import { RecallDrill } from './drills/recall';
import { drawCard, downloadCard } from './ui/card';
import { NIMBUS_SVG, nimbusLine, nimbusLineForScore } from './ui/nimbus';

type State = 'attract' | 'callsign' | 'intro' | 'drill' | 'result' | 'card';

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const params = new URLSearchParams(location.search);
const IDLE_RESET = 40;
const DEMO_AFTER = Number(params.get('demoAfter') ?? 25);
const CARD_HOLD = 45;
const CALLSIGNS = ['ACE', 'VIPER9', 'NOVA', 'STRATUS', 'CIRRUS', 'JETSTREAM', 'ZENITH', 'ALTITUDE', 'CONTRAIL', 'TAILWIND', 'SKYLINE', 'MACH2'];

const arena = new Arena($<HTMLCanvasElement>('arena'));
const sfx = new Sfx();
const board = new Leaderboard(localStorage);
const pointer: Pointer = { x: 0, y: 0, px: innerWidth / 2, py: innerHeight / 2 };
const makeDrills = (): Drill[] => [new ReactionDrill(), new FlickDrill(), new TrackingDrill(), new DisciplineDrill(), new RecallDrill()];

let state: State = 'attract';
let stateTime = 0;
let idle = 0;
let rng: Rng = mulberry32(Number(params.get('seed')) || Date.now());
let name = '';
let drills: Drill[] = [];
let index = 0;
let drill: Drill | null = null;
let stats = {} as Stats;
let botRun = false;
let demoRun = false;
let botCooldown = 0;
let countShown = -1;
let cardAnim = 0;
let cardData: { name: string; rating: number; stats: Stats } | null = null;
let sharedView = false;
let attractBurst = 0;

/* ---------- mascot ---------- */
const nimbus = document.createElement('div');
nimbus.className = 'nimbus';
nimbus.innerHTML = NIMBUS_SVG;
document.body.append(nimbus);
function say(text: string | null): void {
  nimbus.querySelector('.bubble')?.remove();
  nimbus.classList.toggle('off', text === null);
  if (!text) return;
  const b = document.createElement('div');
  b.className = 'bubble';
  b.textContent = text;
  nimbus.append(b);
}

/* ---------- hud ---------- */
const floats = $('floats');
const flashEl = $('flash');
const promptEl = $('prompt');
const hud: Hud = {
  overlay: $('overlay'),
  prompt(text, tone = 'neutral') {
    if (promptEl.textContent === text && promptEl.classList.contains(tone)) return;
    promptEl.className = 'prompt';
    void promptEl.offsetWidth;
    promptEl.classList.add(tone);
    promptEl.textContent = text;
  },
  counter(text) {
    const el = $('hudCounter');
    if (el.textContent !== text) el.textContent = text;
  },
  float(text, px, py, tone = 'good') {
    const el = document.createElement('div');
    el.className = `float ${tone}`;
    el.textContent = text;
    el.style.left = `${px}px`;
    el.style.top = `${py}px`;
    floats.append(el);
    window.setTimeout(() => el.remove(), 820);
  },
  flash(tone) {
    flashEl.className = '';
    void flashEl.offsetWidth;
    flashEl.className = tone;
  },
};

function show(next: State): void {
  state = next;
  stateTime = 0;
  for (const id of ['attract', 'callsign', 'intro', 'result', 'card']) $(id).classList.toggle('hidden', id !== next);
  $('hud').classList.toggle('hidden', next !== 'drill');
  document.body.classList.toggle('playing', next === 'drill' || next === 'intro');
  $('demoTag').classList.toggle('hidden', !demoRun || next === 'attract');
  if (demoRun && next !== 'attract') document.body.append($('demoTag'));
}

/* ---------- attract ---------- */
function buildLogo(): void {
  const logo = $('logo');
  let i = 0;
  logo.innerHTML = '';
  for (const word of ['SKY', 'COMBINE']) {
    const w = document.createElement('div');
    w.className = 'word';
    for (const ch of word) {
      const s = document.createElement('span');
      s.textContent = ch;
      s.style.setProperty('--i', String(i++));
      w.append(s);
    }
    logo.append(w);
  }
}

function toAttract(): void {
  if (state === 'drill') drill?.dispose();
  drill = null;
  arena.clearTargets();
  hud.overlay.innerHTML = '';
  botRun = demoRun = sharedView = false;
  idle = 0;
  buildLogo();
  const top = board.all().slice(0, 3);
  $('top3').innerHTML = top.map((e, i) => `<div><b>#${i + 1}</b>${e.name}<em>${e.rating}</em></div>`).join('');
  arena.setMood(SKY, 1);
  sfx.setMusic(0);
  board.post({ type: 'idle' });
  show('attract');
  say(nimbusLine('attract', Math.random()));
  if (location.hash.startsWith('#c=')) history.replaceState(null, '', location.pathname + location.search);
}

/* ---------- callsign ---------- */
function renderName(): void {
  $('nameText').textContent = name;
}
function typeKey(ch: string): void {
  if (name.length >= 10) return;
  name += ch;
  sfx.key();
  renderName();
}
function buildKeys(): void {
  const keys = $('keys');
  for (const ch of 'QWERTYUIOPASDFGHJKL0ZXCVBNM123456789') {
    const b = document.createElement('button');
    b.textContent = ch;
    b.addEventListener('click', () => typeKey(ch));
    b.addEventListener('pointerenter', () => sfx.hover());
    keys.append(b);
  }
}
function toCallsign(): void {
  name = '';
  renderName();
  sfx.click();
  sfx.whoosh();
  show('callsign');
  say('Pick a callsign. It goes on your scouting report.');
}

/* ---------- run ---------- */
function startRun(opts: { bot?: boolean; demo?: boolean } = {}): void {
  botRun = !!opts.bot || !!opts.demo || params.get('bot') === '1';
  demoRun = !!opts.demo;
  name = demoRun ? 'NIMBUS' : sanitizeName(name || pick(rng, CALLSIGNS));
  drills = makeDrills();
  index = 0;
  stats = {} as Stats;
  $('hudName').textContent = name;
  sfx.setMusic(1);
  introDrill();
}

function introDrill(): void {
  drill = drills[index];
  $('introStep').textContent = `DRILL ${index + 1} / ${drills.length}`;
  $('introTitle').textContent = drill.title;
  $('introBrief').textContent = drill.brief;
  $('count').textContent = '';
  countShown = -1;
  arena.setMood(drill.mood, 1.6);
  arena.pulse(2);
  sfx.whoosh();
  board.post({ type: 'live', name, drill: drill.title, step: index + 1, total: drills.length });
  show('intro');
  say(null);
}

function beginDrill(): void {
  if (!drill) return;
  $('hudStep').textContent = `DRILL ${index + 1} / ${drills.length}`;
  $('hudTitle').textContent = drill.title;
  $('hudDots').innerHTML = drills.map((_, i) => `<i class="${i < index ? 'done' : i === index ? 'now' : ''}"></i>`).join('');
  hud.counter('');
  hud.prompt('', 'neutral');
  show('drill');
  const ctx: DrillContext = { arena, sfx, rng, hud, pointer };
  drill.start(ctx);
  sfx.count(true);
}

function endDrill(): void {
  if (!drill) return;
  const res = drill.result();
  stats[drill.id] = res.score;
  drill.dispose();
  hud.overlay.innerHTML = '';
  $('resultTitle').textContent = `${drill.title} COMPLETE`;
  $('resultHeadline').textContent = res.headline;
  $('resultDetail').textContent = res.detail;
  $('resultScore').textContent = '0';
  $('resultBar').style.width = '0%';
  $('result').dataset.score = String(res.score);
  sfx.drillEnd();
  arena.setMood(SKY, 1);
  const b = arena.bounds();
  for (let i = 0; i < 5; i++) arena.burst(new THREE.Vector3((Math.random() - 0.5) * b.x * 1.4, b.cy + (Math.random() - 0.5) * b.y, 0), res.score >= 70 ? GOLD : SKY, 40, 10);
  show('result');
  say(nimbusLineForScore(res.score, Math.random()));
}

function toCard(data: { name: string; rating: number; stats: Stats }, rank: number | null): void {
  cardData = data;
  cardAnim = 0;
  const tier = tierFor(data.rating);
  const arch = archetypeFor(data.stats);
  const total = board.all().length;
  $('cardEyebrow').textContent = sharedView ? 'SHARED SCOUTING REPORT' : botRun ? 'DEMO RUN · NOT RANKED' : 'SCOUTING REPORT FILED';
  $('rank').innerHTML = rank ? `#${rank}<small>OF ${total} PLAYER${total === 1 ? '' : 'S'} TODAY</small>` : `${data.rating}<small>${tier.name}</small>`;
  $('rank').style.color = tier.color;
  $('verdict').textContent = `${tier.name} · ${arch.name}. ${arch.blurb}`;
  $('statRows').innerHTML = DRILL_IDS.map(
    (id) => `<div class="stat-row"><span>${DRILL_LABELS[id].toUpperCase()}</span><div class="track"><div class="fill" data-v="${data.stats[id]}"></div></div><b>${data.stats[id]}</b></div>`,
  ).join('');
  $('nextLabel').textContent = sharedView ? 'PLAY IT YOURSELF' : 'NEXT PLAYER';
  $('cardTilt').style.transform = '';
  drawCard($<HTMLCanvasElement>('cardCanvas'), data.name, data.rating, data.stats, 0);
  show('card');
  window.setTimeout(() => document.querySelectorAll<HTMLElement>('.stat-row .fill').forEach((f) => (f.style.width = `${f.dataset.v}%`)), 900);
  sfx.setMusic(0);
  sfx.fanfare(data.rating >= 74);
  arena.setMood(new THREE.Color(tier.color).getHex(), 2);
  say(nimbusLineForScore(data.rating - 15, Math.random()));
  board.post({ type: 'idle' });
}

function finishRun(): void {
  const rating = overallRating(stats);
  let rank: number | null = null;
  if (!botRun) {
    const arch = archetypeFor(stats);
    rank = board.add({ id: `${Date.now()}-${Math.floor(Math.random() * 1e6)}`, name, rating, stats: { ...stats }, archetype: arch.name, ts: Date.now() });
  }
  toCard({ name, rating, stats: { ...stats } }, rank);
}

/* ---------- self-play ---------- */
function setPointer(px: number, py: number): void {
  pointer.px = px;
  pointer.py = py;
  pointer.x = (px / innerWidth) * 2 - 1;
  pointer.y = -(py / innerHeight) * 2 + 1;
}

function runBot(dt: number): void {
  if (!drill) return;
  botCooldown -= dt;
  if (drill.auto) {
    drill.auto(dt);
    return;
  }
  const target = arena.targets.find((t) => t.kind !== 'friendly');
  if (!target) return;
  const p = arena.project(target.group.position);
  const drone = target.kind === 'drone';
  const k = 1 - Math.exp(-dt * (drone ? 9 : 13));
  const wob = drone ? 26 : 0;
  setPointer(
    pointer.px + (p.x + Math.sin(stateTime * 3.1) * wob - pointer.px) * k,
    pointer.py + (p.y + Math.cos(stateTime * 2.3) * wob - pointer.py) * k,
  );
  if (!drone && botCooldown <= 0 && target.age > 0.16 && Math.hypot(p.x - pointer.px, p.y - pointer.py) < 14) {
    botCooldown = 0.16 + rng() * 0.12;
    fire();
  }
}

function fire(): void {
  if (state !== 'drill' || !drill) return;
  const ch = $('crosshair');
  ch.classList.remove('kick');
  void ch.offsetWidth;
  ch.classList.add('kick');
  drill.click();
}

/* ---------- loop ---------- */
let last = performance.now();
function frame(now: number): void {
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  stateTime += dt;
  idle += dt;

  if (state === 'attract') {
    attractBurst -= dt;
    if (attractBurst <= 0) {
      attractBurst = 0.9 + Math.random() * 1.4;
      const b = arena.bounds();
      arena.burst(new THREE.Vector3((Math.random() - 0.5) * b.x * 1.6, b.cy + (Math.random() - 0.5) * b.y * 1.4, -4), Math.random() < 0.3 ? GOLD : SKY, 36, 8);
      arena.pulse(0.5);
    }
    if (stateTime > DEMO_AFTER && DEMO_AFTER > 0) startRun({ demo: true });
  } else if (state === 'intro') {
    const n = stateTime < 1.9 ? -1 : 3 - Math.floor((stateTime - 1.9) / 0.7);
    if (n !== countShown && n >= 1) {
      countShown = n;
      const c = $('count');
      c.textContent = String(n);
      c.classList.remove('tick');
      void c.offsetWidth;
      c.classList.add('tick');
      sfx.count(false);
    }
    if (n < 1 && stateTime >= 1.9) beginDrill();
  } else if (state === 'drill' && drill) {
    if (botRun) runBot(dt);
    drill.update(dt);
    const left = 1 - drill.progress();
    const fill = $('timerFill');
    fill.style.transform = `scaleX(${left})`;
    fill.classList.toggle('low', left < 0.25);
    if (drill.done()) endDrill();
  } else if (state === 'result') {
    const score = Number($('result').dataset.score);
    const t = Math.min(1, stateTime / 1.1);
    const v = Math.round(score * (1 - Math.pow(1 - t, 3)));
    if ($('resultScore').textContent !== String(v)) {
      $('resultScore').textContent = String(v);
      sfx.statTick(v);
    }
    $('resultBar').style.width = `${v}%`;
    if (stateTime > 2.8) {
      index++;
      if (index < drills.length) introDrill();
      else finishRun();
    }
  } else if (state === 'card' && cardData) {
    if (cardAnim < 1 && stateTime > 0.8) {
      cardAnim = Math.min(1, cardAnim + dt / 1.3);
      drawCard($<HTMLCanvasElement>('cardCanvas'), cardData.name, cardData.rating, cardData.stats, 1 - Math.pow(1 - cardAnim, 3));
      if (Math.random() < 0.5) {
        const b = arena.bounds();
        arena.burst(new THREE.Vector3((Math.random() - 0.5) * b.x * 1.8, b.cy + Math.random() * b.y, -2), Math.random() < 0.5 ? GOLD : SKY, 30, 11);
      }
    }
    if (!sharedView) {
      const hold = demoRun ? 9 : CARD_HOLD;
      const left = Math.max(0, Math.ceil(hold - stateTime));
      $('resetNote').textContent = `BOOTH RESETS IN ${left}s`;
      if (left <= 0) toAttract();
    } else $('resetNote').textContent = '';
  }

  if (!demoRun && !sharedView && state !== 'attract' && state !== 'card' && !botRun && idle > IDLE_RESET) toAttract();

  $('crosshair').style.transform = `translate(${pointer.px}px, ${pointer.py}px)`;
  arena.update(dt);
  requestAnimationFrame(frame);
}

/* ---------- input ---------- */
window.addEventListener('pointermove', (e) => {
  idle = 0;
  if (botRun && state === 'drill') return;
  setPointer(e.clientX, e.clientY);
  if (state === 'card') {
    const el = $('cardTilt');
    const r = el.getBoundingClientRect();
    const dx = (e.clientX - (r.left + r.width / 2)) / innerWidth;
    const dy = (e.clientY - (r.top + r.height / 2)) / innerHeight;
    el.style.transform = `rotateY(${dx * 26}deg) rotateX(${-dy * 20}deg)`;
    el.style.setProperty('--shine', `${50 + dx * 160}%`);
  }
});

window.addEventListener(
  'pointerdown',
  (e) => {
    if (!demoRun) return;
    e.stopPropagation();
    idle = 0;
    sfx.unlock();
    toAttract();
    toCallsign();
  },
  { capture: true },
);

window.addEventListener('pointerdown', (e) => {
  idle = 0;
  sfx.unlock();
  if (state === 'drill' && !botRun && e.button === 0) fire();
});

window.addEventListener('keydown', (e) => {
  idle = 0;
  if (e.key === 'Escape') return toAttract();
  if (state === 'callsign') {
    if (/^[a-z0-9]$/i.test(e.key)) typeKey(e.key.toUpperCase());
    else if (e.key === 'Backspace') {
      name = name.slice(0, -1);
      renderName();
    } else if (e.key === 'Enter') startRun();
    return;
  }
  if (e.key === 'm' || e.key === 'M') toggleMute();
  if (e.key === 'f' || e.key === 'F') toggleFullscreen();
});

function toggleMute(): void {
  sfx.setMuted(!sfx.muted);
  $('muteBtn').textContent = sfx.muted ? 'SOUND OFF' : 'SOUND ON';
}
function toggleFullscreen(): void {
  if (document.fullscreenElement) void document.exitFullscreen();
  else void document.documentElement.requestFullscreen().catch(() => undefined);
}

const stop = (fn: () => void) => (e: Event) => {
  e.stopPropagation();
  sfx.unlock();
  fn();
};
$('startBtn').addEventListener('pointerdown', stop(toCallsign));
$('attract').addEventListener('pointerdown', stop(() => state === 'attract' && toCallsign()));
$('randomBtn').addEventListener('click', () => {
  name = pick(rng, CALLSIGNS);
  sfx.click();
  renderName();
});
$('deleteBtn').addEventListener('click', () => {
  name = name.slice(0, -1);
  sfx.key();
  renderName();
});
$('goBtn').addEventListener('click', () => {
  sfx.click();
  startRun();
});
$('saveBtn').addEventListener('click', () => {
  sfx.click();
  if (!cardData) return;
  const canvas = $<HTMLCanvasElement>('cardCanvas');
  cardAnim = 1;
  drawCard(canvas, cardData.name, cardData.rating, cardData.stats, 1);
  downloadCard(canvas, cardData.name);
});
$('nextBtn').addEventListener('click', () => {
  sfx.click();
  toAttract();
});
$('muteBtn').addEventListener('click', toggleMute);
$('fsBtn').addEventListener('click', toggleFullscreen);
document.querySelectorAll('button').forEach((b) => b.addEventListener('pointerenter', () => sfx.hover()));

/* ---------- boot ---------- */
buildKeys();
void document.fonts.ready.then(() => {
  const shared = location.hash.startsWith('#c=') ? decodeCard(location.hash.slice(3)) : null;
  if (shared) {
    buildLogo();
    sharedView = true;
    toCard(shared, null);
  } else toAttract();
  requestAnimationFrame((t) => {
    last = t;
    frame(t);
  });
});

if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  void navigator.serviceWorker
    .register('./sw.js')
    .then(() => navigator.serviceWorker.ready)
    .then((reg) => {
      const urls = performance.getEntriesByType('resource').map((r) => r.name.split('#')[0]).filter((u) => u.startsWith(location.origin));
      reg.active?.postMessage({ type: 'precache', urls: [...new Set(urls)] });
    })
    .catch(() => undefined);
}
