import { useCallback, useEffect, useRef, useState } from 'react';
import { motion, useMotionValue, animate, PanInfo } from 'framer-motion';
import { Star } from 'lucide-react';

interface StarsSliderProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  checkpoints?: number[];
}

const THUMB_SIZE = 18;

export const StarsSlider = ({
  value,
  onChange,
  min = 1,
  max = 1000,
  checkpoints = [10, 50, 100, 500, 1000],
}: StarsSliderProps) => {
  const trackRef = useRef<HTMLDivElement>(null);
  const [trackWidth, setTrackWidth] = useState(0);
  const x = useMotionValue(0);

  // Логарифмическая шкала: для широкого диапазона (1..1000) даёт более
  // равномерное распределение точек на оси, чтобы малые чекпоинты (10/50/100)
  // не слипались слева. log(1)=0, log(1000)≈6.9.
  const logMin = Math.log(min);
  const logMax = Math.log(max);
  const valueToRatio = useCallback(
    (v: number) => {
      const clamped = Math.max(min, Math.min(max, v));
      return (Math.log(clamped) - logMin) / (logMax - logMin);
    },
    [min, max, logMin, logMax]
  );
  const ratioToValue = useCallback(
    (r: number) => {
      const clamped = Math.max(0, Math.min(1, r));
      return Math.round(Math.exp(logMin + clamped * (logMax - logMin)));
    },
    [logMin, logMax]
  );

  // Подписка на ширину трэка через ResizeObserver — нужно для конвертации
  // координат в значение слайдера на любом viewport.
  useEffect(() => {
    if (!trackRef.current) return;
    const el = trackRef.current;
    const update = () => setTrackWidth(el.clientWidth);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const usableWidth = Math.max(0, trackWidth - THUMB_SIZE);

  // Синхронизация позиции thumb с value (когда value изменяется извне или
  // через клик по чекпоинту). Анимация — мягкая пружина.
  useEffect(() => {
    if (usableWidth === 0) return;
    const targetX = valueToRatio(value) * usableWidth;
    const controls = animate(x, targetX, {
      type: 'spring',
      stiffness: 400,
      damping: 35,
    });
    return () => controls.stop();
  }, [value, usableWidth, valueToRatio, x]);

  const xToValue = useCallback(
    (xVal: number) => {
      if (usableWidth === 0) return min;
      return ratioToValue(xVal / usableWidth);
    },
    [usableWidth, min, ratioToValue]
  );

  const handleDrag = useCallback(
    (_: unknown, info: PanInfo) => {
      const rect = trackRef.current?.getBoundingClientRect();
      if (!rect) return;
      const localX = info.point.x - rect.left - THUMB_SIZE / 2;
      onChange(xToValue(localX));
    },
    [onChange, xToValue]
  );

  const handleTrackPointer = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      const rect = trackRef.current?.getBoundingClientRect();
      if (!rect) return;
      const localX = e.clientX - rect.left - THUMB_SIZE / 2;
      onChange(xToValue(localX));
    },
    [onChange, xToValue]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowLeft':
        case 'ArrowDown':
          e.preventDefault();
          onChange(Math.max(min, value - 1));
          break;
        case 'ArrowRight':
        case 'ArrowUp':
          e.preventDefault();
          onChange(Math.min(max, value + 1));
          break;
        case 'PageDown':
          e.preventDefault();
          onChange(Math.max(min, value - 10));
          break;
        case 'PageUp':
          e.preventDefault();
          onChange(Math.min(max, value + 10));
          break;
        case 'Home':
          e.preventDefault();
          onChange(min);
          break;
        case 'End':
          e.preventDefault();
          onChange(max);
          break;
      }
    },
    [onChange, value, min, max]
  );

  const ratio = valueToRatio(value);

  // Позиция точки/лейбла чекпоинта в пикселях по центру (учитывает thumb-size,
  // чтобы визуально совпадать с центром thumb на той же позиции).
  const cpLeftPx = (cp: number) =>
    valueToRatio(cp) * usableWidth + THUMB_SIZE / 2;

  return (
    <div className="select-none">
      {/* Большое значение Stars — золотой градиент */}
      <div className="text-center mb-4">
        <motion.span
          key={value}
          initial={{ scale: 0.95 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 500, damping: 25 }}
          className="inline-flex items-center gap-2 text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-[#FFD56B] via-[#FFB73B] to-[#E89B12]"
          style={{ backgroundSize: '200% 100%' }}
        >
          {value}
          <Star className="w-7 h-7 fill-amber-400 text-amber-400 drop-shadow-[0_0_8px_rgba(255,183,59,0.6)]" />
        </motion.span>
      </div>

      {/* Track */}
      <div
        ref={trackRef}
        className="relative h-12 cursor-pointer touch-none"
        onPointerDown={handleTrackPointer}
      >
        {/* Background track */}
        <div className="absolute top-1/2 -translate-y-1/2 left-0 right-0 h-2 rounded-full bg-muted/60" />

        {/* Animated gold fill */}
        <motion.div
          className="absolute top-1/2 -translate-y-1/2 left-0 h-2 rounded-full overflow-hidden pointer-events-none"
          style={{ width: `${ratio * 100}%` }}
        >
          <motion.div
            className="h-full w-full bg-gradient-to-r from-[#FFD56B] via-[#FFEAA0] via-[#FFB73B] to-[#E89B12]"
            style={{ backgroundSize: '200% 100%' }}
            animate={{ backgroundPositionX: ['0%', '200%'] }}
            transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
          />
        </motion.div>

        {/* Checkpoints */}
        {usableWidth > 0 &&
          checkpoints.map((cp) => {
            const isPassed = value >= cp;
            return (
              <button
                key={cp}
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onChange(cp);
                }}
                aria-label={`${cp} Stars`}
                className={`absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-3 h-3 rounded-full border-2 transition-all hover:scale-125 ${
                  isPassed
                    ? 'border-[#FFB73B] bg-[#FFD56B] shadow-[0_0_6px_rgba(255,183,59,0.8)]'
                    : 'border-amber-300/60 bg-background'
                }`}
                style={{ left: `${cpLeftPx(cp)}px` }}
              />
            );
          })}

        {/* Thumb */}
        {usableWidth > 0 && (
          <motion.div
            drag="x"
            dragConstraints={{ left: 0, right: usableWidth }}
            dragMomentum={false}
            dragElastic={0}
            onDrag={handleDrag}
            onKeyDown={handleKeyDown}
            tabIndex={0}
            role="slider"
            aria-valuemin={min}
            aria-valuemax={max}
            aria-valuenow={value}
            aria-label="Сумма поддержки в Stars"
            style={{ x, top: '50%', marginTop: -(THUMB_SIZE / 2), width: THUMB_SIZE, height: THUMB_SIZE }}
            whileTap={{ scale: 1.15 }}
            whileHover={{ scale: 1.08 }}
            className="absolute rounded-full bg-gradient-to-br from-[#FFEAA0] via-[#FFB73B] to-[#C97D04] shadow-md shadow-amber-500/40 ring-1 ring-white/30 cursor-grab active:cursor-grabbing focus:outline-none focus:ring-2 focus:ring-amber-400 focus:ring-offset-1 focus:ring-offset-background"
          />
        )}
      </div>

      {/* Checkpoint labels */}
      {usableWidth > 0 && (
        <div className="relative h-5 mt-1">
          {checkpoints.map((cp) => (
            <span
              key={cp}
              className="absolute -translate-x-1/2 text-[11px] font-medium text-muted-foreground"
              style={{ left: `${cpLeftPx(cp)}px` }}
            >
              {cp}
            </span>
          ))}
        </div>
      )}
    </div>
  );
};
