import React from 'react';
import { AnimatedGradientBackground, AnimatedGradientBackgroundProps } from './AnimatedGradientBackground';

/**
 * Предустановленные варианты градиентов для быстрого использования
 */

/**
 * Subtle Diagonal - Едва заметный диагональный градиент
 * Идеально для основного фона страниц
 */
export const SubtleDiagonalGradient: React.FC<
  Omit<AnimatedGradientBackgroundProps, 'variant' | 'speed' | 'intensity'>
> = (props) => (
  <AnimatedGradientBackground
    variant="diagonal"
    speed="slow"
    intensity="subtle"
    {...props}
  />
);

/**
 * Medium Wave - Средний волновой градиент
 * Подходит для hero sections и featured cards
 */
export const MediumWaveGradient: React.FC<
  Omit<AnimatedGradientBackgroundProps, 'variant' | 'speed' | 'intensity'>
> = (props) => (
  <AnimatedGradientBackground
    variant="wave"
    speed="medium"
    intensity="medium"
    {...props}
  />
);

/**
 * Vibrant Mesh - Яркий сетчатый градиент
 * Для промо секций и CTA блоков
 */
export const VibrantMeshGradient: React.FC<
  Omit<AnimatedGradientBackgroundProps, 'variant' | 'speed' | 'intensity'>
> = (props) => (
  <AnimatedGradientBackground
    variant="mesh"
    speed="fast"
    intensity="vibrant"
    {...props}
  />
);

/**
 * Aurora Radial - Aurora borealis эффект
 * Для модальных окон и спецэффектов
 */
export const AuroraRadialGradient: React.FC<
  Omit<AnimatedGradientBackgroundProps, 'variant' | 'speed' | 'intensity'>
> = (props) => (
  <AnimatedGradientBackground
    variant="aurora"
    speed="slow"
    intensity="medium"
    {...props}
  />
);

/**
 * Fast Diagonal - Быстрый диагональный градиент
 * Для интерактивных элементов и notification toasts
 */
export const FastDiagonalGradient: React.FC<
  Omit<AnimatedGradientBackgroundProps, 'variant' | 'speed' | 'intensity'>
> = (props) => (
  <AnimatedGradientBackground
    variant="diagonal"
    speed="fast"
    intensity="vibrant"
    {...props}
  />
);

/**
 * Subtle Radial - Едва заметный радиальный градиент
 * Для spotlight эффектов
 */
export const SubtleRadialGradient: React.FC<
  Omit<AnimatedGradientBackgroundProps, 'variant' | 'speed' | 'intensity'>
> = (props) => (
  <AnimatedGradientBackground
    variant="radial"
    speed="medium"
    intensity="subtle"
    {...props}
  />
);

/**
 * Morning Hero - Утренний градиент для Hero секций
 */
export const MorningHeroGradient: React.FC<
  Omit<AnimatedGradientBackgroundProps, 'variant' | 'speed' | 'intensity' | 'timeOfDay'>
> = (props) => (
  <AnimatedGradientBackground
    variant="diagonal"
    speed="medium"
    intensity="medium"
    timeOfDay="morning"
    {...props}
  />
);

/**
 * Evening Wave - Вечерний волновой градиент
 */
export const EveningWaveGradient: React.FC<
  Omit<AnimatedGradientBackgroundProps, 'variant' | 'speed' | 'intensity' | 'timeOfDay'>
> = (props) => (
  <AnimatedGradientBackground
    variant="wave"
    speed="slow"
    intensity="subtle"
    timeOfDay="evening"
    {...props}
  />
);

/**
 * Premium Mesh - Премиум сетчатый градиент
 * Для premium features и VIP секций
 */
export const PremiumMeshGradient: React.FC<
  Omit<AnimatedGradientBackgroundProps, 'variant' | 'speed' | 'intensity'>
> = (props) => (
  <AnimatedGradientBackground
    variant="mesh"
    speed="medium"
    intensity="vibrant"
    overlay
    overlayOpacity={0.03}
    {...props}
  />
);

/**
 * Calm Aurora - Спокойный aurora эффект
 * Для background модальных окон
 */
export const CalmAuroraGradient: React.FC<
  Omit<AnimatedGradientBackgroundProps, 'variant' | 'speed' | 'intensity'>
> = (props) => (
  <AnimatedGradientBackground
    variant="aurora"
    speed="slow"
    intensity="subtle"
    {...props}
  />
);
