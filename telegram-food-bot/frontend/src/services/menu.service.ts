import { apiService, ApiResponse, PaginatedResponse } from './api.service';

const RUSSIAN_CURRENCY_FORMATTER = new Intl.NumberFormat('ru-RU', {
  style: 'currency',
  currency: 'RUB',
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

const USE_MOCK_API = import.meta.env.VITE_USE_MOCK_API === 'true';

export interface MenuItem {
  id: number;
  groupId: number;
  name: string;
  description?: string;
  price?: number;
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
  imageUrl?: string;
  isActive?: boolean;
}

export interface UpdateMenuItemData {
  name?: string;
  description?: string;
  price?: number;
  imageUrl?: string;
  isActive?: boolean;
}

export interface MenuStats {
  total: number;
  active: number;
  averagePrice: number;
}

class MenuService {
  /**
   * Получение всех блюд
   */
  async getAllItems(groupId: number): Promise<ApiResponse<MenuItem[]>> {
    if (USE_MOCK_API) {
      const { mockApiService } = await import('./mockApi.service');
      return await mockApiService.getAllMenuItems();
    }
    return await apiService.get<MenuItem[]>(`/menu?groupId=${groupId}`);
  }

  /**
   * Получение только активных блюд
   */
  async getActiveItems(groupId: number): Promise<ApiResponse<MenuItem[]>> {
    if (import.meta.env.DEV) {
      console.log('[MenuService] 🔍 getActiveItems called', {
        useMockApi: USE_MOCK_API,
        hasToken: !!apiService.getToken(),
        groupId,
      });
    }

    if (USE_MOCK_API) {
      const { mockApiService } = await import('./mockApi.service');
      return await mockApiService.getActiveMenuItems();
    }

    const response = await apiService.get<MenuItem[]>(`/menu/active?groupId=${groupId}`);

    if (import.meta.env.DEV) {
      console.log('[MenuService] ✅ getActiveItems response', {
        success: response.success,
        count: response.data?.length || 0,
        error: response.error,
        data: response.data
      });
    }

    return response;
  }

  /**
   * Получение блюда по ID
   */
  async getItemById(id: number): Promise<ApiResponse<MenuItem>> {
    return await apiService.get<MenuItem>(`/menu/${id}`);
  }

  /**
   * Создание нового блюда (в одной или нескольких группах)
   */
  async createItem(data: CreateMenuItemData, groupIds: number[]): Promise<ApiResponse<MenuItem[]>> {
    if (USE_MOCK_API) {
      const { mockApiService } = await import('./mockApi.service');
      const single = await mockApiService.createMenuItem(data);
      return { ...single, data: single.data ? [single.data] : [] } as ApiResponse<MenuItem[]>;
    }
    return await apiService.post<MenuItem[]>('/menu', { ...data, groupIds });
  }

  /**
   * Обновление блюда
   */
  async updateItem(id: number, data: UpdateMenuItemData, groupId: number): Promise<ApiResponse<MenuItem>> {
    const safeData = {
      ...(data as UpdateMenuItemData & { groupId?: number; groupIds?: number[] }),
    };
    delete safeData.groupId;
    delete safeData.groupIds;

    return await apiService.put<MenuItem>(`/menu/${id}?groupId=${groupId}`, { ...safeData, groupId });
  }

  /**
   * Удаление блюда
   */
  async deleteItem(id: number, groupId: number): Promise<ApiResponse<void>> {
    return await apiService.delete<void>(`/menu/${id}?groupId=${groupId}`);
  }

  /**
   * Переключение статуса активности блюда
   */
  async toggleItemStatus(id: number, groupId: number): Promise<ApiResponse<MenuItem>> {
    return await apiService.patch<MenuItem>(`/menu/${id}/toggle?groupId=${groupId}`, { groupId });
  }

  /**
   * Массовое обновление статуса блюд
   */
  async bulkUpdateStatus(
    ids: number[],
    isActive: boolean,
    groupId: number,
  ): Promise<ApiResponse<{ updatedCount: number }>> {
    return await apiService.patch<{ updatedCount: number }>('/menu/bulk-status', {
      ids,
      isActive,
      groupId,
    });
  }

  /**
   * Поиск блюд
   */
  async searchItems(query: string, groupId: number): Promise<ApiResponse<MenuItem[]>> {
    return await apiService.get<MenuItem[]>(`/menu/search?q=${encodeURIComponent(query)}&groupId=${groupId}`);
  }

  /**
   * Получение популярных блюд
   */
  async getPopularItems(limit: number = 10, groupId: number): Promise<ApiResponse<MenuItemWithStats[]>> {
    return await apiService.get<MenuItemWithStats[]>(`/menu/popular?limit=${limit}&groupId=${groupId}`);
  }

  /**
   * Получение статистики меню
   */
  async getMenuStats(groupId: number): Promise<ApiResponse<MenuStats>> {
    return await apiService.get<MenuStats>(`/menu/stats?groupId=${groupId}`);
  }

  /**
   * Получение блюд с пагинацией
   */
  async getItemsPaginated(params: {
    groupId: number;
    limit?: number;
    offset?: number;
    active?: boolean;
    search?: string;
  }): Promise<PaginatedResponse<MenuItem>> {
    const queryParams = new URLSearchParams();

    queryParams.append('groupId', params.groupId.toString());
    if (params.limit) queryParams.append('limit', params.limit.toString());
    if (params.offset) queryParams.append('offset', params.offset.toString());
    if (params.active !== undefined) queryParams.append('active', params.active.toString());
    if (params.search) queryParams.append('search', params.search);

    return await apiService.getPaginated<MenuItem>(`/menu?${queryParams.toString()}`);
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
    return RUSSIAN_CURRENCY_FORMATTER.format(price);
  }

  /**
   * Сортировка блюд
   */
  sortItems(
    items: MenuItem[], 
    sortBy: 'name' | 'price' | 'created' = 'name',
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
