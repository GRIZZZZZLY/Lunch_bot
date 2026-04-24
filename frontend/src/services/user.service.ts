import { apiService, ApiResponse } from './api.service';

export interface User {
  id: number;
  telegramId: string;
  username?: string;
  firstName: string;
  lastName?: string;
  photoUrl?: string;
  isAdmin: boolean;
  isActive: boolean;
  createdAt: string;
}

export interface UserAvatar {
  userId: number;
  telegramId: string;
  avatarUrl: string | null;
}

export interface PaymentInfo {
  paymentCard?: string | null;
  paymentPhone?: string | null;
  paymentDetails?: string | null;
}

export interface Group {
  id: number;
  title: string;
  telegramId: string;
  type: string;
  isActive: boolean;
  role?: string;
}

class UserService {
  /**
   * Получение информации о текущем пользователе
   */
  async getCurrentUser(): Promise<ApiResponse<User>> {
    return await apiService.get<User>('/user/me');
  }

  /**
   * Получение платёжных данных
   */
  async getPaymentInfo(): Promise<ApiResponse<PaymentInfo>> {
    return await apiService.get<PaymentInfo>('/user/payment-info');
  }

  /**
   * Обновление платёжных данных
   */
  async updatePaymentInfo(data: PaymentInfo): Promise<ApiResponse<PaymentInfo>> {
    return await apiService.put<PaymentInfo>('/user/payment-info', data);
  }

  /**
   * Получение списка групп пользователя
   */
  async getUserGroups(): Promise<ApiResponse<Group[]>> {
    return await apiService.get<Group[]>('/user/groups');
  }

  /**
   * Получение аватарки пользователя по ID
   */
  async getUserAvatar(userId: number): Promise<ApiResponse<UserAvatar>> {
    return await apiService.get<UserAvatar>(`/user/${userId}/avatar`);
  }

  /**
   * Batch-загрузка аватарок для нескольких пользователей
   */
  async getUserAvatarsBatch(userIds: number[]): Promise<ApiResponse<UserAvatar[]>> {
    return await apiService.post<UserAvatar[]>('/user/avatars/batch', { userIds });
  }

  /**
   * Маскировка номера карты для отображения
   */
  maskCardNumber(cardNumber: string): string {
    if (!cardNumber) return '';
    
    // Убираем все пробелы и не-цифры
    const cleanNumber = cardNumber.replace(/\D/g, '');
    
    if (cleanNumber.length < 4) return cardNumber;
    
    // Показываем последние 4 цифры
    const lastFour = cleanNumber.slice(-4);
    const masked = '*'.repeat(Math.max(cleanNumber.length - 4, 0));
    
    return `${masked}${lastFour}`;
  }

  /**
   * Форматирование номера карты с пробелами
   */
  formatCardNumber(cardNumber: string): string {
    if (!cardNumber) return '';
    
    // Убираем все не-цифры
    const cleanNumber = cardNumber.replace(/\D/g, '');
    
    // Разбиваем на группы по 4 цифры
    const groups = cleanNumber.match(/.{1,4}/g) || [];
    return groups.join(' ');
  }

  /**
   * Валидация номера карты (простая проверка)
   */
  validateCardNumber(cardNumber: string): boolean {
    if (!cardNumber) return false;
    
    const cleanNumber = cardNumber.replace(/\D/g, '');
    
    // Карта должна быть от 13 до 19 цифр
    if (cleanNumber.length < 13 || cleanNumber.length > 19) {
      return false;
    }
    
    return true;
  }

  /**
   * Валидация номера телефона
   */
  validatePhone(phone: string): boolean {
    if (!phone) return false;
    
    // Простая валидация - минимум 10 цифр
    const cleanPhone = phone.replace(/\D/g, '');
    return cleanPhone.length >= 10;
  }

  /**
   * Форматирование номера телефона
   */
  formatPhone(phone: string): string {
    if (!phone) return '';
    
    // Убираем все не-цифры
    const cleanPhone = phone.replace(/\D/g, '');
    
    // Формат: +7 (XXX) XXX-XX-XX для российских номеров
    if (cleanPhone.length === 11 && cleanPhone.startsWith('7')) {
      return `+7 (${cleanPhone.slice(1, 4)}) ${cleanPhone.slice(4, 7)}-${cleanPhone.slice(7, 9)}-${cleanPhone.slice(9, 11)}`;
    }
    
    // Формат: +X (XXX) XXX-XX-XX для других
    if (cleanPhone.length >= 10) {
      const countryCode = cleanPhone.slice(0, -10);
      const rest = cleanPhone.slice(-10);
      return `+${countryCode} (${rest.slice(0, 3)}) ${rest.slice(3, 6)}-${rest.slice(6, 8)}-${rest.slice(8, 10)}`;
    }
    
    return phone;
  }
}

export const userService = new UserService();
