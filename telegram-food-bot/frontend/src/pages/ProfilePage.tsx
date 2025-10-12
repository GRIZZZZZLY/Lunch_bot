import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Header } from '../components/layout/Layout';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import { GlassCard, GlassBadge } from '../components/glass';
import { MediumWaveGradient } from '../components/background';
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
  Settings
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useTelegram } from '../hooks/useTelegram';
import { useUI } from '../store/useAppStore';
import { userService, PaymentInfo } from '../services/user.service';
import { useOnboarding } from '../hooks/useOnboarding';

/**
 * Страница профиля и настроек платёжных данных
 */
export const ProfilePage: React.FC = () => {
  const navigate = useNavigate();
  const { user, refresh } = useAuth();
  const { mainButton, backButton, colorScheme } = useTelegram();
  const { addNotification } = useUI();
  
  const isDark = colorScheme === 'dark';
  const { showOnboarding } = useOnboarding();

  const [paymentInfo, setPaymentInfo] = useState<PaymentInfo>({
    paymentCard: '',
    paymentPhone: '',
    paymentDetails: '',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [errors, setErrors] = useState<{
    paymentCard?: string;
    paymentPhone?: string;
  }>({});

  // Загрузка данных
  useEffect(() => {
    loadPaymentInfo();
  }, []);

  // Настройка Telegram кнопок
  useEffect(() => {
    if (hasChanges) {
      mainButton.setText('Сохранить');
      mainButton.onClick(handleSave);
      mainButton.show();
    } else {
      mainButton.hide();
    }

    backButton.onClick(() => navigate('/'));
    backButton.show();

    return () => {
      mainButton.hide();
      backButton.hide();
    };
  }, [hasChanges, paymentInfo]);

  const loadPaymentInfo = async () => {
    try {
      setLoading(true);
      const response = await userService.getPaymentInfo();
      
      if (response.success && response.data) {
        setPaymentInfo({
          paymentCard: response.data.paymentCard || '',
          paymentPhone: response.data.paymentPhone || '',
          paymentDetails: response.data.paymentDetails || '',
        });
      }
    } catch (error) {
      console.error('Error loading payment info:', error);
      addNotification({
        type: 'error',
        message: 'Ошибка загрузки данных',
      });
    } finally {
      setLoading(false);
    }
  };

  const validateForm = (): boolean => {
    const newErrors: typeof errors = {};

    if (paymentInfo.paymentCard && !userService.validateCardNumber(paymentInfo.paymentCard)) {
      newErrors.paymentCard = 'Некорректный номер карты';
    }

    if (paymentInfo.paymentPhone && !userService.validatePhone(paymentInfo.paymentPhone)) {
      newErrors.paymentPhone = 'Некорректный номер телефона';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (!validateForm()) {
      addNotification({
        type: 'error',
        message: 'Исправьте ошибки в форме',
      });
      return;
    }

    try {
      setSaving(true);

      const response = await userService.updatePaymentInfo(paymentInfo);

      if (response.success) {
        addNotification({
          type: 'success',
          message: 'Платёжные данные сохранены',
        });
        setHasChanges(false);
      } else {
        throw new Error(response.error || 'Failed to update');
      }
    } catch (error) {
      console.error('Error saving payment info:', error);
      addNotification({
        type: 'error',
        message: 'Ошибка сохранения данных',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleChange = (field: keyof PaymentInfo, value: string) => {
    setPaymentInfo(prev => ({ ...prev, [field]: value }));
    setHasChanges(true);
    
    // Очищаем ошибку при изменении
    if (errors[field as keyof typeof errors]) {
      setErrors(prev => ({ ...prev, [field]: undefined }));
    }
  };

  const formatCardInput = (value: string) => {
    // Убираем все не-цифры и форматируем
    const cleaned = value.replace(/\D/g, '');
    return userService.formatCardNumber(cleaned);
  };

  if (loading) {
    return (
      <div className="min-h-screen relative">
        <MediumWaveGradient />
        <div className="flex items-center justify-center min-h-screen">
          <LoadingSpinner size="lg" />
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Animated gradient background - full page */}
      <MediumWaveGradient />
      
      <div className="space-y-6 relative">
        {/* Информация о пользователе */}
        <GlassCard
          variant="medium"
          theme={isDark ? 'dark' : 'light'}
          className="p-5"
        >
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.4 }}
            className="flex items-center gap-4"
          >
            {/* Avatar with glass border */}
            <div className="relative">
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-primary-food-500 to-primary-food-600 flex items-center justify-center text-white text-2xl font-bold shadow-lg">
                {user?.firstName?.charAt(0).toUpperCase()}
              </div>
            </div>
            
            <div className="flex-1">
              <div className="font-semibold text-lg text-gray-900 dark:text-white">
                {user?.firstName} {user?.lastName}
              </div>
              {user?.username && (
                <div className="text-sm text-gray-600 dark:text-gray-400 flex items-center gap-1 mt-0.5">
                  <User size={14} />
                  @{user.username}
                </div>
              )}
              {user?.isAdmin && (
                <div className="mt-2">
                  <GlassBadge
                    label="Администратор"
                    icon={Crown}
                    variant="food"
                    glassVariant="light"
                    theme={isDark ? 'dark' : 'light'}
                  />
                </div>
              )}
            </div>
          </motion.div>
        </GlassCard>

        {/* Admin Dashboard Access */}
        {user?.isAdmin && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.4 }}
          >
            <button
              onClick={() => navigate('/admin/dashboard')}
              className="w-full p-5 rounded-2xl bg-gradient-to-br from-yellow-50 to-yellow-100 dark:from-yellow-900/20 dark:to-yellow-800/20 border-2 border-yellow-200 dark:border-yellow-700 hover:shadow-lg transition-all"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="p-3 rounded-xl bg-yellow-400 dark:bg-yellow-600">
                    <Shield size={24} className="text-white" />
                  </div>
                  <div className="text-left">
                    <div className="font-bold text-lg text-gray-900 dark:text-white flex items-center gap-2">
                      Панель администратора
                      <Crown size={18} className="text-yellow-600 dark:text-yellow-400" />
                    </div>
                    <div className="text-sm text-gray-600 dark:text-gray-400 mt-0.5">
                      Статистика, логи и управление системой
                    </div>
                  </div>
                </div>
                <div className="text-yellow-600 dark:text-yellow-400">
                  <Settings size={20} />
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

        {/* Платёжные данные */}
        <GlassCard
          variant="medium"
          theme={isDark ? 'dark' : 'light'}
          className="p-5"
        >
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4, duration: 0.4 }}
            className="space-y-5"
          >
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              Платёжные данные
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Эти данные будут отправлены участникам голосования, если вы станете ответственным за заказ
            </p>
          </div>

          {/* Номер карты */}
          <div>
            <label className="flex items-center space-x-2 text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
              <CreditCard size={16} className="text-primary-food-500" />
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
              } bg-white dark:bg-gray-900 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-food-500 focus:border-transparent transition-all`}
            />
            {errors.paymentCard && (
              <p className="text-xs text-red-600 dark:text-red-400 mt-1.5 flex items-center gap-1">
                <Info size={12} />
                {errors.paymentCard}
              </p>
            )}
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1.5">
              Участники увидят маскированный номер: {userService.maskCardNumber(paymentInfo.paymentCard || '')}
            </p>
          </div>

          {/* Номер телефона */}
          <div>
            <label className="flex items-center space-x-2 text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
              <Phone size={16} className="text-primary-food-500" />
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
              } bg-white dark:bg-gray-900 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-food-500 focus:border-transparent transition-all`}
            />
            {errors.paymentPhone && (
              <p className="text-xs text-red-600 dark:text-red-400 mt-1.5 flex items-center gap-1">
                <Info size={12} />
                {errors.paymentPhone}
              </p>
            )}
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1.5">
              Для связи через мессенджеры или звонок
            </p>
          </div>

          {/* Дополнительные детали */}
          <div>
            <label className="flex items-center space-x-2 text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
              <FileText size={16} className="text-primary-food-500" />
              <span>Дополнительная информация</span>
            </label>
            <textarea
              value={paymentInfo.paymentDetails || ''}
              onChange={(e) => handleChange('paymentDetails', e.target.value)}
              placeholder="Например: СБП по номеру телефона, комментарий к переводу и т.д."
              rows={3}
              maxLength={200}
              className="w-full px-4 py-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-food-500 focus:border-transparent transition-all resize-none"
            />
            <div className="flex justify-between items-center mt-1.5">
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Любая информация для удобства перевода
              </p>
              <span className="text-xs text-gray-500 dark:text-gray-400">
                {(paymentInfo.paymentDetails || '').length}/200
              </span>
            </div>
          </div>

          {/* Превью */}
          {(paymentInfo.paymentCard || paymentInfo.paymentPhone || paymentInfo.paymentDetails) && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-primary-food-50 dark:bg-primary-food-900/20 rounded-lg p-4 border border-primary-food-200 dark:border-primary-food-800"
            >
              <div className="flex items-center gap-2 text-sm font-semibold text-primary-food-700 dark:text-primary-food-300 mb-2">
                <FileText size={16} />
                Так увидят участники:
              </div>
              <div className="text-sm text-gray-700 dark:text-gray-300 space-y-1.5">
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
          <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 border border-blue-200 dark:border-blue-800">
            <div className="flex items-start gap-2">
              <Shield size={16} className="text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-blue-700 dark:text-blue-300">
                <strong>Конфиденциальность:</strong> Ваши данные будут видны только участникам голосования, где вы стали ответственным за заказ.
              </p>
            </div>
          </div>
          </motion.div>
        </GlassCard>

        {/* Help Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7, duration: 0.4 }}
          className="space-y-4"
        >
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Помощь
          </h3>
          
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={showOnboarding}
            className="w-full bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700 shadow-sm hover:shadow-md transition-all"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary-food-50 dark:bg-primary-food-900/20">
                  <BookOpen size={20} className="text-primary-food-500" />
                </div>
                <div className="text-left">
                  <p className="font-medium text-gray-900 dark:text-white">
                    Показать инструкцию
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Как пользоваться ботом
                  </p>
                </div>
              </div>
              <div className="text-gray-400">›</div>
            </div>
          </motion.button>
        </motion.div>

        {/* Отступ снизу для FAB */}
        <div className="h-24"></div>
      </div>

      {/* Floating Action Button */}
      {hasChanges && (
        <motion.button
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.8 }}
          transition={{ duration: 0.3 }}
          whileHover={{ scale: !saving ? 1.05 : 1 }}
          whileTap={{ scale: !saving ? 0.95 : 1 }}
          onClick={handleSave}
          disabled={saving}
          className={`
            fixed bottom-20 right-6 z-50
            flex items-center justify-center space-x-2
            px-6 py-4 rounded-full
            text-base font-semibold
            transition-all duration-300
            ${!saving
              ? 'bg-primary-food-700 hover:bg-primary-food-800 text-white shadow-2xl shadow-primary-food-700/40'
              : 'bg-primary-food-400 text-white shadow-lg cursor-wait'
            }
          `}
        >
          {saving ? (
            <>
              <LoadingSpinner size="sm" />
              <span>Сохранение...</span>
            </>
          ) : (
            <>
              <Save size={20} />
              <span>Сохранить</span>
            </>
          )}
        </motion.button>
      )}
    </>
  );
};
