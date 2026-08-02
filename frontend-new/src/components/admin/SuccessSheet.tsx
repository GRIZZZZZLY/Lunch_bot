import { BottomSheet } from '@/components/rl/BottomSheet';
import { Button, Confetti } from '@/components/rl/primitives';
import { Icon } from '@/components/rl/Icon';
import styles from './SuccessSheet.module.css';

interface Props {
  open: boolean;
  closeAt: string;
  onOpen?: () => void;
}

/* Число участников отсюда убрано: страница передавала сюда usersTotal, а тот
   в buildDashboard жёстко равен нулю — после каждого запуска лист сообщал
   «0 участников получили уведомление». Сколько человек получило рассылку,
   фронт не знает, и выдумывать это число незачем.

   Кнопка «Поделиться» тоже убрана: обработчик был `() => undefined`. */
export function SuccessSheet({ open, closeAt, onOpen }: Props) {
  if (!open) return null;

  return (
    <BottomSheet
      title="Опрос запущен"
      onClose={() => onOpen?.()}
      footer={
        <Button variant="primary" style={{ width: '100%' }} onClick={onOpen}>
          Понятно
        </Button>
      }
    >
      <Confetti fire />
      <div className={styles.body}>
        <div className={`anim-pop ${styles.mark}`}>
          <Icon name="check" size={32} stroke={2.2} />
        </div>
        <p className={styles.title}>Голосование отправлено</p>
        <p className={styles.note}>
          Команда получит уведомление. Опрос закроется в{' '}
          <span className="tnum">{closeAt}</span>.
        </p>
      </div>
    </BottomSheet>
  );
}
