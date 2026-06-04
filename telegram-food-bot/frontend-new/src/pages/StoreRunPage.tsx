import { useMemo, useState, type ChangeEvent, type ReactNode } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import {
  useAddStoreItems,
  useCancelStoreRun,
  useDeleteStoreItem,
  useSetItemPrice,
  useSettleStoreRun,
  useStartShopping,
  useStoreRun,
} from '@/hooks/useStoreRun';
import type { StoreItem, StoreRunStatus } from '@/services/store-run.service';
import { BackHeader } from '@/components/rl/parts';
import { Avatar, Badge, Button, Field, IconButton, Segmented, type BadgeTone } from '@/components/rl/primitives';
import { BottomSheet } from '@/components/rl/BottomSheet';
import { Icon, type IconName } from '@/components/rl/Icon';

const STATUS: Record<StoreRunStatus, { tone: BadgeTone; icon: IconName; label: string }> = {
  COLLECTING: { tone: 'accent', icon: 'clock', label: 'Сбор заказов' },
  SHOPPING: { tone: 'warning', icon: 'cart', label: 'В магазине' },
  SETTLED: { tone: 'success', icon: 'check', label: 'Рассчитано' },
  CANCELLED: { tone: 'danger', icon: 'ban', label: 'Отменено' },
};

function priceNum(p: StoreItem['price']): number {
  if (p == null) return 0;
  const n = Number(p);
  return Number.isFinite(n) ? n : 0;
}

export function StoreRunPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const runId = id ? Number(id) : null;
  const valid = runId !== null && Number.isFinite(runId);

  const { user } = useAuth();
  const { data: run, isLoading } = useStoreRun(valid ? runId : null);

  const addItems = useAddStoreItems(runId ?? 0);
  const deleteItem = useDeleteStoreItem(runId ?? 0);
  const setPrice = useSetItemPrice(runId ?? 0);
  const startShopping = useStartShopping(runId ?? 0);
  const settle = useSettleStoreRun(runId ?? 0);
  const cancel = useCancelStoreRun(runId ?? 0);

  const [addOpen, setAddOpen] = useState(false);
  const [priceTarget, setPriceTarget] = useState<StoreItem | null>(null);

  const isInitiator = !!run && !!user && run.initiatorId === user.id;
  const total = useMemo(() => (run?.items ?? []).reduce((s, it) => s + priceNum(it.price), 0), [run]);

  const wrap = (content: ReactNode) => (
    <div className="rl">
      <BackHeader
        title={run ? run.storeName : 'Закупка'}
        onBack={() => navigate(-1)}
        action={run ? <Badge tone={STATUS[run.status].tone} icon={STATUS[run.status].icon}>{STATUS[run.status].label}</Badge> : undefined}
      />
      <div style={{ padding: '0 16px 16px', display: 'flex', flexDirection: 'column', gap: 14 }}>{content}</div>
    </div>
  );

  if (!valid) return wrap(<Info text="Некорректный идентификатор закупки." />);
  if (isLoading) return wrap(<Info text="Загружаем закупку…" />);
  if (!run) return wrap(<Info text="Закупка не найдена." />);

  const active = run.status === 'COLLECTING' || run.status === 'SHOPPING';

  return wrap(
    <>
      {/* meta */}
      <div className="card" style={{ padding: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
        <Avatar name={run.initiator.firstName} size={40} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 'var(--t-13)', color: 'var(--text-tertiary)' }}>
            Инициатор{isInitiator ? ' · это вы' : `: ${run.initiator.firstName}`}
          </div>
          <div className="font-head tnum" style={{ fontSize: 'var(--t-15)', fontWeight: 600 }}>
            {run.items.length} позиций
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 'var(--t-11)', color: 'var(--text-tertiary)' }}>Итого</div>
          <div className="font-head tnum" style={{ fontSize: 'var(--t-18)', fontWeight: 700 }}>{total} ₽</div>
        </div>
      </div>

      {/* items */}
      {run.items.length === 0 ? (
        <Info text="Пока нет позиций. Добавьте, что нужно купить." />
      ) : (
        <div className="card" style={{ overflow: 'hidden' }}>
          <div className="row-divider">
            {run.items.map((it) => {
              const mine = it.userId === user?.id;
              const canDelete = run.status === 'COLLECTING' && (mine || isInitiator);
              return (
                <div key={it.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 13px' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 'var(--t-15)', fontWeight: 500 }}>
                      {it.name}
                      {it.quantity > 1 && <span className="tnum" style={{ color: 'var(--text-tertiary)' }}> ×{it.quantity}</span>}
                    </div>
                    <div style={{ fontSize: 'var(--t-11)', color: 'var(--text-tertiary)' }}>
                      {it.user?.firstName ?? 'Участник'}
                      {it.notes ? ` · ${it.notes}` : ''}
                    </div>
                  </div>
                  {it.status === 'NOT_FOUND' && <Badge tone="danger">Нет</Badge>}
                  {it.price != null && it.status !== 'NOT_FOUND' && (
                    <span className="tnum" style={{ fontSize: 'var(--t-15)', fontWeight: 600, color: 'var(--text-secondary)' }}>{priceNum(it.price)} ₽</span>
                  )}
                  {run.status === 'SHOPPING' && isInitiator && (
                    <IconButton size="sm" variant="ghost" name="edit" aria-label="Цена" onClick={() => setPriceTarget(it)} />
                  )}
                  {canDelete && (
                    <IconButton size="sm" variant="ghost" name="trash" aria-label="Удалить" style={{ color: 'var(--danger)' }} onClick={() => deleteItem.mutate(it.id)} />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* participant: add item (while collecting) */}
      {run.status === 'COLLECTING' && (
        <Button variant="outline" icon="plus" style={{ width: '100%' }} onClick={() => setAddOpen(true)}>
          Добавить позицию
        </Button>
      )}

      {/* initiator controls */}
      {isInitiator && run.status === 'COLLECTING' && (
        <div style={{ display: 'flex', gap: 10 }}>
          <Button variant="danger" icon="x" style={{ flex: 1 }} loading={cancel.isPending} onClick={() => cancel.mutate()}>
            Отменить
          </Button>
          <Button variant="primary" icon="cart" style={{ flex: 1 }} loading={startShopping.isPending} disabled={run.items.length === 0} onClick={() => startShopping.mutate()}>
            Закрыть сбор
          </Button>
        </div>
      )}
      {isInitiator && run.status === 'SHOPPING' && (
        <Button variant="primary" icon="send" style={{ width: '100%' }} loading={settle.isPending} onClick={() => settle.mutate()}>
          Рассчитать и разослать счета
        </Button>
      )}
      {run.status === 'SETTLED' && (
        <div className="card" style={{ padding: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 40, height: 40, borderRadius: 11, flexShrink: 0, background: 'var(--success-tint)', color: 'var(--success)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="check" size={22} stroke={2.2} />
          </div>
          <div>
            <div className="font-head" style={{ fontSize: 'var(--t-15)', fontWeight: 600 }}>Закупка завершена</div>
            <div style={{ fontSize: 'var(--t-13)', color: 'var(--text-tertiary)' }} className="tnum">Счета разосланы · {total} ₽</div>
          </div>
        </div>
      )}

      {!active && run.status === 'CANCELLED' && <Info text="Эта закупка отменена." />}

      {addOpen && (
        <AddItemSheet
          busy={addItems.isPending}
          onClose={() => setAddOpen(false)}
          onSubmit={async (input) => {
            try {
              await addItems.mutateAsync([input]);
              setAddOpen(false);
            } catch {
              /* toast shown */
            }
          }}
        />
      )}
      {priceTarget && (
        <PriceSheet
          item={priceTarget}
          busy={setPrice.isPending}
          onClose={() => setPriceTarget(null)}
          onSubmit={async (payload) => {
            try {
              await setPrice.mutateAsync({ itemId: priceTarget.id, payload });
              setPriceTarget(null);
            } catch {
              /* toast shown */
            }
          }}
        />
      )}
    </>,
  );
}

function Info({ text }: { text: string }) {
  return (
    <div className="card" style={{ padding: 20, color: 'var(--text-secondary)', fontSize: 'var(--t-13)' }}>
      {text}
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

function AddItemSheet({
  busy,
  onClose,
  onSubmit,
}: {
  busy: boolean;
  onClose: () => void;
  onSubmit: (input: { name: string; quantity: number; notes?: string }) => void | Promise<void>;
}) {
  const [name, setName] = useState('');
  const [qty, setQty] = useState('1');
  const [notes, setNotes] = useState('');
  const canSubmit = name.trim().length > 0 && !busy;
  return (
    <BottomSheet
      title="Добавить позицию"
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" style={{ flex: 1 }} disabled={busy} onClick={onClose}>Отмена</Button>
          <Button
            variant="primary"
            icon="plus"
            style={{ flex: 1 }}
            loading={busy}
            disabled={!canSubmit}
            onClick={() => onSubmit({ name: name.trim(), quantity: Math.max(1, Number(qty) || 1), notes: notes.trim() || undefined })}
          >
            Добавить
          </Button>
        </>
      }
    >
      <FormField label="Что купить">
        <Field value={name} onChange={(e: ChangeEvent<HTMLInputElement>) => setName(e.target.value)} placeholder="Молоко, хлеб…" />
      </FormField>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 12 }}>
        <FormField label="Кол-во">
          <Field value={qty} onChange={(e: ChangeEvent<HTMLInputElement>) => setQty(e.target.value)} inputMode="numeric" className="tnum" />
        </FormField>
        <FormField label="Заметка">
          <Field value={notes} onChange={(e: ChangeEvent<HTMLInputElement>) => setNotes(e.target.value)} placeholder="нежирное" />
        </FormField>
      </div>
    </BottomSheet>
  );
}

function PriceSheet({
  item,
  busy,
  onClose,
  onSubmit,
}: {
  item: StoreItem;
  busy: boolean;
  onClose: () => void;
  onSubmit: (payload: { price: number | null; status: 'BOUGHT' | 'NOT_FOUND' }) => void | Promise<void>;
}) {
  const [status, setStatus] = useState<'BOUGHT' | 'NOT_FOUND'>('BOUGHT');
  const [price, setPrice] = useState(item.price != null ? String(priceNum(item.price)) : '');
  const canSubmit = (status === 'NOT_FOUND' || Number(price) > 0) && !busy;
  return (
    <BottomSheet
      title={item.name}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" style={{ flex: 1 }} disabled={busy} onClick={onClose}>Отмена</Button>
          <Button
            variant="primary"
            icon="check"
            style={{ flex: 1 }}
            loading={busy}
            disabled={!canSubmit}
            onClick={() => onSubmit({ price: status === 'NOT_FOUND' ? null : Number(price), status })}
          >
            Сохранить
          </Button>
        </>
      }
    >
      <div style={{ marginBottom: 14 }}>
        <Segmented
          value={status}
          onChange={setStatus}
          options={[
            { value: 'BOUGHT', label: 'Куплено' },
            { value: 'NOT_FOUND', label: 'Не нашли' },
          ]}
        />
      </div>
      {status === 'BOUGHT' && (
        <FormField label="Цена, ₽">
          <Field value={price} onChange={(e: ChangeEvent<HTMLInputElement>) => setPrice(e.target.value)} inputMode="numeric" className="tnum" placeholder="0" />
        </FormField>
      )}
    </BottomSheet>
  );
}
