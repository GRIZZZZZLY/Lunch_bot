import { useState } from 'react';
import { motion } from 'framer-motion';
import { Heart, Sparkles } from 'lucide-react';
import { DonationModal } from './DonationModal';

export const DonationButton = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);

  return (
    <>
      <motion.button
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.8, duration: 0.4 }}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        onClick={() => setIsModalOpen(true)}
        className="relative w-full overflow-hidden bg-gradient-to-r from-yellow-400 via-yellow-500 to-yellow-600 rounded-2xl p-6 shadow-xl shadow-yellow-500/30 hover:shadow-2xl hover:shadow-yellow-500/40 transition-all"
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
          className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent"
          style={{ width: '50%' }}
        />

        <div className="relative flex items-center justify-between">
          {/* Left side */}
          <div className="flex-1 text-left">
            <motion.div
              animate={{ scale: [1, 1.2, 1] }}
              transition={{
                duration: 2,
                repeat: Infinity,
                ease: 'easeInOut'
              }}
              className="inline-block mb-2"
            >
              <Heart size={32} className="text-white fill-white" />
            </motion.div>
            <h3 className="text-xl font-bold text-white mb-1">
              Поддержать проект
            </h3>
            <p className="text-yellow-100 text-sm">
              Помогите развитию бота
            </p>
          </div>

          {/* Right side */}
          <motion.div
            animate={{
              rotate: [0, 10, -10, 10, 0],
              scale: [1, 1.1, 1]
            }}
            transition={{
              duration: 3,
              repeat: Infinity,
              ease: 'easeInOut'
            }}
          >
            <Sparkles size={48} className="text-yellow-200" />
          </motion.div>
        </div>

        {/* Decorative elements */}
        <div className="absolute top-2 right-2 flex gap-1">
          <motion.div
            animate={{ opacity: [0.5, 1, 0.5] }}
            transition={{
              duration: 2,
              repeat: Infinity,
              delay: 0
            }}
            className="w-2 h-2 bg-yellow-200 rounded-full"
          />
          <motion.div
            animate={{ opacity: [0.5, 1, 0.5] }}
            transition={{
              duration: 2,
              repeat: Infinity,
              delay: 0.3
            }}
            className="w-2 h-2 bg-yellow-200 rounded-full"
          />
          <motion.div
            animate={{ opacity: [0.5, 1, 0.5] }}
            transition={{
              duration: 2,
              repeat: Infinity,
              delay: 0.6
            }}
            className="w-2 h-2 bg-yellow-200 rounded-full"
          />
        </div>
      </motion.button>

      {/* Modal */}
      <DonationModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
    </>
  );
};
