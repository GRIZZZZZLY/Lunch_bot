import type { Request, Response } from 'express';
import { User } from './database.types';

/**
 * Раньше это были два разных интерфейса — «минимальный» с `RequestUser` и
 * «полный» с `User`, — и выбор между ними в каждом контроллере был случайным.
 * Теперь форму `req.user` задаёт ровно одно место: расширение
 * `express-serve-static-core` ниже. Имена оставлены псевдонимами, потому что
 * читаются как документация: подпись `(req: AuthenticatedRequest, ...)`
 * сообщает, что маршрут обязан идти через `telegramAuthMiddleware`.
 */
export type AuthenticatedRequest = Request;

/**
 * Расширение Express Request.
 *
 * `user` — именно Prisma-модель `User`, а не сокращённый `RequestUser`:
 * `telegramAuthMiddleware` кладёт туда результат `UserService.getUserById` /
 * `createUser`, то есть полную запись. Пока здесь стоял `RequestUser` (id,
 * telegramId?, isAdmin?), контроллеры читали `firstName`, `username`,
 * `isActive`, `createdAt`, `photoUrl` через `(req as any).user` — и приведение
 * скрывало не отсутствие типа, а его НЕСООТВЕТСТВИЕ. Компилятор нашёл 16 таких
 * чтений сразу же, как приведения убрали.
 *
 * `user` остаётся необязательным сознательно: аутентификация навешивается
 * ПОМАРШРУТНО (`telegramAuthMiddleware` в routes/*.ts), а не на весь `/api`.
 * Тип обязан отражать, что маршрут без этого middleware существует; проверку
 * делает `requireAuthUser` из api/middleware/require-auth-user.ts.
 */
declare module 'express-serve-static-core' {
  interface Request {
    user?: User;
    telegramInitData?: TelegramInitData;
    /**
     * Разобранный Telegram-пользователь из `initData` — то, что кладёт
     * `validateInitDataMiddleware`. Слот объявлен здесь, потому что раньше туда
     * писали через `(req as any)`, а приведение в middleware аутентификации —
     * последнее место, где стоит терять тип.
     *
     * Читателей у поля сегодня нет: оба middleware, которые его пишут
     * (`validateInitDataMiddleware`, ветка SKIP там же), ни на одном маршруте
     * не подключены — `/api/auth/validate` идёт через контроллер. Это
     * рудимент, а не контракт; удаление кода аутентификации — отдельная работа
     * с отдельной проверкой, а не побочный эффект типизации.
     *
     * Тип — `TelegramWebAppUser` из этого же файла, а НЕ `TelegramUser` из
     * `bot.types.ts`: там `is_bot` объявлен обязательным, чего Telegram не
     * обещает, и на попытке взять его компилятор сразу отказал. Тот тип не
     * используется больше нигде.
     */
    telegramUser?: TelegramWebAppUser;
  }
}

// Стандартный ответ API
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  code?: string;
  timestamp: string;
}

// Ответ с пагинацией
export interface PaginatedApiResponse<T = any> extends ApiResponse<T> {
  pagination?: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

// Telegram WebApp InitData
export interface TelegramInitData {
  query_id?: string;
  user?: TelegramWebAppUser;
  receiver?: TelegramWebAppUser;
  chat?: TelegramWebAppChat;
  chat_type?: string;
  chat_instance?: string;
  start_param?: string;
  can_send_after?: number;
  auth_date?: number;
  hash?: string;
}

export interface TelegramWebAppUser {
  id: number;
  is_bot?: boolean;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
  is_premium?: boolean;
  added_to_attachment_menu?: boolean;
  allows_write_to_pm?: boolean;
  photo_url?: string;
}

export interface TelegramWebAppChat {
  id: number;
  type: 'group' | 'supergroup' | 'channel';
  title: string;
  username?: string;
  photo_url?: string;
}

// DTO для API endpoints
export interface CreateMenuItemDto {
  name: string;
  description?: string;
  price?: number;
  category?: string;
  imageUrl?: string;
}

export interface UpdateMenuItemDto {
  name?: string;
  description?: string;
  price?: number;
  category?: string;
  imageUrl?: string;
  isActive?: boolean;
}

export interface MenuItemQueryDto {
  active?: boolean;
  category?: string;
  search?: string;
  page?: number;
  limit?: number;
  sortBy?: 'name' | 'createdAt' | 'category' | 'price';
  sortOrder?: 'asc' | 'desc';
}

// Типы контроллеров
export type ApiController = (
  req: AuthenticatedRequest,
  res: Response
) => Promise<void>;

// ============================================
// COST SPLITTING TYPES
// ============================================

export interface OrderCostsDto {
  deliveryCost: number;
  serviceFee: number;
  tip: number;
  notes?: string;
}

export interface UpdateOrderCostsDto {
  deliveryCost?: number;
  serviceFee?: number;
  tip?: number;
  notes?: string;
}

export interface OrderCostsResponse {
  id: number;
  pollId: number;
  deliveryCost: number;
  serviceFee: number;
  tip: number;
  notes?: string;
  enteredBy: number;
  enteredAt: string;
  updatedAt: string;
}

export interface TransactionBreakdown {
  transactionId: number;
  userId: number;
  userName: string;
  menuItemName: string;
  itemPrice: number;
  deliveryShare: number;
  serviceShare: number;
  tipShare: number;
  totalAmount: number;
  status: 'PENDING' | 'PAID' | 'CONFIRMED';
}

export interface PollCostBreakdown {
  pollId: number;
  totalItemsCost: number;
  totalDeliveryCost: number;
  totalServiceFee: number;
  totalTip: number;
  grandTotal: number;
  participantsCount: number;
  transactions: TransactionBreakdown[];
  orderCosts?: OrderCostsResponse;
}
