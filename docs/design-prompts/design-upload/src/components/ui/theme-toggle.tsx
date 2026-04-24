import * as React from "react"
import { Moon, Sun } from "lucide-react"
import { useAppStore } from "@/store/useAppStore"
import { cn } from "@/lib/utils"
import { ICON_SIZES } from "@/lib/design-tokens"
import { Button } from "./button"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "./popover"

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
        <Sun className={`${ICON_SIZES.md} rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0`} />
        <Moon className={`${ICON_SIZES.md} absolute  rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100`} />
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
        <Moon className={ICON_SIZES.sm} />
      ) : (
        <Sun className={ICON_SIZES.sm} />
      )}
      <span className="text-sm font-medium">
        {theme === "dark" ? "Темная тема" : "Светлая тема"}
      </span>
    </button>
  )
}

ThemeToggleWithLabel.displayName = "ThemeToggleWithLabel"

/**
 * ThemeTogglePopover - Переключатель темы с выбором через Popover
 * Предлагает 3 варианта: Light, Dark, System
 * 
 * @example
 * <ThemeTogglePopover />
 */
export const ThemeTogglePopover: React.FC = () => {
  const theme = useAppStore((state) => state.theme)
  const setTheme = useAppStore((state) => state.setTheme)
  const [open, setOpen] = React.useState(false)

  const applyTheme = (newTheme: "light" | "dark") => {
    setTheme(newTheme)
    
    if (newTheme === "dark") {
      document.documentElement.classList.add("dark")
    } else {
      document.documentElement.classList.remove("dark")
    }
    setOpen(false)
  }

  const themeOptions = [
    { value: "light", label: "Светлая", icon: Sun },
    { value: "dark", label: "Темная", icon: Moon },
  ] as const

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Sun className={`${ICON_SIZES.md} rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0`} />
          <Moon className={`${ICON_SIZES.md} absolute rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100`} />
          <span className="sr-only">Выбрать тему</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-40 p-2" align="end">
        <div className="space-y-1">
          {themeOptions.map((option) => {
            const Icon = option.icon
            return (
              <button
                key={option.value}
                onClick={() => applyTheme(option.value)}
                className={cn(
                  "flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm",
                  "transition-colors hover:bg-accent hover:text-accent-foreground",
                  theme === option.value && "bg-accent text-accent-foreground"
                )}
              >
                <Icon className={ICON_SIZES.sm} />
                <span>{option.label}</span>
              </button>
            )
          })}
        </div>
      </PopoverContent>
    </Popover>
  )
}

ThemeTogglePopover.displayName = "ThemeTogglePopover"
