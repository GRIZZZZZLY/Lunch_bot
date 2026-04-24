import { useEffect, useState } from 'react';
import {
  useNotificationSettings,
  useReminderSettings,
  useUpdateNotificationSettings,
  useUpdateReminderSettings,
} from '@/hooks/useAdmin';

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
    updateReminder.mutate({
      isEnabled: enabled,
      intervalDays,
      minDebtAge,
      maxReminders,
      messageTemplate: template,
    });
  };

  return (
    <div style={cardStyle}>
      <div style={titleStyle}>Авто-напоминания о долгах</div>

      <Toggle
        label="Включены"
        value={enabled}
        onChange={setEnabled}
      />

      <Field label="Интервал (дней)">
        <NumberInput value={intervalDays} onChange={setIntervalDays} min={1} />
      </Field>
      <Field label="Мин. возраст долга (дней)">
        <NumberInput value={minDebtAge} onChange={setMinDebtAge} min={0} />
      </Field>
      <Field label="Максимум напоминаний">
        <NumberInput value={maxReminders} onChange={setMaxReminders} min={1} />
      </Field>
      <Field label="Шаблон сообщения">
        <textarea
          value={template}
          onChange={(e) => setTemplate(e.target.value)}
          rows={3}
          style={{
            width: '100%',
            border: '1px solid var(--line-2, #eee)',
            borderRadius: 8,
            padding: 8,
            fontSize: 13,
            resize: 'vertical',
          }}
        />
      </Field>

      <button
        onClick={saveReminder}
        disabled={updateReminder.isPending}
        style={{ ...btn, background: '#D6E4FF', width: '100%', marginTop: 6 }}
      >
        {updateReminder.isPending ? 'Сохранение…' : 'Сохранить'}
      </button>

      <div style={{ ...titleStyle, marginTop: 16 }}>Уведомления админа</div>
      {notif && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <Toggle
            label="Новый пользователь"
            value={notif.notifyOnNewUser}
            onChange={(v) => updateNotif.mutate({ notifyOnNewUser: v })}
          />
          <Toggle
            label="Новое голосование"
            value={notif.notifyOnNewPoll}
            onChange={(v) => updateNotif.mutate({ notifyOnNewPoll: v })}
          />
          <Toggle
            label="Завершение голосования"
            value={notif.notifyOnPollEnd}
            onChange={(v) => updateNotif.mutate({ notifyOnPollEnd: v })}
          />
          <Toggle
            label="Оплата долга"
            value={notif.notifyOnDebtPaid}
            onChange={(v) => updateNotif.mutate({ notifyOnDebtPaid: v })}
          />
        </div>
      )}
    </div>
  );
}

function Toggle({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '8px 0',
        cursor: 'pointer',
      }}
    >
      <span style={{ fontSize: 14 }}>{label}</span>
      <input
        type="checkbox"
        checked={value}
        onChange={(e) => onChange(e.target.checked)}
        style={{ transform: 'scale(1.2)' }}
      />
    </label>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ fontSize: 12, color: 'var(--ink-2, #888)', marginBottom: 4 }}>{label}</div>
      {children}
    </div>
  );
}

function NumberInput({
  value,
  onChange,
  min,
}: {
  value: number;
  onChange: (n: number) => void;
  min?: number;
}) {
  return (
    <input
      type="number"
      min={min}
      value={value}
      onChange={(e) => onChange(Math.max(min ?? 0, Number(e.target.value) || 0))}
      style={{
        width: 100,
        border: '1px solid var(--line-2, #eee)',
        borderRadius: 8,
        padding: '6px 10px',
        fontSize: 13,
      }}
    />
  );
}

const cardStyle: React.CSSProperties = {
  background: 'var(--surf-1, #fff)',
  borderRadius: 16,
  padding: 14,
  boxShadow: '0 2px 10px rgba(0,0,0,0.04)',
};
const titleStyle: React.CSSProperties = { fontWeight: 700, fontSize: 15, marginBottom: 10 };
const btn: React.CSSProperties = {
  border: 'none',
  borderRadius: 10,
  padding: '10px 12px',
  fontSize: 13,
  fontWeight: 600,
  cursor: 'pointer',
};
