import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ChevronRight, ChevronLeft, Check, Vote, Hand, Sparkles, CheckCircle2, Rocket } from 'lucide-react';
import { useTelegram } from '../../hooks/useTelegram';
import type { LucideIcon } from 'lucide-react';

interface FirstTimeVotingTutorialProps {
  isOpen: boolean;
  onClose: () => void;
}

interface TutorialStep {
  icon: LucideIcon;
  iconColor: string;
  iconBgColor: string;
  title: string;
  description: string;
}

const tutorialSteps: TutorialStep[] = [
  {
    icon: Vote,
    iconColor: 'text-peach-500',
    iconBgColor: 'bg-peach-50 dark:bg-peach-900/20',
    title: 'Добро пожаловать!',
    description: 'Давайте покажем, как быстро проголосовать за любимое блюдо',
  },
  {
    icon: Hand,
    iconColor: 'text-coral-500',
    iconBgColor: 'bg-coral-50 dark:bg-coral-900/20',
    title: 'Выберите блюдо',
    description: 'Нажмите на карточку понравившегося блюда. Можно выбрать только одно.',
  },
  {
    icon: Sparkles,
    iconColor: 'text-butter-500',
    iconBgColor: 'bg-butter-50 dark:bg-butter-900/20',
    title: 'Получите отклик',
    description: 'Блюдо подсветится, и вы почувствуете вибрацию',
  },
  {
    icon: Rocket,
    iconColor: 'text-lavender-500',
    iconBgColor: 'bg-lavender-50 dark:bg-lavender-900/20',
    title: 'Подтвердите выбор',
    description: 'Нажмите кнопку "Проголосовать" внизу экрана',
  },
  {
    icon: CheckCircle2,
    iconColor: 'text-mint-500',
    iconBgColor: 'bg-mint-50 dark:bg-mint-900/20',
    title: 'Готово!',
    description: 'Ваш голос учтён! Можете изменить выбор до завершения голосования.',
  },
];

export const FirstTimeVotingTutorial: React.FC<FirstTimeVotingTutorialProps> = ({
  isOpen,
  onClose,
}) => {
  const [currentStep, setCurrentStep] = useState(0);
  const { hapticFeedback } = useTelegram();

  useEffect(() => {
    if (isOpen) {
      // Haptic при открытии туториала
      hapticFeedback.impactOccurred('light');
    }
  }, [isOpen, hapticFeedback]);

  const handleNext = () => {
    if (currentStep < tutorialSteps.length - 1) {
      setCurrentStep(currentStep + 1);
      hapticFeedback.selectionChanged();
    } else {
      handleComplete();
    }
  };

  const handlePrev = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
      hapticFeedback.selectionChanged();
    }
  };

  const handleSkip = () => {
    hapticFeedback.impactOccurred('light');
    onClose();
  };

  const handleComplete = () => {
    hapticFeedback.notificationOccurred('success');
    onClose();
  };

  const progress = ((currentStep + 1) / tutorialSteps.length) * 100;
  const currentStepData = tutorialSteps[currentStep];

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={handleSkip}
        >
          <motion.div
            initial={{ scale: 0.9, y: 20 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.9, y: 20 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            onClick={(e) => e.stopPropagation()}
            className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-md w-full overflow-hidden"
          >
            {/* Header */}
            <div className="relative p-6 pb-4">
              <button
                onClick={handleSkip}
                className="absolute top-4 right-4 p-2 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
              >
                <X size={20} />
              </button>

              {/* Progress bar */}
              <div className="mb-6">
                <div className="h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${progress}%` }}
                    transition={{ duration: 0.3 }}
                    className="h-full bg-gradient-to-r from-peach-500 to-peach-600"
                  />
                </div>
                <div className="flex justify-between items-center mt-2">
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    Шаг {currentStep + 1} из {tutorialSteps.length}
                  </span>
                </div>
              </div>
            </div>

            {/* Content */}
            <div className="px-6 pb-6">
              <AnimatePresence mode="wait">
                <motion.div
                  key={currentStep}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.3 }}
                  className="text-center"
                >
                  {/* Icon Circle */}
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ delay: 0.1, type: 'spring', stiffness: 200 }}
                    className={`w-24 h-24 rounded-full ${currentStepData.iconBgColor} flex items-center justify-center mb-6 mx-auto`}
                  >
                    <currentStepData.icon size={48} className={currentStepData.iconColor} />
                  </motion.div>

                  {/* Title */}
                  <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-3">
                    {currentStepData.title}
                  </h2>

                  {/* Description */}
                  <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
                    {currentStepData.description}
                  </p>
                </motion.div>
              </AnimatePresence>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between gap-3 p-6 pt-4 bg-gray-50 dark:bg-gray-900/50">
              {/* Previous button */}
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={handlePrev}
                disabled={currentStep === 0}
                className={`
                  flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium transition-all
                  ${
                    currentStep === 0
                      ? 'opacity-0 pointer-events-none'
                      : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-gray-600'
                  }
                `}
              >
                <ChevronLeft size={20} />
                Назад
              </motion.button>

              {/* Next/Complete button */}
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={handleNext}
                className="flex-1 flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-semibold bg-gradient-to-r from-peach-500 to-peach-600 text-white hover:from-peach-600 hover:to-peach-700 transition-all shadow-lg"
              >
                {currentStep === tutorialSteps.length - 1 ? (
                  <>
                    <Check size={20} />
                    Понятно!
                  </>
                ) : (
                  <>
                    Далее
                    <ChevronRight size={20} />
                  </>
                )}
              </motion.button>
            </div>

            {/* Skip hint */}
            {currentStep === 0 && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.5 }}
                className="text-center py-2 text-xs text-gray-400 dark:text-gray-500"
              >
                Нажмите на фон, чтобы пропустить
              </motion.div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
