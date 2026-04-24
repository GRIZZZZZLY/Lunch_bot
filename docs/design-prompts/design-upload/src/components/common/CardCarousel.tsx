import React, { useCallback, useEffect, useState } from 'react';
import useEmblaCarousel from 'embla-carousel-react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ICON_SIZES } from '@/lib/design-tokens';

interface CardCarouselProps {
  children: React.ReactNode[];
  className?: string;
  autoPlay?: boolean;
  autoPlayDelay?: number;
  showArrows?: boolean;
  showDots?: boolean;
}

/**
 * Карусель карточек с горизонтальным скроллом
 * Использует Embla Carousel для плавного свайпа
 */
export const CardCarousel: React.FC<CardCarouselProps> = ({
  children,
  className,
  autoPlay = false,
  autoPlayDelay = 5000,
  showArrows = true,
  showDots = true,
}) => {
  const [emblaRef, emblaApi] = useEmblaCarousel({
    loop: false,
    align: 'start',
    skipSnaps: false,
    dragFree: true,
  });

  const [selectedIndex, setSelectedIndex] = useState(0);
  const [canScrollPrev, setCanScrollPrev] = useState(false);
  const [canScrollNext, setCanScrollNext] = useState(false);

  const scrollPrev = useCallback(() => {
    if (emblaApi) emblaApi.scrollPrev();
  }, [emblaApi]);

  const scrollNext = useCallback(() => {
    if (emblaApi) emblaApi.scrollNext();
  }, [emblaApi]);

  const scrollTo = useCallback(
    (index: number) => {
      if (emblaApi) emblaApi.scrollTo(index);
    },
    [emblaApi]
  );

  const onSelect = useCallback(() => {
    if (!emblaApi) return;
    setSelectedIndex(emblaApi.selectedScrollSnap());
    setCanScrollPrev(emblaApi.canScrollPrev());
    setCanScrollNext(emblaApi.canScrollNext());
  }, [emblaApi]);

  useEffect(() => {
    if (!emblaApi) return;

    onSelect();
    emblaApi.on('select', onSelect);
    emblaApi.on('reInit', onSelect);

    return () => {
      emblaApi.off('select', onSelect);
      emblaApi.off('reInit', onSelect);
    };
  }, [emblaApi, onSelect]);

  // Auto-play
  useEffect(() => {
    if (!autoPlay || !emblaApi) return;

    const autoPlayInterval = setInterval(() => {
      if (emblaApi.canScrollNext()) {
        emblaApi.scrollNext();
      } else {
        emblaApi.scrollTo(0);
      }
    }, autoPlayDelay);

    return () => clearInterval(autoPlayInterval);
  }, [emblaApi, autoPlay, autoPlayDelay]);

  return (
    <div className={cn('relative', className)}>
      {/* Carousel Container */}
      <div className="overflow-hidden" ref={emblaRef}>
        <div className="flex gap-4">
          {children.map((child, index) => (
            <div
              key={index}
              className="flex-[0_0_100%] min-w-0"
              style={{ flex: '0 0 100%' }}
            >
              {child}
            </div>
          ))}
        </div>
      </div>

      {/* Navigation Arrows */}
      {showArrows && children.length > 1 && (
        <>
          <AnimatePresence>
            {canScrollPrev && (
              <motion.button
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                onClick={scrollPrev}
                className={cn(
                  'absolute left-2 top-1/2 -translate-y-1/2 z-10',
                  'p-2 rounded-full',
                  'bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm',
                  'shadow-lg border border-gray-200 dark:border-gray-700',
                  'hover:bg-white dark:hover:bg-gray-800',
                  'transition-all duration-200',
                  'focus:outline-none focus:ring-2 focus:ring-peach-500'
                )}
                aria-label="Предыдущая карточка"
              >
                <ChevronLeft className={`${ICON_SIZES.md} text-gray-700 dark:text-gray-200`} />
              </motion.button>
            )}
          </AnimatePresence>

          <AnimatePresence>
            {canScrollNext && (
              <motion.button
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                onClick={scrollNext}
                className={cn(
                  'absolute right-2 top-1/2 -translate-y-1/2 z-10',
                  'p-2 rounded-full',
                  'bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm',
                  'shadow-lg border border-gray-200 dark:border-gray-700',
                  'hover:bg-white dark:hover:bg-gray-800',
                  'transition-all duration-200',
                  'focus:outline-none focus:ring-2 focus:ring-peach-500'
                )}
                aria-label="Следующая карточка"
              >
                <ChevronRight className={`${ICON_SIZES.md} text-gray-700 dark:text-gray-200`} />
              </motion.button>
            )}
          </AnimatePresence>
        </>
      )}

      {/* Dot Indicators */}
      {showDots && children.length > 1 && (
        <div className="flex justify-center gap-2 mt-4">
          {children.map((_, index) => (
            <button
              key={index}
              onClick={() => scrollTo(index)}
              className={cn(
                'h-2 rounded-full transition-all duration-300',
                'focus:outline-none focus:ring-2 focus:ring-peach-500 focus:ring-offset-2',
                selectedIndex === index
                  ? 'w-8 bg-peach-500'
                  : 'w-2 bg-gray-300 dark:bg-gray-600 hover:bg-gray-400 dark:hover:bg-gray-500'
              )}
              aria-label={`Перейти к карточке ${index + 1}`}
              aria-current={selectedIndex === index}
            />
          ))}
        </div>
      )}
    </div>
  );
};
