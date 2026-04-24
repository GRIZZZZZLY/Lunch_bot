import type { ProfileUser } from './types';

export function ProfileHero({ user }: { user: ProfileUser }) {
  return (
    <div className="phero">
      <div className="deco" aria-hidden />
      <div
        className="avatar"
        style={user.avatarBg ? { background: user.avatarBg } : undefined}
      >
        {user.initial}
      </div>
      <div className="nm">{user.name}</div>
      <div className="un">{user.username}</div>
      <div className="pills">
        {user.pills.map((p, i) => (
          <span key={i} className={`pill ${p.tone}`}>
            {p.text}
          </span>
        ))}
      </div>
      <div className="joined">{user.joined}</div>
    </div>
  );
}
