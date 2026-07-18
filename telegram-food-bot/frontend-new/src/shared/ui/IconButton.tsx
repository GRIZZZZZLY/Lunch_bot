/* Кнопка-иконка 44×44 (полная touch area — в отличие от rl/IconButton с 36px
   у btn--sm). aria-label обязателен. */
import type { ButtonHTMLAttributes } from 'react';
import { Icon, type IconName } from '@/components/rl/Icon';
import styles from './Button.module.css';

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  name: IconName;
  'aria-label': string;
  variant?: 'secondary' | 'ghost' | 'destructive';
  loading?: boolean;
}

export function IconButton({
  name,
  variant = 'ghost',
  loading = false,
  disabled,
  className,
  type = 'button',
  ...rest
}: IconButtonProps) {
  const cls = [styles.button, styles.iconOnly, styles[variant], loading && styles.loading, className]
    .filter(Boolean)
    .join(' ');
  return (
    <button type={type} className={cls} disabled={disabled || loading} aria-busy={loading || undefined} {...rest}>
      <span className={styles.content}>
        <Icon name={name} size={20} />
      </span>
      {loading && <span className={styles.spinner} aria-hidden="true" />}
    </button>
  );
}
