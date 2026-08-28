import type { CSSProperties } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { Icon } from '@/components/rl/Icon';
import { useActivePolls } from '@/hooks/usePolls';
import { ROOT_TABS, type RootTab } from '@/app/navigation';
import { useBootReveal } from '@/lib/motion';
import { hapticSelection } from '@/lib/haptics';

/* Активная плитка — один элемент, который переезжает, а не четыре, которые по
   очереди зажигаются. Разница не косметическая: переезд связывает нажатие с
   приходом страницы в одно движение, а кроссфейд оставляет два независимых
   события — здесь погасло, там зажглось.

   Индекс считаем сами, а не по isActive у NavLink: плитка живёт в <nav>, ей
   нужен номер колонки, а не состояние кнопки. Точное совпадение и `end`
   повторяют логику NavLink, чтобы плитка не разошлась с подсветкой текста. */
export function activeIndex(items: RootTab[], pathname: string): number {
  return items.findIndex((it) =>
    it.end ? pathname === it.to : pathname === it.to || pathname.startsWith(`${it.to}/`),
  );
}

export function BottomNavigation({ items = ROOT_TABS }: { items?: RootTab[] }) {
  const { data: activePolls = [] } = useActivePolls();
  const { pathname } = useLocation();
  const boot = useBootReveal();
  const badge = activePolls.length;
  const index = activeIndex(items, pathname);

  return (
    <div
      className="rl"
      style={{
        position: 'fixed',
        left: '50%',
        // Центрирование транформом: поэтому сборку кадра анимирует внутренний
        // <nav>, а не эта обёртка. Ключевые кадры перезаписали бы translateX и
        // панель уехала бы на пол-ширины вправо.
        transform: 'translateX(-50%)',
        bottom: 'calc(12px + var(--safe-area-bottom, 0px))',
        // Не мёртвая ветка, как показалось при беглом чтении: на целевых
        // 390 px работает calc(), а 406 px — потолок ширины на широких экранах
        // (дев-превью, планшет), чтобы панель не растягивалась во всю строку.
        width: 'min(406px, calc(100vw - 24px))',
        zIndex: 40,
      }}
    >
      <nav
        className={`bottomnav glass${boot ? ' anim-boot-bottom' : ''}`}
        style={
          {
            boxShadow: 'var(--shadow-3)',
            // Ширину и шаг плитки считает CSS: число колонок задаёт конфиг
            // навигации, а не константа в стилях.
            '--nav-tabs': items.length,
            '--nav-index': index < 0 ? 0 : index,
          } as CSSProperties
        }
        aria-label="Основная навигация"
      >
        {/* Плитка декоративна: состояние вкладки уже несут aria-current у ссылки
            и цвет её подписи. */}
        <span className={`nav-pill${index < 0 ? ' is-hidden' : ''}`} aria-hidden />
        {items.map((it) => (
          <NavLink
            key={it.to}
            to={it.to}
            end={it.end}
            className={({ isActive }) => 'navbtn' + (isActive ? ' on' : '')}
            /* Отдача только на смену вкладки: тап по той, где уже стоишь,
               навигации не делает, и подтверждать ему нечего. */
            onClick={() => {
              if (it.to !== pathname) hapticSelection();
            }}
          >
            <span className="nav-dot" />
            <span style={{ position: 'relative' }}>
              <Icon name={it.icon} size={22} />
              {it.to === '/' && badge > 0 && <span className="nav-badge tnum">{badge}</span>}
            </span>
            {it.label}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
