import { describe, expect, it } from 'vitest';
import { Leaderboard, decodeCard, encodeCard, sanitizeName, type Entry, type KeyValue } from '../src/core/store';

const memory = (): KeyValue => {
  const data = new Map<string, string>();
  return { getItem: (k) => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v) };
};
const stats = { reaction: 50, flick: 60, tracking: 70, discipline: 80, recall: 90 };
const entry = (id: string, rating: number, ts = 1): Entry => ({ id, name: id.toUpperCase(), rating, stats, archetype: 'FLEX', ts });

describe('leaderboard', () => {
  it('ranks by rating, earlier run wins ties', () => {
    const lb = new Leaderboard(memory());
    expect(lb.add(entry('a', 70, 1))).toBe(1);
    expect(lb.add(entry('b', 90, 2))).toBe(1);
    expect(lb.add(entry('c', 70, 3))).toBe(3);
    expect(lb.all().map((e) => e.id)).toEqual(['b', 'a', 'c']);
  });

  it('survives corrupt storage and clears', () => {
    const storage = memory();
    storage.setItem('sky-combine.entries.v1', '{not json');
    const lb = new Leaderboard(storage);
    expect(lb.all()).toEqual([]);
    lb.add(entry('a', 70));
    lb.clear();
    expect(lb.all()).toEqual([]);
  });

  it('exports csv', () => {
    const lb = new Leaderboard(memory());
    lb.add(entry('a', 70, 0));
    expect(lb.csv().split('\n')[1]).toBe('1,A,70,FLEX,50,60,70,80,90,1970-01-01T00:00:00.000Z');
  });
});

describe('names and shared cards', () => {
  it('sanitizes names', () => {
    expect(sanitizeName('ace_42!')).toBe('ACE42');
    expect(sanitizeName('')).toBe('PLAYER');
    expect(sanitizeName('xxshitxx')).toBe('PLAYER');
    expect(sanitizeName('abcdefghijklmnop')).toHaveLength(10);
  });

  it('round-trips a shared card and rejects junk', () => {
    const token = encodeCard('ACE', 88, stats);
    expect(decodeCard(token)).toEqual({ name: 'ACE', rating: 88, stats });
    expect(decodeCard('%%%')).toBeNull();
    expect(decodeCard(btoa('{"n":1}'))).toBeNull();
  });
});
