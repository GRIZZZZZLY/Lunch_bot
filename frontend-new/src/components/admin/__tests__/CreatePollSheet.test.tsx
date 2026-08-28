import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CreatePollSheet, type SheetSchedule } from '../CreatePollSheet';
import type { CreatePollContext } from '../types';

const ctx: CreatePollContext = {
  items: [
    { id: '3', emoji: '', name: 'Борщ', restaurant: 'Столовая', price: 250 },
    { id: '4', emoji: '', name: 'Плов', restaurant: 'Столовая', price: 300 },
  ],
  maxItems: 8,
  minItems: 2,
  groups: [{ id: '1', title: 'Тест на проде' }],
};

const schedule: SheetSchedule = {
  id: 1,
  isEnabled: true,
  days: ['Пн', 'Вт', 'Ср', 'Чт', 'Пт'],
  time: '11:00',
  durationMinutes: 30,
  itemIds: ['3', '4'],
};

function renderSheet(props: Partial<Parameters<typeof CreatePollSheet>[0]> = {}) {
  const onSubmit = vi.fn();
  const onDeleteSchedule = vi.fn();
  render(
    <CreatePollSheet
      open
      ctx={ctx}
      onClose={vi.fn()}
      onSubmit={onSubmit}
      onDeleteSchedule={onDeleteSchedule}
      {...props}
    />,
  );
  return { onSubmit, onDeleteSchedule };
}

const recurringSwitch = () => screen.getByRole('switch', { name: 'Повторяющийся опрос' });
const customSwitch = () => screen.getByRole('switch', { name: 'Другая длительность' });
const minutesField = () => screen.getByRole('spinbutton', { name: 'Длительность в минутах' });

async function pickTwoDishes() {
  await userEvent.click(screen.getByText('Борщ'));
  await userEvent.click(screen.getByText('Плов'));
}

describe('CreatePollSheet — длительность', () => {
  it('пресеты стоят отдельным рядом, кастомного чипа среди них нет', () => {
    renderSheet();
    for (const label of ['15 мин', '30 мин', '1 час']) {
      expect(screen.getByRole('button', { name: label })).toBeInTheDocument();
    }
    expect(screen.queryByRole('button', { name: 'Кастомное' })).not.toBeInTheDocument();
    // ручной ввод скрыт, пока переключатель выключен
    expect(screen.queryByRole('spinbutton', { name: 'Длительность в минутах' })).not.toBeInTheDocument();
  });

  it('пресет доходит до родителя в минутах', async () => {
    const { onSubmit } = renderSheet();
    await pickTwoDishes();
    await userEvent.click(screen.getByRole('button', { name: '1 час' }));
    await userEvent.click(screen.getByRole('button', { name: 'Запустить опрос' }));

    expect(onSubmit.mock.calls[0][0].durationMinutes).toBe(60);
  });

  it('ручной ввод отдаёт своё значение и снимает выбор с пресетов', async () => {
    const { onSubmit } = renderSheet();
    await pickTwoDishes();
    await userEvent.click(customSwitch());

    const field = minutesField();
    await userEvent.clear(field);
    await userEvent.type(field, '90');

    expect(screen.getByRole('button', { name: '30 мин' })).toHaveAttribute('aria-pressed', 'false');

    await userEvent.click(screen.getByRole('button', { name: 'Запустить опрос' }));
    const state = onSubmit.mock.calls[0][0];
    expect(state.durationMinutes).toBe(90);
    expect(state.customDuration).toBe(true);
  });

  it('значение вне 1–1440 блокирует отправку', async () => {
    renderSheet();
    await pickTwoDishes();
    await userEvent.click(customSwitch());

    const field = minutesField();
    await userEvent.clear(field);
    await userEvent.type(field, '5000');

    expect(screen.getByText('От 1 до 1440 минут')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Запустить опрос' })).toBeDisabled();
  });

  it('выключение ручного ввода возвращает к пресету', async () => {
    const { onSubmit } = renderSheet();
    await pickTwoDishes();
    await userEvent.click(customSwitch());
    const field = minutesField();
    await userEvent.clear(field);
    await userEvent.type(field, '90');
    await userEvent.click(customSwitch());

    expect(screen.getByRole('button', { name: '30 мин' })).toHaveAttribute('aria-pressed', 'true');
    await userEvent.click(screen.getByRole('button', { name: 'Запустить опрос' }));
    expect(onSubmit.mock.calls[0][0].durationMinutes).toBe(30);
  });

  it('нестандартная длительность расписания показывается числом, а не безымянным чипом', async () => {
    renderSheet({ schedule: { ...schedule, durationMinutes: 90 } });
    await userEvent.click(recurringSwitch());

    expect(customSwitch()).toHaveAttribute('aria-checked', 'true');
    expect(minutesField()).toHaveValue(90);
  });

  it('стандартная длительность расписания остаётся пресетом', async () => {
    renderSheet({ schedule: { ...schedule, durationMinutes: 15 } });
    await userEvent.click(recurringSwitch());

    expect(customSwitch()).toHaveAttribute('aria-checked', 'false');
    expect(screen.getByRole('button', { name: '15 мин' })).toHaveAttribute('aria-pressed', 'true');
  });
});

describe('CreatePollSheet — расписание уже настроено', () => {
  it('подсказывает текущее время и подставляет настройки при включении', async () => {
    renderSheet({ schedule });
    expect(screen.getByText(/сейчас 11:00/)).toBeInTheDocument();

    await userEvent.click(recurringSwitch());

    expect(screen.getByDisplayValue('11:00')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Сохранить расписание' })).toBeInTheDocument();
    for (const day of ['Пн', 'Пт']) {
      expect(screen.getByRole('button', { name: day }).className).toContain('on');
    }
    expect(screen.getByRole('button', { name: 'Сб' }).className).not.toContain('on');
  });

  it('помечает выключенное расписание', () => {
    renderSheet({ schedule: { ...schedule, isEnabled: false } });
    expect(screen.getByText(/выключено/)).toBeInTheDocument();
  });

  it('отдаёт изменённое время и дни родителю', async () => {
    const { onSubmit } = renderSheet({ schedule });
    await userEvent.click(recurringSwitch());
    await userEvent.click(screen.getByRole('button', { name: 'Сб' }));

    const time = screen.getByDisplayValue('11:00');
    await userEvent.clear(time);
    await userEvent.type(time, '12:15');

    await userEvent.click(screen.getByRole('button', { name: 'Сохранить расписание' }));

    expect(onSubmit).toHaveBeenCalledTimes(1);
    const state = onSubmit.mock.calls[0][0];
    expect(state.recurring).toBe(true);
    expect(state.recurringTime).toBe('12:15');
    expect(state.recurringDays).toContain('Сб');
  });

  it('удаление расписания зовёт обработчик', async () => {
    const { onDeleteSchedule } = renderSheet({ schedule });
    await userEvent.click(recurringSwitch());
    await userEvent.click(screen.getByRole('button', { name: 'Удалить расписание' }));
    expect(onDeleteSchedule).toHaveBeenCalledTimes(1);
  });

  it('без выбранных дней сохранение заблокировано', async () => {
    renderSheet({ schedule });
    await userEvent.click(recurringSwitch());
    for (const day of schedule.days) {
      await userEvent.click(screen.getByRole('button', { name: day }));
    }
    expect(screen.getByText('Выберите хотя бы один день')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Сохранить расписание' })).toBeDisabled();
  });
});

describe('CreatePollSheet — расписания нет', () => {
  it('переключатель ведёт к созданию, кнопка меняет смысл', async () => {
    renderSheet();
    expect(screen.getByRole('button', { name: 'Запустить опрос' })).toBeInTheDocument();

    await userEvent.click(recurringSwitch());
    expect(screen.getByRole('button', { name: 'Создать расписание' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Удалить расписание' })).not.toBeInTheDocument();
  });

  it('разовый опрос по-прежнему требует минимум два блюда', async () => {
    renderSheet();
    expect(screen.getByRole('button', { name: 'Запустить опрос' })).toBeDisabled();
    await userEvent.click(screen.getByText('Борщ'));
    await userEvent.click(screen.getByText('Плов'));
    expect(screen.getByRole('button', { name: 'Запустить опрос' })).toBeEnabled();
  });

  it('строка блюда — единственный контрол: один тап переключает ровно один раз', async () => {
    renderSheet();
    const row = screen.getByRole('checkbox', { name: /Борщ/ });
    // вложенной кнопки внутри строки больше нет — двойного переключения не бывает
    expect(row.querySelector('button')).toBeNull();
    await userEvent.click(row);
    expect(row).toHaveAttribute('aria-checked', 'true');
    await userEvent.click(row);
    expect(row).toHaveAttribute('aria-checked', 'false');
  });

  it('строка блюда доступна с клавиатуры', async () => {
    renderSheet();
    const row = screen.getByRole('checkbox', { name: /Борщ/ });
    row.focus();
    expect(row).toHaveFocus();
    await userEvent.keyboard(' ');
    expect(row).toHaveAttribute('aria-checked', 'true');
  });

  it('чипы дней сообщают выбор скринридеру', async () => {
    renderSheet();
    await userEvent.click(screen.getByRole('switch', { name: 'Повторяющийся опрос' }));
    const sat = screen.getByRole('button', { name: 'Сб', pressed: false });
    await userEvent.click(sat);
    expect(screen.getByRole('button', { name: 'Сб' })).toHaveAttribute('aria-pressed', 'true');
  });
});
