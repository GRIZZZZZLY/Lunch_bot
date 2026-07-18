import { m } from 'framer-motion';
import { LucideIcon } from 'lucide-react';
import { ICON_SIZES } from '@/lib/design-tokens';

interface OnboardingSlideProps {
  icon: LucideIcon;
  iconColor: string;
  iconBgColor: string;
  title: string;
  description: string;
}

export const OnboardingSlide = ({
  icon: Icon,
  iconColor,
  iconBgColor,
  title,
  description
}: OnboardingSlideProps) => {
  return (
    <m.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="flex-shrink-0 w-full px-6 py-8 flex flex-col items-center text-center"
    >
      {/* Icon Circle */}
      <m.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
        className={`w-24 h-24 rounded-full ${iconBgColor} flex items-center justify-center mb-6 shadow-lg`}
      >
        <Icon className={`${ICON_SIZES['2xl']} ${iconColor}`} />
      </m.div>

      {/* Title */}
      <m.h2
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
        className="text-2xl font-bold text-gray-900 dark:text-white mb-3"
      >
        {title}
      </m.h2>

      {/* Description */}
      <m.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.4 }}
        className="text-base text-gray-600 dark:text-gray-400 max-w-sm"
      >
        {description}
      </m.p>
    </m.div>
  );
};
