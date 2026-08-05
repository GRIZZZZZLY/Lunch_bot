import type { MenuItem, Poll } from '@/types/models';

type VotePalette = 'peach' | 'lav' | 'sage' | 'sky' | 'rose';

export interface VoteOption {
  id: string | number;
  emoji: string;
  name: string;
  /** null — блюдо без цены (`MenuItem.price` необязателен в схеме). */
  price: number | null;
  minutes: number;
  votes: number;
  palette: VotePalette;
}

const PALETTES: VoteOption['palette'][] = ['peach', 'sage', 'rose', 'lav', 'sky'];

function parseSelectedIds(raw: Poll['selectedMenuItemIds']): number[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw.map(Number).filter(Number.isFinite);
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map(Number).filter(Number.isFinite) : [];
  } catch {
    return [];
  }
}

function votesByMenuItem(poll: Poll | null | undefined): Map<number, number> {
  const map = new Map<number, number>();
  for (const v of poll?.votes ?? []) {
    map.set(v.menuItemId, (map.get(v.menuItemId) ?? 0) + 1);
  }
  return map;
}

/**
 * Build vote options for a poll.
 * Prefers the expanded `menuItems` relation; falls back to `selectedMenuItemIds`
 * joined against the supplied menu list (the active-list API omits `menuItems`
 * until a poll has votes — see project notes).
 */
export function mapPollToOptions(
  poll: Poll | null | undefined,
  menu?: MenuItem[],
): VoteOption[] {
  // Vote counts can come from the expanded relation (link._count) or the raw votes array.
  const countByLink = new Map<number, number>();
  for (const link of poll?.menuItems ?? []) countByLink.set(link.menuItemId, link._count?.votes ?? 0);
  const countByVote = votesByMenuItem(poll);
  const votesFor = (id: number) => countByLink.get(id) ?? countByVote.get(id) ?? 0;

  // Prefer the full selected set so dishes with 0 votes never vanish (the active-list
  // endpoint only returns links for items that already have votes). Enrich names from
  // the menu list, falling back to the poll's own links.
  const ids = parseSelectedIds(poll?.selectedMenuItemIds);
  if (ids.length) {
    const opts = ids.flatMap((id, idx) => {
      const fromMenu = menu?.find((m) => m.id === id);
      const fromLink = poll?.menuItems?.find((l) => l.menuItemId === id)?.menuItem;
      const mi = fromMenu ?? fromLink;
      if (!mi) return [];
      return [
        {
          id: mi.id,
          emoji: mi.emoji ?? '🍽',
          name: mi.name,
          price: mi.price,
          minutes: mi.deliveryMinutes ?? 20,
          votes: votesFor(id),
          palette: PALETTES[idx % PALETTES.length],
        },
      ];
    });
    if (opts.length) return opts;
  }

  // Fallback: derive purely from the expanded links.
  if (poll?.menuItems?.length) {
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
  return [];
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
