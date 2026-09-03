/**
 * Личный список товаров: то, что пользователь уже заказывал.
 *
 * Пополняется сервером сам, на каждом добавлении и правке позиции. Клиент
 * умеет только читать, закреплять и удалять.
 */
import { apiService } from './api.service';
import type { ApiResponse } from '@/types/api';

export interface ItemPreset {
  id: number;
  name: string;
  quantity: number;
  notes?: string | null;
  pinned: boolean;
  usageCount: number;
  lastUsedAt: string;
}

export interface UpdateItemPresetInput {
  name?: string;
  quantity?: number;
  notes?: string | null;
  pinned?: boolean;
}

export const itemPresetService = {
  /** `storeId` поднимает наверх то, что уже брали в этом магазине. */
  list(storeId?: number | null): Promise<ApiResponse<ItemPreset[]>> {
    return apiService.get<ItemPreset[]>('/user/item-presets', {
      params: storeId ? { storeId } : undefined,
    });
  },
  update(id: number, data: UpdateItemPresetInput): Promise<ApiResponse<ItemPreset>> {
    return apiService.patch<ItemPreset>(`/user/item-presets/${id}`, data);
  },
  remove(id: number): Promise<ApiResponse<void>> {
    return apiService.delete<void>(`/user/item-presets/${id}`);
  },
};
