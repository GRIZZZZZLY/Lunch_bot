/* Профиль (Phase 6, система C). Заглушки удалены сознательно: переключатель
   «Уведомления» ничего не сохранял, строка «Язык» не имела действия —
   не воспроизводить (аудит, план миграции). Тема — реальная функция. */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { getAdminGroups, isGlobalAdmin } from '@/lib/permissions';
import { useMyGroups, usePaymentInfo, usePollHistory, useUpdatePaymentInfo } from '@/hooks/useUser';
import { useStreak } from '@/hooks/useStreak';
import { EditPaymentInfoSheet } from '@/components/profile/EditPaymentInfoSheet';
import { FeedbackModal } from '@/components/modals/FeedbackModal';
import { DonationModal } from '@/components/modals/DonationModal';
import { SchemeThemeToggle } from '@/components/rl/SchemeThemeToggle';
import { Icon } from '@/components/rl/Icon';
import { Status } from '@/shared/ui';
import { pluralize } from '@/shared/lib/pluralize';
import styles from './ProfilePage.module.css';

function maskPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.length < 4) return phone;
  return `+${digits[0]} *** ${digits.slice(-2)}`;
}

export function ProfilePage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: myGroups = [] } = useMyGroups();
  const { data: paymentInfo } = usePaymentInfo();
  const updatePayment = useUpdatePaymentInfo();
  const { data: history = [] } = usePollHistory({ limit: 30 });
  const { streak } = useStreak();

  const [sbpOpen, setSbpOpen] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [donationOpen, setDonationOpen] = useState(false);

  const name = [user?.firstName, user?.lastName].filter(Boolean).join(' ') || 'Гость';
  const handle = user?.username ? `@${user.username}` : 'Участник команды';
  const completed = history.filter((p) => p.status === 'COMPLETED').length;
  const canManage = isGlobalAdmin(user) || getAdminGroups(user, myGroups).length > 0;

  return (
    <div className={`rl ${styles.screen}`}>
      <div className={styles.header}>
        <div className={styles.avatar} aria-hidden>
          {name[0].toUpperCase()}
        </div>
        <div>
          <h1 className={styles.name}>{name}</h1>
          <span className={styles.handle}>{handle}</span>
        </div>
      </div>

      <div className={styles.stats}>
        <div className={styles.stat}>
          <b className="tnum">{history.length}</b>
          <span>голосований</span>
        </div>
        <div className={styles.stat}>
          <b className="tnum">{completed}</b>
          <span>завершено</span>
        </div>
        <div className={styles.stat}>
          <b className="tnum">{streak.current}</b>
          <span>{streak.atRisk ? 'серия · под угрозой' : 'дней серия'}</span>
        </div>
      </div>

      <section className={styles.group} aria-label="Оформление">
        <div className={styles.groupHead}>Оформление</div>
        <div className={styles.row}>
          <div className={styles.rowMain}>
            <span className={styles.rowName}>Тема</span>
            <span className={styles.rowSub}>светлая или тёмная</span>
          </div>
          <SchemeThemeToggle />
        </div>
      </section>

      <section className={styles.group} aria-label="Реквизиты для переводов">
        <div className={styles.groupHead}>Реквизиты для переводов</div>
        <button type="button" className={styles.row} onClick={() => setSbpOpen(true)}>
          <div className={styles.rowMain}>
            <span className={`tnum ${styles.rowName}`}>
              {paymentInfo?.sbpPhone ? `СБП ${maskPhone(paymentInfo.sbpPhone)}` : 'СБП не задано'}
            </span>
            <span className={styles.rowSub}>
              {paymentInfo?.bankName || 'участники увидят реквизиты при расчётах'}
            </span>
          </div>
          <span className={styles.link}>Изменить</span>
        </button>
      </section>

      <section className={styles.group} aria-label="Разделы">
        <button type="button" className={styles.row} onClick={() => navigate('/suggestions/mine')}>
          <div className={styles.rowMain}>
            <span className={styles.rowName}>Мои предложения</span>
          </div>
          <span className={styles.chev}>
            <Icon name="chevronRight" size={16} />
          </span>
        </button>
        <button type="button" className={styles.row} onClick={() => navigate('/poll/history')}>
          <div className={styles.rowMain}>
            <span className={styles.rowName}>История голосований</span>
            {history.length > 0 && (
              <span className={styles.rowSub}>{pluralize(history.length, 'запись', 'записи', 'записей')}</span>
            )}
          </div>
          <span className={styles.chev}>
            <Icon name="chevronRight" size={16} />
          </span>
        </button>
        <button type="button" className={styles.row} onClick={() => navigate('/stats')}>
          <div className={styles.rowMain}>
            <span className={styles.rowName}>Статистика команды</span>
          </div>
          <span className={styles.chev}>
            <Icon name="chevronRight" size={16} />
          </span>
        </button>
        {canManage && (
          <button type="button" className={styles.row} onClick={() => navigate('/admin')}>
            <div className={styles.rowMain}>
              <span className={styles.rowName}>Управление</span>
              <span className={styles.rowSub}>голосования, люди, долги</span>
            </div>
            <Status tone="accent">админ</Status>
          </button>
        )}
      </section>

      <section className={styles.group} aria-label="Обратная связь">
        <button type="button" className={styles.row} onClick={() => setFeedbackOpen(true)}>
          <div className={styles.rowMain}>
            <span className={styles.rowName}>Написать отзыв</span>
          </div>
          <span className={styles.chev}>
            <Icon name="chevronRight" size={16} />
          </span>
        </button>
        <button type="button" className={styles.row} onClick={() => setDonationOpen(true)}>
          <div className={styles.rowMain}>
            <span className={styles.rowName}>Поддержать проект</span>
          </div>
          <span className={styles.chev}>
            <Icon name="chevronRight" size={16} />
          </span>
        </button>
      </section>

      <EditPaymentInfoSheet
        open={sbpOpen}
        initial={paymentInfo}
        busy={updatePayment.isPending}
        onClose={() => setSbpOpen(false)}
        onSubmit={async (data) => {
          await updatePayment.mutateAsync(data);
          setSbpOpen(false);
        }}
      />
      <FeedbackModal open={feedbackOpen} onClose={() => setFeedbackOpen(false)} />
      <DonationModal open={donationOpen} onClose={() => setDonationOpen(false)} sbpPhone={paymentInfo?.sbpPhone} />
    </div>
  );
}
