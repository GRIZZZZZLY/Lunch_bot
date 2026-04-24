import { useMutation } from '@tanstack/react-query';
import { feedbackService, type FeedbackRequest } from '@/services/feedback.service';

export function useSendFeedback() {
  return useMutation({
    mutationFn: (data: FeedbackRequest) => feedbackService.send(data),
  });
}
