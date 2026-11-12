import { beforeEach, describe, expect, it } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import { Suspense, useEffect, useState, type ReactNode } from 'react';
import { preloadable } from '../preloadable';
import { PageFrame } from '../layouts/PageFrame';
import { __resetTransitionMemory } from '@/lib/motion';

/* Экран с ручным загрузчиком: модуль приходит, когда тест скажет. */
function deferredScreen(text: string) {
  let resolve!: () => void;
  let mounts = 0;
  function Page({ tick }: { tick?: number }) {
    useEffect(() => {
      mounts += 1;
    }, []);
    return <p>{`${text} ${tick ?? 0}`}</p>;
  }
  const gate = new Promise<void>((r) => (resolve = r));
  const Screen = preloadable(() => gate.then(() => ({ default: Page })));
  return { Screen, resolve: () => act(async () => resolve()), mounts: () => mounts };
}

/* Как в layout'ах: граница по ключу пути, внутри — контейнер страницы. */
function Layout({ pathname, children }: { pathname: string; children: ReactNode }) {
  return (
    <Suspense key={pathname} fallback={<span>заглушка</span>}>
      <PageFrame pathname={pathname}>{children}</PageFrame>
    </Suspense>
  );
}

const frame = () => document.querySelector('.anim-page');

describe('вход страницы', () => {
  beforeEach(() => __resetTransitionMemory());

  it('обычный переход получает направление сразу', () => {
    const { rerender } = render(<Layout pathname="/">главная</Layout>);
    expect(frame()).not.toHaveClass('is-forward');

    rerender(<Layout pathname="/menu">меню</Layout>);
    expect(frame()).toHaveClass('is-forward');
  });

  it('первый заход на ленивый экран ждёт содержимое, а не играет над заглушкой', async () => {
    const menu = deferredScreen('меню');
    const { rerender } = render(<Layout pathname="/">главная</Layout>);
    rerender(
      <Layout pathname="/menu">
        <menu.Screen />
      </Layout>,
    );

    expect(screen.getByText('заглушка')).toBeInTheDocument();
    expect(frame()).toBeNull();

    await menu.resolve();
    expect(await screen.findByText('меню 0')).toBeInTheDocument();
    expect(frame()).toHaveClass('is-forward');
  });
});

describe('preloadable', () => {
  it('после preload рисует экран сразу, без заглушки', async () => {
    const stats = deferredScreen('статистика');
    const loaded = stats.Screen.preload();
    await stats.resolve();
    await loaded;

    render(
      <Suspense fallback={<span>заглушка</span>}>
        <stats.Screen />
      </Suspense>,
    );
    expect(screen.getByText('статистика 0')).toBeInTheDocument();
  });

  it('не пересоздаёт открытую страницу, когда модуль догрузился', async () => {
    const profile = deferredScreen('профиль');
    function Host() {
      const [tick, setTick] = useState(0);
      return (
        <>
          <button onClick={() => setTick((t) => t + 1)}>ещё</button>
          <Suspense fallback={<span>заглушка</span>}>
            <profile.Screen tick={tick} />
          </Suspense>
        </>
      );
    }
    render(<Host />);
    await profile.resolve();
    await screen.findByText('профиль 0');

    act(() => screen.getByText('ещё').click());
    expect(screen.getByText('профиль 1')).toBeInTheDocument();
    expect(profile.mounts()).toBe(1);
  });
});
