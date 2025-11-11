import { motion } from 'framer-motion';
import { CheckCircle, Heart, Sparkles } from 'lucide-react';
import Confetti from 'react-confetti';
import { useWindowSize } from 'react-use';
import { ICON_SIZES } from '@/lib/design-tokens';
import { cn } from '@/lib/utils';

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
      <Confetti
        width={width}
        height={height}
        recycle={false}
        numberOfPieces={500}
        gravity={0.3}
      />

      {/* Success Icon */}
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: 'spring', stiffness: 200, damping: 15 }}
        className="mx-auto w-24 h-24 bg-gradient-to-r from-green-400 to-green-500 rounded-full flex items-center justify-center mb-6 shadow-2xl"
      >
        <CheckCircle className={cn(ICON_SIZES['2xl'], "text-white")} />
      </motion.div>

      {/* Title */}
      <motion.h2
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="text-3xl font-bold text-gray-900 dark:text-white mb-3"
      >
        Спасибо! 💛
      </motion.h2>

      {/* Description */}
      <motion.p
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="text-lg text-gray-600 dark:text-gray-400 mb-6"
      >
        Ваша поддержка в размере <span className="font-semibold text-yellow-600 dark:text-yellow-400">{amount} {currency}</span><br />
        помогает развивать проект!
      </motion.p>

      {/* Icons */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.4 }}
        className="flex items-center justify-center gap-4 mb-8"
      >
        <Heart className={cn(ICON_SIZES.xl, "text-red-500 fill-red-500")} />
        <Sparkles className={cn(ICON_SIZES.xl, "text-yellow-500")} />
        <Heart className={cn(ICON_SIZES.xl, "text-pink-500 fill-pink-500")} />
      </motion.div>

      {/* Badge Info */}
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.5 }}
        className="bg-gradient-to-r from-yellow-50 to-orange-50 dark:from-yellow-900/20 dark:to-orange-900/20 rounded-xl p-4 mb-6 border border-yellow-200 dark:border-yellow-700"
      >
        <div className="flex items-center justify-center gap-2 mb-2">
          <Sparkles className={cn(ICON_SIZES.md, "text-yellow-500")} />
          <span className="font-semibold text-gray-900 dark:text-white">
            Вы получили бейдж "Supporter"!
          </span>
        </div>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Он будет отображаться в вашем профиле
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
        className="px-8 py-3 bg-gradient-to-r from-yellow-500 to-orange-500 text-white font-semibold rounded-full shadow-lg hover:shadow-xl transition-all"
      >
        Отлично!
      </motion.button>
    </div>
  );
};
