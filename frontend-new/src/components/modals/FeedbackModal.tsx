import { useState } from 'react';
import { Modal } from './Modal';
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

  return (
    <Modal open={open} onClose={onClose} title="Оставьте отзыв">
      {done ? (
        <div style={{ textAlign: 'center', padding: '30px 0' }}>
          <div style={{ fontSize: 56 }}>✅</div>
          <div style={{ fontWeight: 600, marginTop: 10 }}>Спасибо за отзыв!</div>
        </div>
      ) : (
        <>
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 13, color: 'var(--ink-2, #666)', marginBottom: 8 }}>Оценка</div>
            <div style={{ display: 'flex', gap: 6 }}>
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  onClick={() => setRating(n)}
                  style={{
                    flex: 1,
                    padding: 10,
                    border: 'none',
                    borderRadius: 10,
                    background: rating !== null && n <= rating ? '#FFD66E' : 'var(--surf-2, #F2F2F5)',
                    fontSize: 20,
                    cursor: 'pointer',
                  }}
                >
                  ★
                </button>
              ))}
            </div>
          </div>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Расскажите, что понравилось или что улучшить…"
            rows={4}
            style={{
              width: '100%',
              border: '1px solid var(--line-2, #eee)',
              borderRadius: 12,
              padding: 12,
              fontSize: 14,
              resize: 'vertical',
              boxSizing: 'border-box',
            }}
          />
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <button
              onClick={onClose}
              disabled={send.isPending}
              style={{ flex: 1, border: 'none', background: 'var(--surf-2, #F2F2F5)', padding: 12, borderRadius: 12, fontSize: 14, cursor: 'pointer' }}
            >
              Отмена
            </button>
            <button
              onClick={submit}
              disabled={!message.trim() || send.isPending}
              style={{
                flex: 1,
                border: 'none',
                background: 'var(--ink-1, #1b1b1b)',
                color: '#fff',
                padding: 12,
                borderRadius: 12,
                fontSize: 14,
                fontWeight: 600,
                cursor: 'pointer',
                opacity: !message.trim() || send.isPending ? 0.5 : 1,
              }}
            >
              {send.isPending ? 'Отправка…' : 'Отправить'}
            </button>
          </div>
        </>
      )}
    </Modal>
  );
}
