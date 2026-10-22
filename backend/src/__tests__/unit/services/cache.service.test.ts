/**
 * Кэш на Redis. Главное свойство: кэш — необязательная деталь. Если Redis
 * выключен, недоступен или упал посреди запроса, приложение обязано продолжать
 * работать, а не отдавать 500. Поэтому почти каждый тест здесь проверяет
 * поведение при недоступном клиенте.
 *
 * Отдельно проверяется deleteIfValueMatches: снимать распределённую блокировку
 * обычным DEL нельзя — после истечения TTL ключ мог достаться другому процессу.
 */

/** Состояние, которое читает мок конфигурации Redis при загрузке сервиса. */
const redisState: {
  enabled: boolean;
  client: FakeRedis | null;
  createThrows: boolean;
} = { enabled: true, client: null, createThrows: false };

jest.mock('../../../config/redis.config', () => ({
  get REDIS_ENABLED() {
    return redisState.enabled;
  },
  createRedisClient: () => {
    if (redisState.createThrows) {
      throw new Error('cannot connect');
    }
    return redisState.client;
  },
}));

jest.mock('../../../utils/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

interface FakeRedis {
  status: string;
  get: jest.Mock;
  setex: jest.Mock;
  set: jest.Mock;
  del: jest.Mock;
  eval: jest.Mock;
  ping: jest.Mock;
  scanStream: jest.Mock;
  quit: jest.Mock;
  disconnect: jest.Mock;
}

function fakeRedis(overrides: Partial<FakeRedis> = {}): FakeRedis {
  return {
    status: 'ready',
    get: jest.fn().mockResolvedValue(null),
    setex: jest.fn().mockResolvedValue('OK'),
    set: jest.fn().mockResolvedValue('OK'),
    del: jest.fn().mockResolvedValue(1),
    eval: jest.fn().mockResolvedValue(1),
    ping: jest.fn().mockResolvedValue('PONG'),
    scanStream: jest.fn(),
    quit: jest.fn().mockResolvedValue('OK'),
    disconnect: jest.fn(),
    ...overrides,
  };
}

type CacheModule = typeof import('../../../services/cache.service');

/**
 * Сервис — синглтон, создаваемый на импорте: он читает REDIS_ENABLED и создаёт
 * клиент в конструкторе. Поэтому каждый сценарий загружает модуль заново.
 */
function loadCache(): CacheModule {
  let mod: CacheModule = null as unknown as CacheModule;
  jest.isolateModules(() => {
    mod = require('../../../services/cache.service');
  });
  return mod;
}

let client: FakeRedis;

beforeEach(() => {
  jest.clearAllMocks();
  client = fakeRedis();
  redisState.enabled = true;
  redisState.client = client;
  redisState.createThrows = false;
});

describe('инициализация', () => {

  it('с выключенным Redis клиента нет и кэш не используется', async () => {
    redisState.enabled = false;
    const { cacheService } = loadCache();

    await expect(cacheService.get('k')).resolves.toBeUndefined();
    expect(client.get).not.toHaveBeenCalled();
  });

  it('падение при создании клиента не роняет приложение', async () => {
    redisState.createThrows = true;
    const { cacheService } = loadCache();

    await expect(cacheService.set('k', 1)).resolves.toBe(false);
  });

  it('неготовый клиент считается недоступным', async () => {
    client.status = 'connecting';
    const { cacheService } = loadCache();

    await expect(cacheService.get('k')).resolves.toBeUndefined();
    expect(client.get).not.toHaveBeenCalled();
  });
});

describe('get / set', () => {
  it('записанное значение читается как объект', async () => {
    const { cacheService } = loadCache();
    client.get.mockResolvedValue(JSON.stringify({ a: 1 }));

    await expect(cacheService.get('k')).resolves.toEqual({ a: 1 });
  });

  it('отсутствующий ключ — undefined', async () => {
    const { cacheService } = loadCache();

    await expect(cacheService.get('k')).resolves.toBeUndefined();
  });

  it('ошибка чтения не выбрасывается наружу', async () => {
    const { cacheService } = loadCache();
    client.get.mockRejectedValue(new Error('redis down'));

    await expect(cacheService.get('k')).resolves.toBeUndefined();
  });

  it('битый JSON в кэше не роняет запрос', async () => {
    const { cacheService } = loadCache();
    client.get.mockResolvedValue('{не json');

    await expect(cacheService.get('k')).resolves.toBeUndefined();
  });

  it('явный TTL передаётся как есть', async () => {
    const { cacheService } = loadCache();

    await cacheService.set('k', 1, 15);

    expect(client.setex).toHaveBeenCalledWith('k', 15, '1');
  });

  /* Опросы и пользователи несут BigInt (chatId, telegramId). JSON.stringify на
     них падал: кэш активных опросов не записывался никогда, каждый запрос шёл
     в базу и писал в журнал «Cache write failed». */
  it('BigInt записывается строкой, а не роняет запись', async () => {
    const { cacheService } = loadCache();

    await expect(cacheService.set('k', { chatId: BigInt('-1001234') })).resolves.toBe(true);
    expect(client.setex).toHaveBeenCalledWith(
      'k',
      expect.any(Number),
      '{"chatId":"-1001234"}'
    );
  });

  it('ошибка записи возвращает false', async () => {
    const { cacheService } = loadCache();
    client.setex.mockRejectedValue(new Error('redis down'));

    await expect(cacheService.set('k', 1)).resolves.toBe(false);
  });
});

describe('setIfAbsent (защита от повторов)', () => {
  it('свободный ключ занимается', async () => {
    const { cacheService } = loadCache();

    await expect(cacheService.setIfAbsent('lock', 'me', 30)).resolves.toBe(
      'stored'
    );
    expect(client.set).toHaveBeenCalledWith('lock', '"me"', 'EX', 30, 'NX');
  });

  it('занятый ключ отдаёт exists', async () => {
    const { cacheService } = loadCache();
    client.set.mockResolvedValue(null);

    await expect(cacheService.setIfAbsent('lock', 'me', 30)).resolves.toBe(
      'exists'
    );
  });

  it('недоступный Redis отдаёт unavailable, а не «занято»', async () => {
    redisState.enabled = false;
    const { cacheService } = loadCache();

    await expect(cacheService.setIfAbsent('lock', 'me', 30)).resolves.toBe(
      'unavailable'
    );
  });

  it('ошибка Redis тоже unavailable', async () => {
    const { cacheService } = loadCache();
    client.set.mockRejectedValue(new Error('redis down'));

    await expect(cacheService.setIfAbsent('lock', 'me', 30)).resolves.toBe(
      'unavailable'
    );
  });
});

describe('удаление', () => {
  it('удаляет список ключей одним вызовом', async () => {
    const { cacheService } = loadCache();
    client.del.mockResolvedValue(2);

    await expect(cacheService.del(['a', 'b'])).resolves.toBe(2);
    expect(client.del).toHaveBeenCalledWith('a', 'b');
  });

  it('при недоступном кэше удаление — ноль ключей', async () => {
    redisState.enabled = false;
    const { cacheService } = loadCache();

    await expect(cacheService.del('k')).resolves.toBe(0);
  });

  it('ошибка удаления не выбрасывается', async () => {
    const { cacheService } = loadCache();
    client.del.mockRejectedValue(new Error('redis down'));

    await expect(cacheService.del('k')).resolves.toBe(0);
  });
});

describe('deleteIfValueMatches (снятие своей блокировки)', () => {
  it('снимает блокировку через Lua-скрипт со сравнением значения', async () => {
    const { cacheService } = loadCache();

    await expect(cacheService.deleteIfValueMatches('lock', 'me')).resolves.toBe(
      true
    );
    const [script, keyCount, key, value] = client.eval.mock.calls[0];
    expect(script).toContain("redis.call('get', KEYS[1]) == ARGV[1]");
    expect(keyCount).toBe(1);
    expect(key).toBe('lock');
    expect(value).toBe('"me"');
  });

  it('чужую блокировку не снимает', async () => {
    const { cacheService } = loadCache();
    client.eval.mockResolvedValue(0);

    await expect(cacheService.deleteIfValueMatches('lock', 'me')).resolves.toBe(
      false
    );
  });

  it('недоступный Redis — false', async () => {
    redisState.enabled = false;
    const { cacheService } = loadCache();

    await expect(cacheService.deleteIfValueMatches('lock', 'me')).resolves.toBe(
      false
    );
  });

  it('ошибка скрипта — false', async () => {
    const { cacheService } = loadCache();
    client.eval.mockRejectedValue(new Error('NOSCRIPT'));

    await expect(cacheService.deleteIfValueMatches('lock', 'me')).resolves.toBe(
      false
    );
  });
});

describe('getOrSet', () => {
  it('на попадании fetcher не вызывается', async () => {
    const { cacheService } = loadCache();
    client.get.mockResolvedValue(JSON.stringify('cached'));
    const fetcher = jest.fn();

    await expect(cacheService.getOrSet('k', fetcher)).resolves.toBe('cached');
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('на промахе значение считается и кладётся в кэш', async () => {
    const { cacheService } = loadCache();
    const fetcher = jest.fn().mockResolvedValue('fresh');

    await expect(cacheService.getOrSet('k', fetcher, 15)).resolves.toBe('fresh');
    expect(client.setex).toHaveBeenCalledWith('k', 15, '"fresh"');
  });

  it('при выключенном кэше fetcher вызывается каждый раз', async () => {
    redisState.enabled = false;
    const { cacheService } = loadCache();
    const fetcher = jest.fn().mockResolvedValue('fresh');

    await cacheService.getOrSet('k', fetcher);
    await cacheService.getOrSet('k', fetcher);

    expect(fetcher).toHaveBeenCalledTimes(2);
  });
});

describe('прочие операции', () => {
  it('healthCheck: готовый Redis отвечает PONG', async () => {
    const { cacheService } = loadCache();

    await expect(cacheService.healthCheck()).resolves.toBe(true);
  });

  it('healthCheck: выключенный кэш считается здоровым', async () => {
    redisState.enabled = false;
    const { cacheService } = loadCache();

    await expect(cacheService.healthCheck()).resolves.toBe(true);
  });

  it('healthCheck: включённый но неготовый Redis — нездоров', async () => {
    client.status = 'connecting';
    const { cacheService } = loadCache();

    await expect(cacheService.healthCheck()).resolves.toBe(false);
  });

  it('healthCheck: ошибка ping — нездоров', async () => {
    const { cacheService } = loadCache();
    client.ping.mockRejectedValue(new Error('timeout'));

    await expect(cacheService.healthCheck()).resolves.toBe(false);
  });

  it('close закрывает соединение', async () => {
    const { cacheService } = loadCache();

    await cacheService.close();

    expect(client.quit).toHaveBeenCalled();
  });

  it('close без клиента ничего не делает', async () => {
    redisState.enabled = false;
    const { cacheService } = loadCache();

    await expect(cacheService.close()).resolves.toBeUndefined();
  });

  it('уже закрытое соединение не закрывается второй раз', async () => {
    client.status = 'end';
    const { cacheService } = loadCache();

    await cacheService.close();

    expect(client.quit).not.toHaveBeenCalled();
  });

  it('падение quit добивается disconnect (идемпотентное завершение)', async () => {
    const { cacheService } = loadCache();
    client.quit.mockRejectedValue(new Error('connection lost'));

    await cacheService.close();

    expect(client.disconnect).toHaveBeenCalled();
  });
});

describe('invalidatePattern', () => {
  /** scanStream отдаёт ключи событиями data/end, как настоящий поток ioredis. */
  function streamOf(batches: string[][]): {
    on: jest.Mock;
    handlers: Record<string, Array<(keys?: string[]) => void>>;
  } {
    const handlers: Record<string, Array<(keys?: string[]) => void>> = {};
    return {
      handlers,
      on: jest.fn((event: string, handler: (keys?: string[]) => void) => {
        handlers[event] = handlers[event] ?? [];
        handlers[event].push(handler);
        if (event === 'end') {
          for (const batch of batches) {
            for (const dataHandler of handlers.data ?? []) dataHandler(batch);
          }
          handler();
        }
      }),
    };
  }

  it('найденные ключи удаляются одним вызовом', async () => {
    const { cacheService } = loadCache();
    client.scanStream.mockReturnValue(streamOf([['a', 'b'], ['c']]));

    await cacheService.invalidatePattern('stats');

    expect(client.scanStream).toHaveBeenCalledWith(
      expect.objectContaining({ match: '*stats*' })
    );
    expect(client.del).toHaveBeenCalledWith('a', 'b', 'c');
  });

  it('пустой результат не вызывает удаление', async () => {
    const { cacheService } = loadCache();
    client.scanStream.mockReturnValue(streamOf([]));

    await cacheService.invalidatePattern('stats');

    expect(client.del).not.toHaveBeenCalled();
  });

  it('при недоступном кэше сканирования нет', async () => {
    redisState.enabled = false;
    const { cacheService } = loadCache();

    await cacheService.invalidatePattern('stats');

    expect(client.scanStream).not.toHaveBeenCalled();
  });

  it('ошибка сканирования не выбрасывается', async () => {
    const { cacheService } = loadCache();
    client.scanStream.mockImplementation(() => {
      throw new Error('redis down');
    });

    await expect(
      cacheService.invalidatePattern('stats')
    ).resolves.toBeUndefined();
  });
});

describe('CacheInvalidator', () => {
  it('изменение голосования сбрасывает его детали, голоса и разбивку', async () => {
    const { CacheInvalidator, CACHE_KEYS, cacheService } = loadCache();
    client.scanStream.mockReturnValue({ on: jest.fn() });
    const del = jest.spyOn(cacheService, 'del');

    await CacheInvalidator.invalidatePoll(3);

    expect(del).toHaveBeenCalledWith(
      expect.arrayContaining([
        CACHE_KEYS.POLL_DETAILS(3),
        CACHE_KEYS.POLL_VOTES(3),
        CACHE_KEYS.POLL_VOTE_BREAKDOWN(3),
      ])
    );
  });

  it('с известной группой сбрасывается и её список активных голосований', async () => {
    const { CacheInvalidator, CACHE_KEYS, cacheService } = loadCache();
    client.scanStream.mockReturnValue({ on: jest.fn() });
    const del = jest.spyOn(cacheService, 'del');

    await CacheInvalidator.invalidatePoll(3, 7);

    expect(del).toHaveBeenCalledWith(
      expect.arrayContaining([
        CACHE_KEYS.ACTIVE_POLLS_GROUP(7),
        CACHE_KEYS.ACTIVE_POLL_GROUP(7),
      ])
    );
  });

  /* Список и одно голосование — разные формы данных, и один ключ на двоих
     стоил инцидента 2026-08-24: список клал в него `[]`, а проверка «есть ли
     активное голосование» читала пустой массив как «есть». */
  it('список и одиночное голосование группы лежат в РАЗНЫХ ключах', () => {
    const { CACHE_KEYS } = loadCache();

    expect(CACHE_KEYS.ACTIVE_POLL_GROUP(7)).not.toBe(
      CACHE_KEYS.ACTIVE_POLLS_GROUP(7)
    );
  });
});
