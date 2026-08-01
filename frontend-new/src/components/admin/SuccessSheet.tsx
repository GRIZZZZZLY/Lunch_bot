import { BottomSheet } from '@/components/rl/BottomSheet';
import { Button, Confetti } from '@/components/rl/primitives';
import { Icon } from '@/components/rl/Icon';

interface Props {
  open: boolean;
  participants: number;
  closeAt: string;
  onShare?: () => void;
  onOpen?: () => void;
}

export function SuccessSheet({ open, participants, closeAt, onShare, onOpen }: Props) {
  if (!open) return null;

  return (
    <BottomSheet
      title="Опрос запущен"
      onClose={() => onOpen?.()}
      footer={
        <>
          <Button variant="secondary" style={{ flex: 1 }} onClick={onOpen}>
            К опросу
          </Button>
          <Button variant="primary" icon="send" style={{ flex: 1 }} onClick={onShare}>
            Поделиться
          </Button>
        </>
      }
    >
      <Confetti fire />
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', padding: '8px 0 6px', position: 'relative' }}>
        <div className="anim-pop" style={{ width: 64, height: 64, borderRadius: '50%', background: 'var(--accent-tint)', color: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 14 }}>
          <Icon name="check" size={32} stroke={2.2} />
        </div>
        <div className="font-head tight" style={{ fontSize: 'var(--text-18)', fontWeight: 700 }}>
          Голосование отправлено
        </div>
        <p style={{ margin: '6px 0 0', fontSize: 'var(--text-13)', color: 'var(--text-tertiary)', maxWidth: 260, lineHeight: 1.5 }}>
          <span className="tnum">{participants}</span> участников получили уведомление. Закроется в{' '}
          <span className="tnum">{closeAt}</span>.
        </p>
      </div>
    </BottomSheet>
  );
}
