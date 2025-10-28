"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.menuController = exports.MenuController = void 0;
const menu_service_1 = require("../../services/menu.service");
const logger_1 = require("../../utils/logger");
class MenuController {
    static async getAllItems(req, res) {
        try {
            const items = await menu_service_1.MenuService.getAllMenuItems();
            res.json({
                success: true,
                data: items,
                count: items.length,
                timestamp: new Date().toISOString(),
            });
        }
        catch (error) {
            logger_1.logger.error('Error getting all menu items:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to get menu items',
                code: 'INTERNAL_ERROR'
            });
        }
    }
    static async getActiveItems(req, res) {
        try {
            const user = req.user;
            logger_1.logger.info('🔍 [MenuController] getActiveItems called', {
                userId: user?.id,
                userTelegramId: user?.telegramId,
                hasAuthHeader: !!req.headers.authorization
            });
            const items = await menu_service_1.MenuService.getActiveMenuItems();
            logger_1.logger.info('✅ [MenuController] Active menu items retrieved', {
                count: items.length,
                items: items.map(i => ({ id: i.id, name: i.name, isActive: i.isActive }))
            });
            res.json({
                success: true,
                data: items,
                count: items.length,
                timestamp: new Date().toISOString(),
            });
        }
        catch (error) {
            logger_1.logger.error('❌ [MenuController] Error getting active menu items:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to get active menu items',
                code: 'INTERNAL_ERROR'
            });
        }
    }
    static async getCategories(req, res) {
        try {
            const categories = await menu_service_1.MenuService.getCategories();
            res.json({
                success: true,
                data: categories,
                count: categories.length,
                timestamp: new Date().toISOString(),
            });
        }
        catch (error) {
            logger_1.logger.error('Error getting categories:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to get categories',
                code: 'INTERNAL_ERROR'
            });
        }
    }
    static async getPopularItems(req, res) {
        try {
            const limit = parseInt(req.query.limit) || 10;
            const items = await menu_service_1.MenuService.getPopularMenuItems(limit);
            res.json({
                success: true,
                data: items,
                count: items.length,
                limit,
                timestamp: new Date().toISOString(),
            });
        }
        catch (error) {
            logger_1.logger.error('Error getting popular menu items:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to get popular menu items',
                code: 'INTERNAL_ERROR'
            });
        }
    }
    static async getMenuStats(req, res) {
        try {
            const stats = await menu_service_1.MenuService.getMenuStats();
            res.json({
                success: true,
                data: stats,
                timestamp: new Date().toISOString(),
            });
        }
        catch (error) {
            logger_1.logger.error('Error getting menu stats:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to get menu stats',
                code: 'INTERNAL_ERROR'
            });
        }
    }
    static async searchItems(req, res) {
        try {
            const query = req.query.q;
            if (!query || query.trim().length < 2) {
                res.status(400).json({
                    success: false,
                    error: 'Search query must be at least 2 characters long',
                    code: 'INVALID_QUERY'
                });
                return;
            }
            const items = await menu_service_1.MenuService.searchMenuItems(query.trim());
            res.json({
                success: true,
                data: items,
                count: items.length,
                query: query.trim(),
                timestamp: new Date().toISOString(),
            });
        }
        catch (error) {
            logger_1.logger.error('Error searching menu items:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to search menu items',
                code: 'INTERNAL_ERROR'
            });
        }
    }
    static async getItemById(req, res) {
        try {
            const id = parseInt(req.params.id);
            if (isNaN(id)) {
                res.status(400).json({
                    success: false,
                    error: 'Invalid item ID',
                    code: 'INVALID_ID'
                });
                return;
            }
            const item = await menu_service_1.MenuService.getMenuItemById(id);
            if (!item) {
                res.status(404).json({
                    success: false,
                    error: 'Menu item not found',
                    code: 'ITEM_NOT_FOUND'
                });
                return;
            }
            res.json({
                success: true,
                data: item,
                timestamp: new Date().toISOString(),
            });
        }
        catch (error) {
            logger_1.logger.error('Error getting menu item by ID:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to get menu item',
                code: 'INTERNAL_ERROR'
            });
        }
    }
    static async createItem(req, res) {
        try {
            const data = req.body;
            const user = req.user;
            logger_1.logger.info('🔵 CREATE MENU ITEM REQUEST', {
                requestId: Date.now(),
                userId: user.id,
                username: user.username,
                data: {
                    name: data.name,
                    description: data.description?.substring(0, 50),
                    price: data.price,
                    category: data.category,
                    isActive: data.isActive,
                },
            });
            const itemData = {
                ...data,
                createdBy: user.id,
            };
            const item = await menu_service_1.MenuService.createMenuItem(itemData);
            logger_1.logger.info('✅ MENU ITEM CREATED SUCCESSFULLY', {
                itemId: item.id,
                name: item.name,
                category: item.category,
                price: item.price,
                createdBy: user.id,
                createdByUsername: user.username,
            });
            res.status(201).json({
                success: true,
                data: item,
                message: 'Menu item created successfully',
                timestamp: new Date().toISOString(),
            });
        }
        catch (error) {
            logger_1.logger.error('❌ ERROR CREATING MENU ITEM', {
                error: error instanceof Error ? error.message : 'Unknown error',
                stack: error instanceof Error ? error.stack : undefined,
                userId: req.user?.id,
                requestBody: req.body,
            });
            res.status(500).json({
                success: false,
                error: 'Failed to create menu item',
                code: 'INTERNAL_ERROR'
            });
        }
    }
    static async updateItem(req, res) {
        try {
            const id = parseInt(req.params.id);
            const data = req.body;
            const user = req.user;
            if (isNaN(id)) {
                res.status(400).json({
                    success: false,
                    error: 'Invalid item ID',
                    code: 'INVALID_ID'
                });
                return;
            }
            const item = await menu_service_1.MenuService.updateMenuItem(id, data);
            logger_1.logger.info('Menu item updated', {
                itemId: item.id,
                name: item.name,
                updatedBy: user.id,
            });
            res.json({
                success: true,
                data: item,
                message: 'Menu item updated successfully',
                timestamp: new Date().toISOString(),
            });
        }
        catch (error) {
            if (error instanceof Error && error.message === 'Menu item not found') {
                res.status(404).json({
                    success: false,
                    error: 'Menu item not found',
                    code: 'ITEM_NOT_FOUND'
                });
                return;
            }
            logger_1.logger.error('Error updating menu item:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to update menu item',
                code: 'INTERNAL_ERROR'
            });
        }
    }
    static async toggleItemStatus(req, res) {
        try {
            const id = parseInt(req.params.id);
            const user = req.user;
            if (isNaN(id)) {
                res.status(400).json({
                    success: false,
                    error: 'Invalid item ID',
                    code: 'INVALID_ID'
                });
                return;
            }
            const item = await menu_service_1.MenuService.toggleMenuItemStatus(id);
            logger_1.logger.info('Menu item status toggled', {
                itemId: item.id,
                name: item.name,
                newStatus: item.isActive,
                toggledBy: user.id,
            });
            res.json({
                success: true,
                data: item,
                message: `Menu item ${item.isActive ? 'activated' : 'deactivated'} successfully`,
                timestamp: new Date().toISOString(),
            });
        }
        catch (error) {
            if (error instanceof Error && error.message === 'Menu item not found') {
                res.status(404).json({
                    success: false,
                    error: 'Menu item not found',
                    code: 'ITEM_NOT_FOUND'
                });
                return;
            }
            logger_1.logger.error('Error toggling menu item status:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to toggle menu item status',
                code: 'INTERNAL_ERROR'
            });
        }
    }
    static async deleteItem(req, res) {
        try {
            const id = parseInt(req.params.id);
            const user = req.user;
            if (isNaN(id)) {
                res.status(400).json({
                    success: false,
                    error: 'Invalid item ID',
                    code: 'INVALID_ID'
                });
                return;
            }
            await menu_service_1.MenuService.deleteMenuItem(id);
            logger_1.logger.info('Menu item deleted', {
                itemId: id,
                deletedBy: user.id,
            });
            res.json({
                success: true,
                message: 'Menu item deleted successfully',
                timestamp: new Date().toISOString(),
            });
        }
        catch (error) {
            if (error instanceof Error && error.message === 'Menu item not found') {
                res.status(404).json({
                    success: false,
                    error: 'Menu item not found',
                    code: 'ITEM_NOT_FOUND'
                });
                return;
            }
            logger_1.logger.error('Error deleting menu item:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to delete menu item',
                code: 'INTERNAL_ERROR'
            });
        }
    }
    static async bulkUpdateStatus(req, res) {
        try {
            const { ids, isActive } = req.body;
            const user = req.user;
            if (!Array.isArray(ids) || ids.length === 0) {
                res.status(400).json({
                    success: false,
                    error: 'Invalid or empty IDs array',
                    code: 'INVALID_IDS'
                });
                return;
            }
            if (typeof isActive !== 'boolean') {
                res.status(400).json({
                    success: false,
                    error: 'isActive must be boolean',
                    code: 'INVALID_STATUS'
                });
                return;
            }
            const updatedCount = await menu_service_1.MenuService.bulkUpdateStatus(ids, isActive);
            logger_1.logger.info('Bulk menu items status updated', {
                updatedCount,
                newStatus: isActive,
                updatedBy: user.id,
            });
            res.json({
                success: true,
                updatedCount,
                message: `${updatedCount} menu items ${isActive ? 'activated' : 'deactivated'} successfully`,
                timestamp: new Date().toISOString(),
            });
        }
        catch (error) {
            logger_1.logger.error('Error bulk updating menu items:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to bulk update menu items',
                code: 'INTERNAL_ERROR'
            });
        }
    }
}
exports.MenuController = MenuController;
exports.menuController = MenuController;
