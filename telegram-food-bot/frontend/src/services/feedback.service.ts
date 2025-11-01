import { apiService, ApiResponse } from './api.service';

export interface FeedbackRequest {
  message: string;
  userId?: number;
  username?: string;
  firstName?: string;
}

export interface FeedbackResponse {
  id: number;
  createdAt: string;
}

/**
 * Feedback Service - Сервис обратной связи
 * 
 * Отправляет сообщения пользователей создателю бота
 */
class FeedbackService {
  /**
   * Отправить обратную связь
   */
  async send(data: FeedbackRequest): Promise<ApiResponse<FeedbackResponse>> {
    return apiService.post<FeedbackResponse>('/feedback', data);
  }
}

export const feedbackService = new FeedbackService();
