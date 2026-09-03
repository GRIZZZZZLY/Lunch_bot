/**
 * Справочник магазинов группы — «откуда заказываем».
 *
 * Метода создания нет: запись рождается на сервере при создании закупки. Здесь
 * только чтение подсказок и правка того, что уже накопилось.
 */
import { apiService } from './api.service';
import type { ApiResponse } from '@/types/api';

export interface GroupStore {
  id: number;
  groupId: number;
  name: string;
  lastUsedAt: string;
  usageCount: number;
  archivedAt?: string | null;
}

export const groupStoreService = {
  list(groupId: number): Promise<ApiResponse<GroupStore[]>> {
    return apiService.get<GroupStore[]>(`/groups/${groupId}/stores`);
  },
  rename(groupId: number, storeId: number, name: string): Promise<ApiResponse<GroupStore>> {
    return apiService.patch<GroupStore>(`/groups/${groupId}/stores/${storeId}`, { name });
  },
  /** Скрывает магазин из подсказок. Закупки, где он назван, не меняются. */
  archive(groupId: number, storeId: number): Promise<ApiResponse<void>> {
    return apiService.delete<void>(`/groups/${groupId}/stores/${storeId}`);
  },
};
