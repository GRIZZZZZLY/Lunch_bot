/* Создание закупки (вызывается с Home). Пресеты сбора — COLLECT_PRESETS
   [5,15,30], в диапазоне backend 3..30 (фикс B1).

   Магазин задаётся одним из двух способов: чипом из справочника группы (тогда
   уходит `storeId`, и имя берёт сервер) или свободным вводом (тогда уходит
   `storeName`, и сервер сам заводит запись). Правка поля сбрасывает выбранный
   чип — иначе показанное имя и отправленный id могли бы разойтись. */
import { lazy, Suspense, useState, type ChangeEvent, type ReactNode } from 'react';
import { BottomSheet } from '@/components/rl/BottomSheet';
import { Button, Chip, Field } from '@/components/rl/primitives';
import type { GroupStore } from '@/services/group-store.service';
import { COLLECT_PRESETS } from '../lib/selectors';

/* Шторка живёт в чанке главной, а главная у порога скорости: статический
   импорт подсказки добавлял к нему 3,4 КБ. Отдельным чанком она грузится,
   только когда шторку открыли. */
const PaymentMissingNotice = lazy(() =>
  import('@/components/profile/PaymentMissingNotice').then((m) => ({
    default: m.PaymentMissingNotice,
  })),
);
import { StoreChips } from './StoreChips';

function FormField({ label, htmlFor, children }: { label: string; htmlFor?: string; children: ReactNode }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label htmlFor={htmlFor} style={{ display: 'block', fontSize: 'var(--text-13)', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8 }}>{label}</label>
      {children}
    </div>
  );
}

export interface CreateStoreRunInput {
  storeId?: number | null;
  storeName?: string;
  collectMinutes: number;
}

export function CreateStoreRunSheet({
  open,
  busy,
  stores = [],
  onClose,
  onSubmit,
  onManageStore,
}: {
  open: boolean;
  busy: boolean;
  stores?: GroupStore[];
  onClose: () => void;
  onSubmit: (input: CreateStoreRunInput) => void | Promise<void>;
  onManageStore?: (store: GroupStore) => void;
}) {
  const [freeName, setFreeName] = useState('');
  const [storeId, setStoreId] = useState<number | null>(null);
  const [mins, setMins] = useState<number>(COLLECT_PRESETS[COLLECT_PRESETS.length - 1]);

  if (!open) return null;
  /* Выбранный магазин читается из свежего списка, а не из копии: после
     переименования поле показывает новое имя, после «Убрать из подсказок» выбор
     снимается. Раньше уходил id скрытого магазина, и сервер отвечал «магазина
     нет». */
  const selected = storeId !== null ? (stores.find((s) => s.id === storeId) ?? null) : null;
  const name = selected ? selected.name : freeName;
  const canSubmit = (selected !== null || freeName.trim().length > 0) && !busy;

  const submit = () =>
    onSubmit(
      selected
        ? { storeId: selected.id, collectMinutes: mins }
        : { storeName: freeName.trim(), collectMinutes: mins },
    );

  return (
    <BottomSheet
      title="Новая закупка"
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" style={{ flex: 1 }} disabled={busy} onClick={onClose}>
            Отмена
          </Button>
          <Button variant="primary" icon="cart" style={{ flex: 1 }} loading={busy} disabled={!canSubmit} onClick={submit}>
            Открыть сбор
          </Button>
        </>
      }
    >
      <FormField label="Откуда заказываем" htmlFor="store-run-name">
        <StoreChips
          stores={stores}
          selectedId={selected?.id ?? null}
          onSelect={(store) => {
            setStoreId(store.id);
            // иначе скрытие чипа вернуло бы в поле давно набранный текст
            setFreeName('');
          }}
          onManage={(store) => onManageStore?.(store)}
        />
        <Field
          id="store-run-name"
          value={name}
          placeholder="Например: Лента у метро"
          onChange={(e: ChangeEvent<HTMLInputElement>) => {
            setFreeName(e.target.value);
            setStoreId(null);
          }}
        />
      </FormField>
      <FormField label="Сбор заказов">
        <div style={{ display: 'flex', gap: 8 }}>
          {COLLECT_PRESETS.map((m) => (
            <Chip key={m} on={mins === m} onClick={() => setMins(m)}>
              {m} мин
            </Chip>
          ))}
        </div>
      </FormField>
      {/* Деньги за закупку получает тот, кто её открыл: сказать про пустые
          реквизиты надо до покупок, а не когда должникам некуда переводить. */}
      <Suspense fallback={null}>
        <PaymentMissingNotice>
          Реквизитов нет — участники не узнают, куда переводить вам за покупки.
        </PaymentMissingNotice>
      </Suspense>
    </BottomSheet>
  );
}
