import type { VoteOption } from '@/components/home/InlineVotingCard';
import type { Poll } from '@/types/models';

const PALETTES: VoteOption['palette'][] = ['peach', 'sage', 'rose', 'lav', 'sky'];

export function mapPollToOptions(poll: Poll | null | undefined): VoteOption[] {
  if (!poll?.menuItems) return [];
  return poll.menuItems.map((link, idx) => ({
    id: link.menuItemId,
    emoji: link.menuItem.emoji ?? '🍽',
    name: link.menuItem.name,
    price: link.menuItem.price,
    minutes: link.menuItem.deliveryMinutes ?? 20,
    votes: link._count?.votes ?? 0,
    palette: PALETTES[idx % PALETTES.length],
  }));
}

export function totalVotes(poll: Poll | null | undefined): number {
  if (!poll) return 0;
  if (poll._count?.votes != null) return poll._count.votes;
  if (poll.votes) return poll.votes.length;
  return poll.menuItems?.reduce((s, m) => s + (m._count?.votes ?? 0), 0) ?? 0;
}

export function pollCountdown(poll: Poll | null | undefined): string {
  if (!poll) return '';
  const start = new Date(poll.createdAt).getTime();
  const end = start + poll.duration * 60_000;
  const remainingMs = Math.max(0, end - Date.now());
  const minutes = Math.floor(remainingMs / 60_000);
  const seconds = Math.floor((remainingMs % 60_000) / 1000);
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}
