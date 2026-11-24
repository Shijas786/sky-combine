export const DRILL_IDS = ['reaction', 'flick', 'tracking', 'discipline', 'recall'] as const;
export type DrillId = (typeof DRILL_IDS)[number];
export type Stats = Record<DrillId, number>;

export const DRILL_LABELS: Record<DrillId, string> = {
  reaction: 'Reaction',
  flick: 'Flick',
  tracking: 'Tracking',
  discipline: 'Discipline',
  recall: 'Map IQ',
};

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const toScore = (v: number) => Math.round(clamp01(v) * 100);

export function median(values: number[]): number {
  if (!values.length) return NaN;
  const s = [...values].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

/** 150 ms is elite, 450 ms scores zero. Each false start costs 8 points. */
export function scoreReaction(timesMs: number[], falseStarts: number): number {
  if (!timesMs.length) return 0;
  const base = clamp01((450 - median(timesMs)) / 300) * 100;
  return Math.round(Math.max(0, base - falseStarts * 8));
}

/** Hits weighted by accuracy; 26 clean hits in the window is a perfect run. */
export function scoreFlick(hits: number, shots: number): number {
  if (!shots) return 0;
  const accuracy = hits / shots;
  return toScore((hits * (0.5 + 0.5 * accuracy)) / 26);
}

/** Share of the window spent on target; 85% on target is a perfect run. */
export function scoreTracking(onTargetMs: number, totalMs: number): number {
  if (totalMs <= 0) return 0;
  return toScore(onTargetMs / totalMs / 0.85);
}

/** Hostiles hit count for you; friendlies hit and stray shots count against you. */
export function scoreDiscipline(hostileHits: number, hostiles: number, friendlyHits: number, strayShots: number): number {
  if (!hostiles) return 0;
  return toScore((hostileHits - friendlyHits * 2 - strayShots * 0.5) / hostiles);
}

/** Each ping scores by how close the nearest unclaimed guess landed (map units 0..1). */
export function scoreRecall(pings: Array<{ x: number; y: number }>, guesses: Array<{ x: number; y: number }>, tolerance = 0.2): number {
  if (!pings.length) return 0;
  const free = [...guesses];
  let total = 0;
  for (const p of pings) {
    let best = -1;
    let bestD = Infinity;
    free.forEach((g, i) => {
      const d = Math.hypot(g.x - p.x, g.y - p.y);
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    });
    if (best >= 0) {
      free.splice(best, 1);
      total += clamp01(1 - bestD / tolerance);
    }
  }
  return toScore(total / pings.length);
}

/** Overall rating 40..99: the mean, nudged up by the best skill so specialists are rewarded. */
export function overallRating(stats: Stats): number {
  const values = DRILL_IDS.map((id) => stats[id]);
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const blended = mean * 0.8 + Math.max(...values) * 0.2;
  return Math.round(40 + clamp01(blended / 100) * 59);
}

export interface Tier {
  name: string;
  min: number;
  color: string;
}

export const TIERS: Tier[] = [
  { name: 'FRANCHISE PLAYER', min: 92, color: '#ffd166' },
  { name: 'ALL-STAR', min: 84, color: '#7df9ff' },
  { name: 'PRO', min: 74, color: '#00aeef' },
  { name: 'ACADEMY', min: 62, color: '#9bb7ff' },
  { name: 'ROOKIE', min: 0, color: '#c8d3e6' },
];

export const tierFor = (rating: number): Tier => TIERS.find((t) => rating >= t.min) ?? TIERS[TIERS.length - 1];

export interface Archetype {
  name: string;
  blurb: string;
}

const ARCHETYPES: Record<DrillId, Archetype> = {
  reaction: { name: 'ENTRY', blurb: 'First through the door. You win the fight before it starts.' },
  flick: { name: 'SHARPSHOOTER', blurb: 'One shot, one target. Snap aim is your signature.' },
  tracking: { name: 'ANCHOR', blurb: 'Glued to the target. Nobody shakes your crosshair.' },
  discipline: { name: 'CLOSER', blurb: 'Ice in the veins. You only pull the trigger when it counts.' },
  recall: { name: 'SHOTCALLER', blurb: 'You see the whole map. The team plays off your reads.' },
};

const FLEX: Archetype = { name: 'FLEX', blurb: 'No weak spots. You fill whatever role the team needs.' };

export function archetypeFor(stats: Stats): Archetype {
  const values = DRILL_IDS.map((id) => stats[id]);
  const max = Math.max(...values);
  const min = Math.min(...values);
  if (max >= 60 && max - min <= 12) return FLEX;
  return ARCHETYPES[DRILL_IDS[values.indexOf(max)]];
}
