import '@testing-library/jest-dom/vitest';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { LunchDnaCard } from '../../src/components/stats/LunchDnaCard';

describe('LunchDnaCard', () => {
  it('should render identity, fingerprint and pulse sections', () => {
    render(
      <LunchDnaCard
        isDark={false}
        profile={{
          archetype: 'Архитектор обеда',
          confidence: 'high',
          confidenceLabel: 'Высокая уверенность',
          summary: 'Ты чаще выбираешь понятные блюда и хорошо совпадаешь с taste baseline команды.',
          isFallback: false,
          historySampleSize: 14,
          tags: ['любит проверенное', 'часто совпадает с группой', 'низкая хаотичность'],
          axes: [
            { key: 'stability', label: 'Стабильность', value: 82 },
            { key: 'novelty', label: 'Открытость', value: 28 },
            { key: 'comfort', label: 'Comfort', value: 73 },
            { key: 'price', label: 'Цена', value: 50 },
            { key: 'teamSync', label: 'Синхронность', value: 79 },
            { key: 'polarity', label: 'Полярность', value: 24 },
          ],
          baseline: {
            title: 'Taste baseline',
            description: 'Твой выбор чаще попадает в популярное ядро команды.',
          },
          pulse: {
            title: 'Taste drift',
            description: 'На этой неделе ты держишься ближе к comfort food, чем обычно.',
          },
        }}
      />
    );

    expect(screen.getByText('Твой Lunch DNA')).toBeInTheDocument();
    expect(screen.getByText('Архитектор обеда')).toBeInTheDocument();
    expect(screen.getByText('Taste baseline')).toBeInTheDocument();
    expect(screen.getByText('Taste drift')).toBeInTheDocument();
    expect(screen.getByTestId('lunch-dna-fingerprint')).toBeInTheDocument();
  });

  it('should render onboarding state for fallback profile', () => {
    render(
      <LunchDnaCard
        isDark={true}
        profile={{
          archetype: 'Профиль формируется',
          confidence: 'low',
          confidenceLabel: 'Недостаточно данных',
          summary: 'Чтобы собрать Lunch DNA, нужно ещё 3–5 голосований.',
          isFallback: true,
          historySampleSize: 2,
          tags: ['пока мало данных'],
          axes: [
            { key: 'stability', label: 'Стабильность', value: 50 },
            { key: 'novelty', label: 'Открытость', value: 50 },
            { key: 'comfort', label: 'Comfort', value: 50 },
            { key: 'price', label: 'Цена', value: 50 },
            { key: 'teamSync', label: 'Синхронность', value: 50 },
            { key: 'polarity', label: 'Полярность', value: 50 },
          ],
          baseline: {
            title: 'Taste baseline',
            description: 'Сначала нужно накопить достаточно голосов.',
          },
          pulse: {
            title: 'Taste drift',
            description: 'Пока рано делать надёжные выводы.',
          },
        }}
      />
    );

    expect(screen.getByText('Профиль формируется')).toBeInTheDocument();
    expect(screen.getByText('Чтобы собрать Lunch DNA, нужно ещё 3–5 голосований.')).toBeInTheDocument();
  });
});
