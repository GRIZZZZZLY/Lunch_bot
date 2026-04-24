import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-medium transition-all disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current active:scale-[0.98]",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm hover:shadow-md",
        destructive:
          "bg-destructive text-white hover:bg-destructive/90 shadow-sm hover:shadow-md",
        outline:
          "border border-border bg-card/92 hover:bg-muted/70 text-foreground shadow-none",
        secondary:
          "bg-muted text-foreground hover:bg-muted/80",
        ghost:
          "hover:bg-muted/80 text-muted-foreground hover:text-foreground",
        link: "text-primary underline-offset-4 hover:underline",
        
        // ✅ SEMANTIC VARIANTS - Intent-based design (NEW!)
        success: "bg-mint-500 hover:bg-mint-600 text-white shadow-sm hover:shadow-md",
        warning: "bg-butter-500 hover:bg-butter-600 text-gray-900 shadow-sm hover:shadow-md",
        danger: "bg-coral-500 hover:bg-coral-600 text-white shadow-sm hover:shadow-md",
        info: "bg-lavender-500 hover:bg-lavender-600 text-white shadow-sm hover:shadow-md",
        
        // Gradient variants - унифицированные с GradientButton
        peach: "bg-gradient-to-r from-peach-500 to-coral-500 text-white hover:opacity-95 shadow-sm hover:shadow-md",
        mint: "bg-gradient-to-r from-mint-500 to-mint-600 text-white hover:opacity-95 shadow-sm hover:shadow-md",
        lavender: "bg-gradient-to-r from-lavender-500 to-lavender-600 text-white hover:opacity-95 shadow-sm hover:shadow-md",
        coral: "bg-gradient-to-r from-coral-500 to-coral-600 text-white hover:opacity-95 shadow-sm hover:shadow-md",
        butter: "bg-gradient-to-r from-butter-500 to-butter-600 text-gray-900 hover:opacity-95 shadow-sm hover:shadow-md",
      },
      size: {
        default: "h-11 px-5 py-2 rounded-xl",
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

export { Button }
