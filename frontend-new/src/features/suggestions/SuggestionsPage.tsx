/* Предложения блюд (Phase 5, система C). Участник предлагает и отзывает свои,
   пока они на рассмотрении; админ группы одобряет/отклоняет. Отклонение —
   шторка с необязательной причиной, одобрение — подтверждение, потому что оно
   необратимо создаёт блюдо в меню.

   Список разложен на две секции: то, что ждёт решения, и то, что уже разобрано.
   Раньше очередь и архив шли подряд одним весом, и админ не отличал работу от
   истории. */
import { useMemo, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import {
  useApproveSuggestion,
  useCreateSuggestion,
  useDeleteSuggestion,
  useRejectSuggestion,
  useSuggestions,
} from '@/hooks/useSuggestions';
import { isGroupAdminRole } from '@/lib/permissions';
import { apiErrorMessage } from '@/lib/apiError';
import { useMyGroups } from '@/hooks/useUser';
import { useAppStore } from '@/store/useAppStore';
import { useScreenHeader } from '@/app/layouts/screenHeader';
import { BottomSheet } from '@/components/rl/BottomSheet';
import {
  ConfirmDialog,
  EmptyState,
  ErrorState,
  InlineNotice,
  Skeleton,
  Status,
  TextField,
} from '@/shared/ui';
import { Button } from '@/components/rl/primitives';
import { formatPrice } from '@/shared/lib/money';
import { useRovingFocus } from '@/shared/lib/useRovingFocus';
import type { MenuSuggestion, SuggestionStatus } from '@/types/models';
import styles from './SuggestionsPage.module.css';

const STATUS_META: Record<SuggestionStatus, { tone: 'warning' | 'success' | 'danger'; label: string }> = {
  PENDING: { tone: 'warning', label: 'На рассмотрении' },
  APPROVED: { tone: 'success', label: 'Одобрено' },
  REJECTED: { tone: 'danger', label: 'Отклонено' },
};

const TABS = [
  { id: 'all', label: 'Все' },
  { id: 'mine', label: 'Мои' },
] as const;

type TabId = (typeof TABS)[number]['id'];

/** «14 июля» — без года, потому что очередь живёт днями, а не годами. */
function formatDay(iso: string): string {
  return new Date(iso).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' });
}

/* Имя без глагола: «предложил» и «предложила» требуют пола, которого у нас
   нет, а «предложил(а)» читается как бланк. */
function authorLine(s: MenuSuggestion, isOwn: boolean): string {
  const who = isOwn ? 'Вы' : (s.suggester?.firstName ?? 'Участник группы');
  return `${who} · ${formatDay(s.createdAt)}`;
}

export function SuggestionsPage({ onlyMine = false }: { onlyMine?: boolean }) {
  const { user } = useAuth();
  useScreenHeader(onlyMine ? 'Мои предложения' : 'Предложения блюд');

  // Предложения per-group: бэк требует groupId на create/approve/reject/delete.
  // Группа — глобальный контекст (fallback на первую активную, если не выбрана).
  const currentGroupId = useAppStore((s) => s.currentGroupId);
  const { data: myGroups = [] } = useMyGroups();
  const activeGroups = useMemo(() => myGroups.filter((g) => g.isActive), [myGroups]);
  const activeGroup = activeGroups.find((g) => String(g.id) === currentGroupId) ?? activeGroups[0];
  const groupId = activeGroup ? String(activeGroup.id) : undefined;

  // Модерация — по роли в группе (совпадает с бэком: menu-suggestion.routes →
  // groupAdminMiddleware, глобальный isAdmin не в счёт).
  const isAdmin = isGroupAdminRole(activeGroup?.role);

  const [tab, setTab] = useState<TabId>(onlyMine ? 'mine' : 'all');
  const tabsFocus = useRovingFocus(TABS.length, TABS.findIndex((t) => t.id === tab));
  const { data: suggestions = [], isLoading, error, refetch } = useSuggestions({ groupId });

  const createMutation = useCreateSuggestion();
  const approveMutation = useApproveSuggestion();
  const rejectMutation = useRejectSuggestion();
  const deleteMutation = useDeleteSuggestion();

  const [formOpen, setFormOpen] = useState(false);
  const [approveTarget, setApproveTarget] = useState<MenuSuggestion | null>(null);
  const [rejectTarget, setRejectTarget] = useState<MenuSuggestion | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<MenuSuggestion | null>(null);

  /* Отказ сервера показываем у той строки, где нажали: раньше 403 на удаление
     не сообщался вообще — диалог оставался открытым, и человек жал снова. */
  const [rowError, setRowError] = useState<{ id: number; text: string } | null>(null);

  const items = useMemo(
    () => (tab === 'mine' ? suggestions.filter((s) => s.suggestedBy === user?.id) : suggestions),
    [suggestions, tab, user?.id],
  );
  const pending = useMemo(() => items.filter((s) => s.status === 'PENDING'), [items]);
  const decided = useMemo(() => items.filter((s) => s.status !== 'PENDING'), [items]);

  const failRow = (id: number, fallback: string) => (e: unknown) =>
    setRowError({ id, text: apiErrorMessage(e, fallback) });

  const row = (s: MenuSuggestion) => {
    const meta = STATUS_META[s.status] ?? STATUS_META.PENDING;
    const isOwn = s.suggestedBy === user?.id;
    return (
      <div key={s.id} className={styles.row}>
        <div className={styles.top}>
          <span className={styles.name}>{s.name}</span>
          {s.price != null && <span className={`tnum ${styles.price}`}>{formatPrice(s.price)}</span>}
        </div>
        {s.description && <p className={styles.desc}>{s.description}</p>}
        {/* Плашка статуса — только у разобранных: она отвечает «какое решение».
            У ожидающих это слово в слово повторяло заголовок секции в сорока
            пикселях выше. */}
        <div className={styles.metaLine}>
          {s.status !== 'PENDING' && <Status tone={meta.tone}>{meta.label}</Status>}
          <span className={styles.author}>{authorLine(s, isOwn)}</span>
        </div>
        {s.status === 'REJECTED' && s.rejectionReason && (
          <p className={styles.reason}>Причина: {s.rejectionReason}</p>
        )}
        {/* critical, а не warning: у него role="alert", и диктор произносит
            отказ сразу — иначе о нём не узнаёт вообще никто. */}
        {rowError?.id === s.id && <InlineNotice tone="critical">{rowError.text}</InlineNotice>}
        {isAdmin && s.status === 'PENDING' && (
          <div className={styles.actions}>
            <Button
              loading={approveMutation.isPending && approveMutation.variables?.id === s.id}
              onClick={() => {
                setRowError(null);
                setApproveTarget(s);
              }}
            >
              Одобрить
            </Button>
            <Button
              variant="secondary"
              onClick={() => {
                setRowError(null);
                setRejectTarget(s);
              }}
            >
              Отклонить
            </Button>
          </div>
        )}
        {!isAdmin && isOwn && s.status === 'PENDING' && (
          <div className={styles.actions}>
            <Button
              variant="ghost"
              onClick={() => {
                setRowError(null);
                setDeleteTarget(s);
              }}
            >
              Отозвать
            </Button>
          </div>
        )}
      </div>
    );
  };

  const section = (title: string, list: MenuSuggestion[]) =>
    list.length > 0 && (
      <section className={styles.section}>
        <h2 className={styles.sectionHead}>
          {title}
          <span className={styles.sectionCount}>· {list.length}</span>
        </h2>
        <div className={styles.group}>{list.map(row)}</div>
      </section>
    );

  return (
    <div className={`rl ${styles.screen}`}>
      <div className={styles.filters} role="tablist" aria-label="Чьи предложения показывать">
        {TABS.map((t, idx) => {
          const { ref, ...roving } = tabsFocus.getItemProps(idx);
          return (
            <button
              key={t.id}
              ref={ref as React.Ref<HTMLButtonElement>}
              type="button"
              role="tab"
              aria-selected={tab === t.id}
              className={`${styles.filter}${tab === t.id ? ` ${styles.on}` : ''}`}
              onClick={() => setTab(t.id)}
              {...roving}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      {error && (
        <div className={styles.stateWrap}>
          <ErrorState kind="network" onRetry={() => refetch()} />
        </div>
      )}

      {/* Пока список едет, экран был просто пустым. */}
      {!error && isLoading && (
        <div className={styles.group} role="status" aria-label="Загрузка предложений">
          {[0, 1, 2].map((i) => (
            <div key={i} className={styles.row}>
              <Skeleton width="60%" height={17} />
              <Skeleton width="35%" height={13} />
            </div>
          ))}
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

      {!error && !isLoading && items.length > 0 && (
        <>
          {section(isAdmin ? 'Ждут решения' : 'На рассмотрении', pending)}
          {section('Разобранные', decided)}
          <div className={styles.ctaWrap}>
            <Button block onClick={() => setFormOpen(true)}>
              Предложить блюдо
            </Button>
          </div>
        </>
      )}

      {formOpen && (
        <SuggestionSheet
          busy={createMutation.isPending}
          onClose={() => setFormOpen(false)}
          onSubmit={(data, onFail) =>
            createMutation.mutate(
              { data, groupId },
              {
                onSuccess: () => setFormOpen(false),
                onError: (e) => onFail(apiErrorMessage(e, 'Не удалось отправить предложение')),
              },
            )
          }
        />
      )}

      {/* Одобрение необратимо: блюдо сразу появляется в меню группы. */}
      {approveTarget && (
        <ConfirmDialog
          title="Добавить блюдо в меню?"
          description={`«${approveTarget.name}» появится в меню группы, и вернуть это одним нажатием не получится.`}
          confirmLabel="Одобрить"
          pending={approveMutation.isPending}
          onConfirm={() =>
            approveMutation.mutate(
              { id: approveTarget.id, groupId },
              {
                onSuccess: () => setApproveTarget(null),
                onError: (e) => {
                  failRow(approveTarget.id, 'Не удалось одобрить предложение')(e);
                  setApproveTarget(null);
                },
              },
            )
          }
          onCancel={() => setApproveTarget(null)}
        />
      )}

      {rejectTarget && (
        <RejectSheet
          suggestion={rejectTarget}
          busy={rejectMutation.isPending}
          onClose={() => setRejectTarget(null)}
          onSubmit={(reason, onFail) =>
            rejectMutation.mutate(
              { id: rejectTarget.id, reason, groupId },
              {
                onSuccess: () => setRejectTarget(null),
                onError: (e) => onFail(apiErrorMessage(e, 'Не удалось отклонить предложение')),
              },
            )
          }
        />
      )}

      {deleteTarget && (
        <ConfirmDialog
          title="Отозвать предложение?"
          description={deleteTarget.name}
          confirmLabel="Отозвать"
          destructive
          pending={deleteMutation.isPending}
          onConfirm={() =>
            deleteMutation.mutate(
              { id: deleteTarget.id, groupId },
              {
                onSuccess: () => setDeleteTarget(null),
                onError: (e) => {
                  failRow(deleteTarget.id, 'Не удалось отозвать предложение')(e);
                  setDeleteTarget(null);
                },
              },
            )
          }
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
  onSubmit: (
    data: { name: string; description?: string; price?: number },
    onFail: (text: string) => void,
  ) => void;
}) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [failure, setFailure] = useState<string | null>(null);
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
            onClick={() => {
              setFailure(null);
              onSubmit(
                { name: name.trim(), description: description.trim() || undefined, price: parsed },
                setFailure,
              );
            }}
          >
            Отправить
          </Button>
        </>
      }
    >
      <div className={styles.form}>
        {/* Текст в шторке остаётся вместе с заполненной формой: переписывать
            название заново из-за обрыва связи человек не должен. */}
        {failure && <InlineNotice tone="critical">{failure}</InlineNotice>}
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
          hint="Админ группы посмотрит предложение и добавит блюдо в меню."
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
  onSubmit: (reason: string | undefined, onFail: (text: string) => void) => void;
}) {
  const [reason, setReason] = useState('');
  const [failure, setFailure] = useState<string | null>(null);
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
            variant="danger"
            block
            loading={busy}
            onClick={() => {
              setFailure(null);
              onSubmit(reason.trim() || undefined, setFailure);
            }}
          >
            Отклонить
          </Button>
        </>
      }
    >
      <div className={styles.form}>
        {failure && <InlineNotice tone="critical">{failure}</InlineNotice>}
        <TextField
          label="Причина (необязательно)"
          value={reason}
          placeholder="Например: уже есть похожее блюдо"
          hint="Автор увидит причину в списке предложений"
          onChange={(e) => setReason(e.target.value)}
        />
      </div>
    </BottomSheet>
  );
}
