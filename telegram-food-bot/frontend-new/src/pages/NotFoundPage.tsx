import { useNavigate } from 'react-router-dom';
import { Button, EmptyState } from '@/shared/ui';

export function NotFoundPage() {
  const navigate = useNavigate();
  return (
    <div className="rl" style={{ paddingTop: 32 }}>
      <EmptyState
        icon="info"
        title="Экран не найден"
        description="Такого адреса в приложении нет."
        action={<Button onClick={() => navigate('/', { replace: true })}>На главную</Button>}
      />
    </div>
  );
}
