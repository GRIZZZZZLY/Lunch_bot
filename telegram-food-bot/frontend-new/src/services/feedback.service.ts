import { apiService } from './api.service';

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

class FeedbackService {
  send(data: FeedbackRequest) {
    return apiService.post<FeedbackResponse>('/feedback', data);
  }
}

export const feedbackService = new FeedbackService();
