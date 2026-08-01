import { Prisma, StoreRun, StoreItem } from '@prisma/client';
import { prisma } from '../database/client';
import { logger } from '../utils/logger';
import { BudgetService } from './budget.service';
import { GroupService } from './group.service';

export type StoreRunStatus = 'COLLECTING' | 'SHOPPING' | 'SETTLED' | 'CANCELLED';
export type StoreItemStatus = 'REQUESTED' | 'BOUGHT' | 'NOT_FOUND';

const ACTIVE_STATUSES: StoreRunStatus[] = ['COLLECTING', 'SHOPPING'];
const COLLECT_MIN_MINUTES = 3;
const COLLECT_MAX_MINUTES = 30;
const ITEM_NAME_MAX_LEN = 200;
const ITEM_NOTES_MAX_LEN = 500;
/* Держим вровень с SetPriceSchema в контроллере: zod отсекает раньше сервиса,
   и разъехавшийся предел означал бы, что сообщение об ошибке называет не ту
   границу, по которой запрос на самом деле отклонён. */
const ITEM_PRICE_MAX = 100_000;

export interface CreateStoreRunInput {
  initiatorId: number;
  groupId: number;
  storeName: string;
  collectMinutes: number;
}

export interface AddStoreItemInput {
  name: string;
  quantity?: number;
  notes?: string | null;
}

export interface UpdateStoreItemInput {
  name?: string;
  quantity?: number;
  notes?: string | null;
}

export class StoreRunError extends Error {
  constructor(
    public code:
      | 'NOT_FOUND'
      | 'FORBIDDEN'
      | 'WRONG_STATUS'
      | 'ACTIVE_RUN_EXISTS'
      | 'INVALID_INPUT'
      | 'BOT_NOT_IN_GROUP',
    message: string,
  ) {
    super(message);
    this.name = 'StoreRunError';
  }
}

export class StoreRunService {
  /**
   * Создать новый поход в магазин.
   * Инициатор не может запустить второй забег, пока его предыдущий активен.
   */
  static async createStoreRun(input: CreateStoreRunInput): Promise<StoreRun> {
    const { initiatorId, groupId, storeName, collectMinutes } = input;

    const trimmedName = storeName.trim();
    if (!trimmedName) {
      throw new StoreRunError('INVALID_INPUT', 'Store name is required');
    }
    if (trimmedName.length > 100) {
      throw new StoreRunError('INVALID_INPUT', 'Store name is too long');
    }

    if (
      !Number.isFinite(collectMinutes) ||
      collectMinutes < COLLECT_MIN_MINUTES ||
      collectMinutes > COLLECT_MAX_MINUTES
    ) {
      throw new StoreRunError(
        'INVALID_INPUT',
        `collectMinutes must be between ${COLLECT_MIN_MINUTES} and ${COLLECT_MAX_MINUTES}`,
      );
    }

    const membership = await prisma.groupMember.findUnique({
      where: { groupId_userId: { groupId, userId: initiatorId } },
    });
    if (!membership || !membership.isActive) {
      throw new StoreRunError(
        'FORBIDDEN',
        'Initiator is not an active member of this group',
      );
    }

    const existing = await prisma.storeRun.findFirst({
      where: {
        initiatorId,
        status: { in: ACTIVE_STATUSES },
      },
      select: { id: true, storeName: true, status: true },
    });
    if (existing) {
      throw new StoreRunError(
        'ACTIVE_RUN_EXISTS',
        `You already have an active store run: "${existing.storeName}" (#${existing.id}, ${existing.status})`,
      );
    }

    const collectUntil = new Date(Date.now() + collectMinutes * 60 * 1000);

    let storeRun: StoreRun;
    try {
      storeRun = await prisma.storeRun.create({
        data: {
          groupId,
          initiatorId,
          storeName: trimmedName,
          collectUntil,
        },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new StoreRunError(
          'ACTIVE_RUN_EXISTS',
          'You already have an active store run'
        );
      }
      throw error;
    }

    logger.info('Store run created', {
      storeRunId: storeRun.id,
      initiatorId,
      groupId,
      storeName: trimmedName,
      collectMinutes,
    });

    return storeRun;
  }

  /**
   * Получить забег со списком позиций.
   * Проверяет членство requestingUserId в группе забега — бросает FORBIDDEN если не член.
   */
  static async getStoreRunById(id: number, requestingUserId: number) {
    const run = await prisma.storeRun.findUnique({
      where: { id },
      include: {
        initiator: true,
        items: {
          include: { user: true },
          orderBy: { createdAt: 'asc' },
        },
        group: { select: { id: true, telegramId: true, title: true } },
      },
    });
    if (!run) return null;

    const isMember = await GroupService.isUserGroupMember(requestingUserId, run.groupId);
    if (!isMember) {
      throw new StoreRunError('FORBIDDEN', 'Not a member of this group');
    }
    return run;
  }

  /**
   * Активные забеги в группах пользователя (включая те, где он инициатор).
   * Используется на главной: чтобы показать в карточке активные магазинные забеги.
   */
  static async getActiveStoreRunsForUser(userId: number) {
    const memberships = await prisma.groupMember.findMany({
      where: { userId, isActive: true },
      select: { groupId: true },
    });
    const groupIds = memberships.map((m) => m.groupId);
    if (groupIds.length === 0) return [];

    return prisma.storeRun.findMany({
      where: {
        groupId: { in: groupIds },
        status: { in: ACTIVE_STATUSES },
      },
      include: {
        initiator: true,
        items: { where: { userId }, select: { id: true, name: true, quantity: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Добавить позиции от участника.
   */
  static async addItemsBulk(
    storeRunId: number,
    userId: number,
    rawItems: AddStoreItemInput[],
  ): Promise<StoreItem[]> {
    if (rawItems.length === 0) {
      throw new StoreRunError('INVALID_INPUT', 'At least one item is required');
    }

    const sanitized = rawItems
      .map((it) => this.sanitizeItemInput(it))
      .filter((it): it is { name: string; quantity: number; notes: string | null } => it !== null);

    if (sanitized.length === 0) {
      throw new StoreRunError('INVALID_INPUT', 'No valid items after sanitization');
    }

    const created = await prisma.$transaction(async tx => {
      const storeRun = await tx.storeRun.findUnique({
        where: { id: storeRunId },
        select: { groupId: true },
      });
      if (!storeRun) {
        throw new StoreRunError('NOT_FOUND', 'Store run not found');
      }

      // Условное обновление блокирует строку забега до конца транзакции.
      const guard = await tx.storeRun.updateMany({
        where: { id: storeRunId, status: 'COLLECTING' },
        data: { updatedAt: new Date() },
      });
      if (guard.count !== 1) {
        throw new StoreRunError(
          'WRONG_STATUS',
          'Cannot add items after collection has ended'
        );
      }

      const membership = await tx.groupMember.findUnique({
        where: {
          groupId_userId: { groupId: storeRun.groupId, userId },
        },
      });
      if (!membership?.isActive) {
        throw new StoreRunError('FORBIDDEN', 'Not a member of this group');
      }

      return tx.storeItem.createManyAndReturn({
        data: sanitized.map(item => ({
          storeRunId,
          userId,
          name: item.name,
          quantity: item.quantity,
          notes: item.notes,
        })),
      });
    });

    logger.info('Store items added', {
      storeRunId,
      userId,
      count: created.length,
    });

    return created;
  }

  /**
   * Обновить свою позицию (до перехода в SHOPPING).
   */
  static async updateItem(
    itemId: number,
    userId: number,
    data: UpdateStoreItemInput,
  ): Promise<StoreItem> {
    const item = await prisma.storeItem.findUnique({
      where: { id: itemId },
      include: { storeRun: { select: { id: true, status: true } } },
    });
    if (!item) throw new StoreRunError('NOT_FOUND', 'Item not found');
    if (item.userId !== userId) {
      throw new StoreRunError('FORBIDDEN', 'You can only edit your own items');
    }
    if (item.storeRun.status !== 'COLLECTING') {
      throw new StoreRunError(
        'WRONG_STATUS',
        `Cannot edit item: run is ${item.storeRun.status}`,
      );
    }

    const patch: Prisma.StoreItemUpdateInput = {};
    if (data.name !== undefined) {
      const name = data.name.trim();
      if (!name || name.length > ITEM_NAME_MAX_LEN) {
        throw new StoreRunError('INVALID_INPUT', 'Invalid item name');
      }
      patch.name = name;
    }
    if (data.quantity !== undefined) {
      if (!Number.isInteger(data.quantity) || data.quantity < 1 || data.quantity > 99) {
        throw new StoreRunError('INVALID_INPUT', 'Quantity must be 1..99');
      }
      patch.quantity = data.quantity;
    }
    if (data.notes !== undefined) {
      patch.notes = this.sanitizeNotes(data.notes);
    }

    return prisma.$transaction(async tx => {
      const guard = await tx.storeRun.updateMany({
        where: { id: item.storeRun.id, status: 'COLLECTING' },
        data: { updatedAt: new Date() },
      });
      if (guard.count !== 1) {
        throw new StoreRunError(
          'WRONG_STATUS',
          'Cannot edit item after collection has ended'
        );
      }
      return tx.storeItem.update({ where: { id: itemId }, data: patch });
    });
  }

  /**
   * Удалить свою позицию (до SHOPPING).
   */
  static async deleteItem(itemId: number, userId: number): Promise<void> {
    const item = await prisma.storeItem.findUnique({
      where: { id: itemId },
      include: { storeRun: { select: { id: true, status: true } } },
    });
    if (!item) throw new StoreRunError('NOT_FOUND', 'Item not found');
    if (item.userId !== userId) {
      throw new StoreRunError('FORBIDDEN', 'You can only delete your own items');
    }
    if (item.storeRun.status !== 'COLLECTING') {
      throw new StoreRunError(
        'WRONG_STATUS',
        `Cannot delete item: run is ${item.storeRun.status}`,
      );
    }

    await prisma.$transaction(async tx => {
      const guard = await tx.storeRun.updateMany({
        where: { id: item.storeRun.id, status: 'COLLECTING' },
        data: { updatedAt: new Date() },
      });
      if (guard.count !== 1) {
        throw new StoreRunError(
          'WRONG_STATUS',
          'Cannot delete item after collection has ended'
        );
      }
      await tx.storeItem.delete({ where: { id: itemId } });
    });
  }

  /**
   * Инициатор: ранний переход COLLECTING -> SHOPPING.
   */
  static async startShopping(storeRunId: number, initiatorId: number): Promise<StoreRun> {
    const run = await this.requireInitiator(storeRunId, initiatorId);
    if (run.status !== 'COLLECTING') {
      throw new StoreRunError(
        'WRONG_STATUS',
        `Cannot start shopping: run is already ${run.status}`,
      );
    }

    const transition = await prisma.storeRun.updateMany({
      where: {
        id: storeRunId,
        initiatorId,
        status: 'COLLECTING',
      },
      data: { status: 'SHOPPING', shoppingAt: new Date() },
    });
    if (transition.count !== 1) {
      throw new StoreRunError(
        'WRONG_STATUS',
        'Store run state changed before shopping started'
      );
    }
    const updated = await prisma.storeRun.findUniqueOrThrow({
      where: { id: storeRunId },
    });
    logger.info('Store run entered SHOPPING', { storeRunId, initiatorId });
    return updated;
  }

  /**
   * Инициатор: проставить цену и статус BOUGHT|NOT_FOUND на позиции.
   * Допускается повторная правка до settle.
   */
  static async setItemPrice(
    itemId: number,
    initiatorId: number,
    price: number | null,
    status: Extract<StoreItemStatus, 'BOUGHT' | 'NOT_FOUND'>,
  ): Promise<StoreItem> {
    const item = await prisma.storeItem.findUnique({
      where: { id: itemId },
      include: {
        storeRun: { select: { id: true, initiatorId: true, status: true } },
      },
    });
    if (!item) throw new StoreRunError('NOT_FOUND', 'Item not found');
    if (item.storeRun.initiatorId !== initiatorId) {
      throw new StoreRunError('FORBIDDEN', 'Only initiator can set prices');
    }
    if (item.storeRun.status !== 'SHOPPING') {
      throw new StoreRunError(
        'WRONG_STATUS',
        `Cannot set price: run is ${item.storeRun.status}`,
      );
    }

    /* BOUGHT без цены — легальное промежуточное состояние: в магазине отмечают
       покупку одним касанием, цену вносят потом (часто по чеку на кассе). Такая
       позиция не попадает в деньги, и settle её не пропустит (см. ниже). */
    if (status === 'BOUGHT' && price != null) {
      if (!Number.isFinite(price) || price < 0 || price > ITEM_PRICE_MAX) {
        throw new StoreRunError(
          'INVALID_INPUT',
          `Price must be between 0 and ${ITEM_PRICE_MAX}`
        );
      }
    }

    return prisma.$transaction(async tx => {
      const guard = await tx.storeRun.updateMany({
        where: {
          id: item.storeRun.id,
          initiatorId,
          status: 'SHOPPING',
        },
        data: { updatedAt: new Date() },
      });
      if (guard.count !== 1) {
        throw new StoreRunError(
          'WRONG_STATUS',
          'Cannot set price after settlement'
        );
      }
      return tx.storeItem.update({
        where: { id: itemId },
        data: {
          status,
          price:
            status === 'BOUGHT' && price != null
              ? new Prisma.Decimal(price)
              : null,
        },
      });
    });
  }

  /**
   * Инициатор: финализировать забег.
   * Сначала создаются транзакции (идемпотентно), затем статус переводится в SETTLED.
   * Если создание транзакций упало — статус остаётся SHOPPING, можно повторить.
   */
  static async settle(storeRunId: number, initiatorId: number): Promise<StoreRun> {
    const run = await this.requireInitiator(storeRunId, initiatorId);
    if (run.status !== 'SHOPPING') {
      throw new StoreRunError(
        'WRONG_STATUS',
        `Cannot settle: run is ${run.status} (must be SHOPPING)`,
      );
    }

    const { updated, transactionCount } = await prisma.$transaction(async tx => {
      const transition = await tx.storeRun.updateMany({
        where: {
          id: storeRunId,
          initiatorId,
          status: 'SHOPPING',
        },
        data: { status: 'SETTLED', settledAt: new Date() },
      });
      if (transition.count !== 1) {
        throw new StoreRunError(
          'WRONG_STATUS',
          'Store run state changed before settlement'
        );
      }

      /* Купленное без цены в деньги не попадает — молча потерять чужую позицию
         нельзя. Считаем ПОСЛЕ перехода: строка забега уже заблокирована, и
         параллельный setItemPrice не проскочит между проверкой и расчётом.
         Throw откатывает транзакцию, забег остаётся SHOPPING. */
      const unpriced = await tx.storeItem.count({
        where: { storeRunId, status: 'BOUGHT', price: null },
      });
      if (unpriced > 0) {
        throw new StoreRunError(
          'INVALID_INPUT',
          `Cannot settle: ${unpriced} bought item(s) have no price`,
        );
      }

      const transactions =
        await BudgetService.createTransactionsForStoreRun(storeRunId, tx);
      const settled = await tx.storeRun.findUniqueOrThrow({
        where: { id: storeRunId },
      });
      return { updated: settled, transactionCount: transactions.length };
    });

    logger.info('Store run settled', {
      storeRunId,
      initiatorId,
      transactionsCreated: transactionCount,
    });

    return updated;
  }

  /**
   * Инициатор: отменить забег (доступно только в COLLECTING).
   */
  static async cancelStoreRun(storeRunId: number, initiatorId: number): Promise<StoreRun> {
    const run = await this.requireInitiator(storeRunId, initiatorId);
    if (run.status !== 'COLLECTING') {
      throw new StoreRunError(
        'WRONG_STATUS',
        `Cannot cancel: run is ${run.status}`,
      );
    }

    const transition = await prisma.storeRun.updateMany({
      where: {
        id: storeRunId,
        initiatorId,
        status: 'COLLECTING',
      },
      data: { status: 'CANCELLED', cancelledAt: new Date() },
    });
    if (transition.count !== 1) {
      throw new StoreRunError(
        'WRONG_STATUS',
        'Store run state changed before cancellation'
      );
    }
    const updated = await prisma.storeRun.findUniqueOrThrow({
      where: { id: storeRunId },
    });
    logger.info('Store run cancelled', { storeRunId, initiatorId });
    return updated;
  }

  /**
   * Cron: закрыть COLLECTING-забеги, у которых истёк collectUntil → перевести в SHOPPING.
   * Возвращает список изменённых id для вызова уведомлений.
   */
  static async autoCloseExpired(): Promise<number[]> {
    // Один атомарный условный апдейт: статус меняется ТОЛЬКО если на момент записи
    // строка ещё 'COLLECTING'. Забег, отменённый между чтением и записью, не
    // попадёт под обновление (нет гонки findMany→updateMany, нет «воскрешения»
    // отменённого забега и ложных уведомлений). Возвращаются только реально
    // обновлённые строки.
    const now = new Date();
    const closed = await prisma.storeRun.updateManyAndReturn({
      where: { status: 'COLLECTING', collectUntil: { lt: now } },
      data: { status: 'SHOPPING', shoppingAt: now },
      select: { id: true },
    });
    const ids = closed.map((r) => r.id);
    if (ids.length > 0) {
      logger.info('Store runs auto-closed to SHOPPING', { count: ids.length, ids });
    }
    return ids;
  }

  /**
   * Cron: отменить забеги, зависшие в SHOPPING дольше таймаута (инициатор ушёл
   * в магазин и не внёс цены / не завершил). Один атомарный условный апдейт со
   * статус-гардом — гонко-безопасно, без «воскрешения» уже завершённых.
   * Возвращает id отменённых забегов (для очистки сообщений + уведомления).
   */
  static async expireStaleShoppingRuns(): Promise<number[]> {
    const timeoutMin = Number(process.env.STORE_RUN_SHOPPING_TIMEOUT_MIN ?? '180');
    const now = new Date();
    const cutoff = new Date(now.getTime() - timeoutMin * 60 * 1000);

    const expired = await prisma.storeRun.updateManyAndReturn({
      where: { status: 'SHOPPING', shoppingAt: { lt: cutoff } },
      data: { status: 'CANCELLED', cancelledAt: now },
      select: { id: true },
    });
    const ids = expired.map((r) => r.id);
    if (ids.length > 0) {
      logger.info('Stale SHOPPING store runs auto-cancelled', { count: ids.length, ids, timeoutMin });
    }
    return ids;
  }

  // ------------------------------------------------------------------
  // Helpers
  // ------------------------------------------------------------------

  private static async requireInitiator(
    storeRunId: number,
    initiatorId: number,
  ): Promise<StoreRun> {
    const run = await prisma.storeRun.findUnique({ where: { id: storeRunId } });
    if (!run) throw new StoreRunError('NOT_FOUND', 'Store run not found');
    if (run.initiatorId !== initiatorId) {
      throw new StoreRunError('FORBIDDEN', 'Only initiator can perform this action');
    }
    return run;
  }

  private static sanitizeItemInput(
    input: AddStoreItemInput,
  ): { name: string; quantity: number; notes: string | null } | null {
    const name = input.name?.trim() ?? '';
    if (!name || name.length > ITEM_NAME_MAX_LEN) return null;

    const quantity = input.quantity ?? 1;
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 99) return null;

    return { name, quantity, notes: this.sanitizeNotes(input.notes) };
  }

  private static sanitizeNotes(notes: string | null | undefined): string | null {
    if (notes == null) return null;
    const trimmed = notes.trim();
    if (!trimmed) return null;
    return trimmed.slice(0, ITEM_NOTES_MAX_LEN);
  }
}
