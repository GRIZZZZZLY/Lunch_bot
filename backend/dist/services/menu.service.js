"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MenuService = void 0;
const client_1 = require("@prisma/client");
const client_2 = require("../database/client");
const logger_1 = require("../utils/logger");
const cache_service_1 = require("./cache.service");
class MenuService {
    static async createMenuItem(data) {
        try {
            const menuItem = await client_2.prisma.menuItem.create({
                data: {
                    name: data.name,
                    description: data.description,
                    price: data.price,
                    category: data.category,
                    imageUrl: data.imageUrl,
                    isActive: data.isActive ?? true,
                    createdBy: data.createdBy,
                },
            });
            cache_service_1.CacheInvalidator.invalidateMenu();
            logger_1.logger.info(`Menu item created: ${menuItem.id} (${menuItem.name})`);
            return menuItem;
        }
        catch (error) {
            logger_1.logger.error('Error creating menu item:', error);
            throw new Error('Failed to create menu item');
        }
    }
    static async getMenuItemById(id) {
        try {
            return await client_2.prisma.menuItem.findUnique({
                where: { id },
            });
        }
        catch (error) {
            logger_1.logger.error('Error getting menu item by ID:', error);
            throw new Error('Failed to get menu item');
        }
    }
    static async updateMenuItem(id, data) {
        try {
            const menuItem = await client_2.prisma.menuItem.update({
                where: { id },
                data: {
                    ...data,
                    updatedAt: new Date(),
                },
            });
            cache_service_1.CacheInvalidator.invalidateMenu();
            logger_1.logger.info(`Menu item updated: ${menuItem.id} (${menuItem.name})`);
            return menuItem;
        }
        catch (error) {
            if (error instanceof client_1.Prisma.PrismaClientKnownRequestError) {
                if (error.code === 'P2025') {
                    throw new Error('Menu item not found');
                }
            }
            logger_1.logger.error('Error updating menu item:', error);
            throw new Error('Failed to update menu item');
        }
    }
    static async deleteMenuItem(id) {
        try {
            const menuItem = await client_2.prisma.menuItem.findUnique({
                where: { id },
                include: {
                    _count: {
                        select: {
                            votes: true,
                            pollResults: true,
                        },
                    },
                },
            });
            if (!menuItem) {
                throw new Error('Menu item not found');
            }
            if (menuItem._count.votes > 0 || menuItem._count.pollResults > 0) {
                logger_1.logger.info(`Menu item ${id} has related data, cleaning up...`, {
                    votes: menuItem._count.votes,
                    pollResults: menuItem._count.pollResults,
                });
                await client_2.prisma.vote.updateMany({
                    where: { menuItemId: id },
                    data: { menuItemId: null },
                });
                await client_2.prisma.pollResult.updateMany({
                    where: { winnerMenuItemId: id },
                    data: { winnerMenuItemId: null },
                });
            }
            await client_2.prisma.menuItem.delete({
                where: { id },
            });
            cache_service_1.CacheInvalidator.invalidateMenu();
            logger_1.logger.info(`Menu item deleted: ${id}`, {
                cleanedVotes: menuItem._count.votes,
                cleanedResults: menuItem._count.pollResults,
            });
        }
        catch (error) {
            if (error instanceof Error && error.message === 'Menu item not found') {
                throw error;
            }
            if (error instanceof client_1.Prisma.PrismaClientKnownRequestError) {
                if (error.code === 'P2025') {
                    throw new Error('Menu item not found');
                }
                if (error.code === 'P2003') {
                    throw new Error('Cannot delete menu item: it is referenced by other records');
                }
            }
            logger_1.logger.error('Error deleting menu item:', error);
            throw new Error('Failed to delete menu item');
        }
    }
    static async getAllMenuItems() {
        try {
            return await client_2.prisma.menuItem.findMany({
                orderBy: [
                    { isActive: 'desc' },
                    { name: 'asc' },
                ],
            });
        }
        catch (error) {
            logger_1.logger.error('Error getting all menu items:', error);
            throw new Error('Failed to get menu items');
        }
    }
    static async getMenuItemsByIds(ids) {
        try {
            if (!ids || ids.length === 0) {
                return [];
            }
            return await client_2.prisma.menuItem.findMany({
                where: {
                    id: { in: ids },
                    isActive: true,
                },
                orderBy: { name: 'asc' },
            });
        }
        catch (error) {
            logger_1.logger.error('Error getting menu items by IDs:', error);
            throw new Error('Failed to get menu items by IDs');
        }
    }
    static async getActiveMenuItems() {
        try {
            logger_1.logger.info('🔍 [MenuService] getActiveMenuItems called');
            const items = await cache_service_1.cacheService.getOrSet(cache_service_1.CACHE_KEYS.MENU_ITEMS_ACTIVE, async () => {
                logger_1.logger.info('🔍 [MenuService] Fetching from DB (cache miss)');
                const dbItems = await client_2.prisma.menuItem.findMany({
                    where: { isActive: true },
                    select: {
                        id: true,
                        name: true,
                        description: true,
                        price: true,
                        category: true,
                        imageUrl: true,
                        isActive: true,
                        createdBy: true,
                        createdAt: true,
                        updatedAt: true,
                    },
                    orderBy: { name: 'asc' },
                });
                logger_1.logger.info('✅ [MenuService] DB query result', {
                    count: dbItems.length,
                    items: dbItems.slice(0, 3).map(i => i.name)
                });
                return dbItems;
            }, cache_service_1.CACHE_TTL.MENU);
            logger_1.logger.info('✅ [MenuService] Returning items', { count: items.length });
            return items;
        }
        catch (error) {
            logger_1.logger.error('❌ [MenuService] Error getting active menu items:', error);
            throw new Error('Failed to get active menu items');
        }
    }
    static async getMenuItemsByCategory(category) {
        try {
            return await cache_service_1.cacheService.getOrSet(cache_service_1.CACHE_KEYS.MENU_ITEMS_BY_CATEGORY(category), async () => {
                return await client_2.prisma.menuItem.findMany({
                    where: {
                        category,
                        isActive: true,
                    },
                    select: {
                        id: true,
                        name: true,
                        description: true,
                        price: true,
                        category: true,
                        imageUrl: true,
                        isActive: true,
                        createdBy: true,
                        createdAt: true,
                        updatedAt: true,
                    },
                    orderBy: { name: 'asc' },
                });
            }, cache_service_1.CACHE_TTL.MENU);
        }
        catch (error) {
            logger_1.logger.error('Error getting menu items by category:', error);
            throw new Error('Failed to get menu items by category');
        }
    }
    static async searchMenuItems(query) {
        try {
            return await client_2.prisma.menuItem.findMany({
                where: {
                    OR: [
                        {
                            name: {
                                contains: query,
                            },
                        },
                        {
                            description: {
                                contains: query,
                            },
                        },
                    ],
                    isActive: true,
                },
                orderBy: { name: 'asc' },
            });
        }
        catch (error) {
            logger_1.logger.error('Error searching menu items:', error);
            throw new Error('Failed to search menu items');
        }
    }
    static async toggleMenuItemStatus(id) {
        try {
            const currentItem = await client_2.prisma.menuItem.findUnique({
                where: { id },
                select: { isActive: true },
            });
            if (!currentItem) {
                throw new Error('Menu item not found');
            }
            const menuItem = await client_2.prisma.menuItem.update({
                where: { id },
                data: {
                    isActive: !currentItem.isActive,
                    updatedAt: new Date(),
                },
            });
            cache_service_1.CacheInvalidator.invalidateMenu();
            logger_1.logger.info(`Menu item status toggled: ${id} -> ${menuItem.isActive}`);
            return menuItem;
        }
        catch (error) {
            if (error instanceof Error && error.message === 'Menu item not found') {
                throw error;
            }
            if (error instanceof client_1.Prisma.PrismaClientKnownRequestError) {
                if (error.code === 'P2025') {
                    throw new Error('Menu item not found');
                }
            }
            logger_1.logger.error('Error toggling menu item status:', error);
            throw new Error('Failed to toggle menu item status');
        }
    }
    static async getPopularMenuItems(limit = 10) {
        try {
            const popularItems = await client_2.prisma.menuItem.findMany({
                where: { isActive: true },
                include: {
                    _count: {
                        select: {
                            votes: true,
                            pollResults: true,
                        },
                    },
                },
                orderBy: {
                    votes: {
                        _count: 'desc',
                    },
                },
                take: limit,
            });
            return popularItems.map(item => ({
                ...item,
                voteCount: item._count.votes,
                winCount: item._count.pollResults,
            }));
        }
        catch (error) {
            logger_1.logger.error('Error getting popular menu items:', error);
            throw new Error('Failed to get popular menu items');
        }
    }
    static async getCategories() {
        try {
            return await cache_service_1.cacheService.getOrSet('menu_categories', async () => {
                const categories = await client_2.prisma.menuItem.findMany({
                    where: {
                        category: { not: null },
                        isActive: true,
                    },
                    select: { category: true },
                    distinct: ['category'],
                });
                return categories
                    .map(item => item.category)
                    .filter(Boolean)
                    .sort();
            }, cache_service_1.CACHE_TTL.MENU);
        }
        catch (error) {
            logger_1.logger.error('Error getting categories:', error);
            throw new Error('Failed to get categories');
        }
    }
    static async getMenuStats() {
        try {
            const [total, active, categoriesResult, avgPriceResult] = await Promise.all([
                client_2.prisma.menuItem.count(),
                client_2.prisma.menuItem.count({ where: { isActive: true } }),
                client_2.prisma.menuItem.findMany({
                    where: { category: { not: null } },
                    select: { category: true },
                    distinct: ['category'],
                }),
                client_2.prisma.menuItem.aggregate({
                    where: {
                        price: { not: null },
                        isActive: true,
                    },
                    _avg: { price: true },
                }),
            ]);
            const categories = categoriesResult.length;
            const averagePrice = avgPriceResult._avg.price || 0;
            return {
                total,
                active,
                categories,
                averagePrice: Math.round(averagePrice * 100) / 100,
            };
        }
        catch (error) {
            logger_1.logger.error('Error getting menu stats:', error);
            throw new Error('Failed to get menu stats');
        }
    }
    static async bulkUpdateStatus(ids, isActive) {
        try {
            const result = await client_2.prisma.menuItem.updateMany({
                where: {
                    id: {
                        in: ids,
                    },
                },
                data: {
                    isActive,
                    updatedAt: new Date(),
                },
            });
            cache_service_1.CacheInvalidator.invalidateMenu();
            logger_1.logger.info(`Bulk updated ${result.count} menu items status to ${isActive}`);
            return result.count;
        }
        catch (error) {
            logger_1.logger.error('Error bulk updating menu items:', error);
            throw new Error('Failed to bulk update menu items');
        }
    }
}
exports.MenuService = MenuService;
//# sourceMappingURL=menu.service.js.map