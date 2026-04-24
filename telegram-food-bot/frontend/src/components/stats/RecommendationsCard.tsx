import React from 'react';
import { motion } from 'framer-motion';
import { Sparkles } from 'lucide-react';
import { PastelCard, CardContent } from '../ui/pastel-card';
import { cn } from '@/lib/utils';
import { ICON_SIZES } from '@/lib/design-tokens';
import type { Recommendation } from '@/services/insights.service';

interface RecommendationsCardProps {
  recommendations: Recommendation[];
  className?: string;
}

const algorithmLabels: Record<string, string> = {
  category: 'По вашим предпочтениям',
  collaborative: 'Рекомендации коллег',
  diversity: 'Для разнообразия',
};

/**
 * Карточка рекомендаций с ежедневной ротацией алгоритмов
 */
export const RecommendationsCard: React.FC<RecommendationsCardProps> = ({
  recommendations,
  className,
}) => {
  if (recommendations.length === 0) return null;

  const algorithm = recommendations[0]?.algorithm;
  const label = algorithmLabels[algorithm] || 'Рекомендации';

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: 0.1 }}
      className={className}
    >
      <PastelCard variant="default" className="overflow-hidden">
        <CardContent className="p-4">
          {/* Header */}
          <div className="flex items-center gap-2 mb-3">
            <div className="p-1.5 rounded-lg bg-lavender-500/12">
              <Sparkles className={cn(ICON_SIZES.sm, 'text-lavender-500')} />
            </div>
            <div>
              <h4 className="text-sm font-semibold text-foreground">
                Рекомендации
              </h4>
              <p className="text-[11px] text-muted-foreground">
                {label}
              </p>
            </div>
          </div>

          {/* Recommendations list */}
          <div className="space-y-2.5">
            {recommendations.map((rec, index) => (
              <motion.div
                key={rec.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.15 + index * 0.08 }}
                className={cn(
                  'flex items-start gap-3 p-3 rounded-xl border border-border/60',
                  'bg-card/75 hover:bg-muted/35',
                  'transition-colors duration-200'
                )}
              >
                <span className="text-xl flex-shrink-0 mt-0.5">
                  {rec.icon}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground">
                    {rec.title}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                    {rec.description}
                  </p>
                </div>
              </motion.div>
            ))}
          </div>
        </CardContent>
      </PastelCard>
    </motion.div>
  );
};
