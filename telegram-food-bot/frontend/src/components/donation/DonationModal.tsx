import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Heart } from 'lucide-react';
import { PaymentMethodCard } from './PaymentMethodCard';
import { StarsSlider } from './StarsSlider';
import { PaymentSuccess } from './PaymentSuccess';
import { LoadingSpinner } from '../common/LoadingSpinner';
import { PaymentMethod } from '../../types/donation.types';
import { GradientButton } from '../ui/gradient-button';
import { DONATION_THEME, getDonationStyles } from '../../styles/donation.theme';
import { useAppStore } from '../../store/useAppStore';
import { ICON_SIZES } from '@/lib/design-tokens';
import { donationService } from '../../services/donation.service';
import { useTelegram } from '../../hooks/useTelegram';

interface DonationModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const DEFAULT_STARS = 1;
const MAX_STARS = 1000;

const paymentMethods: Array<{
  id: PaymentMethod;
  name: string;
  description: string;
  enabled: boolean;
}> = [
  {
    id: 'stars',
    name: 'Telegram Stars',
    description: 'Быстро и безопасно',
    enabled: true,
  },
  {
    id: 'sbp',
    name: 'СБП',
    description: 'Скоро — переводом по номеру',
    enabled: false,
  },
  {
    id: 'crypto',
    name: 'Telegram Wallet',
    description: 'Скоро — BTC, USDT, TON',
    enabled: false,
  },
];

export const DonationModal = ({ isOpen, onClose }: DonationModalProps) => {
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod | null>(null);
  const [stars, setStars] = useState<number>(DEFAULT_STARS);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);
  const [successData, setSuccessData] = useState<{ amount: number; currency: string } | null>(null);
  const isDark = useAppStore((s) => s.theme) === 'dark';
  const styles = getDonationStyles(isDark);
  const { webApp, showAlert } = useTelegram();

  const canProceed = selectedMethod === 'stars' && stars >= 1 && stars <= MAX_STARS;

  const handlePayStars = async () => {
    setLoading(true);
    setErrorMessage(null);
    try {
      const response = await donationService.createStarsInvoice(stars);
      if (!response.success || !response.data?.invoiceUrl) {
        throw new Error(response.error || 'Не удалось создать инвойс');
      }

      const { invoiceUrl } = response.data;

      // Telegram WebApp.openInvoice — открывает оплату Stars прямо в Telegram.
      // Колбэк вернёт 'paid' | 'cancelled' | 'failed' | 'pending'.
      const tg = webApp as any;
      if (typeof tg?.openInvoice === 'function') {
        tg.openInvoice(invoiceUrl, (status: string) => {
          if (status === 'paid') {
            setSuccessData({ amount: stars, currency: '⭐' });
            setShowSuccess(true);
          } else if (status === 'cancelled') {
            setErrorMessage('Платёж отменён');
          } else if (status === 'failed') {
            setErrorMessage('Платёж не прошёл, попробуй ещё раз');
          }
          // status === 'pending' — оставляем пользователя в модалке без ошибки
          setLoading(false);
        });
      } else {
        // Fallback вне Telegram (dev-режим) — открыть ссылку в новой вкладке
        window.open(invoiceUrl, '_blank', 'noopener,noreferrer');
        showAlert('Открой Mini App в Telegram, чтобы оплатить через Stars');
        setLoading(false);
      }
    } catch (err: any) {
      setErrorMessage(err?.error || err?.message || 'Ошибка создания платежа');
      setLoading(false);
    }
  };

  const handlePayment = async () => {
    if (!canProceed || !selectedMethod) return;
    if (selectedMethod === 'stars') {
      await handlePayStars();
      return;
    }
    // sbp/crypto — пока disabled, сюда не должно попадать
  };

  const handleClose = () => {
    setSelectedMethod(null);
    setStars(DEFAULT_STARS);
    setErrorMessage(null);
    setShowSuccess(false);
    setSuccessData(null);
    onClose();
  };

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
                  className="sticky top-0 z-10 overflow-hidden rounded-t-3xl rounded-b-none"
                  style={{
                    background: styles.gradients.modalHeader,
                    boxShadow: styles.shadow.bar,
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

                    <div className="mb-2 flex items-center gap-3">
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
                      <h2 className="text-2xl font-semibold text-white">
                        Поддержать проект
                      </h2>
                    </div>
                    <p className="text-sm text-white/85">
                      Помоги развитию бота — выбери способ оплаты
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
                          setStars(DEFAULT_STARS);
                          setErrorMessage(null);
                        }}
                      />
                    ))}
                  </div>

                  {/* Stars amount slider */}
                  {selectedMethod === 'stars' && (
                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="space-y-3"
                    >
                      <h3 className="text-sm font-semibold text-foreground uppercase tracking-wide">
                        Сколько Stars
                      </h3>
                      <StarsSlider
                        value={stars}
                        onChange={setStars}
                        min={1}
                        max={MAX_STARS}
                        checkpoints={[10, 50, 100, 500, 1000]}
                      />
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        ⚠️ Telegram удерживает комиссию ~30% за платежи через
                        Stars. Для максимальной поддержки выбирай СБП или
                        Wallet (скоро).
                      </p>
                    </motion.div>
                  )}

                  {/* Error message */}
                  {errorMessage && (
                    <p className="text-sm text-destructive">{errorMessage}</p>
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
                            <span>Поддержать</span>
                          </>
                        )}
                      </GradientButton>
                    </motion.div>
                  )}

                  {/* Info */}
                  <div className="rounded-2xl border border-border/50 bg-muted/40 p-4">
                    <p className="text-sm text-muted-foreground">
                      💡 Все средства идут на развитие проекта. Спасибо!
                    </p>
                  </div>
                </div>
              </>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
