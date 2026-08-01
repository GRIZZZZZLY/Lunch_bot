/* Компактная семантическая метка статуса (COLLECTING/SHOPPING/…,
   REQUESTED/BOUGHT/NOT_FOUND). Текст обязателен — цвет не единственный
   канал различения; иконка усиливает, но не заменяет подпись. */
import type { ReactNode } from 'react';
import { Icon, type IconName } from '@/components/rl/Icon';
import styles from './Status.module.css';

/* Доменные тона (vote/shop/money) отличают «идёт голосование» от «идёт
   закупка»: без них оба состояния носили warning и совпадали тон-в-тон. */
export type StatusTone =
  | 'neutral'
  | 'accent'
  | 'success'
  | 'warning'
  | 'danger'
  | 'info'
  | 'vote'
  | 'shop'
  | 'money';

export interface StatusProps {
  tone?: StatusTone;
  icon?: IconName;
  children: ReactNode;
  className?: string;
}

export function Status({ tone = 'neutral', icon, children, className }: StatusProps) {
  return (
    <span className={[styles.status, styles[tone], className].filter(Boolean).join(' ')}>
      {icon && <Icon name={icon} size={12} stroke={2} />}
      {children}
    </span>
  );
}
