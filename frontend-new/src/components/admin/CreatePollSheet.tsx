import { useMemo, useState } from 'react';
import type {
  CreatePollContext,
  CreatePollFormState,
  DurationOption,
  MenuItemOption,
} from './types';
import '@/styles/admin.css';

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

export function CreatePollSheet({
  open,
  ctx,
  initial,
  submitting,
  onClose,
  onSubmit,
}: Props) {
  const [state, setState] = useState<CreatePollFormState>(() => makeInitial(ctx, initial));

  const selectedCount = state.selectedItems.length;
  const titleError = state.title.trim().length === 0;
  const itemsError = selectedCount < ctx.minItems;
  const canSubmit = !titleError && !itemsError && !submitting;

  const previewCloseAt = useMemo(() => {
    switch (state.duration) {
      case '15m':
        return '12:15';
      case '30m':
        return '12:30';
      case '1h':
        return '13:00';
      default:
        return '—';
    }
  }, [state.duration]);

  if (!open) return null;

  function toggleItem(id: string) {
    setState((prev) => {
      const set = new Set(prev.selectedItems);
      if (set.has(id)) set.delete(id);
      else if (set.size < ctx.maxItems) set.add(id);
      return { ...prev, selectedItems: [...set] };
    });
  }

  function toggleDay(d: string) {
    setState((prev) => {
      const set = new Set(prev.recurringDays);
      if (set.has(d)) set.delete(d);
      else set.add(d);
      return { ...prev, recurringDays: [...set] };
    });
  }

  const selectedItems = ctx.items.filter((it) => state.selectedItems.includes(it.id));

  return (
    <div className="bs-frame">
      <div className="sheet-hdr">
        <div className="grab" />
        <div className="r">
          <div className="tt">Создать опрос</div>
          <div className="x" onClick={onClose}>
            ✕
          </div>
        </div>
      </div>

      <div className="content" style={{ paddingTop: 0 }}>
        {ctx.groups && ctx.groups.length > 1 && (
          <div className="form-sec">
            <div className="l">Группа</div>
            <div className="chips-row">
              {ctx.groups.map((g) => (
                <span
                  key={g.id}
                  className={`c-chip${state.groupId === g.id ? ' on' : ''}`}
                  onClick={() => !submitting && setState({ ...state, groupId: g.id })}
                >
                  {g.title}
                </span>
              ))}
            </div>
          </div>
        )}

        <div className="form-sec">
          <div className="l">Основное</div>

          <div className={`field${titleError ? ' err' : ''}`}>
            <div className="lbl">Название</div>
            <input
              className="tin"
              placeholder={titleError ? 'Обязательное поле' : 'Обед 15 апреля'}
              value={state.title}
              disabled={submitting}
              onChange={(e) => setState({ ...state, title: e.target.value })}
            />
            {titleError && (
              <div className="emsg">✗ Укажите название — участники увидят его в чате</div>
            )}
          </div>

          <div className="field">
            <div className="lbl">Длительность</div>
            <div className="chips-row">
              {DURATION_CHIPS.map((c) => (
                <span
                  key={c.key}
                  className={`c-chip${state.duration === c.key ? ' on' : ''}`}
                  onClick={() => !submitting && setState({ ...state, duration: c.key })}
                >
                  {c.label}
                </span>
              ))}
            </div>
          </div>

          <div className="toggle-row">
            <div className="tx">
              <div className="tl">Повторяющийся опрос</div>
              <div className="ts">
                {state.recurring ? 'каждую рабочую неделю' : 'запланировать на несколько дней'}
              </div>
            </div>
            <div
              className={`toggle${state.recurring ? ' on' : ''}`}
              onClick={() => !submitting && setState({ ...state, recurring: !state.recurring })}
            />
          </div>

          {state.recurring && (
            <div className="recur-sub">
              <div className="lbl">Дни</div>
              <div className="chips-row">
                {WEEKDAYS.map((d) => (
                  <span
                    key={d}
                    className={`c-chip${state.recurringDays.includes(d) ? ' on' : ''}`}
                    onClick={() => !submitting && toggleDay(d)}
                  >
                    {d}
                  </span>
                ))}
              </div>
              <div className="lbl" style={{ marginTop: 6 }}>
                Время запуска
              </div>
              <input
                className="tin"
                value={state.recurringTime}
                onChange={(e) => setState({ ...state, recurringTime: e.target.value })}
                style={{ fontFamily: 'var(--mono)', letterSpacing: '0.05em' }}
              />
            </div>
          )}
        </div>

        <div className="form-sec">
          <div className="l">Блюда</div>
          <div
            className="count-pill"
            style={
              itemsError
                ? {
                    borderColor: 'var(--coral-500)',
                    boxShadow: '0 0 0 3px rgba(229,90,79,0.15)',
                  }
                : undefined
            }
          >
            <span style={itemsError ? { color: 'var(--coral-500)' } : undefined}>
              ВЫБРАНО{' '}
              <span className="num">
                {selectedCount} из {ctx.maxItems}
              </span>
              {itemsError && ` — минимум ${ctx.minItems}`}
            </span>
            <span style={{ color: 'var(--ink-3)' }}>макс. {ctx.maxItems}</span>
          </div>
          <div
            style={{
              background: 'var(--card-grad)',
              border: '1px solid var(--line)',
              borderRadius: 14,
              padding: '4px 12px',
            }}
          >
            {ctx.items.map((it) => (
              <MenuRow
                key={it.id}
                item={it}
                on={state.selectedItems.includes(it.id)}
                disabled={submitting}
                onToggle={() => toggleItem(it.id)}
              />
            ))}
          </div>
          <div className="add-manual">
            <span className="l">Добавить вручную</span>
            <span className="p">+</span>
          </div>
        </div>

        <div className="form-sec">
          <div className="l">Участники</div>
          <div
            style={{
              background: 'var(--card-grad)',
              border: '1px solid var(--line)',
              borderRadius: 14,
              padding: '4px 12px',
            }}
          >
            {ctx.audiences.map((a) => (
              <div
                key={a.key}
                className={`radio${state.audience === a.key ? ' on' : ''}`}
                onClick={() => !submitting && setState({ ...state, audience: a.key })}
              >
                <div className="rr" />
                <div
                  className="l"
                  style={{ color: 'var(--ink)', fontSize: 13, fontWeight: 600 }}
                >
                  {a.label}
                </div>
                <div className="s">{a.sub}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="prev-card" style={itemsError ? { opacity: 0.55 } : undefined}>
          <div className="pt">🚀 {state.title || 'Без названия'}</div>
          <div className="ps">
            {state.duration === '15m'
              ? '15 МИН'
              : state.duration === '30m'
              ? '30 МИН'
              : state.duration === '1h'
              ? '1 ЧАС'
              : 'КАСТОМНОЕ'}{' '}
            · 24 УЧАСТНИКА · {previewCloseAt === '—' ? '—' : `ЗАКР. ${previewCloseAt}`}
          </div>
          <div className="pl">
            {selectedItems.map((it) => (
              <div key={it.id} className="pli">
                <span className="em">{it.emoji}</span>
                {it.name}
              </div>
            ))}
            {itemsError && (
              <div
                style={{
                  fontFamily: 'var(--mono)',
                  fontSize: 11,
                  color: 'var(--ink-3)',
                  textAlign: 'center',
                  padding: 6,
                }}
              >
                добавьте ещё {ctx.minItems - selectedCount} блюдо…
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="sticky-foot">
        <button
          type="button"
          className={`btn primary${submitting ? ' loading' : ''}`}
          disabled={!canSubmit}
          onClick={() => canSubmit && onSubmit(state)}
          style={!canSubmit && !submitting ? { opacity: 0.5, pointerEvents: 'none', boxShadow: 'none' } : undefined}
        >
          {submitting ? (
            <>
              <span className="sp" />
              Запускаем…
            </>
          ) : (
            <>Запустить опрос 🚀</>
          )}
        </button>
      </div>
    </div>
  );
}

function MenuRow({
  item,
  on,
  disabled,
  onToggle,
}: {
  item: MenuItemOption;
  on: boolean;
  disabled?: boolean;
  onToggle: () => void;
}) {
  return (
    <div
      className={`mi-row${on ? ' on' : ''}`}
      onClick={() => !disabled && onToggle()}
    >
      <div className="cb" />
      <div className={`ic${item.iconTone && item.iconTone !== 'default' ? ` ${item.iconTone}` : ''}`}>
        {item.emoji}
      </div>
      <div className="md">
        <div className="nm">{item.name}</div>
        <div className="mt">
          {item.restaurant} · {item.price} ₽
        </div>
      </div>
    </div>
  );
}
