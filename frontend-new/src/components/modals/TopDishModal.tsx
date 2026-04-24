import { Modal } from './Modal';

export interface TopDish {
  name: string;
  emoji?: string;
  votes: number;
  totalVotes: number;
  price?: number;
}

interface Props {
  open: boolean;
  dish: TopDish | null;
  onClose: () => void;
}

export function TopDishModal({ open, dish, onClose }: Props) {
  if (!dish) return null;
  const pct = dish.totalVotes > 0 ? Math.round((dish.votes / dish.totalVotes) * 100) : 0;

  return (
    <Modal open={open} onClose={onClose} title="🏆 Победитель голосования">
      <div style={{ textAlign: 'center', padding: '10px 0' }}>
        <div style={{ fontSize: 88, lineHeight: 1 }}>{dish.emoji ?? '🍽'}</div>
        <div style={{ fontWeight: 700, fontSize: 20, marginTop: 10 }}>{dish.name}</div>
        {dish.price !== undefined && (
          <div style={{ color: 'var(--ink-2, #666)', fontSize: 14, marginTop: 4 }}>{dish.price} ₽</div>
        )}

        <div style={{ marginTop: 18, background: 'var(--surf-2, #F7F7F9)', borderRadius: 14, padding: 14 }}>
          <div style={{ fontSize: 28, fontWeight: 700 }}>{pct}%</div>
          <div style={{ fontSize: 13, color: 'var(--ink-2, #666)' }}>
            {dish.votes} из {dish.totalVotes} голосов
          </div>
        </div>

        <button
          onClick={onClose}
          style={{
            marginTop: 16,
            width: '100%',
            border: 'none',
            background: 'var(--ink-1, #1b1b1b)',
            color: '#fff',
            padding: 12,
            borderRadius: 12,
            fontSize: 14,
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          Отлично
        </button>
      </div>
    </Modal>
  );
}
