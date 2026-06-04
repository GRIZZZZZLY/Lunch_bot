import { useMemo, useState, type ChangeEvent, type ReactNode } from 'react';
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
import { BackHeader } from '@/components/rl/parts';
import { Badge, Button, Chip, Field, IconButton, type BadgeTone } from '@/components/rl/primitives';
import { BottomSheet } from '@/components/rl/BottomSheet';
import { Icon } from '@/components/rl/Icon';

interface Props {
  onlyMine?: boolean;
}

const STATUS_META: Record<SuggestionStatus, { tone: BadgeTone; label: string }> = {
  PENDING: { tone: 'warning', label: 'На рассмотрении' },
  APPROVED: { tone: 'success', label: 'Одобрено' },
  REJECTED: { tone: 'danger', label: 'Отклонено' },
};

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
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
    if (tab === 'mine') return suggestions.filter((s) => s.suggestedBy === user?.id);
    return suggestions;
  }, [suggestions, tab, user?.id]);

  return (
    <div className="rl">
      <BackHeader
        title="Предложения блюд"
        onBack={() => navigate(-1)}
        action={<IconButton variant="secondary" name="plus" aria-label="Добавить предложение" onClick={() => setFormOpen(true)} />}
      />

      <div style={{ padding: '0 16px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {isAdmin && (
          <div style={{ display: 'flex', gap: 8 }}>
            <Chip on={tab === 'all'} onClick={() => setTab('all')}>
              Все
            </Chip>
            <Chip on={tab === 'mine'} onClick={() => setTab('mine')}>
              Мои
            </Chip>
          </div>
        )}

        {isLoading && items.length === 0 && (
          <div className="card" style={{ padding: 20, color: 'var(--text-secondary)', fontSize: 'var(--t-13)' }}>
            Загрузка…
          </div>
        )}
        {!isLoading && items.length === 0 && (
          <div className="card" style={{ padding: '36px 24px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 60, height: 60, borderRadius: 18, background: 'var(--bg-base)', color: 'var(--text-tertiary)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 6, border: '1px solid var(--border-subtle)' }}>
              <Icon name="sparkle" size={28} />
            </div>
            <div className="font-head" style={{ fontSize: 'var(--t-16)', fontWeight: 600 }}>
              Пока нет предложений
            </div>
            <p style={{ margin: 0, fontSize: 'var(--t-13)', color: 'var(--text-tertiary)', maxWidth: 240, lineHeight: 1.5 }}>
              Нажмите «плюс», чтобы предложить блюдо команде.
            </p>
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
          onSubmit={async (data) => {
            await createMutation.mutateAsync(data);
            setFormOpen(false);
          }}
        />
      )}
    </div>
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
  const meta = STATUS_META[s.status];
  return (
    <div className="card" style={{ padding: 14, display: 'flex', gap: 12, alignItems: 'flex-start' }}>
      <div style={{ width: 44, height: 44, borderRadius: 12, flexShrink: 0, background: 'var(--accent-tint)', color: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Icon name="menu" size={22} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
          <span className="font-head" style={{ fontSize: 'var(--t-15)', fontWeight: 600 }}>
            {s.name}
          </span>
          <span style={{ fontSize: 'var(--t-11)', color: 'var(--text-tertiary)' }} className="tnum">
            {fmtDate(s.createdAt)}
          </span>
        </div>
        {s.description && <div style={{ fontSize: 'var(--t-13)', color: 'var(--text-secondary)', marginTop: 2 }}>{s.description}</div>}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
          <Badge tone={meta.tone}>{meta.label}</Badge>
          {s.price != null && <span className="tnum" style={{ fontSize: 'var(--t-13)', color: 'var(--text-secondary)' }}>{s.price} ₽</span>}
        </div>
        {s.status === 'REJECTED' && s.rejectionReason && (
          <div style={{ fontSize: 'var(--t-13)', color: 'var(--text-tertiary)', marginTop: 6 }}>Причина: {s.rejectionReason}</div>
        )}
        {isAdmin && s.status === 'PENDING' && (
          <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
            <Button variant="success" size="sm" icon="check" style={{ flex: 1 }} onClick={onApprove}>
              Одобрить
            </Button>
            <Button variant="ghost" size="sm" icon="x" style={{ flex: 1 }} onClick={onReject}>
              Отклонить
            </Button>
          </div>
        )}
        {isAdmin && s.status === 'REJECTED' && (
          <div style={{ marginTop: 10 }}>
            <Button variant="ghost" size="sm" icon="trash" style={{ color: 'var(--danger)' }} onClick={onDelete}>
              Удалить
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

function FormField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={{ display: 'block', fontSize: 'var(--t-13)', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8 }}>{label}</label>
      {children}
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
  onSubmit: (d: { name: string; description?: string; price?: number }) => void | Promise<void>;
}) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');

  const canSubmit = name.trim().length >= 2 && !submitting;

  return (
    <BottomSheet
      title="Новое предложение"
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" style={{ flex: 1 }} disabled={submitting} onClick={onClose}>
            Отмена
          </Button>
          <Button
            variant="primary"
            icon="send"
            style={{ flex: 1 }}
            loading={submitting}
            disabled={!canSubmit}
            onClick={() => {
              const parsed = price.trim() ? Number(price) : undefined;
              onSubmit({
                name: name.trim(),
                description: description.trim() || undefined,
                price: Number.isFinite(parsed) ? (parsed as number) : undefined,
              });
            }}
          >
            Отправить
          </Button>
        </>
      }
    >
      <FormField label="Название блюда">
        <Field value={name} onChange={(e: ChangeEvent<HTMLInputElement>) => setName(e.target.value)} placeholder="Пельмени с говядиной" maxLength={100} />
      </FormField>
      <FormField label="Описание">
        <Field
          as="textarea"
          value={description}
          onChange={(e: ChangeEvent<HTMLTextAreaElement>) => setDescription(e.target.value)}
          placeholder="Почему стоит добавить"
          maxLength={500}
        />
      </FormField>
      <FormField label="Цена, ₽">
        <Field value={price} onChange={(e: ChangeEvent<HTMLInputElement>) => setPrice(e.target.value)} placeholder="350" inputMode="numeric" className="tnum" />
      </FormField>
    </BottomSheet>
  );
}
