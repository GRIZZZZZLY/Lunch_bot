import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ChevronRight, ChevronLeft, Check } from 'lucide-react';
import { useTelegram } from '../../hooks/useTelegram';
import { ICON_SIZES } from '@/lib/design-tokens';

interface FirstTimeVotingTutorialProps {
  isOpen: boolean;
  onClose: () => void;
}

interface TutorialStep {
  icon: string;
  title: string;
  description: string;
}

const tutorialSteps: TutorialStep[] = [
  // Слайды об приложении (общий обзор)
  {
    icon: '👋',
    title: 'Добро пожаловать!',
    description: 'Это приложение поможет вашей команде выбирать, что заказать на обед. Голосуйте, смотрите статистику и управляйте заказами вместе!',
  },
  {
    icon: '📱',
    title: 'Навигация',
    description: 'Внизу экрана — меню: Главная (голосования), Меню (все блюда), Статистика и Профиль. Исследуйте!',
  },
  // Слайды о голосовании
  {
    icon: '🗳️',
    title: 'Как голосовать?',
    description: 'Когда начнётся голосование, выберите блюда из списка. Можно выбрать несколько блюд!',
  },
  {
    icon: '👆',
    title: 'Выберите блюдо',
    description: 'Нажмите на карточку блюда, которое вам нравится. Выбранные блюда подсветятся.',
  },
  {
    icon: '✅',
    title: 'Подтвердите выбор',
    description: 'Нажмите кнопку "Проголосовать" — и готово! Вы можете изменить выбор до завершения голосования.',
  },
  {
    icon: '🎉',
    title: 'Всё готово!',
    description: 'Теперь вы знаете всё необходимое. Приятного аппетита!',
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
                <X className={ICON_SIZES.md} />
              </button>

              {/* Progress bar */}
              <div className="mb-6">
                <div className="h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${progress}%` }}
                    transition={{ duration: 0.3 }}
                    className="h-full bg-gradient-to-r from-primary-food-500 to-primary-food-600"
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
                  {/* Icon */}
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ delay: 0.1, type: 'spring', stiffness: 200 }}
                    className="text-7xl mb-6"
                  >
                    {currentStepData.icon}
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
                <ChevronLeft className={ICON_SIZES.md} />
                Назад
              </motion.button>

              {/* Next/Complete button */}
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={handleNext}
                className="flex-1 flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-semibold bg-gradient-to-r from-primary-food-500 to-primary-food-600 text-white hover:from-primary-food-600 hover:to-primary-food-700 transition-all shadow-lg"
              >
                {currentStep === tutorialSteps.length - 1 ? (
                  <>
                    <Check className={ICON_SIZES.md} />
                    Понятно!
                  </>
                ) : (
                  <>
                    Далее
                    <ChevronRight className={ICON_SIZES.md} />
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
                className="text-center py-2 text-xs text-gray-400 dark:text-gray-400 dark:text-gray-400"
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
