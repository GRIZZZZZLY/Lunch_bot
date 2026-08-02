import { useEffect, useRef, useState, type ChangeEvent, type ReactNode } from 'react';
import type { CreatePollContext, CreatePollFormState, DurationOption, MenuItemOption } from './types';
import { BottomSheet } from '@/components/rl/BottomSheet';
import { Button, Chip, Field, Switch } from '@/components/rl/primitives';
import { Icon } from '@/components/rl/Icon';
import { DAY_LABELS } from '@/lib/schedule';

const DURATION_CHIPS: { key: DurationOption; label: string }[] = [
  { key: '15m', label: '15 мин' },
  { key: '30m', label: '30 мин' },
  { key: '1h', label: '1 час' },
  { key: 'custom', label: 'Кастомное' },
];

const WEEKDAYS = [...DAY_LABELS];

/** Уже настроенное расписание выбранной группы — в подписях формы, а не в формате API. */
export interface SheetSchedule {
  id: number;
  isEnabled: boolean;
  days: string[];
  time: string;
  durationKey: DurationOption;
  itemIds: string[];
}

interface Props {
  open: boolean;
  ctx: CreatePollContext;
  initial?: Partial<CreatePollFormState>;
  submitting?: boolean;
  /** Расписание автозапуска выбранной группы, если оно уже создано. */
  schedule?: SheetSchedule | null;
  deletingSchedule?: boolean;
  onClose: () => void;
  onSubmit: (state: CreatePollFormState) => void;
  onDeleteSchedule?: () => void;
  /** Вызывается при смене группы — родитель перезагружает меню этой группы */
  onGroupChange?: (groupId: string) => void;
}

function makeInitial(ctx: CreatePollContext, override?: Partial<CreatePollFormState>): CreatePollFormState {
  return {
    title: '',
    duration: '30m',
    recurring: false,
    recurringDays: ['Пн', 'Вт', 'Ср', 'Чт', 'Пт'],
    recurringTime: '12:00',
    selectedItems: [],
    groupId: ctx.groups?.[0]?.id,
    ...override,
  };
}

function Label({ children }: { children: ReactNode }) {
  return (
    <div style={{ fontSize: 'var(--text-11)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-tertiary)', margin: '16px 0 10px' }}>
      {children}
    </div>
  );
}

export function CreatePollSheet({
  open,
  ctx,
  initial,
  submitting,
  schedule,
  deletingSchedule,
  onClose,
  onSubmit,
  onDeleteSchedule,
  onGroupChange,
}: Props) {
  const [state, setState] = useState<CreatePollFormState>(() => makeInitial(ctx, initial));

  // Компонент не размонтируется между открытиями — на каждое открытие
  // пересобираем форму, иначе остаётся выбор прошлой сессии (группа, блюда).
  const wasOpen = useRef(open);
  useEffect(() => {
    if (open && !wasOpen.current) setState(makeInitial(ctx, initial));
    wasOpen.current = open;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const selectGroup = (id: string) => {
    if (id === state.groupId) return;
    // Блюда принадлежат меню конкретной группы — при смене группы сбрасываем выбор
    setState((prev) => ({ ...prev, groupId: id, selectedItems: [] }));
    onGroupChange?.(id);
  };

  if (!open) return null;

  const selectedCount = state.selectedItems.length;
  const itemsError = selectedCount < ctx.minItems;
  // Правка существующего расписания: блюда у него свои, заново выбирать их не нужно.
  const editingSchedule = state.recurring && !!schedule;
  const daysMissing = state.recurring && state.recurringDays.length === 0;
  const canSubmit = (editingSchedule || !itemsError) && !daysMissing && !submitting;
  const submitLabel = state.recurring
    ? schedule
      ? 'Сохранить расписание'
      : 'Создать расписание'
    : 'Запустить опрос';

  /** Включение переключателя при живом расписании подставляет его настройки. */
  const setRecurring = (on: boolean) =>
    setState((prev) =>
      on && schedule
        ? {
            ...prev,
            recurring: true,
            recurringDays: schedule.days,
            recurringTime: schedule.time,
            duration: schedule.durationKey,
            selectedItems: schedule.itemIds.length ? schedule.itemIds : prev.selectedItems,
          }
        : { ...prev, recurring: on },
    );

  const toggleItem = (id: string) =>
    setState((prev) => {
      const set = new Set(prev.selectedItems);
      if (set.has(id)) set.delete(id);
      else if (set.size < ctx.maxItems) set.add(id);
      return { ...prev, selectedItems: [...set] };
    });

  const toggleDay = (d: string) =>
    setState((prev) => {
      const set = new Set(prev.recurringDays);
      if (set.has(d)) set.delete(d);
      else set.add(d);
      return { ...prev, recurringDays: [...set] };
    });

  return (
    <BottomSheet
      title="Создать опрос"
      onClose={onClose}
      footer={
        <Button
          variant="primary"
          icon={state.recurring ? 'clock' : 'flame'}
          style={{ width: '100%' }}
          loading={submitting}
          disabled={!canSubmit}
          onClick={() => canSubmit && onSubmit(state)}
        >
          {submitLabel}
        </Button>
      }
    >
      {ctx.groups && ctx.groups.length > 1 && (
        <>
          <Label>Группа</Label>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {ctx.groups.map((g) => (
              <Chip key={g.id} on={state.groupId === g.id} onClick={() => !submitting && selectGroup(g.id)}>
                {g.title}
              </Chip>
            ))}
          </div>
        </>
      )}

      <Label>Длительность</Label>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {DURATION_CHIPS.map((c) => (
          <Chip key={c.key} on={state.duration === c.key} onClick={() => !submitting && setState({ ...state, duration: c.key })}>
            {c.label}
          </Chip>
        ))}
      </div>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          marginTop: 16,
          padding: '12px 14px',
          borderRadius: 'var(--radius-block)',
          background: 'var(--canvas)',
        }}
      >
        <div>
          <div className="font-head" style={{ fontSize: 'var(--text-15)', fontWeight: 600 }}>
            Повторяющийся опрос
          </div>
          <div style={{ fontSize: 'var(--text-13)', color: 'var(--text-tertiary)' }}>
            {schedule
              ? `сейчас ${schedule.time}${schedule.isEnabled ? '' : ' · выключено'} — можно изменить`
              : state.recurring
                ? 'каждую рабочую неделю'
                : 'запланировать на несколько дней'}
          </div>
        </div>
        <Switch on={state.recurring} disabled={submitting} onChange={setRecurring} aria-label="Повторяющийся опрос" />
      </div>

      {state.recurring && (
        <>
          <Label>Дни</Label>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {WEEKDAYS.map((d) => (
              <Chip key={d} on={state.recurringDays.includes(d)} onClick={() => !submitting && toggleDay(d)}>
                {d}
              </Chip>
            ))}
          </div>
          {daysMissing && (
            <div style={{ marginTop: 6, fontSize: 'var(--text-11)', color: 'var(--danger)' }}>
              Выберите хотя бы один день
            </div>
          )}
          <Label>Время запуска</Label>
          <Field
            value={state.recurringTime}
            className="tnum"
            disabled={submitting}
            onChange={(e: ChangeEvent<HTMLInputElement>) => setState({ ...state, recurringTime: e.target.value })}
          />
          {schedule && onDeleteSchedule && (
            <Button
              variant="ghost"
              icon="trash"
              style={{ width: '100%', marginTop: 12 }}
              loading={deletingSchedule}
              disabled={submitting || deletingSchedule}
              onClick={onDeleteSchedule}
            >
              Удалить расписание
            </Button>
          )}
        </>
      )}

      <Label>
        Блюда
        {(() => {
          const g = ctx.groups?.find((x) => x.id === state.groupId);
          return g ? ` — меню «${g.title}»` : '';
        })()}
      </Label>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '8px 12px',
          marginBottom: 8,
          borderRadius: 999,
          border: `1px solid ${itemsError ? 'var(--danger)' : 'var(--divider)'}`,
          fontSize: 'var(--text-11)',
          fontWeight: 600,
          color: itemsError ? 'var(--danger)' : 'var(--text-secondary)',
        }}
      >
        <span>
          ВЫБРАНО <span className="tnum">{selectedCount}</span> из <span className="tnum">{ctx.maxItems}</span>
          {itemsError && ` — минимум ${ctx.minItems}`}
        </span>
        <span style={{ color: 'var(--text-tertiary)' }} className="tnum">
          макс. {ctx.maxItems}
        </span>
      </div>
      <div className="card" style={{ padding: 6 }}>
        {ctx.items.map((it) => (
          <MenuRow key={it.id} item={it} on={state.selectedItems.includes(it.id)} disabled={submitting} onToggle={() => toggleItem(it.id)} />
        ))}
      </div>
    </BottomSheet>
  );
}

function MenuRow({ item, on, disabled, onToggle }: { item: MenuItemOption; on: boolean; disabled?: boolean; onToggle: () => void }) {
  return (
    /* Строка — настоящая кнопка с ролью checkbox: раньше это был div с
       role="button" без tabIndex, и с клавиатуры до него было не добраться —
       единственной остановкой оказывался вложенный чекбокс. Вложенную кнопку
       убрали: квадратик теперь просто рисунок состояния. */
    <button
      type="button"
      role="checkbox"
      aria-checked={on}
      disabled={disabled}
      className={'dish-row' + (on ? ' is-voted' : '')}
      onClick={() => !disabled && onToggle()}
    >
      <span className={'checkbox' + (on ? ' on' : '')} aria-hidden="true">
        {on && <Icon name="check" size={15} stroke={2.4} />}
      </span>
      <div style={{ width: 36, height: 36, borderRadius: 10, flexShrink: 0, background: 'var(--accent-tint)', color: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Icon name="menu" size={18} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 'var(--text-15)', fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.name}</div>
        <div style={{ fontSize: 'var(--text-11)', color: 'var(--text-tertiary)' }} className="tnum">
          {item.restaurant ? `${item.restaurant} · ` : ''}
          {item.price} ₽
        </div>
      </div>
    </button>
  );
}
