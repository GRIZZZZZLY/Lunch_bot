import type { IconName } from '@/components/rl/Icon';

export interface RootTab {
  to: string;
  label: string;
  icon: IconName;
  end?: boolean;
}

/* Конфиг нижней навигации. Судьба таба «Статистика» решается позже:
   чтобы убрать его — достаточно удалить элемент из этого массива
   (layout-компоненты и роутинг менять не нужно). */
export const ROOT_TABS: RootTab[] = [
  { to: '/', label: 'Главная', icon: 'home', end: true },
  { to: '/menu', label: 'Меню', icon: 'menu' },
  { to: '/stats', label: 'Статистика', icon: 'stats' },
  { to: '/profile', label: 'Профиль', icon: 'user' },
];
