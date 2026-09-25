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

const firstTransform = (testId: string) =>
  calls.find((c) => c.el === screen.getByTestId(testId) && 'transform' in c.keyframes[0])?.keyframes[0].transform;

describe('FlipGroup', () => {
  it('строка, сменившая секцию, летит листком от старого места; соседи съезжают, стоящие на месте не трогаются', () => {
    const { rerender } = render(<Lists first={[1, 2]} second={[3]} />);
    // было: s1 0, r1 50, r2 100, s2 150, r3 200
    rerender(<Lists first={[2]} second={[3, 1]} />);
    // стало: s1 0, r2 50, s2 100, r3 150, r1 200

    expect(firstTransform('s2')).toBe('translate(0px, 50px)');
    expect(firstTransform('r2')).toBe('translate(0px, 50px)');
    // r1 едет внутри s2, поэтому из его пути вычтено смещение карточки: 50 − 200 − 50.
    expect(firstTransform('r1')).toBe('translate(0px, -200px)');
    expect(screen.getByTestId('r1')).toHaveClass('flip-lift');
    // r3 сдвинулся ровно вместе со своей карточкой — своего движения у него нет.
    expect(firstTransform('r3')).toBeUndefined();
  });

  it('исчезнувшая строка гаснет призраком, а не пропадает кадром', () => {
    const { rerender } = render(<Lists first={[1]} second={[3]} />);
    rerender(<Lists first={[1]} second={[]} />);

    const ghost = screen.getByTestId('s2').querySelector('[data-flip-ghost]');
    expect(ghost).not.toBeNull();
    expect(ghost).toHaveAttribute('aria-hidden', 'true');
    expect(ghost).not.toHaveAttribute('data-testid', expect.anything());
  });

  it('полная смена содержимого не анимируется: это приход данных, а не изменение', () => {
    const { rerender } = render(
      <FlipGroup>
        <div data-testid="loading">…</div>
      </FlipGroup>,
    );
    rerender(
      <FlipGroup>
        <section data-testid="s1">готово</section>
      </FlipGroup>,
    );

    expect(calls).toHaveLength(0);
  });

  it('prefers-reduced-motion: экран меняется мгновенно, как раньше', () => {
    window.matchMedia = ((query: string) => ({ matches: query.includes('reduce'), media: query })) as typeof window.matchMedia;
    const { rerender } = render(<Lists first={[1, 2]} second={[3]} />);
    rerender(<Lists first={[2]} second={[3, 1]} />);

    expect(calls).toHaveLength(0);
    expect(screen.getByTestId('r1')).not.toHaveClass('flip-lift');
  });
});
