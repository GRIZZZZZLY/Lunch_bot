import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageCircle, X, Send } from 'lucide-react';
import { Button } from '../ui/button';
import { GlassCard, GlassCardContent } from '../ui/glass-card';
import { feedbackService } from '../../services/feedback.service';
import { useHaptic } from '../../hooks/useHaptic';
import { useUI } from '../../store/useAppStore';
import { useAuth } from '../../hooks/useAuth';

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
  const { addNotification } = useUI();
  const { user } = useAuth();

  // Block body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }

    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  // Close on Escape
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    console.log('[FeedbackModal] handleSubmit called');
    
    if (!message.trim()) {
      console.log('[FeedbackModal] Validation failed: empty message');
      addNotification({
        type: 'error',
        message: 'Введите сообщение'
      });
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
        addNotification({
          type: 'success',
          message: '✅ Сообщение отправлено!'
        });
        setMessage('');
        onClose();
      } else {
        console.error('[FeedbackModal] Response indicates failure:', response.error);
        throw new Error(response.error || 'Ошибка отправки');
      }
    } catch (error: any) {
      console.error('[FeedbackModal] Error caught:', error);
      haptic.error();
      addNotification({
        type: 'error',
        message: error.message || '❌ Не удалось отправить'
      });
    } finally {
      setIsSending(false);
      console.log('[FeedbackModal] handleSubmit finished');
    }
  };

  const handleClose = () => {
    if (!isSending) {
      haptic.light();
      onClose();
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={handleClose}
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, y: 100, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 100, scale: 0.95 }}
            transition={{ 
              type: 'spring', 
              damping: 25, 
              stiffness: 300 
            }}
            className="relative w-full max-w-lg mx-4 mb-4 sm:mb-0"
          >
            <GlassCard intensity="solid">
              <GlassCardContent className="p-6 space-y-4">
                {/* Header */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="size-10 rounded-xl bg-gradient-to-br from-coral-500 to-coral-600 flex items-center justify-center">
                      <MessageCircle className="size-5 text-white" />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-foreground">
                        Обратная связь
                      </h3>
                      <p className="text-xs text-muted-foreground">
                        Сообщение отправится создателю бота
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={handleClose}
                    disabled={isSending}
                  >
                    <X className="size-5" />
                  </Button>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">
                      Ваше сообщение
                    </label>
                    <textarea
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      placeholder="Опишите свои впечатления, предложения или сообщите о проблеме..."
                      rows={5}
                      maxLength={1000}
                      disabled={isSending}
                      className="w-full px-4 py-3 rounded-xl border border-border bg-background/50 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-coral-500/50 resize-none transition-all"
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
                      variant="coral"
                      disabled={isSending || !message.trim()}
                      className="flex-1"
                    >
                      {isSending ? (
                        <>Отправка...</>
                      ) : (
                        <>
                          <Send className="size-4 mr-2" />
                          Отправить
                        </>
                      )}
                    </Button>
                  </div>
                </form>

                {/* Privacy note */}
                <p className="text-xs text-muted-foreground text-center">
                  🔒 Вместе с сообщением будет отправлен ваш Telegram ID для ответа
                </p>
              </GlassCardContent>
            </GlassCard>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
