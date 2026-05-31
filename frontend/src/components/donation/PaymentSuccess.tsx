import { lazy, Suspense } from 'react';
import { motion } from 'framer-motion';
import { CheckCircle, Heart, Sparkles } from 'lucide-react';
import { useWindowSize } from '@/hooks/useWindowSize';
import { ICON_SIZES } from '@/lib/design-tokens';
import { cn } from '@/lib/utils';

// Lazy load react-confetti
const Confetti = lazy(() => import('react-confetti'));

interface PaymentSuccessProps {
  amount: number;
  currency: string;
  onClose: () => void;
}

export const PaymentSuccess = ({ amount, currency, onClose }: PaymentSuccessProps) => {
  const { width, height } = useWindowSize();

  return (
    <div className="text-center py-8">
      {/* Confetti */}
      <Suspense fallback={null}>
        <Confetti
          width={width}
          height={height}
          recycle={false}
          numberOfPieces={500}
          gravity={0.3}
        />
      </Suspense>

      {/* Success Icon */}
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: 'spring', stiffness: 200, damping: 15 }}
        className="mx-auto mb-6 flex h-24 w-24 items-center justify-center rounded-full bg-gradient-to-r from-mint-500 to-lavender-500 shadow-2xl"
      >
        <CheckCircle className={cn(ICON_SIZES['2xl'], "text-white")} />
      </motion.div>

      {/* Title */}
      <motion.h2
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="mb-3 text-3xl font-semibold text-gray-900 dark:text-white"
      >
        Спасибо! 💛
      </motion.h2>

      {/* Description */}
      <motion.p
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="mb-6 text-lg text-gray-600 dark:text-gray-400"
      >
        Твоя поддержка в размере <span className="font-semibold text-primary">{amount} {currency}</span><br />
        помогает развивать проект!
      </motion.p>

      {/* Icons */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.4 }}
        className="flex items-center justify-center gap-4 mb-8"
      >
        <Heart className={cn(ICON_SIZES.xl, "text-coral-500 fill-coral-500")} />
        <Sparkles className={cn(ICON_SIZES.xl, "text-lavender-500")} />
        <Heart className={cn(ICON_SIZES.xl, "text-primary fill-primary")} />
      </motion.div>

      {/* Badge Info */}
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.5 }}
        className="mb-6 rounded-xl border border-lavender-500/20 bg-lavender-500/8 p-4"
      >
        <div className="flex items-center justify-center gap-2 mb-2">
          <Sparkles className={cn(ICON_SIZES.md, "text-lavender-500")} />
          <span className="font-semibold text-gray-900 dark:text-white">
            Ты получил бейдж «Supporter»!
          </span>
        </div>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Он будет отображаться в твоём профиле
        </p>
      </motion.div>

      {/* Close Button */}
      <motion.button
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.6 }}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={onClose}
        className="rounded-full bg-primary px-8 py-3 font-semibold text-primary-foreground shadow-lg transition-all hover:bg-primary/90 hover:shadow-xl"
      >
        Отлично!
      </motion.button>
    </div>
  );
};
