/* ROCKET LUNCH — floating action button (redesign v2). */
import { Icon, type IconName } from './Icon';

export function Fab({
  onClick,
  label = 'Создать',
  icon = 'plus',
}: {
  onClick?: () => void;
  label?: string;
  icon?: IconName;
}) {
  return (
    <div
      className="rl"
      style={{
        position: 'fixed',
        right: 18,
        bottom: 'calc(88px + env(safe-area-inset-bottom))',
        zIndex: 45,
      }}
    >
      <button className="fab press" aria-label={label} onClick={onClick}>
        <Icon name={icon} size={26} stroke={2} />
      </button>
    </div>
  );
}
