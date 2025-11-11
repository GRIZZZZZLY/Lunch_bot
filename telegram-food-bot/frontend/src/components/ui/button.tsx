import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-medium transition-all disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current active:scale-95",
  {
    variants: {
      variant: {
        default: "bg-gradient-to-br from-primary via-primary to-primary/90 text-primary-foreground hover:from-primary/95 hover:via-primary/90 hover:to-primary/85 shadow-lg hover:shadow-xl active:shadow-md",
        destructive:
          "bg-gradient-to-br from-destructive via-destructive to-destructive/90 text-white hover:from-destructive/95 hover:via-destructive/90 hover:to-destructive/85 shadow-lg hover:shadow-xl active:shadow-md",
        outline:
          "border-[1.5px] border-gray-300 dark:border-gray-600 bg-white/50 dark:bg-gray-800/50 hover:bg-gray-100 dark:hover:bg-gray-700 hover:border-gray-400 dark:hover:border-gray-500",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        ghost:
          "hover:bg-gray-100 dark:hover:bg-gray-800",
        link: "text-primary underline-offset-4 hover:underline",
        
        // ✅ SEMANTIC VARIANTS - Intent-based design (NEW!)
        success: "bg-mint-500 hover:bg-mint-600 active:bg-mint-700 text-white shadow-md hover:shadow-lg hover:shadow-mint-500/30 dark:bg-mint-600 dark:hover:bg-mint-500",
        warning: "bg-butter-500 hover:bg-butter-600 active:bg-butter-700 text-gray-900 shadow-md hover:shadow-lg hover:shadow-butter-500/30 dark:bg-butter-600 dark:hover:bg-butter-500",
        danger: "bg-coral-500 hover:bg-coral-600 active:bg-coral-700 text-white shadow-md hover:shadow-lg hover:shadow-coral-500/30 dark:bg-coral-600 dark:hover:bg-coral-500",
        info: "bg-lavender-500 hover:bg-lavender-600 active:bg-lavender-700 text-white shadow-md hover:shadow-lg hover:shadow-lavender-500/30 dark:bg-lavender-600 dark:hover:bg-lavender-500",
        
        // Gradient variants - унифицированные с GradientButton
        peach: "bg-gradient-to-r from-peach-500 to-coral-500 text-white hover:from-peach-600 hover:to-coral-600 shadow-lg hover:shadow-[0_10px_30px_rgba(255,120,81,0.4)]",
        mint: "bg-gradient-to-r from-mint-500 to-mint-600 text-white hover:from-mint-600 hover:to-mint-700 shadow-lg hover:shadow-[0_10px_30px_rgba(92,174,135,0.4)]",
        lavender: "bg-gradient-to-r from-lavender-500 to-lavender-600 text-white hover:from-lavender-600 hover:to-lavender-700 shadow-lg hover:shadow-[0_10px_30px_rgba(139,92,246,0.4)]",
        coral: "bg-gradient-to-r from-coral-500 to-coral-600 text-white hover:from-coral-600 hover:to-coral-700 shadow-lg hover:shadow-[0_10px_30px_rgba(255,90,74,0.4)]",
        butter: "bg-gradient-to-r from-butter-500 to-butter-600 text-gray-900 hover:from-butter-600 hover:to-butter-700 shadow-lg hover:shadow-[0_10px_30px_rgba(255,191,31,0.4)]",
      },
      size: {
        default: "h-11 px-6 py-2 rounded-xl",
        sm: "h-9 px-3 text-sm rounded-lg",
        lg: "h-14 px-8 text-lg rounded-2xl font-semibold",
        icon: "size-10 rounded-xl",
        "icon-sm": "size-8 rounded-lg",
        "icon-lg": "size-12 rounded-2xl",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

interface ButtonProps extends React.ComponentProps<"button">,
  VariantProps<typeof buttonVariants> {
  asChild?: boolean
  /**
   * Add shimmer animation effect (works best with gradient variants)
   */
  shimmer?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, shimmer = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"

    return (
      <Comp
        ref={ref}
        data-slot="button"
        className={cn(
          buttonVariants({ variant, size }),
          shimmer && "relative overflow-hidden",
          shimmer && "before:absolute before:inset-0 before:bg-gradient-to-r before:from-transparent before:via-white/20 before:to-transparent before:translate-x-[-200%] hover:before:translate-x-[200%] before:transition-transform before:duration-1000",
          className
        )}
        {...props}
      />
    )
  }
)

Button.displayName = "Button"

export { Button, buttonVariants }
