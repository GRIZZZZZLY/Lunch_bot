/**
 * Обратная связь: человек пишет из приложения, сервис доставляет в Telegram.
 *
 * Два свойства, из-за которых это стоит тестов.
 *
 * 1. Экранирование HTML. Сообщение уходит с `parse_mode: 'HTML'`, поэтому текст
 *    вида «1 < 2» или «<3» без экранирования делает разметку невалидной, и
 *    Telegram отвергает ВСЁ сообщение. Человек при этом уже увидел «спасибо»:
 *    жалоба теряется на самом безобидном вводе.
 * 2. Сбой обязан пробрасываться наружу, а не глотаться. Контроллер на нём
 *    отдаёт 500 — только поэтому пользователь узнаёт, что не дошло.
 */
jest.mock('../../../utils/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

type FeedbackModule = typeof import('../../../services/feedback.service');

interface BotApi {
  sendMessage: jest.Mock;
}

/**
 * Сервис читает ADMIN_USER_IDS в КОНСТРУКТОРЕ, а экземпляр создаётся при
 * импорте модуля. Значит под каждый набор переменных нужен свой экземпляр —
 * иначе тест про «не настроен получатель» проверял бы уже созданный объект.
 */
function loadService(adminUserIds: string | undefined): FeedbackModule {
  if (adminUserIds === undefined) {
    delete process.env.ADMIN_USER_IDS;
  } else {
    process.env.ADMIN_USER_IDS = adminUserIds;
  }

  let mod: FeedbackModule = null as unknown as FeedbackModule;
  jest.isolateModules(() => {
    mod = require('../../../services/feedback.service');
  });
  return mod;
}

function botWith(sendMessage: jest.Mock): { api: BotApi } {
  return { api: { sendMessage } };
}

const NOW = new Date('2026-08-03T12:00:00.000Z');
const ADMIN = '500';

let envBackup: NodeJS.ProcessEnv;
let sendMessage: jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers().setSystemTime(NOW);
  envBackup = { ...process.env };
  sendMessage = jest.fn().mockResolvedValue({ message_id: 1 });
});

afterEach(() => {
  jest.useRealTimers();
  process.env = envBackup;
});

/** Текст, ушедший в Telegram. */
function sentText(): string {
  return sendMessage.mock.calls[0][1] as string;
}

describe('экранирование HTML', () => {
  it('имя и username экранируются так же, как текст', async () => {
    const { feedbackService } = loadService(ADMIN);
    feedbackService.initialize(botWith(sendMessage));

    await feedbackService.sendToAdmin({
      message: 'Идея',
      firstName: '<script>',
      username: 'i<v>an',
    });

    const text = sentText();
    expect(text).not.toContain('<script>');
    expect(text).toContain('&lt;script&gt;');
    expect(text).toContain('i&lt;v&gt;an');
  });
});

describe('отказы', () => {
  it('без инициализации бота отправка падает, а не молчит', async () => {
    const { feedbackService } = loadService(ADMIN);

    await expect(
      feedbackService.sendToAdmin({ message: 'Идея' })
    ).rejects.toThrow('Bot not initialized');
  });

  it('без настроенного получателя отправка падает', async () => {
    const { feedbackService } = loadService(undefined);
    feedbackService.initialize(botWith(sendMessage));

    await expect(
      feedbackService.sendToAdmin({ message: 'Идея' })
    ).rejects.toThrow('Admin user ID not configured');
    expect(sendMessage).not.toHaveBeenCalled();
  });

  it('пустой ADMIN_USER_IDS равносилен отсутствию', async () => {
    const { feedbackService } = loadService('');
    feedbackService.initialize(botWith(sendMessage));

    await expect(
      feedbackService.sendToAdmin({ message: 'Идея' })
    ).rejects.toThrow('Admin user ID not configured');
  });
});
