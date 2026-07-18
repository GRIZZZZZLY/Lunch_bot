import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "./card"

const pastelCardVariants = cva(
  "transition-colors duration-200",
  {
    variants: {
      variant: {
        peach: "border-peach-500/20 bg-peach-500/8 dark:border-peach-400/14 dark:bg-peach-400/10",
        lavender: "border-lavender-500/20 bg-lavender-500/8 dark:border-lavender-400/14 dark:bg-lavender-400/10",
        sky: "border-sky-400/20 bg-sky-400/8 dark:border-sky-300/14 dark:bg-sky-300/10",
        sage: "border-mint-500/20 bg-mint-500/8 dark:border-mint-400/14 dark:bg-mint-400/10",
        rose: "border-coral-500/20 bg-coral-500/8 dark:border-coral-400/14 dark:bg-coral-400/10",
        glass: "bg-white/70 dark:bg-card/72 backdrop-blur-md border-border/60",
        default: "border border-border/80 bg-card dark:border-white/[0.07] shadow-[0_1px_4px_rgba(33,20,10,0.06)] dark:shadow-none",
      },
    },
    defaultVariants: {
      variant: "default",
    }
  }
)

export interface PastelCardProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof pastelCardVariants> {}

const PastelCard = React.forwardRef<HTMLDivElement, PastelCardProps>(
  ({ className, variant, ...props }, ref) => (
    <Card
      ref={ref}
      className={cn(pastelCardVariants({ variant }), className)}
      {...props}
    />
  )
)
PastelCard.displayName = "PastelCard"

export { PastelCard, CardHeader, CardTitle, CardDescription, CardContent }
