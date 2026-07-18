import { useState } from 'react';
import { m } from 'framer-motion';
import { Heart } from 'lucide-react';
import { DonationModal } from './DonationModal';
import { DONATION_THEME, getDonationStyles } from '../../styles/donation.theme';
import { useAppStore } from '../../store/useAppStore';

export const DonationButton = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const isDark = useAppStore((s) => s.theme) === 'dark';
  const styles = getDonationStyles(isDark);

  return (
    <>
      <m.button
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.8, duration: 0.4 }}
        whileHover={{
          scale: 1.02,
          boxShadow: styles.shadow.buttonHover,
          border: styles.border.hover,
        }}
        whileTap={{ scale: 0.98 }}
        onClick={() => setIsModalOpen(true)}
        className="relative w-full overflow-hidden rounded-2xl transition-all"
        style={{
          background: styles.gradients.button,
          boxShadow: styles.shadow.button,
          border: styles.border.default,
          padding: DONATION_THEME.spacing.buttonPadding,
        }}
      >
        <div className="relative flex items-center gap-4">
          {/* Heart icon — idle pulse убран (redesign 2026-04-24) */}
          <Heart
            size={DONATION_THEME.spacing.iconSize.large}
            className="fill-white"
            style={{ color: 'white' }}
          />
          
          {/* Text content - clean without emoji */}
          <div className="flex-1 text-left">
            <h3 className="mb-1 text-lg font-semibold text-white">
              Поддержать проект
            </h3>
            <p className="text-sm text-white/85">
              Помогите развитию бота
            </p>
          </div>
        </div>
      </m.button>

      {/* Modal */}
      <DonationModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
    </>
  );
};
