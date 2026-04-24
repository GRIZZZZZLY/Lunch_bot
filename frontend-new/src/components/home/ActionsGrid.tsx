import { ArrowRight, Utensils, Clock, TrendingUp, UserPlus } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

type Palette = 'peach' | 'lav' | 'sage' | 'sky';

export interface ActionTile {
  key: string;
  label: string;
  palette: Palette;
  icon: LucideIcon;
  iconColor: string;
  onClick?: () => void;
}

const defaultItems: ActionTile[] = [
  { key: 'menu',    label: 'Меню',        palette: 'peach', icon: Utensils,   iconColor: '#3D2012' },
  { key: 'history', label: 'История',     palette: 'lav',   icon: Clock,      iconColor: '#2E1F56' },
  { key: 'stats',   label: 'Статистика',  palette: 'sage',  icon: TrendingUp, iconColor: '#0E3D26' },
  { key: 'invite',  label: 'Пригласить',  palette: 'sky',   icon: UserPlus,   iconColor: '#083855' },
];

export function ActionsGrid({ items = defaultItems }: { items?: ActionTile[] }) {
  return (
    <div className="act-grid">
      {items.map(({ key, label, palette, icon: Icon, iconColor, onClick }) => (
        <button key={key} type="button" className={`act ${palette}`} onClick={onClick}>
          <div className="ic">
            <Icon size={18} strokeWidth={2} color={iconColor} />
          </div>
          <div className="lbl">
            <span>{label}</span>
            <ArrowRight size={14} />
          </div>
        </button>
      ))}
    </div>
  );
}
