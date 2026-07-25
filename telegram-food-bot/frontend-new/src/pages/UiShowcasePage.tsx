/* DEV-only витрина примитивов Phase 2C (/dev/ui). В production маршрут
   не регистрируется. Нужна для визуальной проверки и скриншотов тем. */
import { useState } from 'react';
import {
  Button,
  ConfirmDialog,
  EmptyState,
  ErrorState,
  IconButton,
  InlineNotice,
  Skeleton,
  Status,
  TextField,
} from '@/shared/ui';
import { useCountdown } from '@/shared/lib/useCountdown';

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <h2 style={{ margin: 0, fontSize: 'var(--text-13)', fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        {title}
      </h2>
      {children}
    </section>
  );
}

export function UiShowcasePage() {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingOpen, setPendingOpen] = useState(false);
  const [price, setPrice] = useState('0');
  const [countdownEnd] = useState(() => Date.now() + 15 * 60_000);
  const countdown = useCountdown(countdownEnd);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 28, padding: '16px 16px 32px' }}>
      <Section title="Button">
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          <Button>Primary</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="destructive">Destructive</Button>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          <Button disabled>Disabled</Button>
          <Button loading>Загрузка не меняет ширину</Button>
          <IconButton name="plus" aria-label="Добавить" variant="secondary" />
          <IconButton name="x" aria-label="Удалить" variant="destructive" />
        </div>
        <Button block>Block-кнопка на всю ширину</Button>
      </Section>

      <Section title="TextField">
        <TextField label="Название" placeholder="Молоко 3.2%" hint="До 200 символов" />
        <TextField
          label="Цена за всё (×3 шт), ₽"
          inputMode="decimal"
          suffix="₽"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          hint="Цена всей строки, не за штуку. 0 — допустимо."
        />
        <TextField label="С ошибкой" defaultValue="—" error="Слишком длинное название" />
        <TextField label="Отключено" disabled defaultValue="Недоступно" />
      </Section>

      <Section title="Status">
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          <Status tone="accent" icon="clock">Сбор заказов</Status>
          <Status tone="warning" icon="cart">В магазине</Status>
          <Status tone="success" icon="check">Рассчитано</Status>
          <Status tone="danger" icon="ban">Отменено</Status>
          <Status tone="neutral">Запрошено</Status>
          <Status tone="success" icon="check">Куплено</Status>
          <Status tone="danger">Не нашли</Status>
        </div>
      </Section>

      <Section title="Skeleton">
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <Skeleton variant="circle" width={40} height={40} />
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <Skeleton variant="text" width="60%" />
            <Skeleton variant="text" width="35%" />
          </div>
        </div>
        <Skeleton variant="block" height={72} />
      </Section>

      <Section title="InlineNotice">
        <InlineNotice tone="info">Инициатор увидит список после закрытия сбора.</InlineNotice>
        <InlineNotice tone="warning" title="3 позиции без цены">
          Они не попадут в расчёт долгов.
        </InlineNotice>
        <InlineNotice tone="critical" title="Сбор закрывается">
          Добавить позиции больше нельзя.
        </InlineNotice>
      </Section>

      <Section title="EmptyState / ErrorState">
        <EmptyState
          icon="cart"
          title="Пока пусто"
          description="Добавьте первую позицию — остальные подтянутся."
          action={<Button variant="secondary">Добавить</Button>}
        />
        <ErrorState onRetry={() => undefined} />
      </Section>

      <Section title="useCountdown">
        <div className="tnum" style={{ fontSize: 'var(--text-22)', fontWeight: 600 }}>
          {String(countdown.minutes).padStart(2, '0')}:{String(countdown.seconds).padStart(2, '0')}
          <span style={{ fontSize: 'var(--text-13)', color: 'var(--text-tertiary)', marginLeft: 8 }}>
            до конца сбора
          </span>
        </div>
      </Section>

      <Section title="ConfirmDialog">
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          <Button variant="destructive" onClick={() => setConfirmOpen(true)}>
            Удалить позицию
          </Button>
          <Button variant="secondary" onClick={() => setPendingOpen(true)}>
            Pending-вариант
          </Button>
        </div>
        {confirmOpen && (
          <ConfirmDialog
            title="Удалить позицию?"
            description="«Молоко 3.2% ×2» исчезнет из закупки."
            confirmLabel="Удалить"
            destructive
            onConfirm={() => setConfirmOpen(false)}
            onCancel={() => setConfirmOpen(false)}
          />
        )}
        {pendingOpen && (
          <ConfirmDialog
            title="Рассчитать закупку?"
            description="Долги будут созданы и разосланы участникам."
            confirmLabel="Рассчитать"
            pending
            onConfirm={() => undefined}
            onCancel={() => setPendingOpen(false)}
          />
        )}
      </Section>
    </div>
  );
}
