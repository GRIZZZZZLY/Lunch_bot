import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { HomeActionsSection } from '../../src/components/home/HomeActionsSection';

vi.mock('framer-motion', async () => {
  const ReactModule = await import('react');

  return {
    m: {
      button: ({
        children,
        whileHover: _whileHover,
        whileTap: _whileTap,
        initial: _initial,
        animate: _animate,
        transition: _transition,
        ...props
      }: any) => ReactModule.createElement('button', props, children),
    },
  };
});

describe('HomeActionsSection', () => {
  afterEach(() => {
    cleanup();
  });

  it('shows repeat action for an admin when the last completed poll exists', () => {
    const onRepeatLastPoll = vi.fn();

    render(
      <HomeActionsSection
        showAdminAction
        repeatLastPoll={{ status: 'ready', onClick: onRepeatLastPoll }}
        onCreatePoll={vi.fn()}
        onInviteFriend={vi.fn()}
        onAddToGroup={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /Повторить/i }));

    expect(onRepeatLastPoll).toHaveBeenCalledTimes(1);
  });

  it('shows top dish action when a handler is provided', () => {
    const onShowTopDish = vi.fn();

    render(
      <HomeActionsSection
        showAdminAction={false}
        onCreatePoll={vi.fn()}
        onInviteFriend={vi.fn()}
        onAddToGroup={vi.fn()}
        topDish={{ status: 'ready', onClick: onShowTopDish }}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /Топ блюдо/i }));

    expect(onShowTopDish).toHaveBeenCalledTimes(1);
  });
});
