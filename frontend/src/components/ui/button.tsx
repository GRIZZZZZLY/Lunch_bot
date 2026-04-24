import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap font-semibold transition-all duration-150 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-1 focus-visible:ring-offset-background active:scale-[0.97]",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/92 shadow-[0_2px_8px_hsl(var(--primary)/0.30)] hover:shadow-[0_4px_12px_hsl(var(--primary)/0.38)]",
        destructive:
          "bg-destructive text-destructive-foreground hover:bg-destructive/92 shadow-[0_2px_8px_hsl(var(--destructive)/0.28)]",
        outline:
          "border-[1.5px] border-border bg-transparent hover:bg-muted/60 text-foreground",
        secondary:
          "bg-muted text-foreground hover:bg-muted/80",
        ghost:
          "hover:bg-muted/80 text-muted-foreground hover:text-foreground",
        link: "text-primary underline-offset-4 hover:underline",

        // ✅ SEMANTIC VARIANTS
        success: "bg-success text-success-foreground hover:bg-success/90 shadow-[0_2px_8px_hsl(var(--success)/0.28)]",
        warning: "bg-warning text-warning-foreground hover:bg-warning/90 shadow-[0_2px_8px_hsl(var(--warning)/0.28)]",
        danger: "bg-destructive text-destructive-foreground hover:bg-destructive/92 shadow-[0_2px_8px_hsl(var(--destructive)/0.28)]",
        info: "bg-accent text-accent-foreground hover:bg-accent/90 shadow-[0_2px_8px_hsl(var(--accent)/0.22)]",

        // Legacy gradient variants — сохранены для обратной совместимости,
        // но рекомендуется заменять на default (автоматически адаптируется по теме)
        peach: "bg-gradient-to-r from-peach-500 to-coral-500 text-white hover:opacity-95 shadow-sm hover:shadow-md",
        mint: "bg-gradient-to-r from-mint-500 to-mint-600 text-white hover:opacity-95 shadow-sm hover:shadow-md",
        lavender: "bg-gradient-to-r from-lavender-500 to-lavender-600 text-white hover:opacity-95 shadow-sm hover:shadow-md",
        coral: "bg-gradient-to-r from-coral-500 to-coral-600 text-white hover:opacity-95 shadow-sm hover:shadow-md",
        butter: "bg-gradient-to-r from-butter-500 to-butter-600 text-gray-900 hover:opacity-95 shadow-sm hover:shadow-md",
      },
      size: {
        default: "h-11 min-h-[44px] px-5 text-[15px] rounded-[12px]",
        sm:      "h-9  min-h-[36px] px-[14px] text-[13px] rounded-[10px]",
        lg:      "h-[52px] min-h-[52px] px-7 text-[16px] rounded-[14px]",
        icon:    "size-11 min-w-[44px] min-h-[44px] rounded-[12px]",
        "icon-sm": "size-9 rounded-[10px]",
        "icon-lg": "size-12 rounded-[14px]",
        fab:     "size-14 rounded-[18px]",
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
