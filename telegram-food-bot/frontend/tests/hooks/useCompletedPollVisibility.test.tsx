import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useCompletedPollVisibility } from '../../src/hooks/useCompletedPollVisibility';
import type { PollWithDetails } from '../../src/services/polls.service';

const poll = (id: number, endedAt: string): PollWithDetails => ({
  id,
  groupId: 2,
  title: 'Lunch',
  status: 'COMPLETED',
  duration: 30,
  startedAt: '2026-06-22T09:00:00.000Z',
  endedAt,
  createdAt: '2026-06-22T09:00:00.000Z',
  updatedAt: endedAt,
  group: {
    id: 2,
    title: 'Team Two',
    telegramId: '2',
  },
  votes: [],
  results: [],
});

describe('useCompletedPollVisibility', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-22T09:40:00.000Z'));
    window.localStorage.clear();
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    window.localStorage.clear();
  });

  it('shows a recent completed poll and stores dismiss by poll id', () => {
    const { result } = renderHook(() =>
      useCompletedPollVisibility(poll(9, '2026-06-22T09:30:00.000Z'))
    );

    expect(result.current.visible).toBe(true);

    act(() => {
      result.current.dismiss();
    });

    expect(result.current.visible).toBe(false);
    expect(window.localStorage.getItem('completedPoll:dismissed:9')).toBe('1');
  });

  it('hides a completed poll older than fifteen minutes', () => {
    const { result } = renderHook(() =>
      useCompletedPollVisibility(poll(10, '2026-06-22T09:24:59.000Z'))
    );

    expect(result.current.visible).toBe(false);
  });
});
