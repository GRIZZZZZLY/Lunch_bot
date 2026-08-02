/* Плитка таббара едет по номеру колонки, и этот номер обязан совпадать с тем,
   какую ссылку NavLink считает активной: разойдутся — подложка встанет под одной
   вкладкой, а подпись подсветится у другой. */
import { describe, expect, it } from 'vitest';
import { activeIndex } from '../BottomNavigation';
import { ROOT_TABS } from '@/app/navigation';

describe('activeIndex', () => {
  it('находит вкладку по точному пути', () => {
    expect(activeIndex(ROOT_TABS, '/')).toBe(0);
    expect(activeIndex(ROOT_TABS, '/menu')).toBe(1);
    expect(activeIndex(ROOT_TABS, '/stats')).toBe(2);
    expect(activeIndex(ROOT_TABS, '/profile')).toBe(3);
  });

  it('у Главной end: вложенные пути ей не принадлежат', () => {
    // Иначе '/' совпала бы с любым маршрутом, и плитка застряла бы на первой.
    expect(activeIndex(ROOT_TABS, '/poll/history')).toBe(-1);
    expect(activeIndex(ROOT_TABS, '/store-run/7')).toBe(-1);
  });

  it('вкладка без end забирает свои вложенные пути', () => {
    const tabs = [{ to: '/menu', label: 'Меню', icon: 'menu' as const }];
    expect(activeIndex(tabs, '/menu/42')).toBe(0);
    // Похожий префикс — не вложенность: /menuish не относится к /menu.
    expect(activeIndex(tabs, '/menuish')).toBe(-1);
  });

  it('маршрут вне вкладок не подсвечивает ничего', () => {
    expect(activeIndex(ROOT_TABS, '/whatever')).toBe(-1);
  });
});
