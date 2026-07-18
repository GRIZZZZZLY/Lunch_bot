import { ErrorState } from 'telegram-food-bot-frontend-new';

export function Network() {
  return (
    <div style={{ width: 320 }}>
      <ErrorState onRetry={() => undefined} />
    </div>
  );
}

export function Forbidden() {
  return (
    <div style={{ width: 320 }}>
      <ErrorState kind="forbidden" description="Вы не состоите в этой группе." />
    </div>
  );
}

export function NotFound() {
  return (
    <div style={{ width: 320 }}>
      <ErrorState kind="notFound" title="Закупка не найдена" />
    </div>
  );
}
