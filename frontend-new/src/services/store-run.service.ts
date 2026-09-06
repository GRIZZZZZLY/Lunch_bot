import { apiService } from './api.service';
import type { ApiResponse } from '@/types/api';

export type StoreRunStatus = 'COLLECTING' | 'SHOPPING' | 'SETTLED' | 'CANCELLED';
export type StoreItemStatus = 'REQUESTED' | 'BOUGHT' | 'NOT_FOUND';

export interface StoreRunUser {
  id: number;
  telegramId?: string | number;
  firstName: string;
  lastName?: string | null;
  username?: string | null;
  avatarUrl?: string | null;
  photoUrl?: string | null;
}

export interface StoreItem {
  id: number;
  storeRunId: number;
  userId: number;
  name: string;
  quantity: number;
  notes?: string | null;
  price?: string | number | null;
  status: StoreItemStatus;
  createdAt: string;
  updatedAt: string;
  user?: StoreRunUser;
}

export interface StoreRun {
  id: number;
  groupId: number;
  initiatorId: number;
  /** Связь со справочником. `null` у закупок, созданных до его появления. */
  storeId?: number | null;
  /** Снимок имени на момент закупки: переименование магазина его не меняет. */
  storeName: string;
  status: StoreRunStatus;
  collectUntil: string;
  shoppingAt?: string | null;
  settledAt?: string | null;
  cancelledAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface StoreRunWithRelations extends StoreRun {
  initiator: StoreRunUser;
  group?: { id: number; telegramId: string | number; title: string };
  items: StoreItem[];
}

export interface StoreRunListItem extends StoreRun {
  initiator: StoreRunUser;
  items: Array<Pick<StoreItem, 'id' | 'name' | 'quantity'>>;
}

/**
 * Магазин задаётся ЛИБО выбором из справочника (`storeId`), ЛИБО именем.
 * Сервер требует хотя бы одно из двух; имя при выборе чипа не дублируется,
 * чтобы источником истины оставалась запись справочника.
 */
export interface CreateStoreRunPayload {
  groupId: number;
  storeId?: number | null;
  storeName?: string;
  collectMinutes: number;
}

export interface AddItemInput {
  name: string;
  quantity?: number;
  notes?: string | null;
}

export interface UpdateItemInput {
  name?: string;
  quantity?: number;
  notes?: string | null;
}

export interface SetPricePayload {
  price: number | null;
  status: 'BOUGHT' | 'NOT_FOUND';
}

export const storeRunService = {
  createRun(payload: CreateStoreRunPayload): Promise<ApiResponse<StoreRun>> {
    return apiService.post<StoreRun>('/store-runs', payload);
  },
  /** `groupId` явно: см. polls.service.getActive про фиксацию области. */
  getActive(groupId?: string): Promise<ApiResponse<StoreRunListItem[]>> {
    return apiService.get<StoreRunListItem[]>('/store-runs/active', {
      params: groupId ? { groupId } : undefined,
    });
  },
  getRun(id: number): Promise<ApiResponse<StoreRunWithRelations>> {
    return apiService.get<StoreRunWithRelations>(`/store-runs/${id}`);
  },
  addItems(id: number, items: AddItemInput[]): Promise<ApiResponse<StoreItem[]>> {
    return apiService.post<StoreItem[]>(`/store-runs/${id}/items`, { items });
  },
  updateItem(runId: number, itemId: number, data: UpdateItemInput): Promise<ApiResponse<StoreItem>> {
    return apiService.patch<StoreItem>(`/store-runs/${runId}/items/${itemId}`, data);
  },
  deleteItem(runId: number, itemId: number): Promise<ApiResponse<void>> {
    return apiService.delete<void>(`/store-runs/${runId}/items/${itemId}`);
  },
  setItemPrice(runId: number, itemId: number, payload: SetPricePayload): Promise<ApiResponse<StoreItem>> {
    return apiService.post<StoreItem>(`/store-runs/${runId}/items/${itemId}/price`, payload);
  },
  startShopping(id: number): Promise<ApiResponse<StoreRun>> {
    return apiService.post<StoreRun>(`/store-runs/${id}/start-shopping`, {});
  },
  settle(id: number): Promise<ApiResponse<StoreRun>> {
    return apiService.post<StoreRun>(`/store-runs/${id}/settle`, {});
  },
  cancel(id: number): Promise<ApiResponse<StoreRun>> {
    return apiService.post<StoreRun>(`/store-runs/${id}/cancel`, {});
  },
};
