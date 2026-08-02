import { useState, type ChangeEvent, type ReactNode } from 'react';
import type { ReminderSettings } from '@/services/admin.service';
import {
  useNotificationSettings,
  useReminderSettings,
  useUpdateNotificationSettings,
  useUpdateReminderSettings,
} from '@/hooks/useAdmin';
import { Button, Field, Switch } from '@/components/rl/primitives';
import { InlineNotice } from '@/shared/ui';
import styles from './AdminCards.module.css';

export function ReminderSettingsCard() {
  const reminderQuery = useReminderSettings();
  const notifQuery = useNotificationSettings();
  const updateNotif = useUpdateNotificationSettings();
  const reminder = reminderQuery.data;
  const notif = notifQuery.data;

  return (
    <div className={styles.card}>
      <h2 className={styles.title}>Авто-напоминания о долгах</h2>

      {reminderQuery.isLoading && <p className={styles.muted}>Загрузка…</p>}

      {/* Форма показывалась ВСЕГДА, подставляя дефолты `?? 1 / ?? 3 / ?? ''`.
          При упавшем чтении админ видел пустой шаблон и единицы, а «Сохранить»
          записывало это поверх настоящих настроек. Пока не прочитали —
          сохранять нечего. */}
      {reminderQuery.isError && (
        <InlineNotice tone="critical">
          Не удалось прочитать настройки, поэтому форма скрыта — иначе её можно
          было бы сохранить поверх настоящих значений.{' '}
          <button type="button" className={styles.retry} onClick={() => reminderQuery.refetch()}>
            Повторить
          </button>
        </InlineNotice>
      )}

      {reminder && (
        <ReminderSettingsForm key={reminder.updatedAt ?? 'reminder'} initial={reminder} />
      )}

      <h2 className={`${styles.title} ${styles.sectionGap}`}>Уведомления админа</h2>

      {notifQuery.isError ? (
        <InlineNotice tone="critical">
          Не удалось прочитать настройки уведомлений.{' '}
          <button type="button" className={styles.retry} onClick={() => notifQuery.refetch()}>
            Повторить
          </button>
        </InlineNotice>
      ) : (
        notif && (
          <div>
            <ToggleRow label="Новый пользователь" value={notif.notifyOnNewUser} onChange={(v) => updateNotif.mutate({ notifyOnNewUser: v })} />
            <ToggleRow label="Новое голосование" value={notif.notifyOnNewPoll} onChange={(v) => updateNotif.mutate({ notifyOnNewPoll: v })} />
            <ToggleRow label="Завершение голосования" value={notif.notifyOnPollEnd} onChange={(v) => updateNotif.mutate({ notifyOnPollEnd: v })} />
            <ToggleRow label="Оплата долга" value={notif.notifyOnDebtPaid} onChange={(v) => updateNotif.mutate({ notifyOnDebtPaid: v })} />
          </div>
        )
      )}
    </div>
  );
}

function ReminderSettingsForm({ initial }: { initial: ReminderSettings }) {
  const updateReminder = useUpdateReminderSettings();
  const [intervalDays, setIntervalDays] = useState(initial.intervalDays);
  const [minDebtAge, setMinDebtAge] = useState(initial.minDebtAge);
  const [maxReminders, setMaxReminders] = useState(initial.maxReminders);
  const [template, setTemplate] = useState(initial.messageTemplate ?? '');
  const [enabled, setEnabled] = useState(initial.isEnabled);
  const [saveError, setSaveError] = useState<string | null>(null);

  /* Отказ сохранения раньше не показывался: mutate без onError, кнопка
     переставала крутиться, и всё. */
  const saveReminder = () => {
    setSaveError(null);
    updateReminder.mutate(
      { isEnabled: enabled, intervalDays, minDebtAge, maxReminders, messageTemplate: template },
      { onError: () => setSaveError('Не удалось сохранить настройки. Проверьте связь и попробуйте ещё раз.') },
    );
  };

  return (
    <>
      <ToggleRow label="Включены" value={enabled} onChange={setEnabled} />

      <FormField label="Интервал (дней)" htmlFor="reminder-interval-days">
        <NumberField id="reminder-interval-days" value={intervalDays} onChange={setIntervalDays} min={1} />
      </FormField>
      <FormField label="Мин. возраст долга (дней)" htmlFor="reminder-min-debt-age">
        <NumberField id="reminder-min-debt-age" value={minDebtAge} onChange={setMinDebtAge} min={0} />
      </FormField>
      <FormField label="Максимум напоминаний" htmlFor="reminder-max-count">
        <NumberField id="reminder-max-count" value={maxReminders} onChange={setMaxReminders} min={1} />
      </FormField>
      <FormField label="Шаблон сообщения" htmlFor="reminder-template">
        <Field id="reminder-template" as="textarea" rows={3} value={template} onChange={(e: ChangeEvent<HTMLTextAreaElement>) => setTemplate(e.target.value)} />
      </FormField>

      {saveError && (
        <div className={styles.notice}>
          <InlineNotice tone="critical">{saveError}</InlineNotice>
        </div>
      )}

      <Button variant="primary" icon="check" style={{ width: '100%' }} loading={updateReminder.isPending} onClick={saveReminder}>
        Сохранить
      </Button>
    </>
  );
}

function ToggleRow({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className={styles.toggleRow}>
      <span className={styles.toggleLabel}>{label}</span>
      <Switch on={value} onChange={onChange} aria-label={label} />
    </div>
  );
}

function FormField({ label, htmlFor, children }: { label: string; htmlFor: string; children: ReactNode }) {
  return (
    <div className={styles.field}>
      <label htmlFor={htmlFor} className={styles.fieldLabel}>
        {label}
      </label>
      {children}
    </div>
  );
}

function NumberField({ id, value, onChange, min }: { id: string; value: number; onChange: (n: number) => void; min?: number }) {
  return (
    <div className={styles.daysField}>
      <Field
        id={id}
        type="number"
        min={min}
        value={value}
        className="tnum"
        onChange={(e: ChangeEvent<HTMLInputElement>) => onChange(Math.max(min ?? 0, Number(e.target.value) || 0))}
      />
    </div>
  );
}
