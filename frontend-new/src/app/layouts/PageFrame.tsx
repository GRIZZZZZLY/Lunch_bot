/* Контейнер страницы, который несёт вход при навигации (styles/motion.css).

   Живёт ВНУТРИ Suspense и монтируется вместе с содержимым страницы. Раньше
   контейнер стоял снаружи границы, и хук направления срабатывал при его
   монтировании — при первом заходе на ленивый экран это был пустой
   контейнер: вход доигрывал 0–280 мс над заглушкой, а страница вставала на
   ~320-й мс без движения (замер Playwright, 2026-11-13).

   Хук — здесь, а не в потомке-маркере: layout-эффекты потомков выполняются
   раньше, чем React привязывает ref родительского узла, и маркер видел бы
   null на каждом обычном переходе. */
import { useRef, type ReactNode } from 'react';
import { usePageTransition } from '@/lib/motion';

export function PageFrame({ pathname, children }: { pathname: string; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  usePageTransition(ref, pathname);
  return (
    <div ref={ref} className="anim-page">
      {children}
    </div>
  );
}
