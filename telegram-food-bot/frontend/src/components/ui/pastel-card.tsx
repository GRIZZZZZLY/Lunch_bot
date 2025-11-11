import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "./card"

const pastelCardVariants = cva(
  "transition-colors duration-200",
  {
    variants: {
      variant: {
        peach: "border-pastel-peach-200 bg-pastel-peach-50 dark:border-pastel-peach-700 dark:bg-pastel-peach-950",
        lavender: "border-pastel-lavender-200 bg-pastel-lavender-50 dark:border-pastel-lavender-700 dark:bg-pastel-lavender-950",
        sky: "border-pastel-sky-200 bg-pastel-sky-50 dark:border-pastel-sky-700 dark:bg-pastel-sky-950",
        sage: "border-pastel-sage-200 bg-pastel-sage-50 dark:border-pastel-sage-700 dark:bg-pastel-sage-950",
        rose: "border-pastel-rose-200 bg-pastel-rose-50 dark:border-pastel-rose-700 dark:bg-pastel-rose-950",
        default: "border-border bg-card dark:border-border dark:bg-card",
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

export { PastelCard, pastelCardVariants, CardHeader, CardTitle, CardDescription, CardContent, CardFooter }
