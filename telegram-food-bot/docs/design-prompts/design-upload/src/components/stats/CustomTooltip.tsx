import { motion } from 'framer-motion';
import { cn } from '../../lib/utils';

interface TooltipEntry {
  color?: string;
  name?: string;
  dataKey?: string;
  value: number;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: TooltipEntry[];
  label?: string;
  formatter?: (value: number) => string;
}

/**
 * Custom Tooltip для recharts графиков
 * Glassmorphism стиль с анимацией
 */
export const CustomTooltip = ({
  active,
  payload,
  label,
  formatter = (value) => value.toString(),
}: CustomTooltipProps) => {
  if (!active || !payload || payload.length === 0) {
    return null;
  }

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      transition={{ duration: 0.15 }}
      className={cn(
        "rounded-xl border border-border/50 shadow-lg",
        "bg-background/95 backdrop-blur-md",
        "p-3 min-w-[120px]"
      )}
    >
      {label && (
        <p className="text-sm font-medium text-foreground mb-2">
          {label}
        </p>
      )}
      
      <div className="space-y-1">
        {payload.map((entry, index) => (
          <div key={`tooltip-item-${index}`} className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <div
                className="size-2.5 rounded-full"
                style={{ backgroundColor: entry.color }}
              />
              <span className="text-xs text-muted-foreground">
                {entry.name || entry.dataKey}
              </span>
            </div>
            <span className="text-sm font-semibold text-foreground">
              {formatter(entry.value)}
            </span>
          </div>
        ))}
      </div>
    </motion.div>
  );
};
