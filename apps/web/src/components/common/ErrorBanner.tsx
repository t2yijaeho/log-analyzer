import styles from './ErrorBanner.module.css';

export interface ErrorBannerProps {
  message: string;
  detail?: string;
  onRetry?: () => void;
  onDismiss?: () => void;
}

export function ErrorBanner({ message, detail, onRetry, onDismiss }: ErrorBannerProps) {
  return (
    <div className={styles.banner} role="alert">
      <div className={styles.text}>
        <span className={styles.message}>{message}</span>
        {detail ? <span className={styles.detail}>{detail}</span> : null}
      </div>
      <div className={styles.actions}>
        {onRetry ? (
          <button type="button" className={styles.retry} onClick={onRetry}>
            Retry
          </button>
        ) : null}
        {onDismiss ? (
          <button type="button" className={styles.dismiss} onClick={onDismiss} aria-label="Dismiss">
            ×
          </button>
        ) : null}
      </div>
    </div>
  );
}
