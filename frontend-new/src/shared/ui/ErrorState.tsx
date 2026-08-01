/* Экранное состояние ошибки. Компонент не знает про API: страница передаёт
   тексты (или выбирает пресет kind) и обработчик retry. */
import { Icon, type IconName } from '@/components/rl/Icon';
import { Button } from '@/components/rl/primitives';
import styles from './StateViews.module.css';

export type ErrorKind = 'network' | 'forbidden' | 'notFound';

const PRESETS: Record<ErrorKind, { icon: IconName; title: string; description: string }> = {
  network: {
    icon: 'info',
    title: 'Не удалось загрузить',
    description: 'Проверьте соединение и попробуйте ещё раз.',
  },
  forbidden: {
    icon: 'ban',
    title: 'Нет доступа',
    description: 'У вас нет доступа к этому разделу.',
  },
  notFound: {
    icon: 'info',
    title: 'Не найдено',
    description: 'Возможно, запись была удалена.',
  },
};

export interface ErrorStateProps {
  kind?: ErrorKind;
  title?: string;
  description?: string;
  onRetry?: () => void;
  retryLabel?: string;
}

export function ErrorState({
  kind = 'network',
  title,
  description,
  onRetry,
  retryLabel = 'Повторить',
}: ErrorStateProps) {
  const preset = PRESETS[kind];
  return (
    <div className={styles.state} role="alert">
      <div className={styles.icon}>
        <Icon name={preset.icon} size={24} />
      </div>
      <h3 className={styles.title}>{title ?? preset.title}</h3>
      <p className={styles.description}>{description ?? preset.description}</p>
      {onRetry && (
        <div className={styles.action}>
          <Button variant="secondary" onClick={onRetry}>
            {retryLabel}
          </Button>
        </div>
      )}
    </div>
  );
}
