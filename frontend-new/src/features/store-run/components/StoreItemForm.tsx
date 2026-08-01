/* Общее тело формы позиции для Add/Edit. Валидация: name 1..200 (trim),
   quantity int 1..99, notes ≤500. Сабмит заблокирован при невалидности/busy.
   Ошибка сети не сбрасывает поля — родитель просто не закрывает sheet. */
import { useState } from 'react';
import { TextField } from '@/shared/ui';
import { Button } from '@/components/rl/primitives';

export interface StoreItemFormValues {
  name: string;
  quantity: number;
  notes?: string;
}

const NAME_MAX = 200;
const NOTES_MAX = 500;

export function StoreItemForm({
  initial,
  busy,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  initial?: { name?: string; quantity?: number; notes?: string };
  busy: boolean;
  submitLabel: string;
  onSubmit: (values: StoreItemFormValues) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? '');
  const [qty, setQty] = useState(String(initial?.quantity ?? 1));
  const [notes, setNotes] = useState(initial?.notes ?? '');
  const [touched, setTouched] = useState(false);

  const trimmedName = name.trim();
  const qtyNum = Number(qty);
  const qtyValid = Number.isInteger(qtyNum) && qtyNum >= 1 && qtyNum <= 99;
  const nameError =
    !trimmedName ? 'Укажите название' : trimmedName.length > NAME_MAX ? `Не длиннее ${NAME_MAX} символов` : undefined;
  const qtyError = !qtyValid ? 'Целое число от 1 до 99' : undefined;
  const notesError = notes.trim().length > NOTES_MAX ? `Не длиннее ${NOTES_MAX} символов` : undefined;
  const valid = !nameError && !qtyError && !notesError;

  const submit = () => {
    setTouched(true);
    if (!valid || busy) return;
    onSubmit({
      name: trimmedName,
      quantity: qtyNum,
      notes: notes.trim() ? notes.trim() : undefined,
    });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <TextField
        label="Что купить"
        value={name}
        maxLength={NAME_MAX + 20}
        autoFocus
        placeholder="Молоко, хлеб…"
        error={touched ? nameError : undefined}
        onChange={(e) => setName(e.target.value)}
      />
      <TextField
        label="Количество"
        value={qty}
        inputMode="numeric"
        error={touched ? qtyError : undefined}
        onChange={(e) => setQty(e.target.value)}
      />
      <TextField
        label="Заметка (необязательно)"
        value={notes}
        placeholder="нежирное, синяя пачка…"
        error={touched ? notesError : undefined}
        onChange={(e) => setNotes(e.target.value)}
      />
      <div style={{ display: 'flex', gap: 10 }}>
        <Button variant="secondary" block disabled={busy} onClick={onCancel}>
          Отмена
        </Button>
        <Button block loading={busy} disabled={touched && !valid} onClick={submit}>
          {submitLabel}
        </Button>
      </div>
    </div>
  );
}
