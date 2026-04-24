type Palette = 'morning' | 'afternoon' | 'evening';

export interface HeroCardProps {
  palette: Palette;
  eyebrow: string;
  title: string;
  subtitle?: string;
  avatars?: { initial: string; bg?: string; color?: string }[];
  moreCount?: number;
  chips?: string[];
}

export function HeroCard({
  palette,
  eyebrow,
  title,
  subtitle,
  avatars = [],
  moreCount,
  chips,
}: HeroCardProps) {
  return (
    <div className={`home-hero ${palette} anim-hero`}>
      <div className="deco" />
      <div className="eyebrow">{eyebrow}</div>
      <h1>{title}</h1>
      {subtitle && <div className="sub">{subtitle}</div>}

      {(avatars.length > 0 || moreCount) && (
        <div className="avatars">
          {avatars.map((a, i) => (
            <div
              key={i}
              className="av"
              style={{ background: a.bg, color: a.color }}
            >
              {a.initial}
            </div>
          ))}
          {moreCount !== undefined && moreCount > 0 && (
            <div className="av more">+{moreCount}</div>
          )}
        </div>
      )}

      {chips && chips.length > 0 && (
        <div className="chip-row">
          {chips.map((c, i) => (
            <span key={i} className="chip">
              {c}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
