import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ChevronLeft, Loader2, ShoppingBag } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useStoreRun } from '@/hooks/queries/useStoreRunQueries';
import { useAuth } from '@/hooks/useAuth';
import { ParticipantView } from '@/components/store-run/ParticipantView';
import { InitiatorView } from '@/components/store-run/InitiatorView';

export const StoreRunPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const storeRunId = id ? Number(id) : null;
  const {
    data: run,
    isLoading,
    error,
  } = useStoreRun(storeRunId, { enabled: !!storeRunId });

  const handleBack = () => {
    navigate('/');
  };

  if (!storeRunId) {
    return <NotFound onBack={handleBack} />;
  }

  if (isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !run) {
    return <NotFound onBack={handleBack} />;
  }

  if (!user) {
    return (
      <div className="p-4 text-center text-sm text-muted-foreground">
        Требуется авторизация.
      </div>
    );
  }

  const isInitiator = run.initiatorId === user.id;

  return (
    <div className="mx-auto max-w-xl p-4">
      {/* Header */}
      <div className="mb-4 flex items-center gap-3">
        <button
          type="button"
          onClick={handleBack}
          className="rounded-lg p-2 text-foreground transition-colors hover:bg-muted"
          aria-label="Назад"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <div className="flex items-center gap-2">
          <ShoppingBag className="h-5 w-5 text-mint-600 dark:text-mint-400" />
          <h1 className="text-lg font-semibold text-foreground">«{run.storeName}»</h1>
        </div>
      </div>

      {isInitiator ? (
        <InitiatorView run={run} onRunDone={handleBack} />
      ) : (
        <ParticipantView run={run} currentUserId={user.id} />
      )}
    </div>
  );
};

const NotFound: React.FC<{ onBack: () => void }> = ({ onBack }) => (
  <div className="mx-auto max-w-xl space-y-4 p-6 text-center">
    <p className="text-lg font-semibold text-foreground">Забег не найден</p>
    <p className="text-sm text-muted-foreground">
      Возможно, забег уже завершён или отменён.
    </p>
    <Button onClick={onBack}>На главную</Button>
  </div>
);

export default StoreRunPage;
