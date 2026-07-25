import type { ReactNode } from 'react';
import styles from './EmptyState.module.css';

export interface EmptyStateProps {
  title: string;
  description?: string;
  children?: ReactNode;
}

export function EmptyState({ title, description, children }: EmptyStateProps) {
  return (
    <div className={styles.wrap}>
      <div className={styles.title}>{title}</div>
      {description ? <div className={styles.description}>{description}</div> : null}
      {children}
    </div>
  );
}
