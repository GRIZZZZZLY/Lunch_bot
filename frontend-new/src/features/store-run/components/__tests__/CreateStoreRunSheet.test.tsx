import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import type { GroupStore } from '@/services/group-store.service';
import { _resetBackButtonForTests } from '@/lib/backButton';
import { CreateStoreRunSheet } from '../CreateStoreRunSheet';

function mkStore(id: number, name: string): GroupStore {
  return {
    id,
    groupId: 1,
    name,
    lastUsedAt: '2026-09-01T10:00:00Z',
    usageCount: 3,
    archivedAt: null,
  };
}

const STORES = [mkStore(1, 'Пятёрочка'), mkStore(2, 'Магнит')];

beforeEach(() => {
  _resetBackButtonForTests();
});

function renderSheet(props: Partial<Parameters<typeof CreateStoreRunSheet>[0]> = {}) {
  const onSubmit = vi.fn();
  const onClose = vi.fn();
  const onManageStore = vi.fn();

  render(
    <CreateStoreRunSheet
      open
      busy={false}
      stores={STORES}
      onClose={onClose}
      onSubmit={onSubmit}
      onManageStore={onManageStore}
      {...props}
    />,
  );

  return { onSubmit, onClose, onManageStore };
}

describe('CreateStoreRunSheet', () => {
  it('закрытая шторка не рендерится', () => {
    const { container } = render(
      <CreateStoreRunSheet open={false} busy={false} onClose={vi.fn()} onSubmit={vi.fn()} />,
    );

    expect(container).toBeEmptyDOMElement();
  });

  it('без магазина отправка заблокирована', () => {
    renderSheet({ stores: [] });

    expect(screen.getByRole('button', { name: /Открыть сбор/ })).toBeDisabled();
  });

  it('свободный ввод уходит именем, без storeId', async () => {
    const { onSubmit } = renderSheet({ stores: [] });

    await userEvent.type(screen.getByLabelText('Откуда заказываем'), 'Ашан');
    await userEvent.click(screen.getByRole('button', { name: /Открыть сбор/ }));

    expect(onSubmit).toHaveBeenCalledWith({ storeName: 'Ашан', collectMinutes: 30 });
  });

  it('выбор чипа уходит идентификатором, а имя не дублируется', async () => {
    const { onSubmit } = renderSheet();

    await userEvent.click(screen.getByRole('button', { name: 'Магнит' }));
    await userEvent.click(screen.getByRole('button', { name: /Открыть сбор/ }));

    expect(onSubmit).toHaveBeenCalledWith({ storeId: 2, collectMinutes: 30 });
  });

  it('выбранный чип подставляет имя в поле', async () => {
    renderSheet();

    await userEvent.click(screen.getByRole('button', { name: 'Магнит' }));

    expect(screen.getByLabelText('Откуда заказываем')).toHaveValue('Магнит');
  });

  /* Иначе показанное имя и отправленный id разошлись бы: человек правит текст,
     а уходит выбранная раньше запись справочника. */
  it('правка поля сбрасывает выбранный чип', async () => {
    const { onSubmit } = renderSheet();

    await userEvent.click(screen.getByRole('button', { name: 'Магнит' }));
    await userEvent.type(screen.getByLabelText('Откуда заказываем'), ' у дома');
    await userEvent.click(screen.getByRole('button', { name: /Открыть сбор/ }));

    expect(onSubmit).toHaveBeenCalledWith({
      storeName: 'Магнит у дома',
      collectMinutes: 30,
    });
  });

  it('окно сбора берётся из выбранного пресета', async () => {
    const { onSubmit } = renderSheet({ stores: [] });

    await userEvent.type(screen.getByLabelText('Откуда заказываем'), 'Ашан');
    await userEvent.click(screen.getByRole('button', { name: '15 мин' }));
    await userEvent.click(screen.getByRole('button', { name: /Открыть сбор/ }));

    expect(onSubmit).toHaveBeenCalledWith({ storeName: 'Ашан', collectMinutes: 15 });
  });

  it('пустой справочник чипов не показывает', () => {
    renderSheet({ stores: [] });

    expect(
      screen.queryByRole('group', { name: 'Магазины, которыми уже пользовались' }),
    ).not.toBeInTheDocument();
  });
});
