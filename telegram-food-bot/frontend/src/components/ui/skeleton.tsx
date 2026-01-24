import * as React from "react"
import { cn } from "@/lib/utils"

function Skeleton({ 
  className, 
  shimmer = true,
  ...props 
}: React.ComponentProps<"div"> & { shimmer?: boolean }) {
  return (
    <div
      data-slot="skeleton"
      className={cn(
        "relative overflow-hidden rounded-md",
        shimmer 
          ? "bg-muted/50 before:absolute before:inset-0 before:-translate-x-full before:animate-shimmer before:bg-gradient-to-r before:from-transparent before:via-white/20 before:to-transparent"
          : "bg-muted animate-pulse",
        className
      )}
      {...props}
    />
  )
}

export { Skeleton }
