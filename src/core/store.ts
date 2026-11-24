import { DRILL_IDS, type Stats } from './scoring';

export interface Entry {
  id: string;
  name: string;
  rating: number;
  stats: Stats;
  archetype: string;
  ts: number;
}

export type LiveMessage =
  | { type: 'entries' }
  | { type: 'live'; name: string; drill: string; step: number; total: number }
  | { type: 'idle' };

export interface KeyValue {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

const KEY = 'sky-combine.entries.v1';
const CHANNEL = 'sky-combine';
const MAX_ENTRIES = 5000;
const BLOCKED = ['FUCK', 'SHIT', 'CUNT', 'NIGG', 'FAG', 'RAPE', 'NAZI', 'BITCH', 'DICK', 'COCK', 'PUSSY', 'SLUT', 'WHORE'];

export function sanitizeName(raw: string): string {
  const name = raw.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10);
  if (!name || BLOCKED.some((w) => name.includes(w))) return 'PLAYER';
  return name;
}

function isEntry(v: unknown): v is Entry {
  if (!v || typeof v !== 'object') return false;
  const e = v as Entry;
  return (
    typeof e.id === 'string' &&
    typeof e.name === 'string' &&
    typeof e.rating === 'number' &&
    typeof e.ts === 'number' &&
    !!e.stats &&
    DRILL_IDS.every((id) => typeof e.stats[id] === 'number')
  );
}

export function sortEntries(entries: Entry[]): Entry[] {
  return [...entries].sort((a, b) => b.rating - a.rating || a.ts - b.ts);
}

export class Leaderboard {
  private channel: BroadcastChannel | null = null;

  constructor(private storage: KeyValue) {
    if (typeof BroadcastChannel !== 'undefined') this.channel = new BroadcastChannel(CHANNEL);
  }

  all(): Entry[] {
    try {
      const parsed: unknown = JSON.parse(this.storage.getItem(KEY) ?? '[]');
      return Array.isArray(parsed) ? sortEntries(parsed.filter(isEntry)) : [];
    } catch {
      return [];
    }
  }

  /** Saves the run and returns its 1-based rank. */
  add(entry: Entry): number {
    const entries = sortEntries([...this.all(), entry]).slice(0, MAX_ENTRIES);
    this.storage.setItem(KEY, JSON.stringify(entries));
    this.post({ type: 'entries' });
    return entries.findIndex((e) => e.id === entry.id) + 1;
  }

  clear(): void {
    this.storage.setItem(KEY, '[]');
    this.post({ type: 'entries' });
  }

  post(message: LiveMessage): void {
    this.channel?.postMessage(message);
  }

  listen(handler: (message: LiveMessage) => void): void {
    this.channel?.addEventListener('message', (e) => handler(e.data as LiveMessage));
    if (typeof window !== 'undefined') {
      window.addEventListener('storage', (e) => {
        if (e.key === KEY) handler({ type: 'entries' });
      });
    }
  }

  csv(): string {
    const head = ['rank', 'name', 'rating', 'archetype', ...DRILL_IDS, 'time'];
    const rows = this.all().map((e, i) =>
      [i + 1, e.name, e.rating, e.archetype, ...DRILL_IDS.map((id) => e.stats[id]), new Date(e.ts).toISOString()].join(','),
    );
    return [head.join(','), ...rows].join('\n');
  }
}

export interface SharedCard {
  n: string;
  r: number;
  s: number[];
}

export function encodeCard(name: string, rating: number, stats: Stats): string {
  const payload: SharedCard = { n: name, r: rating, s: DRILL_IDS.map((id) => stats[id]) };
  return btoa(JSON.stringify(payload)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function decodeCard(token: string): { name: string; rating: number; stats: Stats } | null {
  try {
    const p = JSON.parse(atob(token.replace(/-/g, '+').replace(/_/g, '/'))) as SharedCard;
    if (typeof p.n !== 'string' || typeof p.r !== 'number' || !Array.isArray(p.s) || p.s.length !== DRILL_IDS.length) return null;
    const stats = {} as Stats;
    DRILL_IDS.forEach((id, i) => {
      stats[id] = Math.min(100, Math.max(0, Math.round(Number(p.s[i]) || 0)));
    });
    return { name: sanitizeName(p.n), rating: Math.min(99, Math.max(0, Math.round(p.r))), stats };
  } catch {
    return null;
  }
}
