import type { ReactNode } from 'react';
import { useAppStore, type AuthStatus } from '@/store/useAppStore';
import { getWebApp } from '@/lib/telegram';
import { bootstrapAuth } from '@/lib/bootstrap';
import { Spinner } from '@/components/rl/primitives';
import { Button } from '@/shared/ui';
import styles from './AuthGate.module.css';

export type AuthView = 'loading' | 'app' | 'error' | 'outside-telegram';

export function resolveAuthView(args: {
  status: AuthStatus;
  hasWebApp: boolean;
  isProd: boolean;
}): AuthView {
  // Вне Telegram в production приложение не работает (валидация initData);
  // в dev действует стаб VITE_DEV_INIT_DATA — пропускаем на общий флоу.
  if (!args.hasWebApp && args.isProd) return 'outside-telegram';
  if (args.status === 'authenticated') return 'app';
  if (args.status === 'error') return 'error';
  return 'loading';
}

export interface AuthGateProps {
  children: ReactNode;
  /** Переопределяются только в тестах. */
  hasWebApp?: boolean;
  isProd?: boolean;
  onRetry?: () => void;
}

export function AuthGate({
  children,
  hasWebApp = !!getWebApp(),
  isProd = import.meta.env.PROD,
  onRetry = () => {
    void bootstrapAuth();
  },
}: AuthGateProps) {
  const status = useAppStore((s) => s.authStatus);
  const authError = useAppStore((s) => s.authError);
  const view = resolveAuthView({ status, hasWebApp, isProd });

  if (view === 'app') return <>{children}</>;

  if (view === 'loading') {
    return (
      <div className={styles.screen} role="status" aria-label="Загрузка">
        <Spinner size={28} />
      </div>
    );
  }

  if (view === 'outside-telegram') {
    return (
      <div className={styles.screen}>
        <div className={styles.box}>
          <h1 className={styles.title}>Откройте в Telegram</h1>
          <p className={styles.text}>
            Рокет-ланч работает внутри Telegram. Откройте приложение через бота.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.screen}>
      <div className={styles.box} role="alert">
        <h1 className={styles.title}>Не удалось войти</h1>
        {authError && <p className={styles.text}>{authError}</p>}
        <Button onClick={onRetry}>Повторить</Button>
      </div>
    </div>
  );
}
