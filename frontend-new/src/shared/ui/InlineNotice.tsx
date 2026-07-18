/* Компактное сообщение по месту (предупреждение перед settle и т.п.) —
   вместо превращения каждого статуса в цветную карточку. */
import type { ReactNode } from 'react';
import { Icon, type IconName } from '@/components/rl/Icon';
import styles from './InlineNotice.module.css';

export type NoticeTone = 'info' | 'warning' | 'critical';

const DEFAULT_ICON: Record<NoticeTone, IconName> = {
  info: 'info',
  warning: 'info',
  critical: 'ban',
};

export interface InlineNoticeProps {
  tone?: NoticeTone;
  icon?: IconName;
  title?: string;
  children: ReactNode;
}

export function InlineNotice({ tone = 'info', icon, title, children }: InlineNoticeProps) {
  return (
    <div className={[styles.notice, styles[tone]].join(' ')} role={tone === 'critical' ? 'alert' : 'status'}>
      <span className={styles.noticeIcon}>
        <Icon name={icon ?? DEFAULT_ICON[tone]} size={16} stroke={2} />
      </span>
      <div className={styles.body}>
        {title && <span className={styles.title}>{title}</span>}
        {children}
      </div>
    </div>
  );
}
