import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSwipeable } from 'react-swipeable';
import { 
  Sparkles, 
  UtensilsCrossed, 
  Vote, 
  BarChart3, 
  CheckCircle,
  X,
  Compass,
  Soup
} from 'lucide-react';
import { OnboardingSlide } from './OnboardingSlide';
import { SlideIndicator } from './SlideIndicator';
import { ICON_SIZES } from '@/lib/design-tokens';
import { cn } from '@/lib/utils';

interface WelcomeModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const slides = [
  // Слайд 1: Приветствие - жёлтый/янтарный
  {
    icon: Sparkles,
    iconColor: 'text-white',
    iconBgColor: 'bg-gradient-to-br from-amber-400 to-orange-500',
    title: 'Добро пожаловать!',
    description: 'Это приложение поможет вашей команде выбирать, что заказать на обед. Голосуйте, смотрите статистику и управляйте заказами вместе!'
  },
  // Слайд 2: Навигация - изумрудный
  {
    icon: Compass,
    iconColor: 'text-white',
    iconBgColor: 'bg-gradient-to-br from-emerald-400 to-teal-500',
    title: 'Навигация',
    description: 'Внизу экрана — меню: Главная (голосования), Меню (все блюда), Статистика и Профиль. Исследуйте!'
  },
  // Слайд 3: Голосование - оранжевый
  {
    icon: Vote,
    iconColor: 'text-white',
    iconBgColor: 'bg-gradient-to-br from-orange-400 to-red-500',
    title: 'Как голосовать?',
    description: 'Когда начнётся голосование, выберите блюда из списка. Можно выбрать несколько блюд!'
  },
  // Слайд 4: Выбор блюда - фиолетовый
  {
    icon: Soup,
    iconColor: 'text-white',
    iconBgColor: 'bg-gradient-to-br from-violet-400 to-purple-600',
    title: 'Выберите блюдо',
    description: 'Нажмите на карточку блюда, которое вам нравится. Выбранные блюда подсветятся фиолетовым.'
  },
  // Слайд 5: Статистика - синий
  {
    icon: BarChart3,
    iconColor: 'text-white',
    iconBgColor: 'bg-gradient-to-br from-blue-400 to-indigo-500',
    title: 'Статистика',
    description: 'Смотрите популярные блюда, историю голосований и личную статистику в разделе "Статистика".'
  },
  // Слайд 6: Готово - зелёный
  {
    icon: CheckCircle,
    iconColor: 'text-white',
    iconBgColor: 'bg-gradient-to-br from-green-400 to-emerald-500',
    title: 'Всё готово!',
    description: 'Теперь вы знаете всё необходимое. Приятного аппетита!'
  }
];

export const WelcomeModal = ({ isOpen, onClose }: WelcomeModalProps) => {
  const [currentSlide, setCurrentSlide] = useState(0);

  const nextSlide = () => {
    if (currentSlide < slides.length - 1) {
      setCurrentSlide(currentSlide + 1);
    } else {
      onClose();
    }
  };

  const prevSlide = () => {
    if (currentSlide > 0) {
      setCurrentSlide(currentSlide - 1);
    }
  };

  const handlers = useSwipeable({
    onSwipedLeft: nextSlide,
    onSwipedRight: prevSlide,
    trackMouse: true
  });

  // Блокируем скролл body когда модальное окно открыто
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 overflow-hidden"
        >
          {/* Overlay */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={onClose}
          />

          {/* Modal Content */}
          <motion.div
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 20 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            className="relative w-full max-w-md bg-white dark:bg-gray-800 rounded-3xl shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close Button */}
            <button
              onClick={onClose}
              aria-label="Закрыть окно приветствия"
              className="absolute top-4 right-4 z-10 p-2 rounded-full bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
            >
              <X className={cn(ICON_SIZES.md, "text-gray-600 dark:text-gray-400")} />
            </button>

            {/* Slides Container */}
            <div className="overflow-hidden" {...handlers}>
              <motion.div
                animate={{ x: `-${currentSlide * 100}%` }}
                transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                className="flex"
              >
                {slides.map((slide, index) => (
                  <OnboardingSlide key={index} {...slide} />
                ))}
              </motion.div>
            </div>

            {/* Indicator */}
            <SlideIndicator total={slides.length} current={currentSlide} />

            {/* Navigation Buttons */}
            <div className="flex items-center justify-between px-6 py-6">
              {/* Skip Button */}
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={onClose}
                className="text-sm font-medium text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
              >
                Пропустить
              </motion.button>

              {/* Next/Start Button */}
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={nextSlide}
                className={`
                  px-6 py-2.5 rounded-full font-semibold text-white
                  transition-all duration-300
                  ${currentSlide === slides.length - 1
                    ? 'bg-gradient-to-r from-primary-food-600 to-primary-food-700 shadow-lg shadow-primary-food-600/30'
                    : 'bg-primary-food-700 hover:bg-primary-food-800'
                  }
                `}
              >
                {currentSlide === slides.length - 1 ? 'Начать' : 'Далее'}
              </motion.button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
