import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center justify-center rounded-md border px-2 py-0.5 text-xs font-medium w-fit whitespace-nowrap shrink-0 [&>svg]:size-3 gap-1 [&>svg]:pointer-events-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive transition-[color,box-shadow] overflow-hidden",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-primary text-primary-foreground [a&]:hover:bg-primary/90",
        secondary:
          "border-transparent bg-secondary text-secondary-foreground [a&]:hover:bg-secondary/90",
        destructive:
          "border-transparent bg-destructive text-white [a&]:hover:bg-destructive/90 focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40 dark:bg-destructive/60",
        outline:
          "text-foreground [a&]:hover:bg-accent [a&]:hover:text-accent-foreground",
        
        // ✅ SEMANTIC VARIANTS - Intent-based design (NEW!)
        success:
          "border-transparent bg-mint-500/10 text-mint-700 border-mint-500/20 dark:bg-mint-500/20 dark:text-mint-300 dark:border-mint-500/30 [a&]:hover:bg-mint-500/20",
        warning:
          "border-transparent bg-butter-500/10 text-butter-700 border-butter-500/20 dark:bg-butter-500/20 dark:text-butter-300 dark:border-butter-500/30 [a&]:hover:bg-butter-500/20",
        danger:
          "border-transparent bg-coral-500/10 text-coral-700 border-coral-500/20 dark:bg-coral-500/20 dark:text-coral-300 dark:border-coral-500/30 [a&]:hover:bg-coral-500/20",
        info:
          "border-transparent bg-lavender-500/10 text-lavender-700 border-lavender-500/20 dark:bg-lavender-500/20 dark:text-lavender-300 dark:border-lavender-500/30 [a&]:hover:bg-lavender-500/20",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function Badge({
  className,
  variant,
  asChild = false,
  ...props
}: React.ComponentProps<"span"> &
  VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : "span"

  return (
    <Comp
      data-slot="badge"
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    />
  )
}

export { Badge, badgeVariants }
