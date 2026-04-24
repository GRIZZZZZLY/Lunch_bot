export type PillTone = 'peach' | 'mint' | 'muted';
export type ProfilePillTone = PillTone;

export interface ProfilePill {
  text: string;
  tone: PillTone;
}

export interface ProfileUser {
  initial: string;
  name: string;
  username: string;
  joined: string;
  pills: ProfilePill[];
  avatarBg?: string;
}

export interface ProfileStatsTriple {
  polls: number | string;
  wins: number | string;
  activity: string;
}

export type PollRowDecoTone = 'default' | 'lav' | 'sage' | 'butter' | 'rose';

export interface RecentPollItem {
  id: string;
  emoji: string;
  date: string;
  name: string;
  tone?: PollRowDecoTone;
  status: 'ok' | 'no';
}

export type SettingIconTone = 'default';
export interface SettingRow {
  id: string;
  icon: string;
  label: string;
  value: string;
  control: { type: 'toggle'; on: boolean } | { type: 'chevron' };
}

export interface ProfileData {
  user: ProfileUser;
  stats?: ProfileStatsTriple;
  recent?: RecentPollItem[];
  settings?: SettingRow[];
  isLoading?: boolean;
  isEmpty?: boolean;
  version?: string;
}

export type HistoryFilterKey = 'all' | 'won' | 'participated' | 'skipped';

export interface HistoryFilter {
  key: HistoryFilterKey;
  label: string;
}

export interface HistoryEntry {
  id: string;
  emoji: string;
  name: string;
  optionsCount: number;
  votes: number;
  tone?: PollRowDecoTone;
  status: 'ok' | 'no';
}

export interface HistoryDay {
  label: string;
  entries: HistoryEntry[];
}

export interface HistoryData {
  days: HistoryDay[];
  isLoadingMore?: boolean;
  isEmpty?: boolean;
}
