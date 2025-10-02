import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layout, Header } from '../components/layout/Layout';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import { Button } from '../components/common/Button';
import { Input } from '../components/common/Input';
import { useAuth } from '../hooks/useAuth';
import { useTelegram } from '../hooks/useTelegram';
import { useUI } from '../store/useAppStore';
import { userService, PaymentInfo } from '../services/user.service';

/**
 * Страница профиля и настроек платёжных данных
 */
export const ProfilePage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { mainButton, backButton } = useTelegram();
  const { addNotification } = useUI();

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
      <Layout>
        <div className="flex items-center justify-center min-h-screen">
          <LoadingSpinner size="lg" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <Header />

      <div className="space-y-6">
        {/* Информация о пользователе */}
        <div className="bg-telegram-secondary-bg-color rounded-2xl p-6 border border-telegram-secondary-bg-color/50">
          <h1 className="text-2xl font-bold text-telegram-text-color mb-4">
            Профиль
          </h1>
          
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-16 h-16 rounded-full bg-telegram-button-color flex items-center justify-center text-white text-2xl font-bold">
                {user?.firstName?.charAt(0).toUpperCase()}
              </div>
              <div>
                <div className="font-semibold text-telegram-text-color">
                  {user?.firstName} {user?.lastName}
                </div>
                {user?.username && (
                  <div className="text-sm text-telegram-hint-color">
                    @{user.username}
                  </div>
                )}
                {user?.isAdmin && (
                  <div className="text-xs text-telegram-button-color mt-1">
                    👑 Администратор
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Платёжные данные */}
        <div className="bg-telegram-secondary-bg-color rounded-2xl p-6 border border-telegram-secondary-bg-color/50 space-y-6">
          <div>
            <h2 className="text-xl font-bold text-telegram-text-color mb-2">
              Платёжные данные
            </h2>
            <p className="text-sm text-telegram-hint-color">
              Эти данные будут отправлены участникам голосования, если вы станете ответственным за заказ
            </p>
          </div>

          {/* Номер карты */}
          <div>
            <label className="block text-sm font-medium text-telegram-text-color mb-2">
              💳 Номер карты
            </label>
            <Input
              type="text"
              value={paymentInfo.paymentCard || ''}
              onChange={(e) => handleChange('paymentCard', formatCardInput(e.target.value))}
              placeholder="1234 5678 9012 3456"
              maxLength={19}
              error={errors.paymentCard}
            />
            {errors.paymentCard && (
              <p className="text-xs text-red-500 mt-1">{errors.paymentCard}</p>
            )}
            <p className="text-xs text-telegram-hint-color mt-1">
              Участники увидят маскированный номер: {userService.maskCardNumber(paymentInfo.paymentCard || '')}
            </p>
          </div>

          {/* Номер телефона */}
          <div>
            <label className="block text-sm font-medium text-telegram-text-color mb-2">
              📱 Номер телефона
            </label>
            <Input
              type="tel"
              value={paymentInfo.paymentPhone || ''}
              onChange={(e) => handleChange('paymentPhone', e.target.value)}
              placeholder="+7 (999) 123-45-67"
              error={errors.paymentPhone}
            />
            {errors.paymentPhone && (
              <p className="text-xs text-red-500 mt-1">{errors.paymentPhone}</p>
            )}
            <p className="text-xs text-telegram-hint-color mt-1">
              Для связи через мессенджеры или звонок
            </p>
          </div>

          {/* Дополнительные детали */}
          <div>
            <label className="block text-sm font-medium text-telegram-text-color mb-2">
              📝 Дополнительная информация
            </label>
            <textarea
              value={paymentInfo.paymentDetails || ''}
              onChange={(e) => handleChange('paymentDetails', e.target.value)}
              placeholder="Например: СБП по номеру телефона, комментарий к переводу и т.д."
              rows={3}
              maxLength={200}
              className="w-full px-4 py-3 rounded-xl border-2 border-telegram-secondary-bg-color bg-telegram-bg-color text-telegram-text-color placeholder-telegram-hint-color focus:outline-none focus:border-telegram-button-color transition-colors resize-none"
            />
            <div className="flex justify-between items-center mt-1">
              <p className="text-xs text-telegram-hint-color">
                Любая информация для удобства перевода
              </p>
              <span className="text-xs text-telegram-hint-color">
                {(paymentInfo.paymentDetails || '').length}/200
              </span>
            </div>
          </div>

          {/* Превью */}
          {(paymentInfo.paymentCard || paymentInfo.paymentPhone || paymentInfo.paymentDetails) && (
            <div className="bg-telegram-bg-color rounded-xl p-4 border border-telegram-button-color/30">
              <div className="text-sm font-medium text-telegram-text-color mb-2">
                📋 Так увидят участники:
              </div>
              <div className="text-sm text-telegram-hint-color space-y-1">
                {paymentInfo.paymentCard && (
                  <div>💳 Карта: {userService.maskCardNumber(paymentInfo.paymentCard)}</div>
                )}
                {paymentInfo.paymentPhone && (
                  <div>📱 Телефон: {paymentInfo.paymentPhone}</div>
                )}
                {paymentInfo.paymentDetails && (
                  <div>📝 {paymentInfo.paymentDetails}</div>
                )}
              </div>
            </div>
          )}

          {/* Информация */}
          <div className="bg-blue-500/10 rounded-xl p-4 border border-blue-500/30">
            <p className="text-sm text-blue-600 dark:text-blue-400">
              ℹ️ <strong>Конфиденциальность:</strong> Ваши данные будут видны только участникам голосования, где вы стали ответственным за заказ.
            </p>
          </div>
        </div>

        {/* Кнопка сохранения для desktop */}
        <div className="pb-safe">
          <Button
            onClick={handleSave}
            disabled={!hasChanges || saving}
            loading={saving}
            fullWidth
            size="lg"
          >
            {saving ? 'Сохранение...' : 'Сохранить изменения'}
          </Button>
        </div>
      </div>
    </Layout>
  );
};
