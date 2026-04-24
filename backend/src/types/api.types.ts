import type { Request, Response } from 'express';
import { User } from './database.types';

// Simplified user type for authentication
export interface RequestUser {
  id: number;
  telegramId?: number | bigint;
  isAdmin?: boolean;
}

// Расширение Express Request для добавления пользователя (минимальный вариант)
export interface AuthenticatedRequest extends Request {
  user?: RequestUser;
  telegramInitData?: TelegramInitData;
}

// Authenticated request with full user info (когда нужны все поля)
export interface AuthenticatedRequestFull extends Request {
  user?: User;
  telegramInitData?: TelegramInitData;
}

// Extend Express Request type globally
declare module 'express-serve-static-core' {
  interface Request {
    user?: RequestUser;
    telegramInitData?: TelegramInitData;
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
