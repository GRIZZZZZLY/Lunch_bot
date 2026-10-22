/* Направление перехода (порядок табов, вложенность detail-экранов) и флаг
   первой сборки кадра. */
import { afterEach, describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { render, renderHook } from '@testing-library/react';
import {
  __resetTransitionMemory,
  resolveDirection,
  useBootReveal,
} from '../motion';

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

describe('useBootReveal', () => {
  it('первое монтирование за сессию — сборка кадра', () => {
    const { result } = renderHook(() => useBootReveal());
    expect(result.current).toBe(true);
  });

  it('шапка, контент и таббар в одном проходе получают один ответ', () => {
    /* Именно один проход, а не три renderHook: те дают три отдельных коммита, и
       эффект первого поднял бы флаг до рендера второго. В приложении все трое
       живут в одном дереве, и если бы флаг поднимался в рендере, кто-то один
       приехал бы без анимации — композиция сборки разорвалась бы. */
    const seen: boolean[] = [];
    function Probe() {
      seen.push(useBootReveal());
      return null;
    }

    render(
      createElement('div', null, createElement(Probe), createElement(Probe), createElement(Probe)),
    );

    expect(seen).toEqual([true, true, true]);
  });

  it('возврат с detail-экрана перемонтирует layout, но открытием не является', () => {
    renderHook(() => useBootReveal()).unmount();

    const again = renderHook(() => useBootReveal());
    expect(again.result.current).toBe(false);
  });
});
