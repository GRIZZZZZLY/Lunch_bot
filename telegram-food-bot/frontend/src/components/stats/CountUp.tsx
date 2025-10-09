import React, { useEffect, useState } from 'react';
import { motion, useSpring, useTransform } from 'framer-motion';

interface CountUpProps {
  end: number;
  duration?: number;
  decimals?: number;
  className?: string;
}

/**
 * Animated counter component
 * Плавная анимация подсчёта от 0 до end
 */
export const CountUp: React.FC<CountUpProps> = ({
  end,
  duration = 1.5,
  decimals = 0,
  className = '',
}) => {
  const [displayValue, setDisplayValue] = useState(0);
  
  const spring = useSpring(0, {
    duration: duration * 1000,
    bounce: 0,
  });

  const rounded = useTransform(spring, (latest) => {
    return decimals > 0
      ? latest.toFixed(decimals)
      : Math.round(latest).toString();
  });

  useEffect(() => {
    spring.set(end);
    
    const unsubscribe = rounded.on('change', (latest) => {
      setDisplayValue(parseFloat(latest));
    });

    return () => unsubscribe();
  }, [end, spring, rounded]);

  return (
    <motion.span
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={className}
    >
      {displayValue}
    </motion.span>
  );
};
