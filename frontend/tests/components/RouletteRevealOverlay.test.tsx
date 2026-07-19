import '@testing-library/jest-dom/vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RouletteRevealOverlay } from '../../src/components/voting/RouletteRevealOverlay';

vi.mock('framer-motion', async () => {
  const ReactModule = await import('react');

  const createMotionComponent = (tag: string) =>
    ReactModule.forwardRef<HTMLElement, any>(
      (
        {
          children,
          initial: _initial,
          animate: _animate,
          exit: _exit,
          transition: _transition,
          ...props
        },
        ref
      ) => ReactModule.createElement(tag, { ...props, ref }, children)
    );

  return {
    AnimatePresence: ({ children }: { children: React.ReactNode }) =>
      ReactModule.createElement(ReactModule.Fragment, null, children),
    m: {
      div: createMotionComponent('div'),
    },
    useReducedMotion: () => true,
  };
});

const participants = [
  { id: 1, firstName: 'Alice', lastName: 'Stone' },
  { id: 2, firstName: 'Bob', lastName: 'Smith' },
  { id: 3, firstName: 'Cara' },
];

const winner = { id: 2, firstName: 'Bob', lastName: 'Smith' };

describe('RouletteRevealOverlay', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
    cleanup();
  });

  it('shows voters first and then reveals the responsible user', async () => {
    const onClose = vi.fn();

    render(
      <RouletteRevealOverlay
        isOpen
        participants={participants}
        winner={winner}
        onClose={onClose}
      />
    );

    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.getByText('Bob')).toBeInTheDocument();
    expect(screen.queryByText('Bob Smith')).not.toBeInTheDocument();

    await act(async () => {
      vi.advanceTimersByTime(250);
    });

    expect(screen.getByText('Bob Smith')).toBeInTheDocument();

    fireEvent.click(screen.getAllByRole('button').at(-1));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('auto-closes after the winner phase', async () => {
    const onClose = vi.fn();

    render(
      <RouletteRevealOverlay
        isOpen
        participants={participants}
        winner={winner}
        onClose={onClose}
      />
    );

    await act(async () => {
      vi.advanceTimersByTime(1700);
    });

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('does not render while closed', () => {
    render(
      <RouletteRevealOverlay
        isOpen={false}
        participants={participants}
        winner={winner}
        onClose={vi.fn()}
      />
    );

    expect(screen.queryByText('Alice')).not.toBeInTheDocument();
  });
});
