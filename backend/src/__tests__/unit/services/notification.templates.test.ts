/**
 * Шаблоны уведомлений как данные.
 *
 * Раньше реестр жил внутри приватного метода `NotificationService`, и проверить
 * текст можно было только через отправку: подними сервис, замокай Prisma и
 * бота, вычитай аргумент `sendMessage`. Из-за этой цены НИ ОДИН тест не смотрел
 * на текст, и порча кодировки (UTF-8, прочитанный как windows-1251) доехала до
 * продакшена. Здесь проверяется не формулировка, а то, что ломает доставку:
 * неподставленные значения и неэкранированный Markdown.
 */
import { notificationTemplates } from '../../../services/notification.templates';
import { NotificationType } from '../../../types/notification.types';

/** Маркеры mojibake из scripts/check-mojibake.mjs. */
const MOJIBAKE = /Р[°Ѕµё‘‚]|С[‚†Ѓњ‹]/;

/**
 * Данные, которых достаточно любому шаблону: у каждого свой тип, но поля
 * пересекаются, а `getMessage` объявлен на `any`. Один фикстур на всех — чтобы
 * добавленный шаблон попал под проверки без правки теста.
 */
const anyTemplateData = {
  groupTitle: 'Команда',
  menuItems: [{ id: 1, name: 'Плов' }],
  endTime: new Date('2026-08-03T09:00:00.000Z'),
  deadline: new Date('2026-08-03T09:00:00.000Z'),
  totalVotes: 3,
  mode: 'single-winner' as const,
  winnerItem: { id: 1, name: 'Плов', price: 250 },
  topItems: [{ item: { id: 1, name: 'Плов' }, votes: 3, percentage: 100 }],
  winner: { firstName: 'Игорь' },
  voters: [{ userId: 1, firstName: 'Игорь' }],
  cancelledBy: { firstName: 'Аня' },
};

describe('реестр шаблонов уведомлений', () => {
  it('ключ реестра совпадает с типом внутри шаблона', () => {
    for (const [type, template] of notificationTemplates) {
      expect(template.type).toBe(type);
    }
  });

  it.each([...notificationTemplates.keys()])('текст %s читаем и без дыр', type => {
    const message = notificationTemplates.get(type)!.getMessage(anyTemplateData);

    expect(message).not.toMatch(MOJIBAKE);
    // Неподставленный плейсхолдер и `undefined`/`NaN` в тексте — это то, что
    // пользователь видит буквально; шаблонная строка молча их не сигналит.
    expect(message).not.toContain('${');
    expect(message).not.toContain('undefined');
    expect(message).not.toContain('NaN');
    expect(message.trim().length).toBeGreaterThan(0);
  });

  it('шаблоны на Markdown экранируют подставляемые названия', () => {
    // Блюдо `Соус_острый` в legacy-Markdown даёт `can't parse entities`, и
    // сообщение не доходит вообще. Экранирование обязано жить в шаблоне:
    // транспорт не различает разметку и данные.
    const message = notificationTemplates
      .get(NotificationType.POLL_ENDED)!
      .getMessage({
        mode: 'multi-winner',
        totalVotes: 1,
        winners: [
          {
            menuItemName: 'Соус_острый *акция*',
            voters: [{ firstName: 'Аня_К' }],
          },
        ],
      });

    expect(message).toContain('Соус\\_острый \\*акция\\*');
    expect(message).toContain('Аня\\_К');
  });

  /**
   * Остаток шаблонов этого файла: экранированы были только POLL_ENDED, а имя
   * победителя рулетки, автор отмены, причина и список участников уходили
   * как есть.
   */
  it('остальные шаблоны на Markdown тоже экранируют подставляемые значения', () => {
    const winner = notificationTemplates
      .get(NotificationType.ROULETTE_WINNER)!
      .getMessage({
        winner: { firstName: 'Аня_К' },
        winnerItem: { name: 'Соус_острый *акция*' },
        voters: [],
      });
    expect(winner).toContain('Аня\\_К');
    expect(winner).toContain('Соус\\_острый \\*акция\\*');

    const cancelled = notificationTemplates
      .get(NotificationType.POLL_CANCELLED)!
      .getMessage({
        cancelledBy: { firstName: 'Аня_К' },
        reason: 'перенос *на завтра*',
        totalVotes: 1,
        voters: [{ firstName: 'Игорь_П', lastName: 'С_ов' }],
      });
    expect(cancelled).toContain('Аня\\_К');
    expect(cancelled).toContain('перенос \\*на завтра\\*');
    expect(cancelled).toContain('Игорь\\_П С\\_ов');
  });
});
