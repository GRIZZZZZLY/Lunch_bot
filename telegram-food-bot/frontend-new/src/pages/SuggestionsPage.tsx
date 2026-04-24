import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import {
  useApproveSuggestion,
  useCreateSuggestion,
  useDeleteSuggestion,
  useRejectSuggestion,
  useSuggestions,
} from '@/hooks/useSuggestions';
import type { MenuSuggestion, SuggestionStatus } from '@/types/models';
import '@/styles/profile.css';

interface Props {
  onlyMine?: boolean;
}

export function SuggestionsPage({ onlyMine = false }: Props) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const isAdmin = user?.isAdmin ?? false;
  const [tab, setTab] = useState<'all' | 'mine'>(onlyMine || !isAdmin ? 'mine' : 'all');
  const [formOpen, setFormOpen] = useState(false);

  const { data: suggestions = [], isLoading } = useSuggestions({ limit: 60 });
  const createMutation = useCreateSuggestion();
  const approveMutation = useApproveSuggestion();
  const rejectMutation = useRejectSuggestion();
  const deleteMutation = useDeleteSuggestion();

  const items = useMemo(() => {
    if (!isAdmin) return suggestions;
    if (tab === 'mine') return suggestions.filter((s) => s.suggestedBy === user?.id);
    return suggestions;
  }, [suggestions, tab, isAdmin, user?.id]);

  const handleSubmit = async (data: { name: string; description?: string; price?: number }) => {
    await createMutation.mutateAsync(data);
    setFormOpen(false);
  };

  return (
    <>
      <div className="top-hdr">
        <div className="back" onClick={() => navigate(-1)}>
          ‹
        </div>
        <div className="ttl">Предложения блюд</div>
        <button
          type="button"
          className="act"
          onClick={() => setFormOpen(true)}
          aria-label="Добавить предложение"
        >
          +
        </button>
      </div>

      {isAdmin && (
        <div className="chips">
          <span
            className={`chip${tab === 'all' ? ' on' : ''}`}
            onClick={() => setTab('all')}
          >
            Все
          </span>
          <span
            className={`chip${tab === 'mine' ? ' on' : ''}`}
            onClick={() => setTab('mine')}
          >
            Мои
          </span>
        </div>
      )}

      <div className="content">
        {isLoading && items.length === 0 && (
          <div style={{ padding: 16, color: 'var(--ink-2)' }}>Загрузка…</div>
        )}
        {!isLoading && items.length === 0 && (
          <div style={{ padding: 16, color: 'var(--ink-2)' }}>
            Пока нет предложений. Нажмите «+», чтобы добавить блюдо.
          </div>
        )}
        {items.map((s) => (
          <SuggestionCard
            key={s.id}
            s={s}
            isAdmin={isAdmin}
            onApprove={() => approveMutation.mutate(s.id)}
            onReject={() => {
              const reason = window.prompt('Причина отказа (необязательно):') ?? undefined;
              rejectMutation.mutate({ id: s.id, reason });
            }}
            onDelete={() => {
              if (window.confirm('Удалить предложение?')) deleteMutation.mutate(s.id);
            }}
          />
        ))}
      </div>

      {formOpen && (
        <SuggestionForm
          submitting={createMutation.isPending}
          onClose={() => setFormOpen(false)}
          onSubmit={handleSubmit}
        />
      )}
    </>
  );
}

function SuggestionCard({
  s,
  isAdmin,
  onApprove,
  onReject,
  onDelete,
}: {
  s: MenuSuggestion;
  isAdmin: boolean;
  onApprove: () => void;
  onReject: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="hist-card" style={{ alignItems: 'flex-start' }}>
      <div className="disc">🍽</div>
      <div className="md">
        <div className="nm">{s.name}</div>
        {s.description && <div className="ct">{s.description}</div>}
        {s.price !== undefined && s.price !== null && (
          <div className="ct">{s.price} ₽</div>
        )}
        <span className={`rib ${statusTone(s.status)}`}>{statusLabel(s.status)}</span>
        {s.status === 'REJECTED' && s.rejectionReason && (
          <div className="ct" style={{ marginTop: 4 }}>Причина: {s.rejectionReason}</div>
        )}
        {isAdmin && s.status === 'PENDING' && (
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <button type="button" className="chip on" onClick={onApprove}>
              Одобрить
            </button>
            <button type="button" className="chip" onClick={onReject}>
              Отклонить
            </button>
          </div>
        )}
        {isAdmin && s.status === 'REJECTED' && (
          <div style={{ marginTop: 8 }}>
            <button type="button" className="chip" onClick={onDelete}>
              Удалить
            </button>
          </div>
        )}
      </div>
      <div className="rt">
        <span className="cnt">{formatDate(s.createdAt)}</span>
      </div>
    </div>
  );
}

function SuggestionForm({
  submitting,
  onClose,
  onSubmit,
}: {
  submitting: boolean;
  onClose: () => void;
  onSubmit: (d: { name: string; description?: string; price?: number }) => void;
}) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');

  const canSubmit = name.trim().length >= 2 && !submitting;

  const submit = () => {
    if (!canSubmit) return;
    const parsedPrice = price.trim() ? Number(price) : undefined;
    onSubmit({
      name: name.trim(),
      description: description.trim() || undefined,
      price: Number.isFinite(parsedPrice) ? (parsedPrice as number) : undefined,
    });
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.4)',
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'center',
        zIndex: 50,
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'var(--surface)',
          width: '100%',
          maxWidth: 430,
          borderTopLeftRadius: 20,
          borderTopRightRadius: 20,
          padding: 16,
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
        }}
      >
        <div style={{ fontSize: 16, fontWeight: 700 }}>Новое предложение</div>
        <input
          type="text"
          placeholder="Название блюда"
          value={name}
          onChange={(e) => setName(e.target.value)}
          style={inputStyle}
          maxLength={100}
        />
        <textarea
          placeholder="Описание (необязательно)"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          style={{ ...inputStyle, minHeight: 80, resize: 'vertical' }}
          maxLength={500}
        />
        <input
          type="number"
          placeholder="Цена, ₽ (необязательно)"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          style={inputStyle}
          min={0}
        />
        <div style={{ display: 'flex', gap: 8 }}>
          <button type="button" className="chip" onClick={onClose} style={{ flex: 1 }}>
            Отмена
          </button>
          <button
            type="button"
            className="chip on"
            onClick={submit}
            disabled={!canSubmit}
            style={{ flex: 1, opacity: canSubmit ? 1 : 0.5 }}
          >
            {submitting ? 'Отправка…' : 'Отправить'}
          </button>
        </div>
      </div>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '10px 12px',
  borderRadius: 10,
  border: '1px solid var(--line)',
  background: 'var(--surface-2)',
  color: 'var(--ink)',
  fontSize: 14,
  outline: 'none',
};

function statusTone(s: SuggestionStatus): 'ok' | 'no' {
  return s === 'APPROVED' ? 'ok' : 'no';
}

function statusLabel(s: SuggestionStatus): string {
  if (s === 'PENDING') return 'На рассмотрении';
  if (s === 'APPROVED') return '✓ Одобрено';
  return '✗ Отклонено';
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
}
