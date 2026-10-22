import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { FlipGroup } from '../FlipGroup';

/* jsdom не считает раскладку. Подменяем её так, чтобы она следовала за DOM:
   каждый элемент с data-testid стоит строкой высотой 50 px в порядке документа.
   Тогда перестановка узлов React сама даёт «старую» и «новую» раскладку. */
const ROW = 50;
const calls: { el: Element; keyframes: Keyframe[] }[] = [];
const saved = {
  animate: HTMLElement.prototype.animate,
  rect: HTMLElement.prototype.getBoundingClientRect,
  offsetParent: Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'offsetParent'),
  matchMedia: window.matchMedia,
};

function fakeAnimation(): Animation {
  return { cancel: vi.fn(), play: vi.fn(), currentTime: 0, playState: 'running', onfinish: null } as unknown as Animation;
}

beforeEach(() => {
  calls.length = 0;
  HTMLElement.prototype.animate = function (this: Element, keyframes: Keyframe[] | PropertyIndexedKeyframes | null) {
    calls.push({ el: this, keyframes: keyframes as Keyframe[] });
    return fakeAnimation();
  } as typeof HTMLElement.prototype.animate;
  HTMLElement.prototype.getBoundingClientRect = function (this: HTMLElement) {
    const i = Array.from(document.querySelectorAll('[data-testid]')).indexOf(this);
    const top = i < 0 ? 0 : i * ROW;
    return { top, left: 0, width: 300, height: i < 0 ? 0 : ROW, bottom: top + ROW, right: 300, x: 0, y: top, toJSON: () => ({}) } as DOMRect;
  };
  Object.defineProperty(HTMLElement.prototype, 'offsetParent', {
    configurable: true,
    get(this: HTMLElement) {
      return this.parentElement;
    },
  });
});

afterEach(() => {
  HTMLElement.prototype.animate = saved.animate;
  HTMLElement.prototype.getBoundingClientRect = saved.rect;
  if (saved.offsetParent) Object.defineProperty(HTMLElement.prototype, 'offsetParent', saved.offsetParent);
  window.matchMedia = saved.matchMedia;
});

function Lists({ first, second }: { first: number[]; second: number[] }) {
  const rows = (ids: number[]) =>
    ids.map((id) => (
      <div key={id} data-testid={`r${id}`} data-flip={`item:${id}`}>
        {id}
      </div>
    ));
  return (
    <FlipGroup>
      <section data-testid="s1">
        <div data-flip-list>{rows(first)}</div>
      </section>
      <section data-testid="s2">
        <div data-flip-list>{rows(second)}</div>
      </section>
    </FlipGroup>
  );
}

describe('FlipGroup', () => {
  it('исчезнувшая строка гаснет призраком, а не пропадает кадром', () => {
    const { rerender } = render(<Lists first={[1]} second={[3]} />);
    rerender(<Lists first={[1]} second={[]} />);

    const ghost = screen.getByTestId('s2').querySelector('[data-flip-ghost]');
    expect(ghost).not.toBeNull();
    expect(ghost).toHaveAttribute('aria-hidden', 'true');
    expect(ghost).not.toHaveAttribute('data-testid', expect.anything());
  });

  /* Пара «без настройки / reduce» на одной перестановке: первая строка
     доказывает, что сценарий вообще анимируется, иначе ноль во второй ничего
     бы не значил. */
  it.each([
    ['без настройки движения перестановка анимируется', false],
    ['prefers-reduced-motion: экран меняется мгновенно', true],
  ])('%s', (_name, reduce) => {
    window.matchMedia = ((query: string) => ({ matches: reduce && query.includes('reduce'), media: query })) as typeof window.matchMedia;
    const { rerender } = render(<Lists first={[1, 2]} second={[3]} />);
    rerender(<Lists first={[2]} second={[3, 1]} />);

    expect(calls.length > 0).toBe(!reduce);
  });
});
