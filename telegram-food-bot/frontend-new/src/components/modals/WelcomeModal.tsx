import { useEffect, useState } from 'react';
import { Modal } from './Modal';

const SLIDES = [
  {
    emoji: '🍱',
    title: 'Добро пожаловать в Rocket Lunch',
    text: 'Голосуйте за обед всей командой — без чатов и путаницы.',
  },
  {
    emoji: '🗳',
    title: 'Голосование за пару кликов',
    text: 'Выбирайте блюдо в Mini App и смотрите результаты в реальном времени.',
  },
  {
    emoji: '💸',
    title: 'Бюджет без споров',
    text: 'Ответственный и долги распределяются автоматически. СБП для быстрой оплаты.',
  },
];

const KEY = 'welcome-shown-v1';

interface Props {
  forceOpen?: boolean;
  onClose?: () => void;
}

export function WelcomeModal({ forceOpen, onClose }: Props) {
  const [open, setOpen] = useState(false);
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    if (forceOpen) {
      setOpen(true);
      return;
    }
    try {
      if (!localStorage.getItem(KEY)) setOpen(true);
    } catch {
      /* no-op */
    }
  }, [forceOpen]);

  const close = () => {
    setOpen(false);
    try {
      localStorage.setItem(KEY, '1');
    } catch {
      /* no-op */
    }
    onClose?.();
  };

  const next = () => {
    if (idx < SLIDES.length - 1) setIdx(idx + 1);
    else close();
  };

  const s = SLIDES[idx];

  return (
    <Modal open={open} onClose={close}>
      <div style={{ textAlign: 'center', padding: '10px 4px' }}>
        <div style={{ fontSize: 72 }}>{s.emoji}</div>
        <div style={{ fontWeight: 700, fontSize: 20, marginTop: 8 }}>{s.title}</div>
        <div style={{ color: 'var(--ink-2, #666)', fontSize: 14, marginTop: 8, lineHeight: 1.4 }}>
          {s.text}
        </div>
        <div style={{ display: 'flex', gap: 6, justifyContent: 'center', marginTop: 18 }}>
          {SLIDES.map((_, i) => (
            <span
              key={i}
              style={{
                width: i === idx ? 24 : 8,
                height: 8,
                borderRadius: 999,
                background: i === idx ? 'var(--ink-1, #1b1b1b)' : 'var(--line-2, #E0E0E5)',
                transition: 'width 180ms',
              }}
            />
          ))}
        </div>
        <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
          {idx < SLIDES.length - 1 && (
            <button
              onClick={close}
              style={{ flex: 1, border: 'none', background: 'var(--surf-2, #F2F2F5)', padding: '12px', borderRadius: 12, fontSize: 14, cursor: 'pointer' }}
            >
              Пропустить
            </button>
          )}
          <button
            onClick={next}
            style={{ flex: 1, border: 'none', background: 'var(--ink-1, #1b1b1b)', color: '#fff', padding: '12px', borderRadius: 12, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}
          >
            {idx < SLIDES.length - 1 ? 'Далее' : 'Начать'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
