import { useState, type ChangeEvent } from 'react';
import { BottomSheet } from '@/components/rl/BottomSheet';
import { Button, Field } from '@/components/rl/primitives';
import { Icon } from '@/components/rl/Icon';
import { useSendFeedback } from '@/hooks/useFeedback';
import { useAuth } from '@/hooks/useAuth';

interface Props {
  open: boolean;
  onClose: () => void;
}

export function FeedbackModal({ open, onClose }: Props) {
  const { user } = useAuth();
  const send = useSendFeedback();
  const [message, setMessage] = useState('');
  const [rating, setRating] = useState<number | null>(null);
  const [done, setDone] = useState(false);

  if (!open) return null;

  const submit = async () => {
    if (!message.trim()) return;
    const fullMessage = rating ? `[${rating}★] ${message.trim()}` : message.trim();
    await send.mutateAsync({
      message: fullMessage,
      userId: user?.id,
      username: user?.username ?? undefined,
      firstName: user?.firstName ?? undefined,
    });
    setDone(true);
    setTimeout(() => {
      onClose();
      setDone(false);
      setMessage('');
      setRating(null);
    }, 1200);
  };

  if (done) {
    return (
      <BottomSheet title="Спасибо!" onClose={onClose}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', padding: '12px 0 6px' }}>
          <div className="anim-pop" style={{ width: 64, height: 64, borderRadius: '50%', background: 'var(--success-tint)', color: 'var(--success)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 14 }}>
            <Icon name="check" size={32} stroke={2.2} />
          </div>
          <div className="font-head tight" style={{ fontSize: 'var(--text-18)', fontWeight: 700 }}>
            Отзыв отправлен
          </div>
        </div>
      </BottomSheet>
    );
  }

  return (
    <BottomSheet
      title="Оставьте отзыв"
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" style={{ flex: 1 }} disabled={send.isPending} onClick={onClose}>
            Отмена
          </Button>
          <Button variant="primary" icon="send" style={{ flex: 1 }} loading={send.isPending} disabled={!message.trim()} onClick={submit}>
            Отправить
          </Button>
        </>
      }
    >
      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 'var(--text-13)', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8 }}>Оценка</div>
        <div style={{ display: 'flex', gap: 6 }}>
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              className="btn btn--secondary press"
              style={{ flex: 1, color: rating !== null && n <= rating ? 'var(--warning)' : 'var(--text-tertiary)' }}
              onClick={() => setRating(n)}
              aria-label={`${n} звёзд`}
            >
              <Icon name="star" size={20} stroke={rating !== null && n <= rating ? 2.2 : 1.75} />
            </button>
          ))}
        </div>
      </div>
      <Field
        as="textarea"
        aria-label="Текст отзыва"
        value={message}
        onChange={(e: ChangeEvent<HTMLTextAreaElement>) => setMessage(e.target.value)}
        placeholder="Расскажите, что понравилось или что улучшить…"
        rows={4}
      />
    </BottomSheet>
  );
}
