import React, { useState, useEffect } from 'react';
import { Button } from '../common/Button';
import { Input } from '../common/Input';
import { LoadingSpinner } from '../common/LoadingSpinner';
import { useTelegram } from '../../hooks/useTelegram';
import { menuService, MenuItem } from '../../services/menu.service';
import { ICON_SIZES } from '@/lib/design-tokens';

export interface MenuFormData {
  name: string;
  description?: string;
  price?: number;
  category?: string;
  imageUrl?: string;
  isActive: boolean;
}

export interface MenuFormProps {
  item?: MenuItem | null;
  onSubmit: (data: MenuFormData) => Promise<void>;
  onCancel: () => void;
  loading?: boolean;
}

/**
 * Форма добавления/редактирования блюда
 */
export const MenuForm: React.FC<MenuFormProps> = ({
  item,
  onSubmit,
  onCancel,
  loading = false,
}) => {
  const { mainButton, backButton, hapticFeedback, showAlert } = useTelegram();
  const [formData, setFormData] = useState<MenuFormData>({
    name: '',
    description: '',
    price: undefined,
    category: '',
    imageUrl: '',
    isActive: true,
  });
  
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [categories, setCategories] = useState<string[]>([]);
  const [loadingCategories, setLoadingCategories] = useState(false);

  // Инициализация формы
  useEffect(() => {
    if (item) {
      setFormData({
        name: item.name,
        description: item.description || '',
        price: item.price || undefined,
        category: item.category || '',
        imageUrl: item.imageUrl || '',
        isActive: item.isActive,
      });
    }
  }, [item]);

  // Загрузка категорий
  useEffect(() => {
    loadCategories();
  }, []);

  // НЕ управляем кнопками Telegram - форма в BottomSheet
  // useEffect(() => {
  //   mainButton.setText(item ? 'Сохранить изменения' : 'Добавить блюдо');
  //   mainButton.onClick(handleSubmit);
  //   mainButton.show();

  //   backButton.onClick(onCancel);
  //   backButton.show();

  //   return () => {
  //     mainButton.hide();
  //     backButton.hide();
  //   };
  // }, [item, formData, mainButton, backButton]);

  const loadCategories = async () => {
    try {
      setLoadingCategories(true);
      const response = await menuService.getCategories();
      if (response.success && response.data) {
        setCategories(response.data);
      }
    } catch (error) {
      console.error('Error loading categories:', error);
    } finally {
      setLoadingCategories(false);
    }
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) {
      newErrors.name = 'Название блюда обязательно';
    } else if (formData.name.length > 100) {
      newErrors.name = 'Название не должно превышать 100 символов';
    }

    if (formData.description && formData.description.length > 500) {
      newErrors.description = 'Описание не должно превышать 500 символов';
    }

    if (formData.price !== undefined && formData.price < 0) {
      newErrors.price = 'Цена не может быть отрицательной';
    }

    if (formData.category && formData.category.length > 50) {
      newErrors.category = 'Название категории не должно превышать 50 символов';
    }

    if (formData.imageUrl && !isValidUrl(formData.imageUrl)) {
      newErrors.imageUrl = 'Некорректный URL изображения';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const isValidUrl = (url: string): boolean => {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  };

  const handleSubmit = async () => {
    hapticFeedback.impactOccurred('medium');

    if (!validateForm()) {
      const firstError = Object.values(errors)[0];
      showAlert(firstError);
      return;
    }

    try {
      await onSubmit(formData);
    } catch (error) {
      console.error('Form submission error:', error);
    }
  };

  const handleInputChange = (field: keyof MenuFormData, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    
    // Очищаем ошибку при изменении поля
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  // Блокируем скролл body когда форма открыта
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, []);

  console.log('📝 MenuForm RENDERING!');
  
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[9999] p-4">
      <div className="bg-white/95 dark:bg-gray-800/95 backdrop-blur-xl rounded-3xl w-full max-w-md max-h-[85vh] flex flex-col shadow-2xl border border-gray-200/20 dark:border-gray-700/20 scale-in">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200/50 dark:border-gray-700/50">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            {item ? 'Редактировать блюдо' : 'Новое блюдо'}
          </h2>
          <button
            onClick={onCancel}
            className={`${ICON_SIZES.xl} text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors text-2xl leading-none  flex items-center justify-center rounded-full hover:bg-gray-100 dark:hover:bg-gray-700`}
          >
            ×
          </button>
        </div>

        {/* Form */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {loading && (
            <div className="absolute inset-0 bg-white bg-opacity-75 dark:bg-gray-800 dark:bg-opacity-75 flex items-center justify-center z-10">
              <LoadingSpinner text="Сохранение..." />
            </div>
          )}

          {/* Name */}
          <Input
            label="Название блюда *"
            placeholder="Например: Пицца Маргарита"
            value={formData.name}
            onChange={(e) => handleInputChange('name', e.target.value)}
            error={errors.name}
            fullWidth
            maxLength={100}
          />

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Описание
            </label>
            <textarea
              className="block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm placeholder-gray-400 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 resize-none"
              rows={3}
              placeholder="Описание блюда..."
              value={formData.description}
              onChange={(e) => handleInputChange('description', e.target.value)}
              maxLength={500}
            />
            {errors.description && (
              <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                {errors.description}
              </p>
            )}
            <p className="mt-1 text-xs text-gray-400 dark:text-gray-400">
              {(formData.description?.length || 0)}/500
            </p>
          </div>

          {/* Price */}
          <Input
            label="Цена (₽)"
            type="number"
            placeholder="0"
            value={formData.price || ''}
            onChange={(e) => handleInputChange('price', e.target.value ? Number(e.target.value) : undefined)}
            error={errors.price}
            fullWidth
            min={0}
            step={0.01}
          />

          {/* Category */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Категория
            </label>
            <div className="space-y-2">
              <Input
                placeholder="Введите или выберите категорию"
                value={formData.category}
                onChange={(e) => handleInputChange('category', e.target.value)}
                error={errors.category}
                fullWidth
                maxLength={50}
              />
              
              {categories.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  <span className="text-xs text-gray-500 dark:text-gray-400 w-full">
                    Существующие категории:
                  </span>
                  {categories.map(category => (
                    <button
                      key={category}
                      type="button"
                      onClick={() => handleInputChange('category', category)}
                      className={`text-xs px-2 py-1 rounded border transition-colors ${
                        formData.category === category
                          ? 'bg-primary-food-700 text-white border-primary-food-700 shadow-sm shadow-primary-food-700/30'
                          : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:bg-gray-200 dark:hover:bg-gray-600'
                      }`}
                    >
                      {category}
                    </button>
                  ))}
                </div>
              )}
              
              {loadingCategories && (
                <div className="flex items-center space-x-2">
                  <LoadingSpinner size="sm" />
                  <span className="text-xs text-gray-400 dark:text-gray-400">Загрузка категорий...</span>
                </div>
              )}
            </div>
          </div>

          {/* Image URL */}
          <Input
            label="URL изображения"
            type="url"
            placeholder="https://example.com/image.jpg"
            value={formData.imageUrl}
            onChange={(e) => handleInputChange('imageUrl', e.target.value)}
            error={errors.imageUrl}
            fullWidth
          />

          {/* Preview image */}
          {formData.imageUrl && isValidUrl(formData.imageUrl) && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Предварительный просмотр
              </label>
              <img
                src={formData.imageUrl}
                alt="Preview"
                className="w-32 h-32 object-cover rounded-lg border border-gray-200 dark:border-gray-700"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = 'none';
                }}
              />
            </div>
          )}

          {/* Active toggle */}
          <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
            <div>
              <h4 className="font-medium text-gray-900 dark:text-white">
                Активное блюдо
              </h4>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Будет участвовать в голосованиях
              </p>
            </div>
            <button
              type="button"
              onClick={() => handleInputChange('isActive', !formData.isActive)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary-food-500 focus:ring-offset-2 ${
                formData.isActive ? 'bg-primary-food-700' : 'bg-gray-200 dark:bg-gray-600'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  formData.isActive ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>
        </div>

        {/* Footer - только для мобильных устройств без MainButton */}
        <div className="p-6 pb-safe border-t border-gray-200/50 dark:border-gray-700/50 space-y-3 bg-white/50 dark:bg-gray-800/50 backdrop-blur-sm rounded-b-3xl">
          <Button
            onClick={handleSubmit}
            loading={loading}
            fullWidth
            disabled={!formData.name.trim()}
          >
            {item ? 'Сохранить изменения' : 'Добавить блюдо'}
          </Button>
          
          <Button
            variant="secondary"
            onClick={onCancel}
            fullWidth
            disabled={loading}
          >
            Отмена
          </Button>
        </div>
      </div>
    </div>
  );
};
