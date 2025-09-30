import { apiService, ApiResponse, PaginatedResponse } from './api.service';
import { mockApiService } from './mockApi.service';

const USE_MOCK_API = import.meta.env.VITE_USE_MOCK_API === 'true';

export interface MenuItem {
  id: number;
  name: string;
  description?: string;
  price?: number;
  category?: string;
  imageUrl?: string;
  images?: string[]; // Массив изображений для карусели
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface MenuItemWithStats extends MenuItem {
  voteCount: number;
  winCount: number;
  _count: {
    votes: number;
    pollResults: number;
  };
}

export interface CreateMenuItemData {
  name: string;
  description?: string;
  price?: number;
  category?: string;
  imageUrl?: string;
  isActive?: boolean;
}

export interface UpdateMenuItemData {
  name?: string;
  description?: string;
  price?: number;
  category?: string;
  imageUrl?: string;
  isActive?: boolean;
}

export interface MenuStats {
  total: number;
  active: number;
  categories: number;
  averagePrice: number;
}

class MenuService {
  /**
   * Получение всех блюд
   */
  async getAllItems(): Promise<ApiResponse<MenuItem[]>> {
    if (USE_MOCK_API) {
      return await mockApiService.getAllMenuItems();
    }
    return await apiService.get<MenuItem[]>('/menu');
  }

  /**
   * Получение только активных блюд
   */
  async getActiveItems(): Promise<ApiResponse<MenuItem[]>> {
    if (USE_MOCK_API) {
      return await mockApiService.getActiveMenuItems();
    }
    return await apiService.get<MenuItem[]>('/menu/active');
  }

  /**
   * Получение блюда по ID
   */
  async getItemById(id: number): Promise<ApiResponse<MenuItem>> {
    return await apiService.get<MenuItem>(`/menu/${id}`);
  }

  /**
   * Создание нового блюда
   */
  async createItem(data: CreateMenuItemData): Promise<ApiResponse<MenuItem>> {
    if (USE_MOCK_API) {
      return await mockApiService.createMenuItem(data);
    }
    return await apiService.post<MenuItem>('/menu', data);
  }

  /**
   * Обновление блюда
   */
  async updateItem(id: number, data: UpdateMenuItemData): Promise<ApiResponse<MenuItem>> {
    return await apiService.put<MenuItem>(`/menu/${id}`, data);
  }

  /**
   * Удаление блюда
   */
  async deleteItem(id: number): Promise<ApiResponse<void>> {
    return await apiService.delete<void>(`/menu/${id}`);
  }

  /**
   * Переключение статуса активности блюда
   */
  async toggleItemStatus(id: number): Promise<ApiResponse<MenuItem>> {
    return await apiService.patch<MenuItem>(`/menu/${id}/toggle`);
  }

  /**
   * Массовое обновление статуса блюд
   */
  async bulkUpdateStatus(
    ids: number[], 
    isActive: boolean
  ): Promise<ApiResponse<{ updatedCount: number }>> {
    return await apiService.patch<{ updatedCount: number }>('/menu/bulk-status', {
      ids,
      isActive,
    });
  }

  /**
   * Поиск блюд
   */
  async searchItems(query: string): Promise<ApiResponse<MenuItem[]>> {
    return await apiService.get<MenuItem[]>(`/menu/search?q=${encodeURIComponent(query)}`);
  }

  /**
   * Получение популярных блюд
   */
  async getPopularItems(limit: number = 10): Promise<ApiResponse<MenuItemWithStats[]>> {
    return await apiService.get<MenuItemWithStats[]>(`/menu/popular?limit=${limit}`);
  }

  /**
   * Получение категорий
   */
  async getCategories(): Promise<ApiResponse<string[]>> {
    if (USE_MOCK_API) {
      return await mockApiService.getMenuCategories();
    }
    return await apiService.get<string[]>('/menu/categories');
  }

  /**
   * Получение статистики меню
   */
  async getMenuStats(): Promise<ApiResponse<MenuStats>> {
    return await apiService.get<MenuStats>('/menu/stats');
  }

  /**
   * Получение блюд по категории
   */
  async getItemsByCategory(category: string): Promise<ApiResponse<MenuItem[]>> {
    return await apiService.get<MenuItem[]>(`/menu?category=${encodeURIComponent(category)}`);
  }

  /**
   * Получение блюд с пагинацией
   */
  async getItemsPaginated(params?: {
    limit?: number;
    offset?: number;
    category?: string;
    active?: boolean;
    search?: string;
  }): Promise<PaginatedResponse<MenuItem>> {
    const queryParams = new URLSearchParams();
    
    if (params?.limit) queryParams.append('limit', params.limit.toString());
    if (params?.offset) queryParams.append('offset', params.offset.toString());
    if (params?.category) queryParams.append('category', params.category);
    if (params?.active !== undefined) queryParams.append('active', params.active.toString());
    if (params?.search) queryParams.append('search', params.search);

    const queryString = queryParams.toString();
    const url = queryString ? `/menu?${queryString}` : '/menu';
    
    return await apiService.getPaginated<MenuItem>(url);
  }

  /**
   * Валидация данных блюда
   */
  validateItemData(data: CreateMenuItemData | UpdateMenuItemData): {
    isValid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    if ('name' in data && data.name) {
      if (data.name.trim().length < 1) {
        errors.push('Название блюда обязательно');
      }
      if (data.name.length > 100) {
        errors.push('Название блюда не должно превышать 100 символов');
      }
    }

    if (data.description && data.description.length > 500) {
      errors.push('Описание не должно превышать 500 символов');
    }

    if (data.price !== undefined && data.price < 0) {
      errors.push('Цена не может быть отрицательной');
    }

    if (data.category && data.category.length > 50) {
      errors.push('Название категории не должно превышать 50 символов');
    }

    if (data.imageUrl && !this.isValidUrl(data.imageUrl)) {
      errors.push('Некорректный URL изображения');
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * Проверка валидности URL
   */
  private isValidUrl(url: string): boolean {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Форматирование цены для отображения
   */
  formatPrice(price?: number): string {
    if (!price) return '';
    return new Intl.NumberFormat('ru-RU', {
      style: 'currency',
      currency: 'RUB',
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(price);
  }

  /**
   * Группировка блюд по категориям
   */
  groupByCategory(items: MenuItem[]): { [category: string]: MenuItem[] } {
    return items.reduce((groups, item) => {
      const category = item.category || 'Без категории';
      if (!groups[category]) {
        groups[category] = [];
      }
      groups[category].push(item);
      return groups;
    }, {} as { [category: string]: MenuItem[] });
  }

  /**
   * Сортировка блюд
   */
  sortItems(
    items: MenuItem[], 
    sortBy: 'name' | 'price' | 'category' | 'created' = 'name',
    order: 'asc' | 'desc' = 'asc'
  ): MenuItem[] {
    return [...items].sort((a, b) => {
      let aValue: string | number | Date;
      let bValue: string | number | Date;

      switch (sortBy) {
        case 'name':
          aValue = a.name.toLowerCase();
          bValue = b.name.toLowerCase();
          break;
        case 'price':
          aValue = a.price || 0;
          bValue = b.price || 0;
          break;
        case 'category':
          aValue = (a.category || 'Без категории').toLowerCase();
          bValue = (b.category || 'Без категории').toLowerCase();
          break;
        case 'created':
          aValue = new Date(a.createdAt);
          bValue = new Date(b.createdAt);
          break;
        default:
          return 0;
      }

      if (aValue < bValue) return order === 'asc' ? -1 : 1;
      if (aValue > bValue) return order === 'asc' ? 1 : -1;
      return 0;
    });
  }
}

export const menuService = new MenuService();
