import { MenuItem } from '@prisma/client';
import { CreateMenuItemData, UpdateMenuItemData, MenuItemWithStats } from '../types/menu.types';
export declare class MenuService {
    static createMenuItem(data: CreateMenuItemData): Promise<MenuItem>;
    static getMenuItemById(id: number): Promise<MenuItem | null>;
    static updateMenuItem(id: number, data: UpdateMenuItemData): Promise<MenuItem>;
    static deleteMenuItem(id: number): Promise<void>;
    static getAllMenuItems(): Promise<MenuItem[]>;
    static getMenuItemsByIds(ids: number[]): Promise<MenuItem[]>;
    static getActiveMenuItems(): Promise<MenuItem[]>;
    static getMenuItemsByCategory(category: string): Promise<MenuItem[]>;
    static searchMenuItems(query: string): Promise<MenuItem[]>;
    static toggleMenuItemStatus(id: number): Promise<MenuItem>;
    static getPopularMenuItems(limit?: number): Promise<MenuItemWithStats[]>;
    static getCategories(): Promise<string[]>;
    static getMenuStats(): Promise<{
        total: number;
        active: number;
        categories: number;
        averagePrice: number;
    }>;
    static bulkUpdateStatus(ids: number[], isActive: boolean): Promise<number>;
}
//# sourceMappingURL=menu.service.d.ts.map