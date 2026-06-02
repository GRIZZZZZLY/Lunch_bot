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

    const storeRun = await prisma.storeRun.create({
      data: {
        groupId,
        initiatorId,
        storeName: trimmedName,
        collectUntil,
      },
    });

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

    const storeRun = await prisma.storeRun.findUnique({
      where: { id: storeRunId },
      select: { id: true, status: true, groupId: true },
    });
    if (!storeRun) {
      throw new StoreRunError('NOT_FOUND', 'Store run not found');
    }
    if (storeRun.status !== 'COLLECTING') {
      throw new StoreRunError(
        'WRONG_STATUS',
        `Cannot add items: store run is ${storeRun.status}`,
      );
    }

    // User must be a member of the group.
    const membership = await prisma.groupMember.findUnique({
      where: { groupId_userId: { groupId: storeRun.groupId, userId } },
    });
    if (!membership || !membership.isActive) {
      throw new StoreRunError('FORBIDDEN', 'Not a member of this group');
    }

    const sanitized = rawItems
      .map((it) => this.sanitizeItemInput(it))
      .filter((it): it is { name: string; quantity: number; notes: string | null } => it !== null);

    if (sanitized.length === 0) {
      throw new StoreRunError('INVALID_INPUT', 'No valid items after sanitization');
    }

    const created = await prisma.storeItem.createManyAndReturn({
      data: sanitized.map((item) => ({
        storeRunId,
        userId,
        name: item.name,
        quantity: item.quantity,
        notes: item.notes,
      })),
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
      include: { storeRun: { select: { status: true } } },
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

    return prisma.storeItem.update({ where: { id: itemId }, data: patch });
  }

  /**
   * Удалить свою позицию (до SHOPPING).
   */
  static async deleteItem(itemId: number, userId: number): Promise<void> {
    const item = await prisma.storeItem.findUnique({
      where: { id: itemId },
      include: { storeRun: { select: { status: true } } },
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

    await prisma.storeItem.delete({ where: { id: itemId } });
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

    const updated = await prisma.storeRun.update({
      where: { id: storeRunId },
      data: { status: 'SHOPPING', shoppingAt: new Date() },
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
        storeRun: { select: { initiatorId: true, status: true } },
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

    if (status === 'BOUGHT') {
      if (price == null || !Number.isFinite(price) || price < 0) {
        throw new StoreRunError('INVALID_INPUT', 'Price must be non-negative');
      }
    }

    return prisma.storeItem.update({
      where: { id: itemId },
      data: {
        status,
        price: status === 'BOUGHT' ? new Prisma.Decimal(price as number) : null,
      },
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

    const transactions = await BudgetService.createTransactionsForStoreRun(storeRunId);

    const updated = await prisma.storeRun.update({
      where: { id: storeRunId },
      data: { status: 'SETTLED', settledAt: new Date() },
    });

    logger.info('Store run settled', {
      storeRunId,
      initiatorId,
      transactionsCreated: transactions.length,
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

    const updated = await prisma.storeRun.update({
      where: { id: storeRunId },
      data: { status: 'CANCELLED', cancelledAt: new Date() },
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
