/* Форма блюда (создание/правка) — шторка на shared/ui. В режиме правки
   содержит удаление (через ConfirmDialog) — из строки списка оно убрано. */
import { useEffect, useRef, useState } from 'react';
import { BottomSheet } from '@/components/rl/BottomSheet';
import { Switch } from '@/components/rl/primitives';
import { ConfirmDialog, TextField } from '@/shared/ui';
import { Button } from '@/components/rl/primitives';
import type { MenuItem } from '@/types/models';
import styles from '../MenuPage.module.css';

export interface DishInput {
  name: string;
  price: number;
  description?: string;
  category?: string;
  isActive?: boolean;
}

export function DishSheet({
  title,
  initial,
  busy,
  deleting,
  onClose,
  onSubmit,
  onDelete,
}: {
  title: string;
  initial?: MenuItem;
  busy: boolean;
  deleting?: boolean;
  onClose: () => void;
  onSubmit: (input: DishInput) => void;
  onDelete?: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? '');
  const [desc, setDesc] = useState(initial?.description ?? '');
  // `String(null)` давал в поле цены литерал «null»: блюдо без суммы редактируется
  // как новое, с пустым полем (валидация всё равно требует price > 0).
  const [price, setPrice] = useState(initial?.price != null ? String(initial.price) : '');
  const [cat, setCat] = useState(initial?.category ?? '');
  const [active, setActive] = useState(initial?.isActive !== false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const submittingRef = useRef(false);
  const wasBusyRef = useRef(busy);

  useEffect(() => {
    if (wasBusyRef.current && !busy) {
      submittingRef.current = false;
    }
    wasBusyRef.current = busy;
  }, [busy]);

  const priceNum = Number(price.trim().replace(',', '.'));
  const canSubmit =
    name.trim().length > 0 &&
    Number.isFinite(priceNum) &&
    priceNum > 0 &&
    !busy;

  const submit = () => {
    if (submittingRef.current) return;
    submittingRef.current = true;
    onSubmit({
      name: name.trim(),
      price: priceNum,
      description: desc.trim() || undefined,
      category: cat.trim() || undefined,
      isActive: active,
    });
  };

  return (
    <BottomSheet
      title={title}
      onClose={onClose}
      closable={!busy && !deleting}
      footer={
        <>
          <Button variant="secondary" block disabled={busy || deleting} onClick={onClose}>
            Отмена
          </Button>
          <Button
            block
            loading={busy}
            disabled={!canSubmit}
            onClick={submit}
          >
            Сохранить
          </Button>
        </>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <TextField
          label="Название"
          value={name}
          autoFocus={!initial}
          placeholder="Пельмени с говядиной"
          onChange={(e) => setName(e.target.value)}
        />
        <TextField
          label="Описание (необязательно)"
          value={desc}
          placeholder="Сметана, укроп, свежий чеснок"
          onChange={(e) => setDesc(e.target.value)}
        />
        <div className={styles.formGrid}>
          <TextField
            label="Цена, ₽"
            value={price}
            inputMode="decimal"
            placeholder="350"
            onChange={(e) => setPrice(e.target.value)}
          />
          <TextField
            label="Категория"
            value={cat}
            placeholder="Горячее"
            onChange={(e) => setCat(e.target.value)}
          />
        </div>
        <div className={styles.activeRow}>
          <div>
            <div className={styles.name}>Активно</div>
            <div className={styles.desc}>Показывать в голосовании</div>
          </div>
          <Switch on={active} onChange={setActive} aria-label="Активно" />
        </div>
        {/* Удаление за разделителем и по содержимому, а не во всю ширину прямо
            над «Сохранить»: раньше палец шёл к сохранению над красной ссылкой. */}
        {initial && onDelete && (
          <div className={styles.dangerZone}>
            <button type="button" className={styles.deleteLink} onClick={() => setConfirmDelete(true)}>
              Удалить блюдо
            </button>
          </div>
        )}
      </div>

      {confirmDelete && initial && (
        <ConfirmDialog
          title={`Удалить «${initial.name}»?`}
          /* Раньше здесь было «исчезнет из каталога и истории голосований» — и
             так оно и работало: удаление стирало победителей в завершённых
             опросах. Теперь история остаётся, и текст об этом говорит. */
          description="Блюдо исчезнет из меню и голосований. Прошлые опросы и статистику это не тронет. Вернуть блюдо из приложения нельзя."
          confirmLabel="Удалить"
          destructive
          pending={!!deleting}
          onConfirm={() => onDelete?.()}
          onCancel={() => setConfirmDelete(false)}
        />
      )}
    </BottomSheet>
  );
}
