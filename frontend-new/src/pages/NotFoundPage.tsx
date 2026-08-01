import { useNavigate } from 'react-router-dom';
import { EmptyState } from '@/shared/ui';
import { Button } from '@/components/rl/primitives';

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
