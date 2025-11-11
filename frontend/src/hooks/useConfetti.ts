import { useCallback } from 'react';
import confetti from 'canvas-confetti';
import { useHaptic } from './useHaptic';

/**
 * Hook для запуска конфетти с разными пресетами
 * Использует canvas-confetti для визуальных эффектов
 */
export function useConfetti() {
  const haptic = useHaptic();

  /**
   * Базовый конфетти эффект
   */
  const basic = useCallback(() => {
    haptic.impact();
    confetti({
      particleCount: 100,
      spread: 70,
      origin: { y: 0.6 },
    });
  }, [haptic]);

  /**
   * Конфетти при разблокировке достижения
   * Золотые и цветные частицы с боков экрана
   */
  const achievement = useCallback((rarity: 'common' | 'rare' | 'epic' | 'legendary' = 'rare') => {
    haptic.impact();

    const colors = {
      common: ['#6b7280', '#9ca3af', '#d1d5db'],
      rare: ['#3b82f6', '#60a5fa', '#93c5fd'],
      epic: ['#8b5cf6', '#a78bfa', '#c4b5fd'],
      legendary: ['#f59e0b', '#fbbf24', '#fde047', '#fef08a'],
    };

    const particleCount = {
      common: 50,
      rare: 80,
      epic: 120,
      legendary: 150,
    };

    const duration = {
      common: 2000,
      rare: 2500,
      epic: 3000,
      legendary: 4000,
    };

    const end = Date.now() + duration[rarity];

    // Конфетти с обеих сторон
    const frame = () => {
      confetti({
        particleCount: 2,
        angle: 60,
        spread: 55,
        origin: { x: 0, y: 0.6 },
        colors: colors[rarity],
      });
      confetti({
        particleCount: 2,
        angle: 120,
        spread: 55,
        origin: { x: 1, y: 0.6 },
        colors: colors[rarity],
      });

      if (Date.now() < end) {
        requestAnimationFrame(frame);
      }
    };

    frame();

    // Взрыв в центре для legendary
    if (rarity === 'legendary') {
      setTimeout(() => {
        confetti({
          particleCount: particleCount[rarity],
          spread: 360,
          startVelocity: 30,
          origin: { x: 0.5, y: 0.5 },
          colors: colors[rarity],
          shapes: ['star', 'circle'],
          scalar: 1.2,
        });
      }, 200);
    }
  }, [haptic]);

  /**
   * Конфетти при повышении уровня
   * Взрыв снизу вверх по центру
   */
  const levelUp = useCallback(() => {
    haptic.impact();

    const duration = 3000;
    const animationEnd = Date.now() + duration;
    const defaults = {
      startVelocity: 30,
      spread: 360,
      ticks: 60,
      zIndex: 0,
      colors: ['#fbbf24', '#f59e0b', '#fb923c', '#f97316'],
    };

    const randomInRange = (min: number, max: number) => {
      return Math.random() * (max - min) + min;
    };

    const interval = window.setInterval(() => {
      const timeLeft = animationEnd - Date.now();

      if (timeLeft <= 0) {
        return clearInterval(interval);
      }

      const particleCount = 50 * (timeLeft / duration);

      // Взрывы снизу
      confetti({
        ...defaults,
        particleCount,
        origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 },
      });
      confetti({
        ...defaults,
        particleCount,
        origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 },
      });
    }, 250);
  }, [haptic]);

  /**
   * Мини-конфетти для небольших успехов
   * Быстрый короткий всплеск
   */
  const mini = useCallback(() => {
    haptic.medium();
    confetti({
      particleCount: 30,
      spread: 45,
      origin: { y: 0.7 },
      colors: ['#3b82f6', '#8b5cf6', '#ec4899'],
      scalar: 0.8,
    });
  }, [haptic]);

  /**
   * Конфетти-фейерверк (для топ-1 в лидерборде)
   * Множественные взрывы по экрану
   */
  const fireworks = useCallback(() => {
    haptic.impact();

    const duration = 4000;
    const animationEnd = Date.now() + duration;

    const randomInRange = (min: number, max: number) => {
      return Math.random() * (max - min) + min;
    };

    const interval = window.setInterval(() => {
      const timeLeft = animationEnd - Date.now();

      if (timeLeft <= 0) {
        return clearInterval(interval);
      }

      const particleCount = 50 * (timeLeft / duration);

      confetti({
        particleCount,
        startVelocity: 30,
        spread: 360,
        origin: {
          x: randomInRange(0.1, 0.9),
          y: randomInRange(0.2, 0.6),
        },
        colors: ['#fbbf24', '#f59e0b', '#ec4899', '#8b5cf6', '#3b82f6'],
        shapes: ['star'],
        scalar: 1.2,
      });
    }, 400);
  }, [haptic]);

  /**
   * Школьная пушка (стрельба снизу)
   */
  const cannon = useCallback(() => {
    haptic.impact();

    const colors = ['#fbbf24', '#f59e0b', '#fb923c', '#f97316', '#ef4444'];

    confetti({
      particleCount: 100,
      angle: 60,
      spread: 55,
      origin: { x: 0, y: 1 },
      colors,
    });
    confetti({
      particleCount: 100,
      angle: 120,
      spread: 55,
      origin: { x: 1, y: 1 },
      colors,
    });
  }, [haptic]);

  /**
   * Звёзды падают сверху (для нового места в топе)
   */
  const stars = useCallback(() => {
    haptic.medium();

    const duration = 2000;
    const end = Date.now() + duration;

    const frame = () => {
      confetti({
        particleCount: 1,
        startVelocity: 0,
        ticks: 200,
        origin: {
          x: Math.random(),
          y: 0,
        },
        colors: ['#fbbf24', '#fde047'],
        shapes: ['star'],
        scalar: 1.5,
        gravity: 0.5,
      });

      if (Date.now() < end) {
        requestAnimationFrame(frame);
      }
    };

    frame();
  }, [haptic]);

  /**
   * Конфетти при оплате (зелёные деньги 💰)
   */
  const payment = useCallback(() => {
    haptic.medium();
    confetti({
      particleCount: 60,
      spread: 70,
      origin: { y: 0.6 },
      colors: ['#10b981', '#34d399', '#6ee7b7', '#a7f3d0'],
      shapes: ['circle'],
    });
  }, [haptic]);

  /**
   * Остановить все активные конфетти
   */
  const stop = useCallback(() => {
    confetti.reset();
  }, []);

  return {
    basic,
    achievement,
    levelUp,
    mini,
    fireworks,
    cannon,
    stars,
    payment,
    stop,
  };
}
