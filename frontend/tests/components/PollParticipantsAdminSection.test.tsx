import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PollParticipantsAdminSection } from '../../src/components/polls/PollParticipantsAdminSection';
import type { PollParticipantInfo } from '../../src/services/admin.service';

const { addNotification, getPollParticipants, setPollParticipantStatus } =
  vi.hoisted(() => ({
    addNotification: vi.fn(),
    getPollParticipants: vi.fn(),
    setPollParticipantStatus: vi.fn(),
  }));

vi.mock('../../src/store/useAppStore', () => ({
  useUI: () => ({
    addNotification,
  }),
}));

vi.mock('../../src/services/admin.service', () => ({
  adminService: {
    getPollParticipants,
    setPollParticipantStatus,
  },
}));

const participants: PollParticipantInfo[] = [
  {
    userId: 1,
    status: 'EXPECTED',
    reason: null,
    hasVoted: false,
    user: {
      id: 1,
      telegramId: '1',
      username: null,
      firstName: 'Анна',
      lastName: null,
      avatarUrl: null,
      photoUrl: null,
    },
  },
  {
    userId: 2,
    status: 'EXPECTED',
    reason: null,
    hasVoted: true,
    user: {
      id: 2,
      telegramId: '2',
      username: null,
      firstName: 'Борис',
      lastName: null,
      avatarUrl: null,
      photoUrl: null,
    },
  },
  {
    userId: 3,
    status: 'EXCLUDED',
    reason: null,
    hasVoted: false,
    user: {
      id: 3,
      telegramId: '3',
      username: null,
      firstName: 'Максим',
      lastName: null,
      avatarUrl: null,
      photoUrl: null,
    },
  },
];

describe('PollParticipantsAdminSection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getPollParticipants.mockResolvedValue({
      success: true,
      data: participants,
    });
    setPollParticipantStatus.mockResolvedValue({
      success: true,
      data: { userId: 1, status: 'EXCLUDED' },
      autoClosed: false,
    });
  });

  afterEach(() => {
    cleanup();
  });

  it('loads participants only after opening and shows quorum progress', async () => {
    render(<PollParticipantsAdminSection pollId={7} />);

    expect(getPollParticipants).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: /Участники голосования/ }));

    expect(await screen.findByText('Анна')).toBeInTheDocument();
    expect(screen.getByText('Борис')).toBeInTheDocument();
    expect(screen.getByText('Максим')).toBeInTheDocument();
    expect(screen.getByText(/\(1\/2 проголосовало, 1 искл\.\)/)).toBeInTheDocument();
  });

  it('excludes an expected participant who has not voted yet', async () => {
    render(<PollParticipantsAdminSection pollId={7} />);

    fireEvent.click(screen.getByRole('button', { name: /Участники голосования/ }));
    await screen.findByText('Анна');

    fireEvent.click(screen.getByRole('button', { name: 'Исключить' }));

    await waitFor(() => {
      expect(setPollParticipantStatus).toHaveBeenCalledWith(7, 1, 'EXCLUDED');
    });
    expect(addNotification).toHaveBeenCalledWith({
      type: 'success',
      message: 'Участник исключён',
    });
  });

  it('does not show exclude action for a participant who has already voted', async () => {
    render(<PollParticipantsAdminSection pollId={7} />);

    fireEvent.click(screen.getByRole('button', { name: /Участники голосования/ }));
    await screen.findByText('Борис');

    expect(screen.getAllByRole('button', { name: 'Исключить' })).toHaveLength(1);
  });

  it('returns an excluded participant to the expected list', async () => {
    render(<PollParticipantsAdminSection pollId={7} />);

    fireEvent.click(screen.getByRole('button', { name: /Участники голосования/ }));
    await screen.findByText('Максим');

    fireEvent.click(screen.getByRole('button', { name: 'Вернуть' }));

    await waitFor(() => {
      expect(setPollParticipantStatus).toHaveBeenCalledWith(7, 3, 'EXPECTED');
    });
    expect(addNotification).toHaveBeenCalledWith({
      type: 'success',
      message: 'Участник возвращён',
    });
  });

  it('notifies the parent when changing participant status auto-closes the poll', async () => {
    const onAutoClosed = vi.fn();
    setPollParticipantStatus.mockResolvedValue({
      success: true,
      data: { userId: 1, status: 'EXCLUDED' },
      autoClosed: true,
    });

    render(<PollParticipantsAdminSection pollId={7} onAutoClosed={onAutoClosed} />);

    fireEvent.click(screen.getByRole('button', { name: /Участники голосования/ }));
    await screen.findByText('Анна');

    fireEvent.click(screen.getByRole('button', { name: 'Исключить' }));

    await waitFor(() => {
      expect(onAutoClosed).toHaveBeenCalledTimes(1);
    });
  });
});
