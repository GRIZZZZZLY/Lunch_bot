import { Request, Response } from 'express';
import { User } from './database.types';
export interface AuthenticatedRequest extends Request {
    user?: User;
    telegramInitData?: TelegramInitData;
}
export interface ApiResponse<T = any> {
    success: boolean;
    data?: T;
    error?: string;
    message?: string;
    code?: string;
    timestamp: string;
}
export interface PaginatedApiResponse<T = any> extends ApiResponse<T> {
    pagination?: {
        page: number;
        limit: number;
        total: number;
        pages: number;
    };
}
export interface TelegramInitData {
    query_id?: string;
    user?: TelegramWebAppUser;
    receiver?: TelegramWebAppUser;
    chat?: TelegramWebAppChat;
    chat_type?: string;
    chat_instance?: string;
    start_param?: string;
    can_send_after?: number;
    auth_date: number;
    hash: string;
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
export type ApiController = (req: AuthenticatedRequest, res: Response) => Promise<void>;
//# sourceMappingURL=api.types.d.ts.map