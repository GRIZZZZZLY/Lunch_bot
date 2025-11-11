import * as React from "react"
import { Card, CardContent } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import { TrendingUp, TrendingDown } from "lucide-react"
import { ICON_SIZES } from "@/lib/design-tokens"

interface Stats01Props {
  title: string
  value: string | number
  description?: string
  trend?: {
    value: number
    direction: "up" | "down"
  }
  icon?: React.ReactNode
  variant?: "peach" | "lavender" | "sky" | "sage" | "rose" | "default"
  className?: string
}

const variantStyles = {
  peach: "border-pastel-peach-200 bg-pastel-peach-50 dark:border-pastel-peach-700 dark:bg-pastel-peach-950",
  lavender: "border-pastel-lavender-200 bg-pastel-lavender-50 dark:border-pastel-lavender-700 dark:bg-pastel-lavender-950",
  sky: "border-pastel-sky-200 bg-pastel-sky-50 dark:border-pastel-sky-700 dark:bg-pastel-sky-950",
  sage: "border-pastel-sage-200 bg-pastel-sage-50 dark:border-pastel-sage-700 dark:bg-pastel-sage-950",
  rose: "border-pastel-rose-200 bg-pastel-rose-50 dark:border-pastel-rose-700 dark:bg-pastel-rose-950",
  default: "border-border bg-card dark:border-border dark:bg-card",
}

/**
 * Stats Card 01 - Базовая карточка статистики
 * Использует pastel палитру и дизайн shadcn
 */
export const Stats01: React.FC<Stats01Props> = ({
  title,
  value,
  description,
  trend,
  icon,
  variant = "default",
  className,
}) => {
  return (
    <Card className={cn(variantStyles[variant], className)}>
      <CardContent className="pt-6">
        <div className="flex items-start justify-between">
          <div className="space-y-2">
            <p className="text-sm font-medium text-muted-foreground">
              {title}
            </p>
            <div className="flex items-baseline gap-2">
              <h3 className="text-3xl font-bold tracking-tight">
                {value}
              </h3>
              {trend && (
                <div
                  className={cn(
                    "flex items-center gap-1 text-sm font-medium",
                    trend.direction === "up"
                      ? "text-green-600 dark:text-green-400"
                      : "text-red-600 dark:text-red-400"
                  )}
                >
                  {trend.direction === "up" ? (
                    <TrendingUp className={ICON_SIZES.sm} />
                  ) : (
                    <TrendingDown className={ICON_SIZES.sm} />
                  )}
                  <span>{trend.value}%</span>
                </div>
              )}
            </div>
            {description && (
              <p className="text-sm text-muted-foreground">
                {description}
              </p>
            )}
          </div>
          {icon && (
            <div className="rounded-lg bg-white/50 dark:bg-gray-800/50 p-2.5">
              {icon}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
