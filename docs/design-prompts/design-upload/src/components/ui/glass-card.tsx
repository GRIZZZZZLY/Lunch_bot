import * as React from "react"
import { cn } from "@/lib/utils"

export interface GlassCardProps extends React.HTMLAttributes<HTMLDivElement> {
  /**
   * Intensity of glassmorphism effect (low, medium, high, ultra) or solid gradient
   */
  intensity?: "low" | "medium" | "high" | "ultra" | "solid"
  /**
   * Enable hover animation
   */
  hover?: boolean
}

/**
 * GlassCard - Карточка с glassmorphism эффектом
 * 
 * @example
 * <GlassCard intensity="medium" hover>
 *   <h3>Title</h3>
 *   <p>Content</p>
 * </GlassCard>
 */
export const GlassCard = React.forwardRef<HTMLDivElement, GlassCardProps>(
  ({ className, intensity = "medium", hover = false, children, ...props }, ref) => {
    const intensityClasses = {
      low: "bg-white/55 dark:bg-card/55 backdrop-blur-sm border-white/30 dark:border-white/5",
      medium: "bg-white/72 dark:bg-card/72 backdrop-blur-md border-border/60",
      high: "bg-white/86 dark:bg-card/84 backdrop-blur-lg border-border/70",
      ultra: "bg-white/78 dark:bg-card/80 backdrop-blur-xl border-border/60",
      solid: "bg-card dark:bg-card border-border",
    }

    return (
      <div
        ref={ref}
        className={cn(
          // Base styles - улучшенные тени и радиусы
          "rounded-card-lg border transition-all duration-300",
          "shadow-[0_6px_18px_rgba(33,24,13,0.06)] dark:shadow-[0_8px_24px_rgba(0,0,0,0.22)]",
          // Glassmorphism effect or solid gradient
          intensityClasses[intensity],
          // Hover effect с улучшенной тенью
          hover && "hover:-translate-y-0.5 hover:shadow-[0_12px_28px_rgba(33,24,13,0.08)] dark:hover:shadow-[0_12px_28px_rgba(0,0,0,0.28)]",
          // Custom classes
          className
        )}
        {...props}
      >
        {children}
      </div>
    )
  }
)

GlassCard.displayName = "GlassCard"

/**
 * GlassCardContent - Content wrapper with padding
 */
export const GlassCardContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("p-6", className)}
    {...props}
  />
))

GlassCardContent.displayName = "GlassCardContent"

/**
 * GlassCardHeader - Header with title and description
 */
export const GlassCardHeader = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex flex-col gap-2 p-6 pb-3", className)}
    {...props}
  />
))

GlassCardHeader.displayName = "GlassCardHeader"

/**
 * GlassCardTitle - Title text
 */
export const GlassCardTitle = React.forwardRef<
  HTMLHeadingElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <h3
    ref={ref}
    className={cn("text-xl font-semibold leading-tight tracking-tight", className)}
    {...props}
  />
))

GlassCardTitle.displayName = "GlassCardTitle"

/**
 * GlassCardDescription - Description text
 */
export const GlassCardDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p
    ref={ref}
    className={cn("text-sm text-muted-foreground", className)}
    {...props}
  />
))

GlassCardDescription.displayName = "GlassCardDescription"

/**
 * GlassCardFooter - Footer with actions
 */
export const GlassCardFooter = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex items-center p-6 pt-3", className)}
    {...props}
  />
))

GlassCardFooter.displayName = "GlassCardFooter"
