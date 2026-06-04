import { useState, type ChangeEvent, type ReactNode } from 'react';
import type { CreatePollContext, CreatePollFormState, DurationOption, MenuItemOption } from './types';
import { BottomSheet } from '@/components/rl/BottomSheet';
import { Button, Checkbox, Chip, Field, Switch } from '@/components/rl/primitives';
import { Icon } from '@/components/rl/Icon';

const DURATION_CHIPS: { key: DurationOption; label: string }[] = [
  { key: '15m', label: '15 мин' },
  { key: '30m', label: '30 мин' },
  { key: '1h', label: '1 час' },
  { key: 'custom', label: 'Кастомное' },
];

const WEEKDAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

interface Props {
  open: boolean;
  ctx: CreatePollContext;
  initial?: Partial<CreatePollFormState>;
  submitting?: boolean;
  onClose: () => void;
  onSubmit: (state: CreatePollFormState) => void;
}

function makeInitial(ctx: CreatePollContext, override?: Partial<CreatePollFormState>): CreatePollFormState {
  return {
    title: '',
    duration: '30m',
    recurring: false,
    recurringDays: ['Пн', 'Вт', 'Ср', 'Чт', 'Пт'],
    recurringTime: '12:00',
    selectedItems: [],
    audience: ctx.audiences[0]?.key ?? 'all',
    groupId: ctx.groups?.[0]?.id,
    ...override,
  };
}

function Label({ children }: { children: ReactNode }) {
  return (
    <div style={{ fontSize: 'var(--t-11)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-tertiary)', margin: '16px 0 10px' }}>
      {children}
    </div>
  );
}

export function CreatePollSheet({ open, ctx, initial, submitting, onClose, onSubmit }: Props) {
  const [state, setState] = useState<CreatePollFormState>(() => makeInitial(ctx, initial));

  if (!open) return null;

  const selectedCount = state.selectedItems.length;
  const titleError = state.title.trim().length === 0;
  const itemsError = selectedCount < ctx.minItems;
  const canSubmit = !titleError && !itemsError && !submitting;

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
        <Button variant="primary" icon="flame" style={{ width: '100%' }} loading={submitting} disabled={!canSubmit} onClick={() => canSubmit && onSubmit(state)}>
          Запустить опрос
        </Button>
      }
    >
      {ctx.groups && ctx.groups.length > 1 && (
        <>
          <Label>Группа</Label>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {ctx.groups.map((g) => (
              <Chip key={g.id} on={state.groupId === g.id} onClick={() => !submitting && setState({ ...state, groupId: g.id })}>
                {g.title}
              </Chip>
            ))}
          </div>
        </>
      )}

      <Label>Название</Label>
      <Field
        value={state.title}
        error={titleError}
        disabled={submitting}
        placeholder="Обед 15 апреля"
        onChange={(e: ChangeEvent<HTMLInputElement>) => setState({ ...state, title: e.target.value })}
      />
      {titleError && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 6, fontSize: 'var(--t-13)', color: 'var(--danger)' }}>
          <Icon name="alert" size={14} /> Укажите название — участники увидят его в чате
        </div>
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
          borderRadius: 'var(--r-block)',
          background: 'var(--bg-base)',
        }}
      >
        <div>
          <div className="font-head" style={{ fontSize: 'var(--t-15)', fontWeight: 600 }}>
            Повторяющийся опрос
          </div>
          <div style={{ fontSize: 'var(--t-13)', color: 'var(--text-tertiary)' }}>
            {state.recurring ? 'каждую рабочую неделю' : 'запланировать на несколько дней'}
          </div>
        </div>
        <Switch on={state.recurring} disabled={submitting} onChange={(v) => setState({ ...state, recurring: v })} aria-label="Повторяющийся опрос" />
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
          <Label>Время запуска</Label>
          <Field
            value={state.recurringTime}
            className="tnum"
            disabled={submitting}
            onChange={(e: ChangeEvent<HTMLInputElement>) => setState({ ...state, recurringTime: e.target.value })}
          />
        </>
      )}

      <Label>Блюда</Label>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '8px 12px',
          marginBottom: 8,
          borderRadius: 999,
          border: `1px solid ${itemsError ? 'var(--danger)' : 'var(--border-subtle)'}`,
          fontSize: 'var(--t-11)',
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

      <Label>Участники</Label>
      <div className="card" style={{ overflow: 'hidden' }}>
        <div className="row-divider">
          {ctx.audiences.map((a) => {
            const on = state.audience === a.key;
            return (
              <div
                key={a.key}
                className="list-item"
                style={{ cursor: 'pointer' }}
                onClick={() => !submitting && setState({ ...state, audience: a.key })}
                role="radio"
                aria-checked={on}
              >
                <span
                  style={{
                    width: 20,
                    height: 20,
                    borderRadius: '50%',
                    flexShrink: 0,
                    border: `2px solid ${on ? 'var(--accent)' : 'var(--border-subtle)'}`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {on && <span style={{ width: 9, height: 9, borderRadius: '50%', background: 'var(--accent)' }} />}
                </span>
                <span style={{ flex: 1, fontSize: 'var(--t-15)', fontWeight: 500 }}>{a.label}</span>
                <span style={{ fontSize: 'var(--t-13)', color: 'var(--text-tertiary)' }}>{a.sub}</span>
              </div>
            );
          })}
        </div>
      </div>
    </BottomSheet>
  );
}

function MenuRow({ item, on, disabled, onToggle }: { item: MenuItemOption; on: boolean; disabled?: boolean; onToggle: () => void }) {
  return (
    <div
      className={'dish-row' + (on ? ' is-voted' : '')}
      onClick={() => !disabled && onToggle()}
      role="button"
      aria-pressed={on}
    >
      <Checkbox on={on} onChange={() => !disabled && onToggle()} aria-label={item.name} />
      <div style={{ width: 36, height: 36, borderRadius: 10, flexShrink: 0, background: 'var(--accent-tint)', color: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Icon name="menu" size={18} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 'var(--t-15)', fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.name}</div>
        <div style={{ fontSize: 'var(--t-11)', color: 'var(--text-tertiary)' }} className="tnum">
          {item.restaurant ? `${item.restaurant} · ` : ''}
          {item.price} ₽
        </div>
      </div>
    </div>
  );
}
