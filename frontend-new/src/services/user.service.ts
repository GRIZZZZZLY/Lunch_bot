import { apiService } from './api.service';
import type { User } from '@/types/models';

/* Имена полей — как на проводе. Раньше здесь были sbpPhone/bankName/cardNumber,
   а API читает и отдаёт paymentPhone/paymentCard/paymentDetails: PUT отвечал
   200, но записывал undefined в каждое поле, а GET отдавал данные, которых
   форма не видела. Профиль поэтому не сохранял НИЧЕГО и всегда показывал
   «СБП не задано». Экран бюджета всё это время читал правильные имена —
   расходился только профиль. */
export interface PaymentInfo {
  paymentPhone?: string | null;
  paymentCard?: string | null;
  paymentDetails?: string | null;
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
