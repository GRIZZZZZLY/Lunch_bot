/**
 * Сценарии создания голосования: «создать из Mini App» и «повторить прошлое».
 *
 * Оба жили в `poll.controller.ts` — 185 и 99 строк соответственно, — и это была
 * не обвязка HTTP, а транзакционный сценарий: проверить группу, убедиться, что
 * активного голосования нет, собрать блюда, создать голосование, отправить
 * сообщение в Telegram. Контроллер знал порядок пяти вызовов сервисов; это и
 * есть признак, что сценарий лежит не там (задача 05).
 *
 * Почему отдельный файл, а не `poll.service.ts`: тот уже 1700 строк и его режет
 * задача 06. Дописывать в него — двигаться против следующей задачи.
 *
 * Отправка в Telegram остаётся в `poll.service.extensions.ts`
 * (`createPollFromWebApp`): здесь только сценарий, а не работа с ботом.
 */
import { MenuItem } from '@prisma/client';

import { logger } from '../utils/logger';
import type { PollWithDetails } from '../types/poll.types';
import { GroupService } from './group.service';
import { MenuService } from './menu.service';
import { PollService } from './poll.service';
import { createPollFromWebApp } from './poll.service.extensions';
import {
  NoMenuItemsError,
  NotEnoughMenuItemsError,
  PollAlreadyActiveError,
  PollGroupNotFoundError,
  PollNotFoundError,
} from './poll.errors';

/** Значения по умолчанию — правила продукта, а не валидация входа. */
const DEFAULT_DURATION_MINUTES = 30;
const MAX_SELECTIONS_LIMIT = 3;

export interface CreatePollForGroupParams {
  groupId: number;
  createdBy: number;
  duration?: number;
  selectedMenuItems?: number[];
  title?: string;
  isMultiSelect?: boolean;
  maxSelections?: number;
}

export interface CreatedPollSummary {
  pollId: number;
  messageId: number;
  groupTitle: string;
  duration: number;
  menuItemsCount: number;
}

/**
 * Сколько блюд можно выбрать за раз.
 *
 * `|| LIMIT`, а не `?? LIMIT`: ноль здесь исторически означает «не задано», и
 * менять это заодно с переносом сценария было бы тихой сменой поведения.
 */
function resolveMaxSelections(
  isMultiSelect: boolean,
  maxSelections?: number
): number {
  if (!isMultiSelect) return 1;

  return Math.max(
    1,
    Math.min(maxSelections || MAX_SELECTIONS_LIMIT, MAX_SELECTIONS_LIMIT)
  );
}

/**
 * Создать голосование в группе и отправить его в Telegram.
 *
 * Проверка «в группе уже идёт голосование» остаётся ЗДЕСЬ, хотя такая же есть
 * внутри транзакции `PollService.createPoll`: там она про гонку двух
 * одновременных запросов, здесь — про понятный отказ до отправки сообщения в
 * чат. Обе отдают один и тот же тип ошибки.
 */
export async function createPollForGroup(
  params: CreatePollForGroupParams
): Promise<CreatedPollSummary> {
  const { groupId, createdBy, selectedMenuItems, title } = params;
  const duration = params.duration ?? DEFAULT_DURATION_MINUTES;
  const isMultiSelect = params.isMultiSelect ?? true;
  const maxSelections = resolveMaxSelections(isMultiSelect, params.maxSelections);

  const group = await GroupService.getGroupById(groupId);
  if (!group) throw new PollGroupNotFoundError();

  const existingPoll = await PollService.getActivePollInGroup(groupId);
  if (existingPoll) {
    throw new PollAlreadyActiveError(groupId, existingPoll.id);
  }

  const menuItems = await selectMenuItems(groupId, selectedMenuItems);
  if (menuItems.length < 2) {
    logger.warn('Not enough menu items for a poll', {
      groupId,
      count: menuItems.length,
      requested: selectedMenuItems?.length ?? 0,
    });
    throw new NotEnoughMenuItemsError();
  }

  const result = await createPollFromWebApp({
    groupId,
    duration,
    createdBy,
    title: title || undefined,
    menuItems,
    // Состав голосования фиксируется на момент создания.
    selectedMenuItemIds: menuItems.map(item => item.id),
    isMultiSelect,
    maxSelections,
  });

  return {
    pollId: result.pollId,
    messageId: result.messageId,
    groupTitle: group.title,
    duration,
    menuItemsCount: menuItems.length,
  };
}

/** Активные блюда группы, суженные до выбранных, если выбор передан. */
async function selectMenuItems(
  groupId: number,
  selectedMenuItems?: number[]
): Promise<MenuItem[]> {
  const menuItems = await MenuService.getActiveMenuItems(groupId);

  if (!selectedMenuItems || selectedMenuItems.length === 0) return menuItems;

  const selected = new Set(selectedMenuItems);
  return menuItems.filter(item => selected.has(item.id));
}

/**
 * Повторить голосование: создать такое же и отправить в группу.
 *
 * «Такое же» — это те же блюда и та же длительность. Если состав блюд в
 * исходном голосовании не сохранён (старые записи) или строка испорчена,
 * берутся все активные блюда группы: повтор полезнее отказа, а испорченную
 * строку здесь всё равно нечем починить.
 */
export async function repeatPoll(
  pollId: number,
  requestedBy: number
): Promise<PollWithDetails | null> {
  const sourcePoll = await PollService.getPollById(pollId);
  if (!sourcePoll) throw new PollNotFoundError();

  const selectedMenuItemIds = parseSelectedMenuItemIds(
    sourcePoll.selectedMenuItemIds,
    pollId
  );

  const menuItems =
    selectedMenuItemIds.length > 0
      ? await MenuService.getMenuItemsByIds(selectedMenuItemIds)
      : await MenuService.getActiveMenuItems(sourcePoll.groupId);

  if (menuItems.length === 0) throw new NoMenuItemsError();

  const result = await createPollFromWebApp({
    groupId: sourcePoll.groupId,
    duration: sourcePoll.duration,
    createdBy: requestedBy,
    menuItems,
    selectedMenuItemIds:
      selectedMenuItemIds.length > 0 ? selectedMenuItemIds : undefined,
  });

  /* Ответ — созданное голосование целиком, как и до переноса: фронт после
     повтора показывает его без второго запроса. */
  return PollService.getPollById(result.pollId);
}

function parseSelectedMenuItemIds(
  raw: string | null,
  pollId: number
): number[] {
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    logger.warn('Failed to parse selectedMenuItemIds, falling back to all items', {
      pollId,
      error,
    });
    return [];
  }
}
