import { useNavigate } from 'react-router-dom';
import { useScreenHeader } from '@/app/layouts/screenHeader';
import { EmptyState } from '@/shared/ui';
import { Button } from '@/components/rl/primitives';

export function NotFoundPage() {
  const navigate = useNavigate();
  // Заголовок — h1 в шапке вкладок; у пустого состояния свой, другой текст.
  useScreenHeader('Экран не найден');
  return (
    <div className="rl" style={{ paddingTop: 32 }}>
      <EmptyState
        icon="info"
        title="Такого адреса в приложении нет"
        action={<Button onClick={() => navigate('/', { replace: true })}>На главную</Button>}
      />
    </div>
  );
}
