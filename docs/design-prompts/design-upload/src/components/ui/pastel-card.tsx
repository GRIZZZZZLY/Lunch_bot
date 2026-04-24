import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "./card"

const pastelCardVariants = cva(
  "transition-colors duration-200",
  {
    variants: {
      variant: {
        peach: "border-peach-500/15 bg-peach-500/6 dark:border-peach-400/12 dark:bg-peach-400/8",
        lavender: "border-lavender-500/15 bg-lavender-500/6 dark:border-lavender-400/12 dark:bg-lavender-400/8",
        sky: "border-sky-400/15 bg-sky-400/6 dark:border-sky-300/12 dark:bg-sky-300/8",
        sage: "border-mint-500/15 bg-mint-500/6 dark:border-mint-400/12 dark:bg-mint-400/8",
        rose: "border-coral-500/15 bg-coral-500/6 dark:border-coral-400/12 dark:bg-coral-400/8",
        glass: "bg-white/70 dark:bg-card/72 backdrop-blur-md border-border/60",
        default: "border-border/70 bg-card/95 dark:border-border/80 dark:bg-card/96 shadow-[0_6px_18px_rgba(33,24,13,0.04)] dark:shadow-[0_8px_20px_rgba(0,0,0,0.16)]",
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

export { PastelCard, CardHeader, CardTitle, CardDescription, CardContent, CardFooter }
