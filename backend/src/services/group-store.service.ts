import { GroupStore, Prisma } from '@prisma/client';

import { prisma } from '../database/client';
import { logger } from '../utils/logger';
import { normalizeName } from '../utils/normalize-name';
import { GroupService } from './group.service';

/** Сколько магазинов отдаём в подсказки. Больше на экране 390 px не разглядеть. */
const LIST_LIMIT = 30;
const STORE_NAME_MAX_LEN = 100;

/** Забеги, чьё имя магазина ещё имеет смысл править: они на экранах прямо сейчас. */
const ACTIVE_RUN_STATUSES = ['COLLECTING', 'SHOPPING'];

/**
 * Ровно те три операции, которые нужны `resolveForRun`.
 *
 * Метод вызывается изнутри транзакции создания забега и принимает клиент
 * параметром, а не ходит в глобальный `prisma`: иначе откат забега оставил бы
 * после себя магазин. Тип структурный, а не `Pick<Prisma.TransactionClient,
 * 'groupStore'>`, потому что полный делегат тянет полтора десятка методов,
 * которых здесь никто не зовёт, — подделать его в тесте нельзя, а список
 * зависимостей он превращает в «весь Prisma».
 */
type StoreTxClient = {
  groupStore: {
    findUnique(args: {
      where: Prisma.GroupStoreWhereUniqueInput;
    }): Promise<GroupStore | null>;
    create(args: { data: Prisma.GroupStoreUncheckedCreateInput }): Promise<GroupStore>;
    update(args: {
      where: Prisma.GroupStoreWhereUniqueInput;
      data: Prisma.GroupStoreUncheckedUpdateInput;
    }): Promise<GroupStore>;
  };
};

export interface ResolveStoreInput {
  groupId: number;
  userId: number;
  /** Выбор из справочника. Приоритетнее имени. */
  storeId?: number | null;
  /** Свободный ввод. Создаёт или воскрешает запись. */
  storeName?: string | null;
}

/** То, что нужно забегу от справочника: связь и снимок имени. */
export interface ResolvedStore {
  id: number;
  name: string;
}

export class GroupStoreError extends Error {
  constructor(
    public code: 'NOT_FOUND' | 'FORBIDDEN' | 'INVALID_INPUT' | 'STORE_EXISTS',
    message: string,
  ) {
    super(message);
    this.name = 'GroupStoreError';
  }
}

/**
 * Справочник магазинов группы — «откуда заказываем».
 *
 * Записи не заводятся отдельной командой: они появляются при создании забега
 * (`resolveForRun`) и копятся сами. Наружу торчат только чтение, переименование
 * и скрытие — то, чего нельзя вывести из самого забега.
 */
export class GroupStoreService {
  /** Активные магазины группы, свежеиспользованные первыми. */
  static async listForGroup(groupId: number, userId: number): Promise<GroupStore[]> {
    await this.assertMember(userId, groupId);

    return prisma.groupStore.findMany({
      where: { groupId, archivedAt: null },
      orderBy: [{ lastUsedAt: 'desc' }],
      take: LIST_LIMIT,
    });
  }

  /**
   * Найти или завести магазин под создаваемый забег.
   *
   * Вызывается ВНУТРИ транзакции создания забега и намеренно не проверяет
   * членство: вызывающий уже проверил его для инициатора, и второй запрос к
   * `group_members` в той же транзакции ничего бы не добавил.
   */
  static async resolveForRun(
    tx: StoreTxClient,
    input: ResolveStoreInput,
  ): Promise<ResolvedStore> {
    const { groupId, userId, storeId, storeName } = input;

    if (storeId != null) {
      return this.touchById(tx, groupId, storeId);
    }

    const name = (storeName ?? '').trim();
    if (!name) {
      throw new GroupStoreError('INVALID_INPUT', 'Store name is required');
    }
    if (name.length > STORE_NAME_MAX_LEN) {
      throw new GroupStoreError('INVALID_INPUT', 'Store name is too long');
    }

    const normalizedName = normalizeName(name);
    const existing = await tx.groupStore.findUnique({
      where: { groupId_normalizedName: { groupId, normalizedName } },
    });
    if (existing) {
      return this.touchExisting(tx, existing);
    }

    try {
      const created = await tx.groupStore.create({
        data: { groupId, createdById: userId, name, normalizedName },
      });
      return { id: created.id, name: created.name };
    } catch (error) {
      /* Гонка: два участника одновременно завели один магазин, уникальный
         индекс отдал второму P2002. Соперник уже создал строку — берём её,
         вместо того чтобы падать на действии, которое пользователь считает
         успешным. */
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        const raced = await tx.groupStore.findUnique({
          where: { groupId_normalizedName: { groupId, normalizedName } },
        });
        if (raced) return this.touchExisting(tx, raced);
      }
      throw error;
    }
  }

  /**
   * Переименовать магазин.
   *
   * Активные забеги получают новое имя, завершённые — нет: их `storeName` это
   * снимок на момент похода, и переписывать его значило бы менять историю.
   */
  static async rename(storeId: number, userId: number, rawName: string): Promise<GroupStore> {
    const name = rawName.trim();
    if (!name) {
      throw new GroupStoreError('INVALID_INPUT', 'Store name is required');
    }
    if (name.length > STORE_NAME_MAX_LEN) {
      throw new GroupStoreError('INVALID_INPUT', 'Store name is too long');
    }

    const store = await this.loadForWrite(storeId, userId);
    const normalizedName = normalizeName(name);

    /* Поправить написание того же имени можно всегда: конфликта с самим собой
       нет, а запрос к соседям только вернул бы эту же строку. */
    if (normalizedName !== store.normalizedName) {
      const clash = await prisma.groupStore.findFirst({
        where: { groupId: store.groupId, normalizedName, id: { not: storeId } },
        select: { id: true },
      });
      if (clash) {
        throw new GroupStoreError(
          'STORE_EXISTS',
          'Магазин с таким названием в этой группе уже есть',
        );
      }
    }

    const updated = await prisma.groupStore.update({
      where: { id: storeId },
      data: { name, normalizedName },
    });

    await prisma.storeRun.updateMany({
      where: { storeId, status: { in: ACTIVE_RUN_STATUSES } },
      data: { storeName: name },
    });

    logger.info('Group store renamed', { storeId, userId, name });
    return updated;
  }

  /** Скрыть магазин из подсказок. Забеги, ссылающиеся на него, не меняются. */
  static async archive(storeId: number, userId: number): Promise<void> {
    const store = await this.loadForWrite(storeId, userId);
    if (store.archivedAt) return;

    await prisma.groupStore.update({
      where: { id: storeId },
      data: { archivedAt: new Date() },
    });
    logger.info('Group store archived', { storeId, userId });
  }

  // ------------------------------------------------------------- private

  private static async assertMember(userId: number, groupId: number): Promise<void> {
    const isMember = await GroupService.isUserGroupMember(userId, groupId);
    if (!isMember) {
      throw new GroupStoreError('FORBIDDEN', 'Not a member of this group');
    }
  }

  /** Магазин под запись: существует, принадлежит группе пользователя. */
  private static async loadForWrite(storeId: number, userId: number): Promise<GroupStore> {
    const store = await prisma.groupStore.findUnique({ where: { id: storeId } });
    if (!store) {
      throw new GroupStoreError('NOT_FOUND', 'Store not found');
    }
    await this.assertMember(userId, store.groupId);
    return store;
  }

  private static async touchById(
    tx: StoreTxClient,
    groupId: number,
    storeId: number,
  ): Promise<ResolvedStore> {
    const store = await tx.groupStore.findUnique({ where: { id: storeId } });
    /* Чужая группа и скрытая запись отвечают одинаково: клиент, приславший
       такой storeId, работает по устаревшему списку — для него это одно и то
       же «магазина нет». */
    if (!store || store.groupId !== groupId || store.archivedAt) {
      throw new GroupStoreError('NOT_FOUND', 'Store not found');
    }
    return this.touchExisting(tx, store);
  }

  /**
   * Отметить использование. Имя НЕ переписывается вводом пользователя: «пятерочка»
   * не должна переименовывать «Пятёрочку» всей группе — для этого есть `rename`.
   * Снятый `archivedAt` — исключение: повторный ввод имени и есть возврат
   * магазина в список.
   */
  private static async touchExisting(
    tx: StoreTxClient,
    store: GroupStore,
  ): Promise<ResolvedStore> {
    const updated = await tx.groupStore.update({
      where: { id: store.id },
      data: {
        lastUsedAt: new Date(),
        usageCount: { increment: 1 },
        ...(store.archivedAt ? { archivedAt: null } : {}),
      },
    });
    return { id: updated.id, name: updated.name };
  }
}
