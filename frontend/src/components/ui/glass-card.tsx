import * as React from "react"
import { cn } from "@/lib/utils"

export interface GlassCardProps extends React.HTMLAttributes<HTMLDivElement> {
  /**
   * Intensity of glassmorphism effect (low, medium, high) or solid gradient
   */
  intensity?: "low" | "medium" | "high" | "solid"
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
      low: "bg-white/5 dark:bg-black/10 backdrop-blur-sm border-white/10",
      medium: "bg-white/10 dark:bg-black/20 backdrop-blur-md border-white/15",
      high: "bg-white/20 dark:bg-black/30 backdrop-blur-xl border-white/20",
      solid: "bg-card dark:bg-card border-border",
    }

    return (
      <div
        ref={ref}
        className={cn(
          // Base styles - улучшенные тени и радиусы
          "rounded-card-lg border transition-all duration-300",
          // Улучшенные тени для эффекта "всплытия"
          "shadow-[0_4px_12px_rgba(0,0,0,0.08)] dark:shadow-[0_4px_12px_rgba(0,0,0,0.3)]",
          // Glassmorphism effect or solid gradient
          intensityClasses[intensity],
          // Hover effect с улучшенной тенью
          hover && "hover:scale-[1.02] hover:shadow-[0_8px_24px_rgba(0,0,0,0.12)] dark:hover:shadow-[0_8px_24px_rgba(0,0,0,0.4)] hover:shadow-primary/15",
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
    className={cn("text-2xl font-bold leading-none tracking-tight", className)}
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
