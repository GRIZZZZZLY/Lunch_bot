import React from 'react';
import { SuggestionsPanel } from '../components/menu/SuggestionsPanel';
// import { MediumWaveGradient } from '../components/background'; // REMOVED: убрали оранжевый градиент
import { motion } from 'framer-motion';

/**
 * Страница обработки предложений блюд (только для админов)
 */
export const SuggestionsPage: React.FC = () => {
  return (
    <>
      {/* Background removed - using neutral bg-background from Layout */}

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="container mx-auto px-4 py-6"
      >
        <SuggestionsPanel />
      </motion.div>
    </>
  );
};

export default SuggestionsPage;
