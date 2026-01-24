import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const gradientButtonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-2xl text-sm font-semibold transition-all disabled:pointer-events-none disabled:opacity-50 active:scale-95",
  {
    variants: {
      variant: {
        // 🍑 Peach gradient (Food primary) - персиковый для светлой темы, фиолетовый для тёмной
        peach: "bg-gradient-to-r from-peach-500 to-coral-500 text-white hover:shadow-[0_10px_30px_rgba(255,120,81,0.4)] dark:from-purple-500 dark:to-violet-500 dark:hover:shadow-[0_10px_30px_rgba(139,92,246,0.4)]",
        
        // 🌿 Mint gradient (Success)
        mint: "bg-gradient-to-r from-mint-500 to-mint-600 text-white hover:shadow-[0_10px_30px_rgba(92,174,135,0.4)] dark:from-mint-300 dark:to-mint-400 dark:text-black",
        
        // 💜 Lavender gradient (Premium)
        lavender: "bg-gradient-to-r from-lavender-500 to-lavender-600 text-white hover:shadow-[0_10px_30px_rgba(139,92,246,0.4)] dark:from-lavender-300 dark:to-lavender-400 dark:text-black",
        
        // 🔴 Coral gradient (Energy)
        coral: "bg-gradient-to-r from-coral-500 to-coral-600 text-white hover:shadow-[0_10px_30px_rgba(255,90,74,0.4)] dark:from-coral-300 dark:to-coral-400 dark:text-black",
        
        // 🌟 Butter gradient (Warning)
        butter: "bg-gradient-to-r from-butter-500 to-butter-600 text-black hover:shadow-[0_10px_30px_rgba(255,191,31,0.4)] dark:from-butter-300 dark:to-butter-400",
        
        // 🎨 Blue-Violet gradient (Premium feel)
        premium: "bg-gradient-to-r from-[#667eea] to-[#764ba2] text-white hover:shadow-[0_10px_30px_rgba(102,126,234,0.4)]",
        
        // ⚫ Subtle gradient (Dark mode)
        subtle: "bg-gradient-to-r from-card to-card/80 text-foreground border hover:shadow-lg",
      },
      size: {
        default: "h-10 px-6 py-2",
        sm: "h-8 rounded-xl px-4 text-xs",
        lg: "h-12 rounded-2xl px-8 text-base",
        icon: "size-10",
      },
    },
    defaultVariants: {
      variant: "peach",
      size: "default",
    },
  }
)

export interface GradientButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof gradientButtonVariants> {
  asChild?: boolean
  /**
   * Add shimmer animation effect
   */
  shimmer?: boolean
}

/**
 * GradientButton - Кнопка с градиентным фоном
 * 
 * @example
 * <GradientButton variant="peach" size="lg">
 *   Голосовать
 * </GradientButton>
 * 
 * @example
 * <GradientButton variant="lavender" shimmer>
 *   Premium действие
 * </GradientButton>
 */
const GradientButton = React.forwardRef<HTMLButtonElement, GradientButtonProps>(
  ({ className, variant, size, asChild = false, shimmer = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    
    return (
      <Comp
        className={cn(
          gradientButtonVariants({ variant, size }),
          shimmer && "relative overflow-hidden",
          shimmer && "before:absolute before:inset-0 before:bg-gradient-to-r before:from-transparent before:via-white/20 before:to-transparent before:translate-x-[-200%] hover:before:translate-x-[200%] before:transition-transform before:duration-1000",
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)

GradientButton.displayName = "GradientButton"

export { GradientButton, gradientButtonVariants }
