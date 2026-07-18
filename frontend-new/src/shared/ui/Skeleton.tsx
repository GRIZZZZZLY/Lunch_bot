import type { CSSProperties } from 'react';
import styles from './Skeleton.module.css';

export interface SkeletonProps {
  variant?: 'text' | 'circle' | 'block';
  width?: number | string;
  height?: number | string;
  className?: string;
  style?: CSSProperties;
}

export function Skeleton({ variant = 'block', width, height, className, style }: SkeletonProps) {
  return (
    <span
      aria-hidden="true"
      className={[styles.skeleton, styles[variant], className].filter(Boolean).join(' ')}
      style={{
        display: 'block',
        width: width ?? (variant === 'circle' ? height : '100%'),
        height: height ?? (variant === 'circle' ? width : undefined),
        ...style,
      }}
    />
  );
}
