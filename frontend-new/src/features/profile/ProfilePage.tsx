/* Профиль (Phase 6, система C). Заглушки удалены сознательно: переключатель
   «Уведомления» ничего не сохранял, строка «Язык» не имела действия —
   не воспроизводить (аудит, план миграции). Тема — реальная функция. */
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { getAdminGroups, isGlobalAdmin } from '@/lib/permissions';
import {
  PROFILE_HISTORY_LIMIT,
  useMyGroups,
  usePaymentInfo,
  usePollHistory,
  useUpdatePaymentInfo,
} from '@/hooks/useUser';
import { useAppStore } from '@/store/useAppStore';
import { useStreak } from '@/hooks/useStreak';
import { EditPaymentInfoSheet } from '@/components/profile/EditPaymentInfoSheet';
import { FeedbackModal } from '@/components/modals/FeedbackModal';
import { DonationModal } from '@/components/modals/DonationModal';
import { SchemeThemeToggle } from '@/components/rl/SchemeThemeToggle';
import { Icon } from '@/components/rl/Icon';
import { InlineNotice, Status } from '@/shared/ui';
import { pluralForm, pluralize } from '@/shared/lib/pluralize';
import { formatPhone } from '@/shared/lib/phone';
import styles from './ProfilePage.module.css';

export function ProfilePage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const currentGroupId = useAppStore((s) => s.currentGroupId);
  const { data: myGroups = [] } = useMyGroups();
  const { data: paymentInfo } = usePaymentInfo();
  const updatePayment = useUpdatePaymentInfo();
  /* Тот же лимит, что и у useStreak, — иначе ключи разойдутся и профиль
     сходит за историей дважды. */
  const {
    data: history = [],
    isLoading: historyLoading,
    isError: historyFailed,
    refetch: refetchHistory,
  } = usePollHistory({ limit: PROFILE_HISTORY_LIMIT });
  const { streak } = useStreak();

  const [sbpOpen, setSbpOpen] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [donationOpen, setDonationOpen] = useState(false);

  const name = [user?.firstName, user?.lastName].filter(Boolean).join(' ') || 'Гость';
  const handle = user?.username ? `@${user.username}` : 'Участник команды';
  const completed = history.filter((p) => p.status === 'COMPLETED').length;
  const canManage = isGlobalAdmin(user) || getAdminGroups(user, myGroups).length > 0;
  const activeGroup = useMemo(
    () => myGroups.find((g) => String(g.id) === currentGroupId),
    [myGroups, currentGroupId],
  );

  /* История упирается в лимит страницы. Раньше её длина выводилась как итог, и
     у активного участника показатель замирал на потолке, выглядя фактом.
     Дойдя до потолка, честнее сказать «90+», чем назвать точное число. */
  const atCap = history.length >= PROFILE_HISTORY_LIMIT;
  /* Нечитаемая история — это «неизвестно», а не «ты ни разу не голосовал».
     Раньше отказ сервера давал три уверенных нуля. */
  const statsUnknown = historyLoading || historyFailed;

  const statValue = (n: number, suffix = false) =>
    statsUnknown ? '—' : `${n}${suffix && atCap ? '+' : ''}`;

  return (
    <div className={`rl ${styles.screen}`}>
      <div className={styles.header}>
        <div className={styles.avatar} aria-hidden>
          {name[0].toUpperCase()}
        </div>
        <div className={styles.headerMain}>
          <h1 className={styles.name}>{name}</h1>
          <span className={styles.handle}>{handle}</span>
        </div>
      </div>

      <div className={styles.stats}>
        <div className={styles.stat}>
          <b className="tnum">{statValue(history.length, true)}</b>
          <span>{pluralForm(history.length, 'голосование', 'голосования', 'голосований')}</span>
        </div>
        <div className={styles.stat}>
          <b className="tnum">{statValue(completed)}</b>
          <span>завершено</span>
        </div>
        <div className={styles.stat}>
          <b className="tnum">{statValue(streak.current)}</b>
          <span>{pluralForm(streak.current, 'день', 'дня', 'дней')} подряд</span>
        </div>
      </div>

      {/* Показатели считаются по текущей группе — той, что выбрана на главной и
          в меню. Без этой строки числа молча менялись при переключении. */}
      {activeGroup && !statsUnknown && (
        <p className={styles.statsNote}>по группе «{activeGroup.title}»</p>
      )}

      {historyFailed && (
        <InlineNotice tone="critical">
          Не удалось прочитать историю голосований, поэтому показатели скрыты.{' '}
          <button type="button" className={styles.retry} onClick={() => refetchHistory()}>
            Повторить
          </button>
        </InlineNotice>
      )}

      {/* Серия под угрозой — это призыв к действию, а не ярлык. Раньше подпись
          показателя подменялась на «серия · под угрозой», и число оставалось
          без единицы измерения. */}
      {!statsUnknown && streak.atRisk && streak.current > 0 && (
        <InlineNotice tone="warning">
          Серия прервётся, если сегодня не проголосовать.
        </InlineNotice>
      )}

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
        {/* Подсказка стоит отдельной строкой, а не в подписи ряда: там она
            исчезала, как только человек указывал банк, — то есть ровно тогда,
            когда реквизиты начинали кому-то показываться. */}
        <p className={styles.groupHint}>Участники увидят их, когда дойдёт до расчёта.</p>
        <button type="button" className={styles.row} onClick={() => setSbpOpen(true)}>
          <div className={styles.rowMain}>
            {/* Номер целиком, не «+7 *** 33»: строка нужна, чтобы убедиться,
                что деньги придут куда надо, и маска этому мешала. */}
            <span className={`tnum ${styles.rowName}`}>
              {paymentInfo?.sbpPhone ? `СБП ${formatPhone(paymentInfo.sbpPhone)}` : 'СБП не задано'}
            </span>
            <span className={styles.rowSub}>
              {paymentInfo?.sbpPhone
                ? paymentInfo.bankName || 'банк не указан'
                : 'без них вам не смогут перевести деньги'}
            </span>
          </div>
          <span className={styles.link}>Изменить</span>
        </button>
      </section>

      <section className={styles.group} aria-label="Разделы">
        {/* Заголовок был только в aria-label: экранный диктор называл раздел,
            а глазами его не было видно. */}
        <div className={styles.groupHead}>Разделы</div>
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
            {!statsUnknown && history.length > 0 && (
              <span className={styles.rowSub}>
                {atCap ? 'последние ' : ''}
                {pluralize(history.length, 'запись', 'записи', 'записей')}
              </span>
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
        <div className={styles.groupHead}>Обратная связь</div>
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
          /* Промис возвращается листу: он показывает отказ сам. Раньше отказ
             не показывался нигде и висел необработанным отклонением. */
          await updatePayment.mutateAsync(data);
          setSbpOpen(false);
        }}
      />
      <FeedbackModal open={feedbackOpen} onClose={() => setFeedbackOpen(false)} />
      <DonationModal open={donationOpen} onClose={() => setDonationOpen(false)} sbpPhone={paymentInfo?.sbpPhone} />
    </div>
  );
}
