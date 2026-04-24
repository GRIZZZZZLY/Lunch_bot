import { ProfileHero } from './ProfileHero';
import { ProfileStats3 } from './ProfileStats3';
import { RecentHistory } from './RecentHistory';
import { SettingsList } from './SettingsList';
import { FeedbackCard } from './FeedbackCard';
import { ProfileFoot } from './ProfileFoot';
import { ProfileLoadingView, ProfileEmptyView } from './ProfileStates';
import type { ProfileData } from './types';
import '@/styles/profile.css';

interface Props {
  data: ProfileData;
  onSeeAllHistory?: () => void;
  onToggleSetting?: (id: string, next: boolean) => void;
  onActivateSetting?: (id: string) => void;
  onFeedback?: (text: string) => void;
  onReportIssue?: () => void;
  onLogout?: () => void;
  onEmptyAction?: () => void;
}

export function ProfileScreen({
  data,
  onSeeAllHistory,
  onToggleSetting,
  onActivateSetting,
  onFeedback,
  onReportIssue,
  onLogout,
  onEmptyAction,
}: Props) {
  if (data.isLoading) {
    return (
      <>
        <TopHeader />
        <ProfileLoadingView />
      </>
    );
  }

  if (data.isEmpty) {
    return (
      <>
        <TopHeader />
        <ProfileEmptyView user={data.user} onAction={onEmptyAction} />
      </>
    );
  }

  return (
    <>
      <TopHeader />
      <div className="content">
        <ProfileHero user={data.user} />
        {data.stats && <ProfileStats3 stats={data.stats} />}
        {data.recent && data.recent.length > 0 && (
          <RecentHistory items={data.recent} onSeeAll={onSeeAllHistory} />
        )}
        {data.settings && (
          <SettingsList
            settings={data.settings}
            onToggle={onToggleSetting}
            onActivate={onActivateSetting}
          />
        )}
        <FeedbackCard onSubmit={onFeedback} onReportIssue={onReportIssue} />
        <ProfileFoot onLogout={onLogout} version={data.version} />
      </div>
    </>
  );
}

function TopHeader() {
  return (
    <div className="top-hdr">
      <div className="ttl">Профиль</div>
      <div className="act">⚙</div>
    </div>
  );
}
