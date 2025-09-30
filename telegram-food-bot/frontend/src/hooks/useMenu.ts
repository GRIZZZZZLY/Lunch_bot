import { useState, useEffect, useCallback } from 'react';
import { menuService, MenuItem, CreateMenuItemData, UpdateMenuItemData } from '../services/menu.service';

interface UseMenuOptions {
  page?: number;
  limit?: number;
  category?: string;
  isActive?: boolean;
  search?: string;
  autoFetch?: boolean;
}

interface UseMenuReturn {
  items: MenuItem[];
  loading: boolean;
  error: string | null;
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  } | null;
  
  // Actions
  fetchItems: () => Promise<void>;
  createItem: (data: CreateMenuItemData) => Promise<MenuItem | null>;
  updateItem: (id: number, data: UpdateMenuItemData) => Promise<MenuItem | null>;
  deleteItem: (id: number) => Promise<boolean>;
  toggleItem: (id: number) => Promise<MenuItem | null>;
  getItem: (id: number) => Promise<MenuItem | null>;
  
  // Utility
  refresh: () => Promise<void>;
  setFilters: (filters: Partial<UseMenuOptions>) => void;
}

export function useMenu(options: UseMenuOptions = {}): UseMenuReturn {
  const {
    page = 1,
    limit = 10,
    category,
    isActive,
    search,
    autoFetch = true
  } = options;

  const [items, setItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pagination, setPagination] = useState<{
    page: number;
    limit: number;
    total: number;
    pages: number;
  } | null>(null);

  const [filters, setFiltersState] = useState({
    page,
    limit,
    category,
    isActive,
    search
  });

  const setFilters = useCallback((newFilters: Partial<UseMenuOptions>) => {
    setFiltersState(prev => ({
      ...prev,
      ...newFilters,
      page: newFilters.page !== undefined ? newFilters.page : 1 // Reset page when filters change
    }));
  }, []);

  const fetchItems = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await menuService.getAllItems();
      
      if (response.success && response.data) {
        setItems(response.data);
        setPagination(null);
      } else {
        setError(response.error || 'Ошибка загрузки меню');
      }
    } catch (err: any) {
      setError(err.message || 'Произошла ошибка при загрузке меню');
      console.error('Error fetching menu items:', err);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  const createItem = useCallback(async (data: CreateMenuItemData): Promise<MenuItem | null> => {
    setLoading(true);
    setError(null);

    try {
      const response = await menuService.createItem(data);
      
      if (response.success && response.data) {
        // Обновляем локальный список
        await fetchItems();
        return response.data;
      } else {
        setError(response.error || 'Ошибка создания блюда');
        return null;
      }
    } catch (err: any) {
      setError(err.message || 'Произошла ошибка при создании блюда');
      console.error('Error creating menu item:', err);
      return null;
    } finally {
      setLoading(false);
    }
  }, [fetchItems]);

  const updateItem = useCallback(async (id: number, data: UpdateMenuItemData): Promise<MenuItem | null> => {
    setLoading(true);
    setError(null);

    try {
      const response = await menuService.updateItem(id, data);
      
      if (response.success && response.data) {
        // Обновляем элемент в локальном списке
        setItems(prev => prev.map(item => 
          item.id === id ? response.data! : item
        ));
        return response.data;
      } else {
        setError(response.error || 'Ошибка обновления блюда');
        return null;
      }
    } catch (err: any) {
      setError(err.message || 'Произошла ошибка при обновлении блюда');
      console.error('Error updating menu item:', err);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const deleteItem = useCallback(async (id: number): Promise<boolean> => {
    setLoading(true);
    setError(null);

    try {
      const response = await menuService.deleteItem(id);
      
      if (response.success) {
        // Удаляем элемент из локального списка
        setItems(prev => prev.filter(item => item.id !== id));
        return true;
      } else {
        setError(response.error || 'Ошибка удаления блюда');
        return false;
      }
    } catch (err: any) {
      setError(err.message || 'Произошла ошибка при удалении блюда');
      console.error('Error deleting menu item:', err);
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  const toggleItem = useCallback(async (id: number): Promise<MenuItem | null> => {
    setLoading(true);
    setError(null);

    try {
      const response = await menuService.toggleItemStatus(id);
      
      if (response.success && response.data) {
        // Обновляем элемент в локальном списке
        setItems(prev => prev.map(item => 
          item.id === id ? response.data! : item
        ));
        return response.data;
      } else {
        setError(response.error || 'Ошибка переключения статуса блюда');
        return null;
      }
    } catch (err: any) {
      setError(err.message || 'Произошла ошибка при переключении статуса блюда');
      console.error('Error toggling menu item:', err);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const getItem = useCallback(async (id: number): Promise<MenuItem | null> => {
    setLoading(true);
    setError(null);

    try {
      const response = await menuService.getItemById(id);
      
      if (response.success && response.data) {
        return response.data;
      } else {
        setError(response.error || 'Ошибка получения блюда');
        return null;
      }
    } catch (err: any) {
      setError(err.message || 'Произошла ошибка при получении блюда');
      console.error('Error getting menu item:', err);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const refresh = useCallback(() => fetchItems(), [fetchItems]);

  // Auto-fetch on mount and filter changes
  useEffect(() => {
    if (autoFetch) {
      fetchItems();
    }
  }, [fetchItems, autoFetch]);

  return {
    items,
    loading,
    error,
    pagination,
    
    fetchItems,
    createItem,
    updateItem,
    deleteItem,
    toggleItem,
    getItem,
    
    refresh,
    setFilters
  };
}
