import { useState, lazy, Suspense } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Sparkles, Utensils, DollarSign, Image, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';

// Lazy load react-confetti
const Confetti = lazy(() => import('react-confetti'));
import { Input } from '@/components/ui/input';
import { GlassCard, GlassCardContent } from '@/components/ui/glass-card';
import { useCreateSuggestion } from '@/hooks/useSuggestions';
import { useTelegram } from '@/hooks/useTelegram';
import { useWindowSize } from '@/hooks/useWindowSize';
import { ICON_SIZES } from '@/lib/design-tokens';

interface SuggestDishFormProps {
  isOpen: boolean;
  onClose: () => void;
}

/**
 * Форма для предложения нового блюда в меню
 */
export function SuggestDishForm({ isOpen, onClose }: SuggestDishFormProps) {
  const { hapticFeedback } = useTelegram();
  const { mutate: createSuggestion, isPending } = useCreateSuggestion();
  const { width, height } = useWindowSize();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [imageUrl, setImageUrl] = useState('');

  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const [showSuccess, setShowSuccess] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Validation
    const newErrors: { [key: string]: string } = {};

    if (!name.trim()) {
      newErrors.name = 'Название обязательно';
    }

    if (price && isNaN(parseFloat(price))) {
      newErrors.price = 'Некорректная цена';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      hapticFeedback?.notificationOccurred('error');
      return;
    }

    // Submit
    createSuggestion(
      {
        name: name.trim(),
        description: description.trim() || undefined,
        price: price ? parseFloat(price) : undefined,
        imageUrl: imageUrl.trim() || undefined,
      },
      {
        onSuccess: () => {
          hapticFeedback?.notificationOccurred('success');
          setShowSuccess(true);
          
          // Закрываем форму через 2 секунды после успеха
          setTimeout(() => {
            setShowSuccess(false);
            handleClose();
          }, 2000);
        },
      }
    );
  };

  const handleClose = () => {
    setName('');
    setDescription('');
    setPrice('');
    setImageUrl('');
    setErrors({});
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Confetti on success */}
          {showSuccess && (
            <Suspense fallback={null}>
              <Confetti
                width={width}
                height={height}
                recycle={false}
                numberOfPieces={200}
                gravity={0.3}
              />
            </Suspense>
          )}

          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={!showSuccess ? handleClose : undefined}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40"
          />

          {/* Bottom Sheet */}
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="fixed bottom-0 left-0 right-0 z-50 max-h-[90vh] overflow-y-auto"
          >
            <GlassCard intensity="high" className="rounded-t-3xl overflow-hidden">
              <GlassCardContent className="p-6 pb-28 space-y-6">
                {/* Success State */}
                {showSuccess && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="absolute inset-0 bg-gradient-to-br from-green-500/95 to-emerald-600/95 backdrop-blur-sm flex flex-col items-center justify-center z-50"
                  >
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ type: 'spring', delay: 0.2 }}
                      className="size-20 rounded-full bg-white flex items-center justify-center mb-4"
                    >
                      <Check className="size-10 text-green-500" />
                    </motion.div>
                    <h3 className="text-2xl font-bold text-white mb-2">
                      Отправлено!
                    </h3>
                    <p className="text-white/90 text-center px-6">
                      Ваше предложение будет рассмотрено администратором
                    </p>
                  </motion.div>
                )}

                {/* Header */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-peach-500/10 dark:bg-peach-500/20">
                      <Sparkles className={`${ICON_SIZES.lg} text-peach-500`} />
                    </div>
                    <div>
                      <h2 className="text-xl font-bold text-foreground">
                        Предложить блюдо
                      </h2>
                      <p className="text-sm text-muted-foreground">
                        Помогите обновить меню
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={handleClose}
                    className="p-2 rounded-lg hover:bg-muted transition-colors"
                  >
                    <X className={ICON_SIZES.md} />
                  </button>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="space-y-4">
                  <p className="text-xs text-muted-foreground">
                    Поля со звездочкой (*) обязательны для заполнения
                  </p>
                  {/* Name */}
                  <div className="space-y-2">
                    <label className="flex items-center gap-2 text-sm font-medium text-foreground">
                      <Utensils className={`${ICON_SIZES.sm} text-peach-500`} />
                      Название блюда *
                    </label>
                    <Input
                      required
                      value={name}
                      onChange={(e) => {
                        setName(e.target.value);
                        if (errors.name) {
                          setErrors({ ...errors, name: '' });
                        }
                      }}
                      placeholder="Борщ с говядиной"
                      className="bg-background/50"
                    />
                    {errors.name && (
                      <p className="text-xs text-red-500">{errors.name}</p>
                    )}
                  </div>

                  {/* Description */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground">
                      Описание
                    </label>
                    <textarea
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="Классический борщ с говядиной, картофелем и свеклой..."
                      rows={3}
                      className="w-full px-3 py-2 bg-background/50 rounded-lg border border-border focus:ring-2 focus:ring-peach-500 focus:border-transparent outline-none transition-all resize-none"
                    />
                  </div>

                  {/* Price */}
                  <div className="space-y-2">
                    <label className="flex items-center gap-2 text-sm font-medium text-foreground">
                      <DollarSign className={`${ICON_SIZES.sm} text-peach-500`} />
                      Примерная цена
                    </label>
                    <Input
                      type="number"
                      step="0.01"
                      value={price}
                      onChange={(e) => {
                        setPrice(e.target.value);
                        if (errors.price) {
                          setErrors({ ...errors, price: '' });
                        }
                      }}
                      placeholder="250"
                      className="bg-background/50"
                    />
                    {errors.price && (
                      <p className="text-xs text-red-500">{errors.price}</p>
                    )}
                  </div>

                  {/* Image URL */}
                  <div className="space-y-2">
                    <label className="flex items-center gap-2 text-sm font-medium text-foreground">
                      <Image className={`${ICON_SIZES.sm} text-peach-500`} />
                      Ссылка на фото (опционально)
                    </label>
                    <Input
                      type="url"
                      value={imageUrl}
                      onChange={(e) => setImageUrl(e.target.value)}
                      placeholder="https://example.com/image.jpg"
                      className="bg-background/50"
                    />
                  </div>

                  {/* Info */}
                  <div className="p-4 rounded-lg bg-blue-500/10 dark:bg-blue-500/20 border border-blue-500/20">
                    <p className="text-sm text-blue-600 dark:text-blue-400">
                      Ваше предложение будет рассмотрено администратором. После одобрения блюдо появится в меню.
                    </p>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-3 pt-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleClose}
                      disabled={isPending}
                      className="flex-1"
                    >
                      Отмена
                    </Button>
                    <Button
                      type="submit"
                      disabled={isPending}
                      className="flex-1 bg-gradient-to-r from-peach-500 to-coral-500 hover:from-peach-600 hover:to-coral-600"
                    >
                      {isPending ? (
                        <div className="flex items-center gap-2">
                          <div className={`${ICON_SIZES.sm} animate-spin rounded-full  border-2 border-white border-t-transparent`} />
                          <span>Отправка...</span>
                        </div>
                      ) : (
                        'Отправить'
                      )}
                    </Button>
                  </div>
                </form>
              </GlassCardContent>
            </GlassCard>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
