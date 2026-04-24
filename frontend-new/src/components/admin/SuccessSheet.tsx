import '@/styles/admin.css';

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
    <div
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        background: 'var(--surface)',
        borderTopLeftRadius: 18,
        borderTopRightRadius: 18,
        boxShadow: 'var(--shadow-elev)',
        paddingBottom: 12,
        zIndex: 20,
      }}
    >
      <div className="sheet-hdr">
        <div className="grab" />
      </div>
      <div className="succ">
        <div className="rocket">🚀</div>
        <div className="st">Опрос запущен!</div>
        <div className="ss">
          {participants} участника получили уведомление. Голосование закроется в {closeAt}.
        </div>
        <div className="confetti" />
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
            marginTop: 16,
            padding: '0 14px',
          }}
        >
          <button type="button" className="btn primary" onClick={onShare}>
            Поделиться в чате
          </button>
          <button
            type="button"
            className="btn"
            style={{
              background: 'transparent',
              color: 'var(--ink-2)',
              border: '1px solid var(--line-2)',
              width: '100%',
            }}
            onClick={onOpen}
          >
            К опросу
          </button>
        </div>
      </div>
    </div>
  );
}
