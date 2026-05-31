import React, { useState } from 'react';
import { MessageCircle, Send } from 'lucide-react';
import { Button } from '../ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import { feedbackService } from '../../services/feedback.service';
import { useHaptic } from '../../hooks/useHaptic';
import { useAuth } from '../../hooks/useAuth';
import { ICON_SIZES } from '@/lib/design-tokens';
import { toast } from 'sonner';

interface FeedbackModalProps {
  isOpen: boolean;
  onClose: () => void;
}

/**
 * FeedbackModal - Модальное окно обратной связи
 * 
 * Позволяет пользователю отправить сообщение создателю бота.
 * Сообщение отправляется в Telegram создателя.
 */
export const FeedbackModal: React.FC<FeedbackModalProps> = ({ 
  isOpen, 
  onClose 
}) => {
  const [message, setMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const haptic = useHaptic();
  const { user } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    console.log('[FeedbackModal] handleSubmit called');
    
    if (!message.trim()) {
      console.log('[FeedbackModal] Validation failed: empty message');
      toast.error('Введи сообщение');
      return;
    }

    try {
      setIsSending(true);
      haptic.light();

      console.log('[FeedbackModal] Sending feedback:', {
        messageLength: message.trim().length,
        userId: user?.id,
        username: user?.username,
        firstName: user?.firstName,
      });

      const response = await feedbackService.send({
        message: message.trim(),
        userId: user?.id,
        username: user?.username,
        firstName: user?.firstName,
      });

      console.log('[FeedbackModal] Response received:', response);

      if (response.success) {
        console.log('[FeedbackModal] Success! Showing notification');
        haptic.success();
        toast.success('✅ Сообщение отправлено!');
        setMessage('');
        onClose();
      } else {
        console.error('[FeedbackModal] Response indicates failure:', response.error);
        throw new Error(response.error || 'Ошибка отправки');
      }
    } catch (error: unknown) {
      console.error('[FeedbackModal] Error caught:', error);
      haptic.error();
      const errorMessage = error instanceof Error ? error.message : '❌ Не удалось отправить';
      toast.error(errorMessage);
    } finally {
      setIsSending(false);
      console.log('[FeedbackModal] handleSubmit finished');
    }
  };

  const handleClose = () => {
    if (!isSending) {
      setMessage('');
      onClose();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-xl bg-gradient-to-br from-orange-500 to-red-500 dark:from-purple-500 dark:to-violet-500 flex items-center justify-center shadow-lg shadow-orange-500/30 dark:shadow-purple-500/30">
              <MessageCircle className={`${ICON_SIZES.md} text-white`} strokeWidth={2.5} />
            </div>
            <div>
              <DialogTitle>Обратная связь</DialogTitle>
              <DialogDescription>
                Сообщение уйдёт создателю бота
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Твоё сообщение
            </label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Опиши свои впечатления, предложения или сообщи о проблеме..."
              rows={5}
              maxLength={1000}
              disabled={isSending}
              className="w-full px-4 py-3 rounded-xl border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-orange-500/50 dark:focus:ring-purple-500/50 focus:border-orange-500 dark:focus:border-purple-500 resize-none transition-all"
            />
            <p className="text-xs text-muted-foreground mt-1">
              {message.length}/1000 символов
            </p>
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={isSending}
              className="flex-1"
            >
              Отмена
            </Button>
            <Button
              type="submit"
              disabled={isSending || !message.trim()}
              className="flex-1 bg-gradient-to-r from-orange-500 to-red-500 dark:from-purple-500 dark:to-violet-500 hover:from-orange-600 hover:to-red-600 dark:hover:from-purple-600 dark:hover:to-violet-600 text-white shadow-lg shadow-orange-500/30 dark:shadow-purple-500/30 hover:shadow-orange-500/50 dark:hover:shadow-purple-500/50 transition-all"
            >
              {isSending ? (
                <>Отправка...</>
              ) : (
                <>
                  <Send className={`${ICON_SIZES.sm} mr-2`} />
                  Отправить
                </>
              )}
            </Button>
          </div>

          {/* Privacy note */}
          <p className="text-xs text-muted-foreground text-center">
            🔒 Вместе с сообщением будет отправлен твой Telegram ID для ответа
          </p>
        </form>
      </DialogContent>
    </Dialog>
  );
};
