import { describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/react';
import { ScreenHeaderContext } from '@/app/layouts/screenHeader';
import { dateCaption } from '../../lib/selectors';
import { useGreetingHeader } from '../useGreetingHeader';

function Probe({ name, loading }: { name?: string; loading: boolean }) {
  useGreetingHeader(name, loading);
  return null;
}

describe('useGreetingHeader', () => {
  it('отдаёт шапке приветствие с именем и дату подписью', () => {
    const set = vi.fn();
    render(
      <ScreenHeaderContext.Provider value={{ set, reset: vi.fn() }}>
        <Probe name="Игорь" loading={false} />
      </ScreenHeaderContext.Provider>,
    );
    expect(set).toHaveBeenLastCalledWith({
      title: expect.stringMatching(/^(Доброе утро|Добрый день|Добрый вечер), Игорь$/),
      action: undefined,
      subtitle: dateCaption(new Date()),
    });
  });
});
