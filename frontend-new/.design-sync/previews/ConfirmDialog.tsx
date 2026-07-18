import { ConfirmDialog } from 'telegram-food-bot-frontend-new';
import type { ReactNode } from 'react';

/* ConfirmDialog позиционируется fixed к низу экрана. Для карточки оборачиваем
   в контейнер с transform — он становится containing block для fixed, и диалог
   рендерится внутри рамки превью. */
function Frame({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        position: 'relative',
        width: 400,
        height: 420,
        transform: 'translateZ(0)',
        overflow: 'hidden',
        borderRadius: 12,
        background: 'var(--canvas)',
      }}
    >
      {children}
    </div>
  );
}

export function Destructive() {
  return (
    <Frame>
      <ConfirmDialog
        title="Удалить позицию?"
        description="«Молоко 3.2% ×2» исчезнет из закупки."
        confirmLabel="Удалить"
        destructive
        onConfirm={() => undefined}
        onCancel={() => undefined}
      />
    </Frame>
  );
}

export function Pending() {
  return (
    <Frame>
      <ConfirmDialog
        title="Рассчитать закупку?"
        description="Долги будут созданы и разосланы участникам."
        confirmLabel="Рассчитать"
        pending
        onConfirm={() => undefined}
        onCancel={() => undefined}
      />
    </Frame>
  );
}
