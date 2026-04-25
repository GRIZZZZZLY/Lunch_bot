import { useState, useEffect } from 'react';

export type TimeOfDay = 'morning' | 'afternoon' | 'evening' | 'night';

export interface TimeColors {
  border: string;   // rgba for border colour
  overlay: string;  // CSS linear-gradient for overlay div
  shadow: string;   // box-shadow value
}

export interface GradientColors {
  from: string;
  to: string;
  textColor: string;
  timeOfDay: TimeOfDay;
  label: string;
  colors: TimeColors;
}

// Project-token aligned colours
// peach=morning  mint=afternoon  lavender=evening  butter=night
const TIME_COLORS: Record<TimeOfDay, TimeColors> = {
  morning: {
    border: 'rgba(251,146,60,0.28)',
    overlay: 'linear-gradient(135deg,rgba(251,146,60,0.12) 0%,rgba(234,88,12,0.06) 100%)',
    shadow: '0 8px 20px rgba(251,146,60,0.10)',
  },
  afternoon: {
    border: 'rgba(92,174,135,0.28)',
    overlay: 'linear-gradient(135deg,rgba(92,174,135,0.12) 0%,rgba(52,211,153,0.06) 100%)',
    shadow: '0 8px 20px rgba(92,174,135,0.10)',
  },
  evening: {
    border: 'rgba(139,92,246,0.28)',
    overlay: 'linear-gradient(135deg,rgba(139,92,246,0.12) 0%,rgba(109,40,217,0.06) 100%)',
    shadow: '0 8px 20px rgba(139,92,246,0.10)',
  },
  night: {
    border: 'rgba(255,191,31,0.28)',
    overlay: 'linear-gradient(135deg,rgba(255,191,31,0.10) 0%,rgba(234,179,8,0.05) 100%)',
    shadow: '0 8px 20px rgba(255,191,31,0.08)',
  },
};

// Legacy gradient colours kept for any existing consumers
const GRADIENTS = {
  morning: { from: 'rgba(255,237,213,0.7)', to: 'rgba(254,215,170,0.7)', textColor: '#9A3412', label: 'завтрака' },
  afternoon: { from: 'rgba(134,239,172,0.7)', to: 'rgba(74,222,128,0.7)', textColor: '#166534', label: 'обеда' },
  evening: { from: 'rgba(191,219,254,0.7)', to: 'rgba(147,197,253,0.7)', textColor: '#1E40AF', label: 'ужина' },
  night: { from: 'rgba(196,181,253,0.7)', to: 'rgba(167,139,250,0.7)', textColor: '#5B21B6', label: 'перекуса' },
} as const;

function getTimeOfDay(): TimeOfDay {
  const hour = new Date().getHours();
  if (hour >= 6 && hour < 11) return 'morning';
  if (hour >= 11 && hour < 16) return 'afternoon';
  if (hour >= 16 && hour < 22) return 'evening';
  return 'night';
}

export function useTimeBasedGradient(
  _isDark: boolean = false,
  updateInterval: number = 60000,
): GradientColors & { gradient: string } {
  const [timeOfDay, setTimeOfDay] = useState<TimeOfDay>(() => getTimeOfDay());

  useEffect(() => {
    const update = () => setTimeOfDay(getTimeOfDay());
    update();
    const id = setInterval(update, updateInterval);
    return () => clearInterval(id);
  }, [updateInterval]);

  const g = GRADIENTS[timeOfDay];
  const gradient = `linear-gradient(135deg,${g.from},${g.to})`;

  return {
    gradient,
    from: g.from,
    to: g.to,
    textColor: g.textColor,
    timeOfDay,
    label: g.label,
    colors: TIME_COLORS[timeOfDay],
  };
}

export function useTimeBasedGradientVars(_isDark: boolean = false) {
  const { from, to, textColor } = useTimeBasedGradient(_isDark);
  return {
    '--gradient-from': from,
    '--gradient-to': to,
    '--gradient-text': textColor,
  } as React.CSSProperties;
}

export function getTimeBasedGradientStatic(
  _isDark: boolean = false,
  customTime?: TimeOfDay,
): GradientColors & { gradient: string } {
  const timeOfDay = customTime || getTimeOfDay();
  const g = GRADIENTS[timeOfDay];
  const gradient = `linear-gradient(135deg,${g.from},${g.to})`;
  return {
    gradient,
    from: g.from,
    to: g.to,
    textColor: g.textColor,
    timeOfDay,
    label: g.label,
    colors: TIME_COLORS[timeOfDay],
  };
}
