import * as React from "react"
import { Moon, Sun } from "lucide-react"
import { useAppStore } from "@/store/useAppStore"
import { cn } from "@/lib/utils"
import { Button } from "./button"

export interface ThemeToggleProps extends React.HTMLAttributes<HTMLButtonElement> {
  /**
   * Button variant
   */
  variant?: "default" | "outline" | "ghost"
  /**
   * Button size
   */
  size?: "default" | "sm" | "lg" | "icon"
}

/**
 * ThemeToggle - Переключатель темы (светлая/темная)
 * 
 * @example
 * <ThemeToggle variant="outline" size="icon" />
 */
export const ThemeToggle = React.forwardRef<HTMLButtonElement, ThemeToggleProps>(
  ({ className, variant = "ghost", size = "icon", ...props }, ref) => {
    const theme = useAppStore((state) => state.theme)
    const setTheme = useAppStore((state) => state.setTheme)

    const toggleTheme = () => {
      const newTheme = theme === "dark" ? "light" : "dark"
      setTheme(newTheme)
      
      // Применяем класс dark к <html>
      if (newTheme === "dark") {
        document.documentElement.classList.add("dark")
      } else {
        document.documentElement.classList.remove("dark")
      }
    }

    return (
      <Button
        ref={ref}
        variant={variant}
        size={size}
        onClick={toggleTheme}
        className={cn("relative", className)}
        {...props}
      >
        <Sun className="size-5 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
        <Moon className="absolute size-5 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
        <span className="sr-only">Переключить тему</span>
      </Button>
    )
  }
)

ThemeToggle.displayName = "ThemeToggle"

/**
 * ThemeToggleWithLabel - Переключатель темы с текстовым label
 * 
 * @example
 * <ThemeToggleWithLabel />
 */
export const ThemeToggleWithLabel: React.FC = () => {
  const theme = useAppStore((state) => state.theme)
  const setTheme = useAppStore((state) => state.setTheme)

  const toggleTheme = () => {
    const newTheme = theme === "dark" ? "light" : "dark"
    setTheme(newTheme)
    
    if (newTheme === "dark") {
      document.documentElement.classList.add("dark")
    } else {
      document.documentElement.classList.remove("dark")
    }
  }

  return (
    <button
      onClick={toggleTheme}
      className={cn(
        "inline-flex items-center gap-3 rounded-lg px-4 py-2",
        "transition-colors hover:bg-accent hover:text-accent-foreground"
      )}
    >
      {theme === "dark" ? (
        <Moon className="size-4" />
      ) : (
        <Sun className="size-4" />
      )}
      <span className="text-sm font-medium">
        {theme === "dark" ? "Темная тема" : "Светлая тема"}
      </span>
    </button>
  )
}

ThemeToggleWithLabel.displayName = "ThemeToggleWithLabel"
