import { useState, useEffect, useReducer } from 'react';
import { Bell, BellOff, Save, AlertCircle } from 'lucide-react';
import { PastelCard } from '../ui/pastel-card';
import { Button } from '../ui/button';
import { cn } from '@/lib/utils';
import { ICON_SIZES } from '@/lib/design-tokens';
import { ReminderSettings, AdminNotificationSettings } from '@/services/admin.service';

interface ReminderSettingsCardProps {
  reminderSettings: ReminderSettings | null;
  notificationSettings: AdminNotificationSettings | null;
  onSaveReminderSettings: (settings: Partial<ReminderSettings>) => Promise<void>;
  onSaveNotificationSettings: (settings: Partial<AdminNotificationSettings>) => Promise<void>;
  loading?: boolean;
}

type NumericInputValue = number | '';

interface SettingsState {
  isEnabled: boolean;
  intervalDays: NumericInputValue;
  minDebtAge: NumericInputValue;
  maxReminders: NumericInputValue;
  messageTemplate: string;
  notifyOnNewUser: boolean;
  notifyOnNewPoll: boolean;
  notifyOnPollEnd: boolean;
  notifyOnDebtPaid: boolean;
}

const mergeSettings = (state: SettingsState, update: Partial<SettingsState>) => ({
  ...state,
  ...update,
});

const NOTIFICATION_OPTIONS = [
  ['notifyOnNewUser', 'Новые пользователи', 'Уведомлять при регистрации нового пользователя'],
  ['notifyOnNewPoll', 'Новые голосования', 'Уведомлять при создании нового голосования'],
  ['notifyOnPollEnd', 'Завершение голосований', 'Уведомлять при завершении голосования'],
  ['notifyOnDebtPaid', 'Оплата долгов', 'Уведомлять при оплате долгов пользователями'],
] as const;

interface AdminNotificationTogglesProps {
  settings: SettingsState;
  onChange: (update: Partial<SettingsState>) => void;
}

const AdminNotificationToggles = ({ settings, onChange }: AdminNotificationTogglesProps) => (
  <div className="border-t border-border/70 pt-6">
    <h4 className="mb-4 text-sm font-semibold text-foreground">
      Уведомления для администраторов
    </h4>
    <div className="space-y-3">
      {NOTIFICATION_OPTIONS.map(([key, title, description]) => (
        <label
          key={key}
          className="flex cursor-pointer items-center justify-between rounded-lg border border-border/60 bg-card/80 p-3 transition-colors hover:bg-muted/50"
        >
          <div className="flex-1">
            <span className="text-sm font-medium text-foreground">{title}</span>
            <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
          </div>
          <input
            type="checkbox"
            checked={settings[key]}
            onChange={event => onChange({ [key]: event.target.checked })}
            className="h-4 w-4 rounded border-gray-300 bg-gray-100 text-lavender-600 focus:ring-2 focus:ring-lavender-500 dark:border-gray-600 dark:bg-gray-700"
          />
        </label>
      ))}
    </div>
  </div>
);

const parseNumericInputValue = (value: string): NumericInputValue => {
  if (value === '') {
    return '';
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? '' : parsed;
};

const DEFAULT_TEMPLATE = `⏰ *Напоминание о долгах*

Привет, {userName}!

У тебя есть неоплаченные долги на сумму *{totalAmount} руб.*

{debtsList}

Пожалуйста, оплати долги как можно скорее и отметь их как оплаченные в приложении.`;

export const ReminderSettingsCard = ({
  reminderSettings,
  notificationSettings,
  onSaveReminderSettings,
  onSaveNotificationSettings,
  loading = false,
}: ReminderSettingsCardProps) => {
  const [settings, updateSettings] = useReducer(mergeSettings, {
    isEnabled: reminderSettings?.isEnabled ?? true,
    intervalDays: reminderSettings?.intervalDays ?? 3,
    minDebtAge: reminderSettings?.minDebtAge ?? 1,
    maxReminders: reminderSettings?.maxReminders ?? 5,
    messageTemplate: reminderSettings?.messageTemplate ?? DEFAULT_TEMPLATE,
    notifyOnNewUser: notificationSettings?.notifyOnNewUser ?? true,
    notifyOnNewPoll: notificationSettings?.notifyOnNewPoll ?? false,
    notifyOnPollEnd: notificationSettings?.notifyOnPollEnd ?? false,
    notifyOnDebtPaid: notificationSettings?.notifyOnDebtPaid ?? false,
  });
  const {
    isEnabled,
    intervalDays,
    minDebtAge,
    maxReminders,
    messageTemplate,
    notifyOnNewUser,
    notifyOnNewPoll,
    notifyOnPollEnd,
    notifyOnDebtPaid,
  } = settings;

  const [saveLoading, setSaveLoading] = useState(false);
  const normalizedIntervalDays = intervalDays === '' ? 1 : intervalDays;
  const normalizedMinDebtAge = minDebtAge === '' ? 0 : minDebtAge;
  const normalizedMaxReminders = maxReminders === '' ? 1 : maxReminders;

  // Update state when settings load
  useEffect(() => {
    if (reminderSettings) {
      updateSettings(reminderSettings);
    }
  }, [reminderSettings]);

  useEffect(() => {
    if (notificationSettings) {
      updateSettings(notificationSettings);
    }
  }, [notificationSettings]);

  const handleSave = async () => {
    setSaveLoading(true);
    try {
      await Promise.all([
        onSaveReminderSettings({
          isEnabled,
          intervalDays: normalizedIntervalDays,
          minDebtAge: normalizedMinDebtAge,
          maxReminders: normalizedMaxReminders,
          messageTemplate,
        }),
        onSaveNotificationSettings({
          notifyOnNewUser,
          notifyOnNewPoll,
          notifyOnPollEnd,
          notifyOnDebtPaid,
        }),
      ]);
    } finally {
      setSaveLoading(false);
    }
  };

  const hasChanges = () => {
    if (!reminderSettings || !notificationSettings) return true;
    
    return (
      isEnabled !== reminderSettings.isEnabled ||
      normalizedIntervalDays !== reminderSettings.intervalDays ||
      normalizedMinDebtAge !== reminderSettings.minDebtAge ||
      normalizedMaxReminders !== reminderSettings.maxReminders ||
      messageTemplate !== reminderSettings.messageTemplate ||
      notifyOnNewUser !== notificationSettings.notifyOnNewUser ||
      notifyOnNewPoll !== notificationSettings.notifyOnNewPoll ||
      notifyOnPollEnd !== notificationSettings.notifyOnPollEnd ||
      notifyOnDebtPaid !== notificationSettings.notifyOnDebtPaid
    );
  };

  return (
    <PastelCard variant="default" className="p-5">
      <div className="mb-6 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className={cn(
            'rounded-xl p-2',
            isEnabled ? 'bg-lavender-500/12 text-lavender-600 dark:text-lavender-400' : 'bg-muted text-muted-foreground'
          )}>
            {isEnabled ? (
              <Bell className={cn(ICON_SIZES.md)} />
            ) : (
              <BellOff className={cn(ICON_SIZES.md)} />
            )}
          </div>
          <div>
            <h3 className="font-semibold text-foreground">
              Настройки уведомлений
            </h3>
            <p className="text-sm text-muted-foreground">
              Автоматические напоминания о долгах и уведомления админам
            </p>
          </div>
        </div>

        <Button
          onClick={handleSave}
          disabled={!hasChanges() || saveLoading || loading}
          variant="default"
          size="sm"
        >
          <Save className={cn(ICON_SIZES.sm, 'mr-2')} />
          {saveLoading ? 'Сохранение...' : 'Сохранить'}
        </Button>
      </div>

      {/* Auto-reminders section */}
      <div className="space-y-4 mb-6">
        <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
            <div className="flex-1">
              <label
                htmlFor="debt-reminders-enabled"
                className="text-sm font-medium text-foreground"
              >
                Автоматические напоминания о долгах
              </label>
              <p className="mt-1 text-xs text-muted-foreground">
                Бот будет автоматически отправлять напоминания должникам
              </p>
            </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <span className="sr-only">Включить напоминания о долгах</span>
            <input
              id="debt-reminders-enabled"
              type="checkbox"
              checked={isEnabled}
              onChange={event => updateSettings({ isEnabled: event.target.checked })}
              className="sr-only peer"
            />
            <div className="peer h-6 w-11 rounded-full bg-muted peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-lavender-500/20 dark:bg-gray-700 peer-checked:bg-lavender-500 peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full after:absolute after:start-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:border after:border-gray-300 after:bg-white after:transition-all after:content-[''] dark:border-gray-600 peer-checked:after:border-white"></div>
          </label>
        </div>

        {isEnabled && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                  <label
                    htmlFor="reminder-interval-days"
                    className="mb-2 block text-sm font-medium text-foreground"
                  >
                  Интервал напоминаний (дней)
                </label>
                <input
                  id="reminder-interval-days"
                  type="number"
                  min="1"
                  max="30"
                  value={intervalDays}
                  onChange={event => updateSettings({ intervalDays: parseNumericInputValue(event.target.value) })}
                    className="w-full rounded-lg border border-border bg-card px-3 py-2 text-foreground focus:border-transparent focus:ring-2 focus:ring-primary"
                  />
                  <p className="mt-1 text-xs text-muted-foreground">
                  Отправлять раз в {normalizedIntervalDays} {normalizedIntervalDays === 1 ? 'день' : normalizedIntervalDays < 5 ? 'дня' : 'дней'}
                </p>
              </div>

              <div>
                  <label
                    htmlFor="reminder-min-debt-age"
                    className="mb-2 block text-sm font-medium text-foreground"
                  >
                  Минимальный возраст долга (дней)
                </label>
                <input
                  id="reminder-min-debt-age"
                  type="number"
                  min="0"
                  max="30"
                  value={minDebtAge}
                  onChange={event => updateSettings({ minDebtAge: parseNumericInputValue(event.target.value) })}
                    className="w-full rounded-lg border border-border bg-card px-3 py-2 text-foreground focus:border-transparent focus:ring-2 focus:ring-primary"
                  />
                  <p className="mt-1 text-xs text-muted-foreground">
                  Напоминать о долгах старше {normalizedMinDebtAge} {normalizedMinDebtAge === 1 ? 'дня' : 'дней'}
                </p>
              </div>

              <div>
                  <label
                    htmlFor="reminder-max-reminders"
                    className="mb-2 block text-sm font-medium text-foreground"
                  >
                  Максимум напоминаний
                </label>
                <input
                  id="reminder-max-reminders"
                  type="number"
                  min="1"
                  max="10"
                  value={maxReminders}
                  onChange={event => updateSettings({ maxReminders: parseNumericInputValue(event.target.value) })}
                    className="w-full rounded-lg border border-border bg-card px-3 py-2 text-foreground focus:border-transparent focus:ring-2 focus:ring-primary"
                  />
                  <p className="mt-1 text-xs text-muted-foreground">
                  После {normalizedMaxReminders} напоминаний перестать беспокоить
                </p>
              </div>
            </div>

            <div>
              <label
                htmlFor="reminder-message-template"
                className="mb-2 block text-sm font-medium text-foreground"
              >
                Шаблон сообщения
              </label>
              <textarea
                id="reminder-message-template"
                value={messageTemplate}
                onChange={event => updateSettings({ messageTemplate: event.target.value })}
                rows={8}
                className="w-full rounded-lg border border-border bg-card px-3 py-2 font-mono text-sm text-foreground focus:border-transparent focus:ring-2 focus:ring-primary"
              />
              <div className="mt-2 rounded-lg border border-lavender-500/20 bg-lavender-500/8 p-3">
                <div className="flex items-start gap-2">
                  <AlertCircle className={cn(ICON_SIZES.sm, 'mt-0.5 text-lavender-500')} />
                  <div className="text-xs text-foreground">
                    <p className="font-medium mb-1">Доступные плейсхолдеры:</p>
                    <ul className="space-y-0.5 ml-2">
                      <li>• <code className="rounded bg-card px-1">{'{userName}'}</code> - имя должника</li>
                      <li>• <code className="rounded bg-card px-1">{'{totalAmount}'}</code> - общая сумма долга</li>
                      <li>• <code className="rounded bg-card px-1">{'{debtsList}'}</code> - список всех долгов</li>
                      <li>• <code className="rounded bg-card px-1">{'{oldestDebtAge}'}</code> - возраст старейшего долга</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      <AdminNotificationToggles settings={settings} onChange={updateSettings} />
    </PastelCard>
  );
};
