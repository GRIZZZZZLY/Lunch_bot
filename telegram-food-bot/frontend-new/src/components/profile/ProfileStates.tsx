import { ProfileHero } from './ProfileHero';
import type { ProfileUser } from './types';

export function ProfileLoadingView() {
  return (
    <div className="content">
      <div className="phero" style={{ background: 'var(--card-grad)', border: '1px solid var(--line)' }}>
        <div className="sk circ" style={{ margin: '0 auto 10px', width: 96, height: 96 }} />
        <div className="sk bar" style={{ width: '60%', height: 18, margin: '0 auto' }} />
        <div className="sk bar" style={{ width: '40%', height: 12, margin: '8px auto 0' }} />
        <div style={{ display: 'flex', justifyContent: 'center', gap: 6, marginTop: 12 }}>
          <div className="sk" style={{ width: 60, height: 22, borderRadius: 999 }} />
          <div className="sk" style={{ width: 80, height: 22, borderRadius: 999 }} />
        </div>
      </div>
      <div className="card">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
          <div className="sk" style={{ height: 46 }} />
          <div className="sk" style={{ height: 46 }} />
          <div className="sk" style={{ height: 46 }} />
        </div>
      </div>
      <div className="card">
        <div className="sk bar" style={{ width: '40%', marginBottom: 10 }} />
        <div className="sk" style={{ height: 60, borderRadius: 12 }} />
        <div className="sk" style={{ height: 60, borderRadius: 12, marginTop: 8 }} />
      </div>
    </div>
  );
}

export function ProfileEmptyView({
  user,
  onAction,
}: {
  user: ProfileUser;
  onAction?: () => void;
}) {
  return (
    <div className="content">
      <ProfileHero user={user} />
      <div className="empty-st">
        <div className="blob">📊</div>
        <div className="et">Пока нет истории</div>
        <div className="es">Проголосуйте в первом опросе — и история будет жить здесь.</div>
        <button type="button" className="ec" onClick={onAction}>
          К голосованию →
        </button>
      </div>
    </div>
  );
}
