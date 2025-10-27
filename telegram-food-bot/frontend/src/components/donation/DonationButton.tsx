import { useState } from 'react';
import { motion } from 'framer-motion';
import { Heart } from 'lucide-react';
import { DonationModal } from './DonationModal';
import { DONATION_THEME } from '../../styles/donation.theme';

export const DonationButton = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);

  return (
    <>
      <motion.button
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.8, duration: 0.4 }}
        whileHover={{ 
          scale: 1.02,
          boxShadow: DONATION_THEME.shadow.buttonHover,
          border: DONATION_THEME.border.hover,
        }}
        whileTap={{ scale: 0.98 }}
        onClick={() => setIsModalOpen(true)}
        className="relative w-full overflow-hidden rounded-2xl transition-all"
        style={{
          background: DONATION_THEME.gradients.button,
          boxShadow: DONATION_THEME.shadow.button,
          border: DONATION_THEME.border.default,
          padding: DONATION_THEME.spacing.buttonPadding,
        }}
      >
        {/* Animated background shine */}
        <motion.div
          animate={{
            x: ['0%', '200%']
          }}
          transition={{
            duration: 3,
            repeat: Infinity,
            ease: 'linear'
          }}
          className="absolute inset-0"
          style={{
            background: DONATION_THEME.gradients.shine,
            width: '50%',
          }}
        />

        <div className="relative flex items-center gap-4">
          {/* Heart icon with subtle pulse */}
          <motion.div
            animate={{ scale: [1, 1.1, 1] }}
            transition={{
              duration: 2,
              repeat: Infinity,
              ease: 'easeInOut'
            }}
          >
            <Heart 
              size={DONATION_THEME.spacing.iconSize.large} 
              className="fill-white"
              style={{ color: 'white' }}
            />
          </motion.div>
          
          {/* Text content - clean without emoji */}
          <div className="flex-1 text-left">
            <h3 className="text-xl font-bold mb-1 text-gray-200">
              Поддержите проект
            </h3>
            <p className="text-sm text-gray-300">
              Помогите развитию бота
            </p>
          </div>
        </div>
      </motion.button>

      {/* Modal */}
      <DonationModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
    </>
  );
};
