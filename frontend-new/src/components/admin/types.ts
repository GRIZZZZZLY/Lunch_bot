export interface AdminChecklistItem {
  id: string;
  label: string;
  urgent?: boolean;
}

export type QuickActionTone = 'peach' | 'lav' | 'sage' | 'rose';

export interface QuickAction {
  id: string;
  emoji: string;
  title: string;
  subtitle: string;
  tone: QuickActionTone;
}

export interface StatTriple {
  num: string;
  label: string;
}

export interface WeekBar {
  day: string;
  value: number;
  peak?: boolean;
  muted?: boolean;
}

export interface SuspiciousAlert {
  title: string;
  subtitle: string;
}

export type UserRoleTag = 'admin' | 'banned';
export type UserAvatarTone = 'default' | 'lav' | 'sage' | 'rose' | 'butter';

export interface AdminUser {
  id: string;
  initial: string;
  name: string;
  username: string;
  pollsCount: number;
  avatarTone?: UserAvatarTone;
  role?: UserRoleTag;
}

export type PollItemTone = 'peach' | 'lav' | 'sage' | 'butter' | 'rose';
export type PollItemStatus = 'active' | 'scheduled';

export interface PollItem {
  id: string;
  emoji: string;
  title: string;
  status: PollItemStatus;
  meta: string;
  tone?: PollItemTone;
}

export interface AdminDashboardData {
  checklist: AdminChecklistItem[];
  checklistHeading: string;
  quickActions: QuickAction[];
  stats: StatTriple[];
  chart: {
    title: string;
    subtitle: string;
    bars: WeekBar[];
    /** Хватает ли данных, чтобы график говорил о ритме недели, а не об одном дне. */
    meaningful: boolean;
  };
  alert?: SuspiciousAlert;
  users: AdminUser[];
  usersTotal: number;
  polls: {
    active: PollItem[];
    scheduled: PollItem[];
  };
}

/** Границы `duration` в схемах API: 1–1440 минут. */
export const DURATION_MIN_MINUTES = 1;
export const DURATION_MAX_MINUTES = 1440;

/** Пресеты ряда чипов. Всё остальное вводится вручную. */
export const DURATION_PRESETS: { minutes: number; label: string }[] = [
  { minutes: 15, label: '15 мин' },
  { minutes: 30, label: '30 мин' },
  { minutes: 60, label: '1 час' },
];

export type MenuItemIconTone = 'default' | 'lav' | 'sage' | 'butter' | 'rose' | 'sky';

export interface MenuItemOption {
  id: string;
  emoji: string;
  name: string;
  restaurant: string;
  /** null — блюдо без цены (`MenuItem.price` необязателен в схеме). */
  price: number | null;
  iconTone?: MenuItemIconTone;
}

export type AudienceKey = 'all' | 'regulars' | 'manual';

export interface AudienceOption {
  key: AudienceKey;
  label: string;
  sub: string;
}

export interface CreatePollFormState {
  title: string;
  /** Длительность в минутах — единственный источник истины, чипы лишь её пресеты. */
  durationMinutes: number;
  /** Открыт ли ручной ввод. Влияет только на вид формы, не на отправляемое значение. */
  customDuration: boolean;
  recurring: boolean;
  recurringDays: string[];
  recurringTime: string;
  selectedItems: string[];
  groupId?: string;
}

export interface GroupOption {
  id: string;
  title: string;
}

export interface CreatePollContext {
  items: MenuItemOption[];
  maxItems: number;
  minItems: number;
  groups?: GroupOption[];
}
