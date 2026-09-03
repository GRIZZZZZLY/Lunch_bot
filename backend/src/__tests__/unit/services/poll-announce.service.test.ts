/**
 * Личные уведомления об итогах голосования — запасной путь, который включается
 * только когда основной (уведомления по категориям) упал. Именно поэтому его
 * текст никто не проверял, а он подставляет в Markdown всё сразу: блюдо, имя и
 * логин ответственного и его реквизиты.
 *
 * Реквизиты здесь уходят в ЛС ДРУГИМ участникам, то есть неэкранированная
 * строка из чужого профиля — не только `can't parse entities`, но и
 * возможность подсунуть человеку кликабельную ссылку.
 */
import { notifyParticipantsLegacy } from '../../../services/poll-announce.service';
import { UserService } from '../../../services/user.service';
import { VoteService } from '../../../services/vote.service';
import { getBotInstance } from '../../../bot/bot-instance';
import { asMock, asServiceMock } from '../../helpers/mocks';

jest.mock('../../../services/user.service', () => ({
  UserService: { getPaymentInfo: jest.fn() },
}));

jest.mock('../../../services/vote.service', () => ({
  VoteService: { getPollVotes: jest.fn() },
}));

jest.mock('../../../bot/bot-instance', () => ({
  getBotInstance: jest.fn(),
  getRequiredBotInstance: jest.fn(),
}));

jest.mock('../../../utils/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

const userService = asServiceMock(UserService);
const voteService = asServiceMock(VoteService);
const botInstance = asMock(getBotInstance);

let sendMessage: jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();

  sendMessage = jest.fn().mockResolvedValue({ message_id: 1 });
  botInstance.mockReturnValue({ api: { sendMessage } });

  voteService.getPollVotes.mockResolvedValue([
    { menuItemId: 1, user: { id: 1, telegramId: BigInt(555) } },
  ]);
  userService.getPaymentInfo.mockResolvedValue(null);
});

describe('notifyParticipantsLegacy', () => {
  it('блюда, имя, логин и реквизиты ответственного экранируются', async () => {
    userService.getPaymentInfo.mockResolvedValue({
      paymentCard: '2200_1234',
      paymentPhone: '+7_999',
      paymentDetails: 'СБП [тут](https://evil.example)',
    });

    await notifyParticipantsLegacy(
      5,
      [{ menuItemId: 1, menuItemName: 'Соус_острый *акция*', votes: 1 }],
      { id: 2, firstName: 'Аня_К', username: 'anya_k' }
    );

    const message = sendMessage.mock.calls[0][1] as string;
    expect(message).toContain('**Соус\\_острый \\*акция\\***');
    expect(message).toContain('Ответственный: Аня\\_К (@anya\\_k)');
    expect(message).toContain('2200\\_1234');
    expect(message).toContain('+7\\_999');
    expect(message).toContain('СБП \\[тут](https://evil.example)');
  });

  /* Реквизит с обратной кавычкой раньше ломал сообщение: значение стояло в
     code-span, а внутри code-span экранировать нечем — legacy-Markdown отдаёт
     `\` в текст как есть. */
  it('обратная кавычка в реквизите больше не ломает разметку', async () => {
    userService.getPaymentInfo.mockResolvedValue({
      paymentCard: 'карта`с кавычкой',
      paymentPhone: null,
      paymentDetails: null,
    });

    await notifyParticipantsLegacy(5, [], {
      id: 2,
      firstName: 'Аня',
      username: null,
    });

    const message = sendMessage.mock.calls[0][1] as string;
    expect(message).toContain('карта\\`с кавычкой');
  });

  it('без ответственного письмо ограничивается итогами', async () => {
    await notifyParticipantsLegacy(
      5,
      [{ menuItemId: 1, menuItemName: 'Плов', votes: 1 }],
      null
    );

    const message = sendMessage.mock.calls[0][1] as string;
    expect(message).toContain('Победитель: **Плов**');
    expect(message).not.toContain('Информация для оплаты');
  });

  it('без голосов рассылки нет', async () => {
    voteService.getPollVotes.mockResolvedValue([]);

    await notifyParticipantsLegacy(5, [], null);

    expect(sendMessage).not.toHaveBeenCalled();
  });

  it('без бота рассылка не запускается', async () => {
    botInstance.mockReturnValue(null);

    await expect(
      notifyParticipantsLegacy(5, [], null)
    ).resolves.toBeUndefined();
    expect(voteService.getPollVotes).not.toHaveBeenCalled();
  });
});
