import { UserItemPreset } from '@prisma/client';

import { prisma } from '../database/client';
import { logger } from '../utils/logger';
import { normalizeName } from '../utils/normalize-name';

/**
 * Сколько незакреплённых пресетов держим на пользователя. Закреплённые сверх
 * лимита не вытесняются: закрепление — это явная просьба сохранить.
 */
const RETENTION_LIMIT = 50;
/** Сколько отдаём на экран. Совпадает с лимитом хранения не случайно: длиннее список никто не листает. */
const LIST_LIMIT = 50;
/** Сколько прошлых позиций смотрим, определяя «брал в этом магазине». */
const STORE_HISTORY_LIMIT = 500;

const NAME_MAX_LEN = 200;
const NOTES_MAX_LEN = 500;
const QUANTITY_MIN = 1;
const QUANTITY_MAX = 99;

export interface RecordUsageInput {
  name: string;
  quantity?: number;
  notes?: string | null;
}

export interface UpdatePresetInput {
  name?: string;
  quantity?: number;
  notes?: string | null;
  pinned?: boolean;
}

export class UserItemPresetError extends Error {
  constructor(
    public code: 'NOT_FOUND' | 'INVALID_INPUT',
    message: string,
  ) {
    super(message);
    this.name = 'UserItemPresetError';
  }
}

/**
 * Личный список товаров пользователя, переносимый между группами.
 *
 * Пополняется сам, из обычной работы с забегом: пользователь не ведёт
 * справочник, он просто заказывает продукты. Отсюда два следствия — запись
 * никогда не роняет основное действие (`recordUsage` глотает свои ошибки) и
 * список ограничен сверху, иначе разовые покупки вытеснили бы постоянные.
 */
export class UserItemPresetService {
  /**
   * Список для экрана добавления позиции.
   *
   * Порядок ярусов: закреплённые → взятое в ЭТОМ магазине → взятое в ЭТОЙ
   * группе → по свежести. Ярус группы отвечает на то, что список общий для всех
   * групп: у человека, который заказывает и в офис, и на дачу, дачные товары
   * просто уезжают вниз, а не теряются — привязка пресета к группе стоила бы
   * пустого списка при каждом переходе.
   *
   * Выборка идёт ДВУМЯ запросами и объединяется здесь. Первый берёт то, что
   * обязано быть в списке всегда (закреплённое и знакомое по истории), второй —
   * `LIST_LIMIT` самых свежих. Раньше запрос был один, с отсечкой ДО
   * ранжирования, и закреплённый товар, не попавший в полсотни свежих, не
   * всплывал наверх — он вообще не доезжал до сортировки. Размер объединения
   * ограничен сверху самим хранилищем: незакреплённых у пользователя не больше
   * `RETENTION_LIMIT`.
   *
   * `groupId` приходит из query и на авторизацию не влияет: читается только
   * собственная история пользователя, и подставленный чужой идентификатор
   * меняет лишь порядок его же списка.
   */
  static async listForUser(
    userId: number,
    scope: { storeId?: number | null; groupId?: number | null } = {},
  ): Promise<UserItemPreset[]> {
    const { seenInStore, seenInGroup } = await this.historyNames(userId, scope);
    const relevant = [...new Set([...seenInStore, ...seenInGroup])];

    const [guaranteed, recent] = await Promise.all([
      prisma.userItemPreset.findMany({
        where: {
          userId,
          OR: [
            { pinned: true },
            ...(relevant.length > 0 ? [{ normalizedName: { in: relevant } }] : []),
          ],
        },
      }),
      prisma.userItemPreset.findMany({
        where: { userId },
        orderBy: [{ lastUsedAt: 'desc' }],
        take: LIST_LIMIT,
      }),
    ]);

    const byId = new Map<number, UserItemPreset>();
    for (const item of [...guaranteed, ...recent]) byId.set(item.id, item);

    return [...byId.values()].sort((a, b) => {
      const byPinned = Number(b.pinned) - Number(a.pinned);
      if (byPinned !== 0) return byPinned;

      const byStore =
        Number(seenInStore.has(b.normalizedName)) - Number(seenInStore.has(a.normalizedName));
      if (byStore !== 0) return byStore;

      const byGroup =
        Number(seenInGroup.has(b.normalizedName)) - Number(seenInGroup.has(a.normalizedName));
      if (byGroup !== 0) return byGroup;

      const byRecency = b.lastUsedAt.getTime() - a.lastUsedAt.getTime();
      if (byRecency !== 0) return byRecency;

      /* Последний разрыв по id: без него порядок записей с одинаковой меткой
         зависел бы от того, в какой выборке они пришли первыми. */
      return a.id - b.id;
    });
  }

  /**
   * Отметить, что товар использован: завести пресет или обновить существующий.
   *
   * Ошибки НЕ выходят наружу. Вызывается следом за добавлением или правкой
   * позиции забега, и падение вспомогательной записи не должно превращать
   * успешно добавленный товар в ошибку на экране. Глушение живёт здесь, а не в
   * каждом вызывающем: так безопасность — свойство метода, а не дисциплины.
   */
  static async recordUsage(userId: number, input: RecordUsageInput): Promise<void> {
    try {
      const name = input.name?.trim() ?? '';
      if (!name || name.length > NAME_MAX_LEN) return;

      const quantity = input.quantity ?? 1;
      if (!Number.isInteger(quantity) || quantity < QUANTITY_MIN || quantity > QUANTITY_MAX) {
        return;
      }

      const notes = this.sanitizeNotes(input.notes);
      const normalizedName = normalizeName(name);
      const now = new Date();

      /* В отличие от магазина группы, здесь новое написание ПЕРЕЗАПИСЫВАЕТ
         старое: список личный, спорить о правильном написании не с кем, а
         пресет по договорённости хранит последнее состояние. */
      await prisma.userItemPreset.upsert({
        where: { userId_normalizedName: { userId, normalizedName } },
        create: { userId, name, normalizedName, quantity, notes },
        update: {
          name,
          quantity,
          notes,
          usageCount: { increment: 1 },
          lastUsedAt: now,
        },
      });

      await this.evictColdest(userId);
    } catch (error) {
      logger.error('[UserItemPresetService] Failed to record preset usage', {
        userId,
        error,
      });
    }
  }

  /** Правка своего пресета: закрепление, имя, количество, заметка. */
  static async update(
    presetId: number,
    userId: number,
    patch: UpdatePresetInput,
  ): Promise<UserItemPreset> {
    await this.loadOwn(presetId, userId);

    const data: {
      name?: string;
      normalizedName?: string;
      quantity?: number;
      notes?: string | null;
      pinned?: boolean;
    } = {};

    if (patch.name !== undefined) {
      const name = patch.name.trim();
      if (!name || name.length > NAME_MAX_LEN) {
        throw new UserItemPresetError('INVALID_INPUT', 'Invalid preset name');
      }
      data.name = name;
      data.normalizedName = normalizeName(name);
    }
    if (patch.quantity !== undefined) {
      if (
        !Number.isInteger(patch.quantity) ||
        patch.quantity < QUANTITY_MIN ||
        patch.quantity > QUANTITY_MAX
      ) {
        throw new UserItemPresetError(
          'INVALID_INPUT',
          `Quantity must be ${QUANTITY_MIN}..${QUANTITY_MAX}`,
        );
      }
      data.quantity = patch.quantity;
    }
    if (patch.notes !== undefined) {
      data.notes = this.sanitizeNotes(patch.notes);
    }
    if (patch.pinned !== undefined) {
      data.pinned = patch.pinned;
    }

    return prisma.userItemPreset.update({ where: { id: presetId }, data });
  }

  /** Удалить свой пресет. Жёстко: это личные данные, прятать их не от кого. */
  static async remove(presetId: number, userId: number): Promise<void> {
    await this.loadOwn(presetId, userId);
    await prisma.userItemPreset.delete({ where: { id: presetId } });
  }

  // ------------------------------------------------------------- private

  /**
   * Чужой пресет отвечает `NOT_FOUND`, а не `FORBIDDEN`: подтверждать
   * существование чужой записи по её id незачем.
   */
  private static async loadOwn(presetId: number, userId: number): Promise<UserItemPreset> {
    const found = await prisma.userItemPreset.findUnique({ where: { id: presetId } });
    if (!found || found.userId !== userId) {
      throw new UserItemPresetError('NOT_FOUND', 'Preset not found');
    }
    return found;
  }

  /**
   * Нормализованные имена позиций, которые пользователь уже брал — отдельно по
   * магазину и по группе.
   *
   * Два запроса, а не один с `OR`: `distinct: ['name']` оставляет по одной
   * строке на имя, и объединённая выборка потеряла бы признак «взято именно в
   * этом магазине» — уцелевшая строка могла бы оказаться из другого магазина
   * той же группы.
   */
  private static async historyNames(
    userId: number,
    scope: { storeId?: number | null; groupId?: number | null },
  ): Promise<{ seenInStore: Set<string>; seenInGroup: Set<string> }> {
    const [seenInStore, seenInGroup] = await Promise.all([
      scope.storeId ? this.namesTakenIn(userId, { storeId: scope.storeId }) : new Set<string>(),
      scope.groupId ? this.namesTakenIn(userId, { groupId: scope.groupId }) : new Set<string>(),
    ]);
    return { seenInStore, seenInGroup };
  }

  /**
   * Сбой не критичен — без истории список просто теряет ярусы ранжирования и
   * остаётся отсортированным по свежести.
   */
  private static async namesTakenIn(
    userId: number,
    runFilter: { storeId: number } | { groupId: number },
  ): Promise<Set<string>> {
    try {
      const rows = await prisma.storeItem.findMany({
        where: { userId, storeRun: runFilter },
        select: { name: true },
        distinct: ['name'],
        take: STORE_HISTORY_LIMIT,
      });
      return new Set(rows.map(row => normalizeName(row.name)));
    } catch (error) {
      logger.error('[UserItemPresetService] Failed to load item history', {
        userId,
        runFilter,
        error,
      });
      return new Set();
    }
  }

  /** Выбросить незакреплённые пресеты сверх лимита, начиная с самых холодных. */
  private static async evictColdest(userId: number): Promise<void> {
    const stale = await prisma.userItemPreset.findMany({
      where: { userId, pinned: false },
      orderBy: { lastUsedAt: 'desc' },
      skip: RETENTION_LIMIT,
      select: { id: true },
    });
    if (stale.length === 0) return;

    await prisma.userItemPreset.deleteMany({
      where: { id: { in: stale.map(row => row.id) } },
    });
  }

  private static sanitizeNotes(notes: string | null | undefined): string | null {
    if (notes == null) return null;
    const trimmed = notes.trim();
    if (!trimmed) return null;
    return trimmed.slice(0, NOTES_MAX_LEN);
  }
}
