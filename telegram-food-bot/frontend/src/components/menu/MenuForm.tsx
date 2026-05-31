import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Plus, Check } from 'lucide-react';

// New shadcn/ui components
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { Switch } from '../ui/switch';
import { GlassCard, GlassCardContent } from '../ui/glass-card';
import { GradientButton } from '../ui/gradient-button';

// Old components
import { LoadingSpinner } from '../common/LoadingSpinner';

// Hooks
import { useTelegram } from '../../hooks/useTelegram';
import { useHaptic } from '../../hooks/useHaptic';
import { MenuItem } from '../../services/menu.service';
import { cn } from '../../lib/utils';
import { sanitizeText, sanitizeURL } from '../../lib/sanitize';
import { ICON_SIZES } from '@/lib/design-tokens';

export interface MenuFormData {
  name: string;
  description?: string;
  price?: number;
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
 * MenuForm v2.0 - Native BottomSheet integration
 * Без fixed обёртки, glassmorphism, mint цвета
 */
export const MenuForm: React.FC<MenuFormProps> = ({
  item,
  onSubmit,
  onCancel,
  loading = false,
}) => {
  const { showAlert } = useTelegram();
  const haptic = useHaptic();
  
  const [formData, setFormData] = useState<MenuFormData>({
    name: '',
    description: '',
    price: undefined,
    imageUrl: '',
    isActive: true,
  });
  
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Инициализация формы
  useEffect(() => {
    if (item) {
      setFormData({
        name: item.name,
        description: item.description || '',
        price: item.price || undefined,
        imageUrl: item.imageUrl || '',
        isActive: item.isActive,
      });
    }
  }, [item]);

  const validateForm = (): { isValid: boolean; errors: Record<string, string> } => {
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

    if (formData.imageUrl && !isValidUrl(formData.imageUrl)) {
      newErrors.imageUrl = 'Некорректный URL изображения';
    }

    setErrors(newErrors);
    return {
      isValid: Object.keys(newErrors).length === 0,
      errors: newErrors
    };
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
    haptic.impact();

    const validation = validateForm();
    if (!validation.isValid) {
      const firstError = Object.values(validation.errors)[0];
      showAlert(firstError || 'Проверь правильность заполнения формы');
      return;
    }

    try {
      await onSubmit(formData);
    } catch (error) {
      console.error('Form submission error:', error);
    }
  };

  const handleInputChange = (
    field: keyof MenuFormData,
    value: string | number | boolean
  ) => {
    // 🔒 SECURITY: Sanitize text inputs
    let sanitizedValue = value;
    
    if (typeof value === 'string') {
      if (field === 'imageUrl') {
        // Очистка URL
        sanitizedValue = sanitizeURL(value);
      } else if (field === 'name' || field === 'description') {
        // Очистка текстовых полей от HTML/XSS
        sanitizedValue = sanitizeText(value);
      }
    }
    
    setFormData(prev => ({ ...prev, [field]: sanitizedValue }));
    
    // Очищаем ошибку при изменении поля
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Form Content - Scrollable */}
      <div className="flex-1 overflow-y-auto p-4 pb-28 space-y-4">
        {loading && (
          <div className="absolute inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-10">
            <LoadingSpinner text="Сохранение..." />
          </div>
        )}

        {/* Name */}
        <GlassCard intensity="low">
          <GlassCardContent className="p-4 space-y-2">
            <Label htmlFor="name" className="text-foreground">
              Название блюда <span className="text-red-500">*</span>
            </Label>
            <Input
              id="name"
              placeholder="Например: Пицца Маргарита"
              value={formData.name}
              onChange={(e) => handleInputChange('name', e.target.value)}
              className={cn(
                "bg-background/50 border-border focus-visible:ring-peach-500 dark:focus-visible:ring-purple-500",
                errors.name && "border-red-500"
              )}
              maxLength={100}
            />
            {errors.name && (
              <p className="text-sm text-red-500">{errors.name}</p>
            )}
          </GlassCardContent>
        </GlassCard>

        {/* Description */}
        <GlassCard intensity="low">
          <GlassCardContent className="p-4 space-y-2">
            <Label htmlFor="description" className="text-foreground">
              Описание
            </Label>
            <Textarea
              id="description"
              rows={3}
              placeholder="Расскажи о блюде..."
              value={formData.description}
              onChange={(e) => handleInputChange('description', e.target.value)}
              className={cn(
                "bg-background/50 border-border focus-visible:ring-peach-500 dark:focus-visible:ring-purple-500 resize-none",
                errors.description && "border-red-500"
              )}
              maxLength={500}
            />
            {errors.description && (
              <p className="text-sm text-red-500">{errors.description}</p>
            )}
            <p className="text-xs text-muted-foreground">
              {(formData.description?.length || 0)}/500
            </p>
          </GlassCardContent>
        </GlassCard>

        {/* Price */}
        <GlassCard intensity="low">
          <GlassCardContent className="p-4 space-y-2">
            <Label htmlFor="price" className="text-foreground">
              Цена (₽)
            </Label>
            <Input
              id="price"
              type="number"
              placeholder="0"
              value={formData.price || ''}
              onChange={(e) => handleInputChange('price', e.target.value ? Number(e.target.value) : undefined)}
              className={cn(
                "bg-background/50 border-border focus-visible:ring-peach-500 dark:focus-visible:ring-purple-500",
                errors.price && "border-red-500"
              )}
              min={0}
              step={0.01}
            />
            {errors.price && (
              <p className="text-sm text-red-500">{errors.price}</p>
            )}
          </GlassCardContent>
        </GlassCard>

        {/* Image URL */}
        <GlassCard intensity="low">
          <GlassCardContent className="p-4 space-y-2">
            <Label htmlFor="imageUrl" className="text-foreground">
              URL изображения
            </Label>
            <Input
              id="imageUrl"
              type="url"
              placeholder="https://example.com/image.jpg"
              value={formData.imageUrl}
              onChange={(e) => handleInputChange('imageUrl', e.target.value)}
              className={cn(
                "bg-background/50 border-border focus-visible:ring-peach-500 dark:focus-visible:ring-purple-500",
                errors.imageUrl && "border-red-500"
              )}
            />
            {errors.imageUrl && (
              <p className="text-sm text-red-500">{errors.imageUrl}</p>
            )}
          </GlassCardContent>
        </GlassCard>

        {/* Preview image - Large (192px) */}
        <AnimatePresence>
          {formData.imageUrl && isValidUrl(formData.imageUrl) && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
            >
              <GlassCard intensity="medium" className="overflow-hidden">
                <div className="relative h-48 w-full">
                  <img
                    src={formData.imageUrl}
                    alt="Preview"
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                    }}
                  />
                  
                  {/* Remove button overlay */}
                  <button
                    type="button"
                    onClick={() => handleInputChange('imageUrl', '')}
                    className={`${ICON_SIZES.xl} absolute top-2 right-2  rounded-full bg-black/60 backdrop-blur-sm flex items-center justify-center text-white hover:bg-red-500 transition-colors`}
                  >
                    <X className={ICON_SIZES.sm} />
                  </button>
                  
                  {/* Preview label */}
                  <div className="absolute bottom-2 left-2 px-3 py-1 rounded-lg bg-black/60 backdrop-blur-sm text-white text-xs font-medium flex items-center gap-1">
                    <Check className={ICON_SIZES.xs} />
                    Предпросмотр
                  </div>
                </div>
              </GlassCard>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Active toggle - Touch-friendly Switch */}
        <GlassCard intensity="low">
          <GlassCardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="isActive" className="text-base text-foreground">
                  Активное блюдо
                </Label>
                <p className="text-sm text-muted-foreground">
                  Будет участвовать в голосованиях
                </p>
              </div>
               <Switch
                id="isActive"
                checked={formData.isActive}
                onCheckedChange={(checked) => {
                  handleInputChange('isActive', checked);
                }}
                className="data-[state=checked]:bg-gradient-to-r data-[state=checked]:from-peach-500 data-[state=checked]:to-coral-500 dark:data-[state=checked]:from-purple-500 dark:data-[state=checked]:to-violet-500"
              />
            </div>
          </GlassCardContent>
        </GlassCard>
      </div>

      {/* Footer - Compact (single row) */}
      <div className="sticky bottom-0 bg-background/80 backdrop-blur-md border-t border-border p-4">
        <div className="flex items-center justify-between gap-3">
          <Button 
            variant="ghost" 
            onClick={onCancel}
            disabled={loading}
            className="flex-1 min-h-11"
          >
            Отмена
          </Button>
          
          <GradientButton 
            variant="peach"
            onClick={handleSubmit}
            disabled={!formData.name.trim() || loading}
            className="flex-1 min-h-11"
            shimmer={!loading}
          >
            {loading ? (
              <>
                <div className={`${ICON_SIZES.sm} animate-spin rounded-full  border-2 border-white border-t-transparent mr-2`} />
                Сохранение...
              </>
            ) : (
              <>
                {item ? <Check className={`${ICON_SIZES.sm} mr-2`} /> : <Plus className={`${ICON_SIZES.sm} mr-2`} />}
                {item ? 'Сохранить' : 'Добавить'}
              </>
            )}
          </GradientButton>
        </div>
      </div>
    </div>
  );
};
