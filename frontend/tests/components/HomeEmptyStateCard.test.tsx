import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { HomeEmptyStateCard } from '../../src/components/home/HomeEmptyStateCard';

describe('HomeEmptyStateCard', () => {
  afterEach(() => {
    cleanup();
  });

  it('shows the empty state title and create action for an admin', () => {
    const onCreatePoll = vi.fn();

    render(
      <HomeEmptyStateCard
        title="No lunch poll"
        description="Create one for the group"
        isAdmin
        showAdminChecklist={false}
        showRemindAdmin={false}
        onCreatePoll={onCreatePoll}
        onRemindAdmin={vi.fn()}
      />
    );

    expect(screen.getByText('No lunch poll')).toBeInTheDocument();
    expect(screen.getByText('Create one for the group')).toBeInTheDocument();

    const buttons = screen.getAllByRole('button');
    expect(buttons).toHaveLength(1);
    fireEvent.click(buttons[0]);
    expect(onCreatePoll).toHaveBeenCalledTimes(1);
  });

  it('shows remind-admin action for a regular user when a group is selected', () => {
    const onRemindAdmin = vi.fn();

    render(
      <HomeEmptyStateCard
        title="No active poll"
        description="Wait or suggest a dish"
        isAdmin={false}
        showAdminChecklist={false}
        showRemindAdmin
        onCreatePoll={vi.fn()}
        onRemindAdmin={onRemindAdmin}
      />
    );

    expect(screen.getByText('No active poll')).toBeInTheDocument();

    const buttons = screen.getAllByRole('button');
    expect(buttons).toHaveLength(1);
    fireEvent.click(buttons[0]);
    expect(onRemindAdmin).toHaveBeenCalledTimes(1);
  });
});
