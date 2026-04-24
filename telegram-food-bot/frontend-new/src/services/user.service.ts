import { apiService } from './api.service';
import type { User } from '@/types/models';

export interface PaymentInfo {
  sbpPhone?: string;
  bankName?: string;
  cardNumber?: string;
}

export interface UserAvatar {
  userId: number;
  photoUrl?: string;
  initial: string;
  color?: string;
}

export interface UserGroup {
  id: number;
  title: string;
  telegramId: string;
  type: string;
  isActive: boolean;
  role: string;
}

class UserService {
  getMe() {
    return apiService.get<User>('/user/me');
  }

  getMyGroups() {
    return apiService.get<UserGroup[]>('/user/groups');
  }

  getPaymentInfo() {
    return apiService.get<PaymentInfo>('/user/payment-info');
  }

  updatePaymentInfo(data: PaymentInfo) {
    return apiService.put<PaymentInfo>('/user/payment-info', data);
  }

  getAvatar(userId: number) {
    return apiService.get<UserAvatar>(`/user/${userId}/avatar`);
  }

  getAvatarsBatch(userIds: number[]) {
    return apiService.post<UserAvatar[]>('/user/avatars/batch', { userIds });
  }
}

export const userService = new UserService();
