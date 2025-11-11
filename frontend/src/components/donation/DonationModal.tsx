import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Heart } from 'lucide-react';
import { PaymentMethodCard } from './PaymentMethodCard';
import { AmountSelector } from './AmountSelector';
import { PaymentSuccess } from './PaymentSuccess';
import { LoadingSpinner } from '../common/LoadingSpinner';
import { PaymentMethod, DonationAmount } from '../../types/donation.types';
import { PastelCard, CardContent } from '../ui/pastel-card';
import { GradientButton } from '../ui/gradient-button';
import { DONATION_THEME } from '../../styles/donation.theme';
import { ICON_SIZES } from '@/lib/design-tokens';

interface DonationModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const paymentMethods = [
  {
    id: 'stars' as PaymentMethod,
    name: 'Telegram Stars',
    description: 'Быстро и безопасно',
    enabled: true,
    amounts: [
      { value: 100, label: 'Кофе' },
      { value: 250, label: 'Обед', popular: true },
      { value: 500, label: 'Ужин' }
    ] as DonationAmount[]
  },
  {
    id: 'sbp' as PaymentMethod,
    name: 'СБП',
    description: 'Система Быстрых Платежей',
    enabled: true,
    amounts: [
      { value: 100, label: 'Минимум' },
      { value: 300, label: 'Оптимально', popular: true },
      { value: 500, label: 'Щедро' }
    ] as DonationAmount[]
  },
  {
    id: 'crypto' as PaymentMethod,
    name: 'Криптовалюта',
    description: 'BTC, USDT, TON',
    enabled: false, // Coming soon
    amounts: [
      { value: 10, label: 'Мини' },
      { value: 25, label: 'Стандарт', popular: true },
      { value: 50, label: 'VIP' }
    ] as DonationAmount[]
  }
];

export const DonationModal = ({ isOpen, onClose }: DonationModalProps) => {
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod | null>(null);
  const [selectedAmount, setSelectedAmount] = useState<number>(0);
  const [loading, setLoading] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [successData, setSuccessData] = useState<{ amount: number; currency: string } | null>(null);

  const currentMethod = paymentMethods.find(m => m.id === selectedMethod);

  const handlePayment = async () => {
    if (!selectedMethod || selectedAmount === 0) return;

    setLoading(true);

    try {
      // Simulate payment processing (placeholder for future API integration)
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Show success
      setSuccessData({
        amount: selectedAmount,
        currency: selectedMethod === 'stars' ? '⭐' : selectedMethod === 'sbp' ? '₽' : '$'
      });
      setShowSuccess(true);
    } catch (error) {
      console.error('Payment error:', error);
      // Log error (toast/alert would be shown in production via separate notification system)
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setSelectedMethod(null);
    setSelectedAmount(0);
    setShowSuccess(false);
    setSuccessData(null);
    onClose();
  };

  const canProceed = selectedMethod && selectedAmount > 0;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] flex items-center justify-center p-4"
        >
          {/* Overlay */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={handleClose}
          />

          {/* Modal Content */}
          <motion.div
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 20 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            className="relative w-full max-w-md bg-background rounded-3xl shadow-2xl overflow-hidden max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {showSuccess && successData ? (
              <PaymentSuccess
                amount={successData.amount}
                currency={successData.currency}
                onClose={handleClose}
              />
            ) : (
              <>
                {/* Header */}
                <div 
                  className="rounded-t-3xl rounded-b-none overflow-hidden sticky top-0 z-10"
                  style={{
                    background: DONATION_THEME.gradients.modalHeader,
                    boxShadow: DONATION_THEME.shadow.bar,
                  }}
                >
                  <div className="relative p-6">
                    <button
                      onClick={handleClose}
                      className="absolute top-4 right-4 z-10"
                    >
                      <div className="p-2 rounded-full bg-white/20 hover:bg-white/30 transition-colors backdrop-blur-sm">
                        <X className={ICON_SIZES.md} style={{ color: 'white' }} />
                      </div>
                    </button>

                    <div className="flex items-center gap-3 mb-2">
                      <motion.div
                        animate={{ 
                          scale: [1, 1.1, 1],
                        }}
                        transition={{
                          duration: 2,
                          repeat: Infinity,
                          ease: 'easeInOut',
                        }}
                      >
                        <Heart 
                          size={DONATION_THEME.spacing.iconSize.large} 
                          className="fill-white"
                          style={{ color: 'white' }}
                        />
                      </motion.div>
                      <h2 className="text-2xl font-bold text-gray-200">
                        Поддержите проект
                      </h2>
                    </div>
                    <p className="text-sm text-gray-300">
                      Помогите развитию бота - выберите способ оплаты
                    </p>
                  </div>
                </div>

                {/* Content */}
                <div className="p-6 space-y-6">
                  {/* Payment Methods */}
                  <div className="space-y-3">
                    <h3 className="text-sm font-semibold text-foreground uppercase tracking-wide">
                      Способ оплаты
                    </h3>
                    {paymentMethods.map((method) => (
                      <PaymentMethodCard
                        key={method.id}
                        method={method.id}
                        name={method.name}
                        description={method.description}
                        selected={selectedMethod === method.id}
                        enabled={method.enabled}
                        onClick={() => {
                          setSelectedMethod(method.id);
                          setSelectedAmount(0);
                        }}
                      />
                    ))}
                  </div>

                  {/* Amount Selection */}
                  {selectedMethod && currentMethod && (
                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="space-y-3"
                    >
                      <h3 className="text-sm font-semibold text-foreground uppercase tracking-wide">
                        Сумма
                      </h3>
                      <AmountSelector
                        amounts={currentMethod.amounts}
                        method={selectedMethod}
                        selectedAmount={selectedAmount}
                        onAmountChange={setSelectedAmount}
                      />
                    </motion.div>
                  )}

                  {/* Payment Button */}
                  {canProceed && (
                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                    >
                      <GradientButton
                        variant="peach"
                        size="lg"
                        shimmer
                        className="w-full"
                        onClick={handlePayment}
                        disabled={loading}
                      >
                        {loading ? (
                          <>
                            <LoadingSpinner size="sm" />
                            <span>Обработка...</span>
                          </>
                        ) : (
                          <>
                            <Heart className={ICON_SIZES.md} />
                            <span>Поддержать ({selectedAmount})</span>
                          </>
                        )}
                      </GradientButton>
                    </motion.div>
                  )}

                  {/* Info */}
                  <PastelCard variant="lavender" className="overflow-hidden">
                    <CardContent className="p-4 pt-4">
                      <p className="text-sm text-foreground">
                        💡 <strong>Важно:</strong> Все средства идут на развитие и поддержку проекта. Спасибо за вашу щедрость!
                      </p>
                    </CardContent>
                  </PastelCard>
                </div>
              </>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
