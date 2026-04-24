import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Header } from '../components/layout/Layout';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import { PastelCard, CardHeader, CardContent } from '../components/ui/pastel-card';
import { Badge } from '../components/ui/badge';
// import { MediumWaveGradient } from '../components/background'; // REMOVED: убрали оранжевый градиент
import { UserAvatar } from '../components/common/UserAvatar';
import {
  User,
  CreditCard,
  Phone,
  FileText,
  Save,
  Shield,
  Info,
  Crown,
  BookOpen,
  Settings,
  Lightbulb,
  ChevronRight
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useTelegram } from '../hooks/useTelegram';
import { useAppStore } from '../store/useAppStore';
import { userService, PaymentInfo } from '../services/user.service';
import { useOnboarding } from '../hooks/useOnboarding';
import { getQuickStats } from '../services/insights.service';
import type { ApiResponse } from '../services/api.service';
import { DonationButton } from '../components/donation/DonationButton';
import { FloatingActionButton } from '../components/common/FloatingActionButton';
import { FeedbackModal } from '../components/modals/FeedbackModal';
import { ICON_SIZES } from '@/lib/design-tokens';
import { cn } from '@/lib/utils';

/**
 * Страница профиля и настроек платёжных данных
 * Использует React Query для предотвращения смешивания данных между пользователями
 */
export const ProfilePage: React.FC = () => {
  const navigate = useNavigate();
  const { user, refresh } = useAuth();
  const { mainButton, backButton, colorScheme } = useTelegram();
  const addNotification = useAppStore((state) => state.addNotification);
  
  const isDark = colorScheme === 'dark';
  const { showOnboarding } = useOnboarding();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Local state для формы
  const [paymentInfo, setPaymentInfo] = useState<PaymentInfo>({
    paymentCard: '',
    paymentPhone: '',
    paymentDetails: '',
  });
  const [errors, setErrors] = useState<{
    paymentCard?: string;
    paymentPhone?: string;
  }>({});
  
  // Автосохранение
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [isFeedbackModalOpen, setIsFeedbackModalOpen] = useState(false);
  const isInitialLoadRef = useRef(true);

  // Сброс при смене пользователя и загрузка данных
  useEffect(() => {
    if (!user?.id) return;

    console.log(`[ProfilePage] User changed to ${user.id} - loading payment info`);
    isInitialLoadRef.current = true;
    setPaymentInfo({
      paymentCard: '',
      paymentPhone: '',
      paymentDetails: '',
    });

    let isActive = true;

    const loadPaymentInfo = async () => {
      try {
        setLoading(true);
        const response = await userService.getPaymentInfo();

        if (!isActive) return;

        if (!response.success) {
          throw new Error(response.error || 'Failed to fetch payment info');
        }

        const data = response.data || {
          paymentCard: '',
          paymentPhone: '',
          paymentDetails: '',
        };

        setPaymentInfo({
          paymentCard: data.paymentCard || '',
          paymentPhone: data.paymentPhone || '',
          paymentDetails: data.paymentDetails || '',
        });
      } catch (error) {
        if (!isActive) return;

        console.error('[ProfilePage] Failed to load payment info:', error);
        addNotification({
          type: 'error',
          message: 'Ошибка загрузки платёжных данных',
        });
      } finally {
        if (isActive) {
          setLoading(false);
          isInitialLoadRef.current = false;
        }
      }
    };

    loadPaymentInfo();

    return () => {
      isActive = false;
    };
  }, [user?.id, addNotification]);

  // Настройка Telegram кнопок (только Back Button)
  useEffect(() => {
    backButton.onClick(() => navigate('/'));
    backButton.show();

    return () => {
      backButton.hide();
      // Очистить таймер автосохранения при размонтировании
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [backButton, navigate]);

  const validateForm = (data: PaymentInfo): boolean => {
    const newErrors: typeof errors = {};

    if (data.paymentCard && !userService.validateCardNumber(data.paymentCard)) {
      newErrors.paymentCard = 'Некорректный номер карты';
    }

    if (data.paymentPhone && !userService.validatePhone(data.paymentPhone)) {
      newErrors.paymentPhone = 'Некорректный номер телефона';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Автосохранение с debounce
  const autoSave = useCallback((data: PaymentInfo) => {
    // Очищаем предыдущий таймер
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    
    // Устанавливаем флаг несохранённых изменений
    setHasUnsavedChanges(true);
    
    // Устанавливаем новый таймер на 2 секунды
    saveTimeoutRef.current = setTimeout(() => {
      // Валидация перед сохранением
      if (!validateForm(data)) {
        setHasUnsavedChanges(false);
        return; // Не сохраняем невалидные данные
      }
      
      setIsSaving(true);
      setHasUnsavedChanges(false);
      userService.updatePaymentInfo(data).then((response: ApiResponse<PaymentInfo>) => {
        if (!response.success) {
          throw new Error(response.error || 'Failed to update payment info');
        }
        setIsSaving(false);
        setLastSaved(new Date());
      }).catch(() => {
        setIsSaving(false);
        addNotification({
          type: 'error',
          message: 'Ошибка при сохранении',
        });
      });
    }, 2000); // 2 секунды задержки
  }, [addNotification]);

  const handleChange = (field: keyof PaymentInfo, value: string) => {
    const newData = { ...paymentInfo, [field]: value };
    setPaymentInfo(newData);
    
    // Очищаем ошибку при изменении
    if (errors[field as keyof typeof errors]) {
      setErrors(prev => ({ ...prev, [field]: undefined }));
    }
    
    // Запускаем автосохранение
    autoSave(newData);
  };

  const formatCardInput = (value: string) => {
    // Убираем все не-цифры и форматируем
    const cleaned = value.replace(/\D/g, '');
    return userService.formatCardNumber(cleaned);
  };

  if (loading) {
    return (
      <div className="min-h-screen relative">
        <div className="flex items-center justify-center min-h-screen">
          <LoadingSpinner size="lg" />
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Background removed - using neutral bg-background from Layout */}
      
        <div className="relative z-10 space-y-6">
        {/* Информация о пользователе */}
        <PastelCard variant="default" className="p-5">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.4 }}
            className="flex items-center gap-4"
          >
            {/* Avatar with automatic loading from Telegram */}
            <UserAvatar
              userId={user?.id}
              firstName={user?.firstName || '?'}
              lastName={user?.lastName}
              size="lg"
            />
            
            <div className="flex-1">
                <div className="text-lg font-semibold text-foreground">
                  {user?.firstName} {user?.lastName}
                </div>
                {user?.username && (
                  <div className="mt-0.5 flex items-center gap-1 text-sm text-muted-foreground">
                    <User size={14} />
                    @{user.username}
                  </div>
                )}
                {user?.isAdmin && (
                  <div className="mt-2">
                    <Badge 
                      variant="warning" 
                    >
                    <Crown className={`${ICON_SIZES.sm} mr-1`} />
                    Администратор
                  </Badge>
                </div>
              )}
            </div>
          </motion.div>
        </PastelCard>

        {/* Stats Row — опросы · блюд · любимое (3-col dashed dividers) */}
        {user?.id && (() => {
          const qs = getQuickStats(user.id);
          return (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25, duration: 0.32 }}
            >
              <PastelCard variant="default" className="p-0 overflow-hidden">
                <div className="grid grid-cols-3 divide-x divide-dashed divide-border/70">
                  <div className="flex flex-col items-center justify-center py-4 px-2">
                    <div className="text-2xl font-bold text-foreground tabular-nums">{qs.totalVotes}</div>
                    <div className="mt-1 text-xs text-muted-foreground">опросов</div>
                  </div>
                  <div className="flex flex-col items-center justify-center py-4 px-2">
                    <div className="text-2xl font-bold text-foreground tabular-nums">{qs.uniqueDishes}</div>
                    <div className="mt-1 text-xs text-muted-foreground">блюд</div>
                  </div>
                  <div className="flex flex-col items-center justify-center py-4 px-2 min-w-0">
                    <div className="text-base font-semibold text-foreground truncate max-w-full">
                      {qs.topDish || '—'}
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">любимое</div>
                  </div>
                </div>
              </PastelCard>
            </motion.div>
          );
        })()}

        {/* Quick link to full history */}
        <motion.button
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.28, duration: 0.32 }}
          whileHover={{ scale: 1.01 }}
          whileTap={{ scale: 0.99 }}
          onClick={() => navigate('/poll/history')}
          className="w-full rounded-2xl border border-peach-500/20 bg-card/95 p-4 transition-all hover:border-peach-500/35 hover:shadow-md"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-peach-500/12 p-2 text-peach-600 dark:text-peach-400">
                <BookOpen className={cn(ICON_SIZES.md)} />
              </div>
              <div className="text-left">
                <p className="font-semibold text-foreground">История голосований</p>
                <p className="text-sm text-muted-foreground">Победы, участия и пропуски</p>
              </div>
            </div>
            <ChevronRight className={cn(ICON_SIZES.md, 'text-peach-500')} />
          </div>
        </motion.button>

        {/* Admin Dashboard Access */}
        {user?.isAdmin && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.4 }}
          >
            <button
              onClick={() => navigate('/admin/dashboard')}
              className="w-full rounded-2xl border border-butter-500/20 bg-card/95 p-5 transition-all hover:border-butter-500/35 hover:shadow-md"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="rounded-xl bg-butter-500/12 p-3 text-butter-600 dark:text-butter-400">
                    <Shield className={cn(ICON_SIZES.lg)} />
                  </div>
                  <div className="text-left">
                    <div className="flex items-center gap-2 text-lg font-semibold text-foreground">
                      Панель администратора
                      <Crown size={18} className="text-butter-600 dark:text-butter-400" />
                    </div>
                    <div className="mt-0.5 text-sm text-muted-foreground">
                      Статистика, логи и управление системой
                    </div>
                  </div>
                </div>
                <div className="text-butter-600 dark:text-butter-400">
                  <Settings className={ICON_SIZES.md} />
                </div>
              </div>
            </button>
          </motion.div>
        )}

        {/* Refresh Token button (if admin in DB but not in token) */}
        {!user?.isAdmin && import.meta.env.DEV && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.4 }}
          >
            <button
              onClick={async () => {
                try {
                  await refresh();
                  addNotification({
                    type: 'success',
                    message: '✅ Права обновлены! Перезагрузите страницу.',
                  });
                  setTimeout(() => window.location.reload(), 1500);
                } catch (error) {
                  addNotification({
                    type: 'error',
                    message: '❌ Ошибка обновления прав',
                  });
                }
              }}
              className="w-full p-4 rounded-2xl bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 border border-blue-200 dark:border-blue-700 hover:shadow-lg transition-all"
            >
              <div className="flex items-center justify-center gap-2 text-blue-600 dark:text-blue-400">
                <Settings size={18} />
                <span className="text-sm font-medium">Обновить права доступа (Dev)</span>
              </div>
            </button>
          </motion.div>
        )}

        {/* My Suggestions Access - для всех пользователей */}
        {/* Мои предложения / Предложка */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: user?.isAdmin ? 0.4 : 0.3, duration: 0.4 }}
        >
          <button
            onClick={() => navigate(user?.isAdmin ? '/admin/suggestions' : '/my-suggestions')}
            className="w-full rounded-2xl border border-lavender-500/20 bg-card/95 p-5 transition-all hover:border-lavender-500/35 hover:shadow-md"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="rounded-xl bg-lavender-500/12 p-3 text-lavender-600 dark:text-lavender-400">
                  <Lightbulb className={cn(ICON_SIZES.lg)} />
                </div>
                <div className="text-left">
                  <div className="flex items-center gap-2 text-lg font-semibold text-foreground">
                    {user?.isAdmin ? 'Предложка' : 'Мои предложения'}
                  </div>
                  <div className="mt-0.5 text-sm text-muted-foreground">
                    {user?.isAdmin ? 'Модерация предложений от пользователей' : 'История предложенных блюд для меню'}
                  </div>
                </div>
              </div>
              <div className="text-lavender-500">
                <ChevronRight className={ICON_SIZES.md} />
              </div>
            </div>
          </button>
        </motion.div>

        {/* Платёжные данные */}
        <PastelCard variant="default" className="p-5">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4, duration: 0.4 }}
            className="space-y-5"
          >
          <div>
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                Платёжные данные
              </h2>
              {hasUnsavedChanges && !isSaving && (
                <span className="flex items-center gap-1 text-sm text-butter-600 dark:text-butter-400">
                  <span className="size-2 rounded-full bg-butter-500 animate-pulse"></span>
                  Несохранённые изменения...
                </span>
              )}
              {isSaving && (
                <span className="flex items-center gap-1 text-sm text-muted-foreground">
                  <svg className="animate-spin h-3 w-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Сохранение...
                </span>
              )}
              {!isSaving && !hasUnsavedChanges && lastSaved && (
                <span className="text-sm text-mint-600 dark:text-mint-400">
                  ✓ Сохранено {lastSaved.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
                </span>
              )}
            </div>
            <p className="text-sm text-muted-foreground">
              Эти данные будут отправлены участникам голосования, если вы станете ответственным за заказ
            </p>
          </div>

          {/* Номер карты */}
          <div>
            <label className="mb-2 flex items-center space-x-2 text-sm font-medium text-foreground">
              <CreditCard className={cn(ICON_SIZES.sm, "text-primary")} />
              <span>Номер карты</span>
            </label>
            <input
              type="text"
              value={paymentInfo.paymentCard || ''}
              onChange={(e) => handleChange('paymentCard', formatCardInput(e.target.value))}
              placeholder="1234 5678 9012 3456"
              maxLength={19}
              className={`w-full px-4 py-3 rounded-lg border ${
                errors.paymentCard 
                  ? 'border-red-500 dark:border-red-500' 
                  : 'border-gray-200 dark:border-gray-700'
               } bg-card text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all`}
            />
            {errors.paymentCard && (
              <p className="text-xs text-red-600 dark:text-red-400 mt-1.5 flex items-center gap-1">
                <Info className={ICON_SIZES.xs} />
                {errors.paymentCard}
              </p>
            )}
            <p className="mt-1.5 text-xs text-muted-foreground">
              Участники увидят маскированный номер: {userService.maskCardNumber(paymentInfo.paymentCard || '')}
            </p>
          </div>

          {/* Номер телефона */}
          <div>
            <label className="mb-2 flex items-center space-x-2 text-sm font-medium text-foreground">
              <Phone className={cn(ICON_SIZES.sm, "text-primary")} />
              <span>Номер телефона</span>
            </label>
            <input
              type="tel"
              value={paymentInfo.paymentPhone || ''}
              onChange={(e) => handleChange('paymentPhone', e.target.value)}
              placeholder="+7 (999) 123-45-67"
              className={`w-full px-4 py-3 rounded-lg border ${
                errors.paymentPhone 
                  ? 'border-red-500 dark:border-red-500' 
                  : 'border-gray-200 dark:border-gray-700'
               } bg-card text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all`}
            />
            {errors.paymentPhone && (
              <p className="text-xs text-red-600 dark:text-red-400 mt-1.5 flex items-center gap-1">
                <Info className={ICON_SIZES.xs} />
                {errors.paymentPhone}
              </p>
            )}
            <p className="mt-1.5 text-xs text-muted-foreground">
              Для связи через мессенджеры или звонок
            </p>
          </div>

          {/* Дополнительные детали */}
          <div>
            <label className="mb-2 flex items-center space-x-2 text-sm font-medium text-foreground">
              <FileText className={cn(ICON_SIZES.sm, "text-primary")} />
              <span>Дополнительная информация</span>
            </label>
            <textarea
              value={paymentInfo.paymentDetails || ''}
              onChange={(e) => handleChange('paymentDetails', e.target.value)}
              placeholder="Например: СБП по номеру телефона, комментарий к переводу и т.д."
              rows={3}
              maxLength={200}
              className="w-full resize-none rounded-lg border border-border bg-card px-4 py-3 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
            />
            <div className="flex justify-between items-center mt-1.5">
              <p className="text-xs text-muted-foreground">
                Любая информация для удобства перевода
              </p>
              <span className="text-xs text-muted-foreground">
                {(paymentInfo.paymentDetails || '').length}/200
              </span>
            </div>
          </div>

          {/* Превью */}
          {(paymentInfo.paymentCard || paymentInfo.paymentPhone || paymentInfo.paymentDetails) && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="rounded-lg border border-primary/18 bg-primary/8 p-4"
            >
              <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-primary">
                <FileText className={ICON_SIZES.sm} />
                Так увидят участники:
              </div>
              <div className="space-y-1.5 text-sm text-foreground">
                {paymentInfo.paymentCard && (
                  <div className="flex items-center gap-2">
                    <CreditCard size={14} />
                    Карта: {userService.maskCardNumber(paymentInfo.paymentCard)}
                  </div>
                )}
                {paymentInfo.paymentPhone && (
                  <div className="flex items-center gap-2">
                    <Phone size={14} />
                    Телефон: {paymentInfo.paymentPhone}
                  </div>
                )}
                {paymentInfo.paymentDetails && (
                  <div className="flex items-start gap-2">
                    <FileText size={14} className="mt-0.5" />
                    {paymentInfo.paymentDetails}
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {/* Информация */}
          <div className="rounded-lg border border-lavender-500/20 bg-lavender-500/8 p-4">
            <div className="flex items-start gap-2">
              <Shield className={cn(ICON_SIZES.sm, "mt-0.5 flex-shrink-0 text-lavender-500")} />
              <p className="text-sm text-foreground">
                <strong>Конфиденциальность:</strong> Ваши данные будут видны только участникам голосования, где вы стали ответственным за заказ.
              </p>
            </div>
          </div>
          </motion.div>
        </PastelCard>

        {/* Help Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7, duration: 0.4 }}
          className="space-y-4"
        >
          <h3 className="text-lg font-semibold text-foreground">
            Помощь
          </h3>
          
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={showOnboarding}
            className="w-full rounded-xl border border-lavender-500/18 bg-card/95 p-4 shadow-sm transition-all hover:border-lavender-500/35 hover:shadow-md"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-lavender-500/12 p-2 text-lavender-500">
                  <BookOpen className={cn(ICON_SIZES.md)} />
                </div>
                <div className="text-left">
                  <p className="font-medium text-foreground">
                    Показать инструкцию
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Как пользоваться ботом
                  </p>
                </div>
              </div>
              <div className="text-lavender-500">›</div>
            </div>
          </motion.button>
        </motion.div>

        {/* Donation Button */}
        <DonationButton />

        {/* Отступ снизу для FAB */}
        <div className="h-24"></div>
      </div>

      <FloatingActionButton onClick={() => setIsFeedbackModalOpen(true)} />

      <FeedbackModal
        isOpen={isFeedbackModalOpen}
        onClose={() => setIsFeedbackModalOpen(false)}
      />

    </>
  );
};
