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
  peach: "border-l-4 border-orange-500 bg-white dark:bg-gray-800 border-t border-r border-b border-gray-200 dark:border-gray-700",
  lavender: "border-l-4 border-purple-500 bg-white dark:bg-gray-800 border-t border-r border-b border-gray-200 dark:border-gray-700",
  sky: "border-l-4 border-blue-500 bg-white dark:bg-gray-800 border-t border-r border-b border-gray-200 dark:border-gray-700",
  sage: "border-l-4 border-green-500 bg-white dark:bg-gray-800 border-t border-r border-b border-gray-200 dark:border-gray-700",
  rose: "border-l-4 border-red-500 bg-white dark:bg-gray-800 border-t border-r border-b border-gray-200 dark:border-gray-700",
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
              <h3 className="text-3xl font-semibold tracking-tight">
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
