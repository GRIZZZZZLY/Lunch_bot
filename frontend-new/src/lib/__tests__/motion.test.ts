/* Направление перехода: порядок табов, вложенность detail-экранов и то, что
   память о предыдущем пути переживает смену layout'а. */
import { afterEach, describe, expect, it } from 'vitest';
import { renderHook } from '@testing-library/react';
import { __resetTransitionMemory, resolveDirection, usePageTransition } from '../motion';

afterEach(() => {
  __resetTransitionMemory();
});

describe('resolveDirection', () => {
  it('между табами идёт по их порядку в навигации', () => {
    expect(resolveDirection('/', '/menu')).toBe('forward');
    expect(resolveDirection('/menu', '/stats')).toBe('forward');
    expect(resolveDirection('/profile', '/')).toBe('back');
    expect(resolveDirection('/stats', '/menu')).toBe('back');
  });

  it('тот же путь не двигает страницу', () => {
    expect(resolveDirection('/menu', '/menu')).toBe('fade');
  });

  it('таб → detail — вперёд, detail → таб — назад', () => {
    expect(resolveDirection('/profile', '/admin')).toBe('forward');
    expect(resolveDirection('/admin', '/profile')).toBe('back');
    expect(resolveDirection('/store-run/7', '/')).toBe('back');
  });

  it('detail → detail считается шагом вглубь', () => {
    expect(resolveDirection('/poll/history', '/poll/12/results')).toBe('forward');
  });
});

describe('usePageTransition', () => {
  /* В приложении контейнер живёт под key={pathname} и создаётся заново на
     каждый переход — тест повторяет это, подменяя узел вместе с путём. */
  function mount(pathname: string) {
    const ref = { current: document.createElement('div') };
    ref.current.className = 'anim-page';
    const view = renderHook(() => usePageTransition(ref, pathname));
    return { ...view, el: ref.current };
  }

  it('первый экран открывается кроссфейдом: предыдущего пути ещё нет', () => {
    const { el } = mount('/menu');
    expect(el.className).toBe('anim-page');
  });

  it('на смене пути ставит класс направления', () => {
    mount('/').unmount();
    const { el } = mount('/stats');
    expect(el.classList.contains('is-forward')).toBe(true);
  });

  it('снимает класс, когда вход доигран: каскад внутри страницы снова нужен', () => {
    mount('/').unmount();
    const { el } = mount('/menu');
    expect(el.classList.contains('is-forward')).toBe(true);

    el.dispatchEvent(new Event('animationend'));
    expect(el.classList.contains('is-forward')).toBe(false);
  });

  it('чужой animationend (от ребёнка) класс не снимает', () => {
    mount('/').unmount();
    const { el } = mount('/menu');
    const child = document.createElement('div');
    el.appendChild(child);

    child.dispatchEvent(new Event('animationend', { bubbles: true }));
    expect(el.classList.contains('is-forward')).toBe(true);
  });

  it('повторный эффект на том же пути ничего не добавляет', () => {
    mount('/').unmount();
    const { el } = mount('/menu');
    expect(el.classList.contains('is-forward')).toBe(true);

    // Тот же путь ещё раз — так выглядит переигранный в StrictMode эффект.
    const again = mount('/menu');
    expect(again.el.className).toBe('anim-page');
  });

  it('помнит предыдущий путь после размонтирования layout’а', () => {
    mount('/').unmount();
    const toProfile = mount('/profile');
    expect(toProfile.el.classList.contains('is-forward')).toBe(true);
    // Уход с root-layout на detail-layout: компонент другой, память общая.
    toProfile.unmount();

    const toAdmin = mount('/admin');
    expect(toAdmin.el.classList.contains('is-forward')).toBe(true);
    toAdmin.unmount();

    const backToProfile = mount('/profile');
    expect(backToProfile.el.classList.contains('is-back')).toBe(true);
  });
});
