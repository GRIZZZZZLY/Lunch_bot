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

export type DurationOption = '15m' | '30m' | '1h' | 'custom';

export type MenuItemIconTone = 'default' | 'lav' | 'sage' | 'butter' | 'rose' | 'sky';

export interface MenuItemOption {
  id: string;
  emoji: string;
  name: string;
  restaurant: string;
  price: number;
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
  duration: DurationOption;
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
