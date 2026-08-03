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
 *
 * Отдельно закреплена ловушка конфигурации: переменная называется
 * ADMIN_USER_IDS (множественное число), но получателя сервис берёт ровно одного
 * — первого в списке. Остальные перечисленные админы обратную связь не видят.
 * Читается это как опечатка в коде, поэтому пусть будет зафиксировано тестом.
 */
jest.mock('../../../utils/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

const { logger } = jest.requireMock('../../../utils/logger');

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

describe('доставка', () => {
  it('сообщение уходит настроенному админу с HTML-разметкой', async () => {
    const { feedbackService } = loadService(ADMIN);
    feedbackService.initialize(botWith(sendMessage));

    await feedbackService.sendToAdmin({ message: 'Кнопка не работает' });

    expect(sendMessage).toHaveBeenCalledWith(ADMIN, expect.any(String), {
      parse_mode: 'HTML',
    });
    expect(sentText()).toContain('Кнопка не работает');
  });

  it('в письме есть имя, username и id, когда они переданы', async () => {
    const { feedbackService } = loadService(ADMIN);
    feedbackService.initialize(botWith(sendMessage));

    await feedbackService.sendToAdmin({
      message: 'Идея',
      userId: 7,
      username: 'ivan',
      firstName: 'Иван',
    });

    const text = sentText();
    expect(text).toContain('Иван');
    expect(text).toContain('@ivan');
    expect(text).toContain('ID: 7');
  });

  it('анонимная обратная связь не добавляет пустых строк', async () => {
    const { feedbackService } = loadService(ADMIN);
    feedbackService.initialize(botWith(sendMessage));

    await feedbackService.sendToAdmin({ message: 'Идея' });

    const text = sentText();
    expect(text).not.toContain('Имя:');
    expect(text).not.toContain('Username:');
    expect(text).not.toContain('ID:');
  });

  it('только первый идентификатор из ADMIN_USER_IDS получает обратную связь', async () => {
    const { feedbackService } = loadService('500,600,700');
    feedbackService.initialize(botWith(sendMessage));

    await feedbackService.sendToAdmin({ message: 'Идея' });

    expect(sendMessage).toHaveBeenCalledTimes(1);
    expect(sendMessage.mock.calls[0][0]).toBe('500');
  });
});

describe('экранирование HTML', () => {
  it.each([
    ['угловые скобки в тексте', 'Оценка: 1 < 2 > 0', '1 &lt; 2 &gt; 0'],
    ['амперсанд', 'Плов & шурпа', 'Плов &amp; шурпа'],
    ['похоже на тег', 'нажал <b>оплатить</b>', '&lt;b&gt;оплатить&lt;/b&gt;'],
  ])('%s не ломает разметку', async (_name, input, expected) => {
    const { feedbackService } = loadService(ADMIN);
    feedbackService.initialize(botWith(sendMessage));

    await feedbackService.sendToAdmin({ message: input });

    expect(sentText()).toContain(expected);
  });

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

  it('амперсанд заменяется первым — иначе получилось бы &amp;lt;', async () => {
    const { feedbackService } = loadService(ADMIN);
    feedbackService.initialize(botWith(sendMessage));

    await feedbackService.sendToAdmin({ message: '&lt;' });

    expect(sentText()).toContain('&amp;lt;');
  });
});

describe('отказы', () => {
  it('без инициализации бота отправка падает, а не молчит', async () => {
    const { feedbackService } = loadService(ADMIN);

    await expect(
      feedbackService.sendToAdmin({ message: 'Идея' })
    ).rejects.toThrow('Bot not initialized');
    expect(logger.error).toHaveBeenCalledWith(
      '❌ [FeedbackService] Bot not initialized!'
    );
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

  it('о ненастроенном получателе предупреждают при загрузке', () => {
    loadService(undefined);

    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('ADMIN_USER_IDS not set')
    );
  });

  it('отказ Telegram пробрасывается — контроллер на нём отдаёт 500', async () => {
    const { feedbackService } = loadService(ADMIN);
    feedbackService.initialize(
      botWith(jest.fn().mockRejectedValue(new Error('bot was blocked')))
    );

    await expect(
      feedbackService.sendToAdmin({ message: 'Идея' })
    ).rejects.toThrow('Failed to send feedback');
    expect(logger.error).toHaveBeenCalledWith(
      '❌ [FeedbackService] Error sending feedback to admin:',
      expect.any(Error)
    );
  });

  it('текст исходной ошибки Telegram наружу не выносится', async () => {
    const { feedbackService } = loadService(ADMIN);
    feedbackService.initialize(
      botWith(jest.fn().mockRejectedValue(new Error('chat_id 500 not found')))
    );

    await expect(
      feedbackService.sendToAdmin({ message: 'Идея' })
    ).rejects.not.toThrow('500');
  });
});
