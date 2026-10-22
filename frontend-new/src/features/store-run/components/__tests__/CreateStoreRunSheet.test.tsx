import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import type { GroupStore } from '@/services/group-store.service';
import { _resetBackButtonForTests } from '@/lib/backButton';

/* Реквизиты инициатора: по умолчанию заполнены, чтобы остальные сценарии
   шторки не видели предупреждения. */
const pay = vi.hoisted(() => ({
  query: { isSuccess: true, data: undefined as unknown },
  update: { mutateAsync: vi.fn(), isPending: false },
}));
vi.mock('@/hooks/useUser', () => ({
  usePaymentInfo: () => pay.query,
  useUpdatePaymentInfo: () => pay.update,
}));

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
  pay.query = { isSuccess: true, data: { paymentPhone: '+79990001122' } };
  pay.update = { mutateAsync: vi.fn(), isPending: false };
});

/* Деньги за закупку получает тот, кто её открыл. Без реквизитов должникам
   потом некуда переводить — сказать об этом надо сейчас, а не после покупок. */
describe('CreateStoreRunSheet — реквизиты инициатора', () => {
  it('без реквизитов предупреждает и открывает форму поверх, не теряя введённого', async () => {
    pay.query = { isSuccess: true, data: undefined };
    renderSheet();

    await userEvent.type(screen.getByLabelText('Откуда заказываем'), 'Лента');
    expect(await screen.findByText(/Реквизитов нет/)).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Указать реквизиты' }));

    expect(await screen.findByRole('dialog', { name: 'Реквизиты СБП' })).toBeInTheDocument();
    expect(screen.getByLabelText('Откуда заказываем')).toHaveValue('Лента');
  });

  /* Подсказка грузится отдельным чанком: ждём, пока он отрисуется, иначе
     «предупреждения нет» проверялось бы до его появления. */
  it('с реквизитами предупреждения нет', async () => {
    renderSheet();
    await import('@/components/profile/PaymentMissingNotice');
    await act(async () => {});

    expect(screen.queryByText(/Реквизитов нет/)).not.toBeInTheDocument();
  });

  it('пока реквизиты не прочитаны, предупреждения нет — иначе оно соврало бы', async () => {
    pay.query = { isSuccess: false, data: undefined };
    renderSheet();
    await import('@/components/profile/PaymentMissingNotice');
    await act(async () => {});

    expect(screen.queryByText(/Реквизитов нет/)).not.toBeInTheDocument();
  });
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
});
