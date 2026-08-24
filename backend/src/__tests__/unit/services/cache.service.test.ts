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
  flushdb: jest.Mock;
  scanStream: jest.Mock;
  info: jest.Mock;
  dbsize: jest.Mock;
  keys: jest.Mock;
  exists: jest.Mock;
  ttl: jest.Mock;
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
    flushdb: jest.fn().mockResolvedValue('OK'),
    scanStream: jest.fn(),
    info: jest.fn().mockResolvedValue('stats'),
    dbsize: jest.fn().mockResolvedValue(7),
    keys: jest.fn().mockResolvedValue(['a']),
    exists: jest.fn().mockResolvedValue(1),
    ttl: jest.fn().mockResolvedValue(42),
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
  it('с включённым Redis клиент создаётся', () => {
    const { cacheService } = loadCache();

    expect(cacheService.getClient()).toBe(client);
  });

  it('с выключенным Redis клиента нет и кэш не используется', async () => {
    redisState.enabled = false;
    const { cacheService } = loadCache();

    expect(cacheService.getClient()).toBeNull();
    await expect(cacheService.get('k')).resolves.toBeUndefined();
    expect(client.get).not.toHaveBeenCalled();
  });

  it('падение при создании клиента не роняет приложение', async () => {
    redisState.createThrows = true;
    const { cacheService } = loadCache();

    expect(cacheService.getClient()).toBeNull();
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

  it('set по умолчанию живёт минуту', async () => {
    const { cacheService } = loadCache();

    await expect(cacheService.set('k', { a: 1 })).resolves.toBe(true);
    expect(client.setex).toHaveBeenCalledWith('k', 60, '{"a":1}');
  });

  it('явный TTL передаётся как есть', async () => {
    const { cacheService } = loadCache();

    await cacheService.set('k', 1, 15);

    expect(client.setex).toHaveBeenCalledWith('k', 15, '1');
  });

  it('ошибка записи возвращает false', async () => {
    const { cacheService } = loadCache();
    client.setex.mockRejectedValue(new Error('redis down'));

    await expect(cacheService.set('k', 1)).resolves.toBe(false);
  });
});

describe('статистика попаданий', () => {
  it('считает hit и miss и выводит процент', async () => {
    const { cacheService } = loadCache();
    client.get
      .mockResolvedValueOnce(JSON.stringify(1))
      .mockResolvedValueOnce(null);

    await cacheService.get('a');
    await cacheService.get('b');
    const stats = await cacheService.getStats();

    expect(stats).toMatchObject({
      hits: 1,
      misses: 1,
      hitRate: '50.00%',
      dbSize: 7,
      enabled: true,
    });
  });

  it('без обращений процент нулевой', async () => {
    const { cacheService } = loadCache();

    await expect(cacheService.getStats()).resolves.toMatchObject({
      hitRate: '0.00%',
    });
  });

  it('при выключенном кэше статистика помечена enabled: false', async () => {
    redisState.enabled = false;
    const { cacheService } = loadCache();

    await cacheService.get('a');

    await expect(cacheService.getStats()).resolves.toMatchObject({
      misses: 1,
      dbSize: 0,
      enabled: false,
    });
  });

  it('ошибка чтения статистики Redis не роняет ответ', async () => {
    const { cacheService } = loadCache();
    client.info.mockRejectedValue(new Error('redis down'));

    await expect(cacheService.getStats()).resolves.toMatchObject({
      enabled: false,
    });
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
  it('удаляет один ключ', async () => {
    const { cacheService } = loadCache();

    await expect(cacheService.del('k')).resolves.toBe(1);
    expect(client.del).toHaveBeenCalledWith('k');
  });

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

  it('flush очищает базу и сбрасывает счётчики', async () => {
    const { cacheService } = loadCache();
    client.get.mockResolvedValue(JSON.stringify(1));

    await cacheService.get('a');
    await cacheService.flush();

    expect(client.flushdb).toHaveBeenCalled();
    await expect(cacheService.getStats()).resolves.toMatchObject({ hits: 0 });
  });

  it('flush при недоступном кэше ничего не делает', async () => {
    redisState.enabled = false;
    const { cacheService } = loadCache();

    await cacheService.flush();

    expect(client.flushdb).not.toHaveBeenCalled();
  });

  it('ошибка flush не выбрасывается', async () => {
    const { cacheService } = loadCache();
    client.flushdb.mockRejectedValue(new Error('redis down'));

    await expect(cacheService.flush()).resolves.toBeUndefined();
  });

  it('has: существующий ключ', async () => {
    const { cacheService } = loadCache();

    await expect(cacheService.has('k')).resolves.toBe(true);
  });

  it('has: отсутствующий ключ', async () => {
    const { cacheService } = loadCache();
    client.exists.mockResolvedValue(0);

    await expect(cacheService.has('k')).resolves.toBe(false);
  });

  it('has: ошибка и недоступность дают false', async () => {
    const { cacheService } = loadCache();
    client.exists.mockRejectedValue(new Error('redis down'));
    await expect(cacheService.has('k')).resolves.toBe(false);

    redisState.enabled = false;
    const offline = loadCache();
    await expect(offline.cacheService.has('k')).resolves.toBe(false);
  });

  it('getTtl отдаёт срок жизни', async () => {
    const { cacheService } = loadCache();

    await expect(cacheService.getTtl('k')).resolves.toBe(42);
  });

  it('getTtl: ключ без срока (-1) трактуется как отсутствие срока', async () => {
    const { cacheService } = loadCache();
    client.ttl.mockResolvedValue(-1);

    await expect(cacheService.getTtl('k')).resolves.toBeUndefined();
  });

  it('getTtl: ошибка и недоступность дают undefined', async () => {
    const { cacheService } = loadCache();
    client.ttl.mockRejectedValue(new Error('redis down'));
    await expect(cacheService.getTtl('k')).resolves.toBeUndefined();

    redisState.enabled = false;
    const offline = loadCache();
    await expect(offline.cacheService.getTtl('k')).resolves.toBeUndefined();
  });

  it('keys отдаёт список по шаблону', async () => {
    const { cacheService } = loadCache();

    await expect(cacheService.keys('user_*')).resolves.toEqual(['a']);
    expect(client.keys).toHaveBeenCalledWith('user_*');
  });

  it('keys: ошибка и недоступность дают пустой список', async () => {
    const { cacheService } = loadCache();
    client.keys.mockRejectedValue(new Error('redis down'));
    await expect(cacheService.keys()).resolves.toEqual([]);

    redisState.enabled = false;
    const offline = loadCache();
    await expect(offline.cacheService.keys()).resolves.toEqual([]);
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

    expect(client.scanStream).toHaveBeenCalledWith({
      match: '*stats*',
      count: 100,
    });
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

describe('CACHE_KEYS', () => {
  it('ключи строятся по идентификаторам', () => {
    const { CACHE_KEYS } = loadCache();

    expect(CACHE_KEYS.ACTIVE_POLLS_GROUP(7)).toBe('active_polls_group_7');
    expect(CACHE_KEYS.ACTIVE_POLL_GROUP(7)).toBe('active_poll_group_7');
    expect(CACHE_KEYS.POLL_DETAILS(3)).toBe('poll_3');
    expect(CACHE_KEYS.POLL_VOTES(3)).toBe('poll_votes_3');
    expect(CACHE_KEYS.POLL_VOTE_BREAKDOWN(3)).toBe('poll_vote_breakdown_3');
    expect(CACHE_KEYS.MENU_ITEMS_BY_CATEGORY('Горячее')).toBe(
      'menu_items_category_Горячее'
    );
    expect(CACHE_KEYS.USER(1)).toBe('user_1');
    expect(CACHE_KEYS.USER_BY_TELEGRAM_ID(BigInt(555))).toBe(
      'user_telegram_555'
    );
    expect(CACHE_KEYS.GROUP(2)).toBe('group_2');
    expect(CACHE_KEYS.GROUP_BY_TELEGRAM_ID(BigInt(-100))).toBe(
      'group_telegram_-100'
    );
    expect(CACHE_KEYS.USER_STATS(1)).toBe('user_stats_1');
  });

  it('статистика без группы — глобальный ключ', () => {
    const { CACHE_KEYS } = loadCache();

    expect(CACHE_KEYS.POLL_STATS()).toBe('stats_global');
    expect(CACHE_KEYS.POLL_STATS(5)).toBe('stats_5');
  });
});

describe('CacheInvalidator', () => {
  it('изменение голосования сбрасывает детали, голоса и статистику', async () => {
    const { CacheInvalidator, cacheService } = loadCache();
    client.scanStream.mockReturnValue({ on: jest.fn() });
    const del = jest.spyOn(cacheService, 'del');
    const invalidate = jest.spyOn(cacheService, 'invalidatePattern');

    await CacheInvalidator.invalidatePoll(3);

    expect(del).toHaveBeenCalledWith([
      'active_polls',
      'poll_3',
      'poll_votes_3',
      'poll_vote_breakdown_3',
    ]);
    expect(invalidate).toHaveBeenCalledWith('stats');
  });

  it('с известной группой сбрасывается и её список активных голосований', async () => {
    const { CacheInvalidator, cacheService } = loadCache();
    client.scanStream.mockReturnValue({ on: jest.fn() });
    const del = jest.spyOn(cacheService, 'del');

    await CacheInvalidator.invalidatePoll(3, 7);

    expect(del).toHaveBeenCalledWith(
      expect.arrayContaining(['active_polls_group_7', 'active_poll_group_7'])
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

  it('новый голос сбрасывает голоса и детали, но не список активных', async () => {
    const { CacheInvalidator, cacheService } = loadCache();
    client.scanStream.mockReturnValue({ on: jest.fn() });
    const del = jest.spyOn(cacheService, 'del');

    await CacheInvalidator.invalidateVote(3);

    expect(del).toHaveBeenCalledWith([
      'poll_votes_3',
      'poll_vote_breakdown_3',
      'poll_3',
    ]);
  });

  it('изменение меню сбрасывает ключ только своей группы', () => {
    const { CacheInvalidator, cacheService } = loadCache();
    const del = jest.spyOn(cacheService, 'del');

    CacheInvalidator.invalidateMenu(7);

    expect(del).toHaveBeenCalledWith('menu_items_active:7');
  });

  it('изменение пользователя сбрасывает и ключ по telegramId', async () => {
    const { CacheInvalidator, cacheService } = loadCache();
    const del = jest.spyOn(cacheService, 'del');

    await CacheInvalidator.invalidateUser(1, BigInt(555));

    expect(del).toHaveBeenCalledWith(['user_1', 'user_telegram_555']);
  });

  it('без telegramId сбрасывается только ключ по id', async () => {
    const { CacheInvalidator, cacheService } = loadCache();
    const del = jest.spyOn(cacheService, 'del');

    await CacheInvalidator.invalidateUser(1);

    expect(del).toHaveBeenCalledWith(['user_1']);
  });
});
