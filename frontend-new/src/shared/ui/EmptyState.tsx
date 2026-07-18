import type { ReactNode } from 'react';
import { Icon, type IconName } from '@/components/rl/Icon';
import styles from './StateViews.module.css';

export interface EmptyStateProps {
  icon?: IconName;
  title: string;
  description?: string;
  action?: ReactNode;
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className={styles.state}>
      {icon && (
        <div className={styles.icon}>
          <Icon name={icon} size={24} />
        </div>
      )}
      <h3 className={styles.title}>{title}</h3>
      {description && <p className={styles.description}>{description}</p>}
      {action && <div className={styles.action}>{action}</div>}
    </div>
  );
}
