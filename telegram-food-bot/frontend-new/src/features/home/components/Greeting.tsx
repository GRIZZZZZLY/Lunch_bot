import { Skeleton } from '@/shared/ui';
import { dateCaption, greetingFor } from '../lib/selectors';
import styles from '../HomePage.module.css';

export function Greeting({ name, loading }: { name?: string; loading?: boolean }) {
  if (loading) {
    return (
      <div className={styles.greeting}>
        <Skeleton variant="text" width={120} height={10} />
        <div style={{ height: 6 }} />
        <Skeleton variant="text" width="55%" height={20} />
      </div>
    );
  }
  const now = new Date();
  return (
    <div className={styles.greeting}>
      <div className={styles.caption}>{dateCaption(now)}</div>
      <h1 className={styles.hello}>
        {greetingFor(now.getHours())}
        {name ? `, ${name}` : ''}
      </h1>
    </div>
  );
}
