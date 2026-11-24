import { describe, expect, it } from 'vitest';
import {
  archetypeFor, median, overallRating, scoreDiscipline, scoreFlick, scoreReaction, scoreRecall, scoreTracking, tierFor,
  type Stats,
} from '../src/core/scoring';

const stats = (r: number, f: number, t: number, d: number, m: number): Stats => ({ reaction: r, flick: f, tracking: t, discipline: d, recall: m });

describe('scoring', () => {
  it('median handles odd, even and empty', () => {
    expect(median([3, 1, 2])).toBe(2);
    expect(median([4, 1, 2, 3])).toBe(2.5);
    expect(median([])).toBeNaN();
  });

  it('reaction rewards fast medians and punishes false starts', () => {
    expect(scoreReaction([150, 150, 150], 0)).toBe(100);
    expect(scoreReaction([300], 0)).toBe(50);
    expect(scoreReaction([600], 0)).toBe(0);
    expect(scoreReaction([300], 2)).toBe(34);
    expect(scoreReaction([], 0)).toBe(0);
  });

  it('flick weights hits by accuracy', () => {
    expect(scoreFlick(26, 26)).toBe(100);
    expect(scoreFlick(13, 13)).toBe(50);
    expect(scoreFlick(13, 26)).toBeLessThan(scoreFlick(13, 13));
    expect(scoreFlick(0, 0)).toBe(0);
  });

  it('tracking is share of time on target', () => {
    expect(scoreTracking(8500, 10000)).toBe(100);
    expect(scoreTracking(4250, 10000)).toBe(50);
    expect(scoreTracking(1, 0)).toBe(0);
  });

  it('discipline punishes friendly fire harder than misses', () => {
    expect(scoreDiscipline(10, 10, 0, 0)).toBe(100);
    expect(scoreDiscipline(10, 10, 1, 0)).toBe(80);
    expect(scoreDiscipline(10, 10, 0, 2)).toBe(90);
    expect(scoreDiscipline(0, 10, 5, 5)).toBe(0);
  });

  it('recall matches each ping to its nearest guess once', () => {
    const pings = [{ x: 0.2, y: 0.2 }, { x: 0.8, y: 0.8 }];
    expect(scoreRecall(pings, [{ x: 0.8, y: 0.8 }, { x: 0.2, y: 0.2 }])).toBe(100);
    expect(scoreRecall(pings, [{ x: 0.2, y: 0.2 }])).toBe(50);
    expect(scoreRecall(pings, [{ x: 0.2, y: 0.2 }, { x: 0.2, y: 0.2 }])).toBe(50);
    expect(scoreRecall(pings, [])).toBe(0);
  });

  it('rating stays in 40..99 and tiers follow it', () => {
    expect(overallRating(stats(0, 0, 0, 0, 0))).toBe(40);
    expect(overallRating(stats(100, 100, 100, 100, 100))).toBe(99);
    expect(tierFor(99).name).toBe('FRANCHISE PLAYER');
    expect(tierFor(40).name).toBe('ROOKIE');
  });

  it('archetype follows the best skill, flex when balanced', () => {
    expect(archetypeFor(stats(90, 40, 40, 40, 40)).name).toBe('ENTRY');
    expect(archetypeFor(stats(40, 40, 40, 40, 95)).name).toBe('SHOTCALLER');
    expect(archetypeFor(stats(80, 78, 75, 82, 79)).name).toBe('FLEX');
  });

  it('pairs a lone correct guess with the ping it matches, not an earlier one', () => {
    const pings = [
      { x: 0.2, y: 0.2 },
      { x: 0.4, y: 0.2 },
    ];
    expect(scoreRecall(pings, [{ x: 0.4, y: 0.2 }])).toBe(50);
  });
});
