/* Предложения блюд (Phase 5, система C). Участник предлагает и удаляет свои
   (удаление — через ConfirmDialog); админ одобряет/отклоняет (отклонение —
   шторка с необязательной причиной, никаких window.prompt). Фильтр Все/Мои. */
import { useMemo, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import {
  useApproveSuggestion,
  useCreateSuggestion,
  useDeleteSuggestion,
  useRejectSuggestion,
  useSuggestions,
} from '@/hooks/useSuggestions';
import { isGlobalAdmin } from '@/lib/permissions';
import { useScreenHeader } from '@/app/layouts/screenHeader';
import { BottomSheet } from '@/components/rl/BottomSheet';
import { Button, ConfirmDialog, EmptyState, ErrorState, Status, TextField } from '@/shared/ui';
import type { MenuSuggestion, SuggestionStatus } from '@/types/models';
import styles from './SuggestionsPage.module.css';

const STATUS_META: Record<SuggestionStatus, { tone: 'warning' | 'success' | 'danger'; label: string }> = {
  PENDING: { tone: 'warning', label: 'На рассмотрении' },
  APPROVED: { tone: 'success', label: 'Одобрено' },
  REJECTED: { tone: 'danger', label: 'Отклонено' },
};

export function SuggestionsPage({ onlyMine = false }: { onlyMine?: boolean }) {
  const { user } = useAuth();
  const isAdmin = isGlobalAdmin(user);
  useScreenHeader('Предложения блюд');

  const [tab, setTab] = useState<'all' | 'mine'>(onlyMine ? 'mine' : 'all');
  const { data: suggestions = [], isLoading, error, refetch } = useSuggestions();

  const createMutation = useCreateSuggestion();
  const approveMutation = useApproveSuggestion();
  const rejectMutation = useRejectSuggestion();
  const deleteMutation = useDeleteSuggestion();

  const [formOpen, setFormOpen] = useState(false);
  const [rejectTarget, setRejectTarget] = useState<MenuSuggestion | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<MenuSuggestion | null>(null);

  const items = useMemo(
    () => (tab === 'mine' ? suggestions.filter((s) => s.suggestedBy === user?.id) : suggestions),
    [suggestions, tab, user?.id],
  );

  return (
    <div className={`rl ${styles.screen}`}>
      <div className={styles.filters}>
        {(['all', 'mine'] as const).map((t) => (
          <button
            key={t}
            type="button"
            className={`${styles.filter}${tab === t ? ` ${styles.on}` : ''}`}
            onClick={() => setTab(t)}
          >
            {t === 'all' ? 'Все' : 'Мои'}
          </button>
        ))}
      </div>

      {error && (
        <div className={styles.stateWrap}>
          <ErrorState kind="network" onRetry={() => refetch()} />
        </div>
      )}

      {!error && !isLoading && items.length === 0 && (
        <div className={styles.stateWrap}>
          <EmptyState
            icon="sparkle"
            title={tab === 'mine' ? 'У вас пока нет предложений' : 'Пока пусто'}
            description="Предложите блюдо — админ добавит его в меню после одобрения."
            action={<Button onClick={() => setFormOpen(true)}>Предложить блюдо</Button>}
          />
        </div>
      )}

      {!error && items.length > 0 && (
        <div className={styles.group}>
          {items.map((s) => {
            const meta = STATUS_META[s.status] ?? STATUS_META.PENDING;
            const isOwn = s.suggestedBy === user?.id;
            return (
              <div key={s.id} className={styles.row}>
                <div className={styles.top}>
                  <span className={styles.name}>{s.name}</span>
                  {s.price != null && <span className={`tnum ${styles.price}`}>{s.price} ₽</span>}
                </div>
                {s.description && <p className={styles.desc}>{s.description}</p>}
                <div className={styles.metaLine}>
                  <Status tone={meta.tone}>{meta.label}</Status>
                </div>
                {s.status === 'REJECTED' && s.rejectionReason && (
                  <p className={styles.reason}>Причина: {s.rejectionReason}</p>
                )}
                {isAdmin && s.status === 'PENDING' && (
                  <div className={styles.actions}>
                    <Button
                      variant="secondary"
                      loading={approveMutation.isPending && approveMutation.variables === s.id}
                      onClick={() => approveMutation.mutate(s.id)}
                    >
                      Одобрить
                    </Button>
                    <Button variant="ghost" onClick={() => setRejectTarget(s)}>
                      Отклонить
                    </Button>
                  </div>
                )}
                {!isAdmin && isOwn && s.status === 'PENDING' && (
                  <div className={styles.actions}>
                    <Button variant="ghost" onClick={() => setDeleteTarget(s)}>
                      Удалить
                    </Button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {!error && !isLoading && items.length > 0 && (
        <div className={styles.ctaWrap}>
          <Button block onClick={() => setFormOpen(true)}>
            Предложить блюдо
          </Button>
        </div>
      )}

      {formOpen && (
        <SuggestionSheet
          busy={createMutation.isPending}
          onClose={() => setFormOpen(false)}
          onSubmit={(data) => createMutation.mutate(data, { onSuccess: () => setFormOpen(false) })}
        />
      )}

      {rejectTarget && (
        <RejectSheet
          suggestion={rejectTarget}
          busy={rejectMutation.isPending}
          onClose={() => setRejectTarget(null)}
          onSubmit={(reason) =>
            rejectMutation.mutate(
              { id: rejectTarget.id, reason },
              { onSuccess: () => setRejectTarget(null) },
            )
          }
        />
      )}

      {deleteTarget && (
        <ConfirmDialog
          title="Удалить предложение?"
          description={deleteTarget.name}
          confirmLabel="Удалить"
          destructive
          pending={deleteMutation.isPending}
          onConfirm={() => deleteMutation.mutate(deleteTarget.id, { onSuccess: () => setDeleteTarget(null) })}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
}

function SuggestionSheet({
  busy,
  onClose,
  onSubmit,
}: {
  busy: boolean;
  onClose: () => void;
  onSubmit: (data: { name: string; description?: string; price?: number }) => void;
}) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const parsed = price.trim() ? Number(price.trim().replace(',', '.')) : undefined;
  const canSubmit = name.trim().length > 0 && (parsed === undefined || (Number.isFinite(parsed) && parsed > 0)) && !busy;

  return (
    <BottomSheet
      title="Предложить блюдо"
      onClose={onClose}
      closable={!busy}
      footer={
        <>
          <Button variant="secondary" block disabled={busy} onClick={onClose}>
            Отмена
          </Button>
          <Button
            block
            loading={busy}
            disabled={!canSubmit}
            onClick={() =>
              onSubmit({ name: name.trim(), description: description.trim() || undefined, price: parsed })
            }
          >
            Отправить
          </Button>
        </>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <TextField label="Название" value={name} autoFocus placeholder="Поке с лососем" onChange={(e) => setName(e.target.value)} />
        <TextField
          label="Описание (необязательно)"
          value={description}
          placeholder="Рис, лосось, авокадо"
          onChange={(e) => setDescription(e.target.value)}
        />
        <TextField
          label="Примерная цена, ₽ (необязательно)"
          value={price}
          inputMode="decimal"
          placeholder="450"
          onChange={(e) => setPrice(e.target.value)}
        />
      </div>
    </BottomSheet>
  );
}

function RejectSheet({
  suggestion,
  busy,
  onClose,
  onSubmit,
}: {
  suggestion: MenuSuggestion;
  busy: boolean;
  onClose: () => void;
  onSubmit: (reason?: string) => void;
}) {
  const [reason, setReason] = useState('');
  return (
    <BottomSheet
      title={`Отклонить «${suggestion.name}»?`}
      onClose={onClose}
      closable={!busy}
      role="alertdialog"
      footer={
        <>
          <Button variant="secondary" block disabled={busy} onClick={onClose}>
            Отмена
          </Button>
          <Button
            variant="destructive"
            block
            loading={busy}
            onClick={() => onSubmit(reason.trim() || undefined)}
          >
            Отклонить
          </Button>
        </>
      }
    >
      <TextField
        label="Причина (необязательно)"
        value={reason}
        placeholder="Например: уже есть похожее блюдо"
        hint="Автор увидит причину в списке предложений"
        onChange={(e) => setReason(e.target.value)}
      />
    </BottomSheet>
  );
}
