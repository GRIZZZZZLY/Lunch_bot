/**
 * Шаблоны уведомлений о голосовании уходят в legacy-Markdown. Подставленное
 * без экранирования `Соус_острый` даёт от Telegram `can't parse entities`, и
 * сообщение не доходит вообще. Порчу кодировки в исходниках ловит
 * `npm run check:mojibake` в корне репозитория.
 */
import { notificationTemplates } from '../../../services/notification.templates';
import { NotificationType } from '../../../types/notification.types';

describe('шаблоны уведомлений экранируют подставленный текст', () => {
  it('итоги голосования экранируют блюдо и голосовавших', () => {
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
