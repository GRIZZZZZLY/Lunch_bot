import { describe, expect, it } from 'vitest';
import { buildLunchDna } from '../../src/services/lunch-dna.service';

describe('buildLunchDna', () => {
  it('should classify stable popular choices as Архитектор обеда', () => {
    const profile = buildLunchDna({
      voteHistory: [
        { menuItemId: 1, menuItemName: 'Борщ', pollId: 1, votedAt: '2026-03-01T10:00:00.000Z' },
        { menuItemId: 1, menuItemName: 'Борщ', pollId: 2, votedAt: '2026-03-02T10:00:00.000Z' },
        { menuItemId: 1, menuItemName: 'Борщ', pollId: 3, votedAt: '2026-03-03T10:00:00.000Z' },
        { menuItemId: 2, menuItemName: 'Плов', pollId: 4, votedAt: '2026-03-04T10:00:00.000Z' },
        { menuItemId: 1, menuItemName: 'Борщ', pollId: 5, votedAt: '2026-03-05T10:00:00.000Z' },
        { menuItemId: 2, menuItemName: 'Плов', pollId: 6, votedAt: '2026-03-06T10:00:00.000Z' },
        { menuItemId: 1, menuItemName: 'Борщ', pollId: 7, votedAt: '2026-03-07T10:00:00.000Z' },
        { menuItemId: 1, menuItemName: 'Борщ', pollId: 8, votedAt: '2026-03-08T10:00:00.000Z' },
      ],
      popularItems: [
        { id: 1, name: 'Борщ', voteCount: 30, winCount: 8, _count: { votes: 30, pollResults: 8 } },
        { id: 2, name: 'Плов', voteCount: 20, winCount: 6, _count: { votes: 20, pollResults: 6 } },
      ],
      totalPolls: 20,
    });

    expect(profile.archetype).toBe('Архитектор обеда');
    expect(profile.confidence).toBe('medium');
    expect(profile.isFallback).toBe(false);
    expect(profile.axes).toHaveLength(6);
    expect(profile.axes.find(axis => axis.key === 'stability')?.value).toBeGreaterThan(70);
    expect(profile.axes.find(axis => axis.key === 'teamSync')?.value).toBeGreaterThan(70);
    expect(profile.axes.find(axis => axis.key === 'novelty')?.value).toBeLessThan(40);
  });

  it('should return an honest fallback profile when there is not enough vote history', () => {
    const profile = buildLunchDna({
      voteHistory: [
        { menuItemId: 10, menuItemName: 'Том Ям', pollId: 1, votedAt: '2026-03-01T10:00:00.000Z' },
        { menuItemId: 11, menuItemName: 'Рамен', pollId: 2, votedAt: '2026-03-02T10:00:00.000Z' },
      ],
      popularItems: [],
      totalPolls: 2,
    });

    expect(profile.confidence).toBe('low');
    expect(profile.isFallback).toBe(true);
    expect(profile.summary).toContain('нужно ещё');
    expect(profile.baseline.title).toBe('Taste baseline');
  });
});
