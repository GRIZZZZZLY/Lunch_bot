import { useEffect, useState, type ChangeEvent, type ReactNode } from 'react';
import {
  useNotificationSettings,
  useReminderSettings,
  useUpdateNotificationSettings,
  useUpdateReminderSettings,
} from '@/hooks/useAdmin';
import { Button, Field, Switch } from '@/components/rl/primitives';

export function ReminderSettingsCard() {
  const { data: reminder } = useReminderSettings();
  const { data: notif } = useNotificationSettings();
  const updateReminder = useUpdateReminderSettings();
  const updateNotif = useUpdateNotificationSettings();

  const [intervalDays, setIntervalDays] = useState(1);
  const [minDebtAge, setMinDebtAge] = useState(1);
  const [maxReminders, setMaxReminders] = useState(3);
  const [template, setTemplate] = useState('');
  const [enabled, setEnabled] = useState(true);

  useEffect(() => {
    if (reminder) {
      setIntervalDays(reminder.intervalDays);
      setMinDebtAge(reminder.minDebtAge);
      setMaxReminders(reminder.maxReminders);
      setTemplate(reminder.messageTemplate);
      setEnabled(reminder.isEnabled);
    }
  }, [reminder]);

  const saveReminder = () => {
    updateReminder.mutate({ isEnabled: enabled, intervalDays, minDebtAge, maxReminders, messageTemplate: template });
  };

  return (
    <div className="card" style={{ padding: 16 }}>
      <div className="font-head" style={{ fontWeight: 700, fontSize: 'var(--t-16)', marginBottom: 8 }}>
        Авто-напоминания о долгах
      </div>

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

      <Button variant="primary" icon="check" style={{ width: '100%', marginTop: 4 }} loading={updateReminder.isPending} onClick={saveReminder}>
        Сохранить
      </Button>

      <div className="font-head" style={{ fontWeight: 700, fontSize: 'var(--t-16)', margin: '18px 0 4px' }}>
        Уведомления админа
      </div>
      {notif && (
        <div>
          <ToggleRow label="Новый пользователь" value={notif.notifyOnNewUser} onChange={(v) => updateNotif.mutate({ notifyOnNewUser: v })} />
          <ToggleRow label="Новое голосование" value={notif.notifyOnNewPoll} onChange={(v) => updateNotif.mutate({ notifyOnNewPoll: v })} />
          <ToggleRow label="Завершение голосования" value={notif.notifyOnPollEnd} onChange={(v) => updateNotif.mutate({ notifyOnPollEnd: v })} />
          <ToggleRow label="Оплата долга" value={notif.notifyOnDebtPaid} onChange={(v) => updateNotif.mutate({ notifyOnDebtPaid: v })} />
        </div>
      )}
    </div>
  );
}

function ToggleRow({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0' }}>
      <span style={{ fontSize: 'var(--t-15)' }}>{label}</span>
      <Switch on={value} onChange={onChange} aria-label={label} />
    </div>
  );
}

function FormField({ label, htmlFor, children }: { label: string; htmlFor: string; children: ReactNode }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <label htmlFor={htmlFor} style={{ display: 'block', fontSize: 'var(--t-13)', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8 }}>{label}</label>
      {children}
    </div>
  );
}

function NumberField({ id, value, onChange, min }: { id: string; value: number; onChange: (n: number) => void; min?: number }) {
  return (
    <div style={{ width: 120 }}>
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
