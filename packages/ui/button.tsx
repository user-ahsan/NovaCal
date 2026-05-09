import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "./lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-[--radius-base] text-sm font-medium transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--primary-accent] focus-visible:ring-offset-2 focus-visible:ring-offset-[--background] disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default:
          "bg-[--primary-accent] text-white hover:bg-[--primary-accent]/90 shadow-sm",
        destructive:
          "bg-[--destructive] text-white hover:bg-[--destructive]/90 shadow-sm",
        outline:
          "border border-[--border-subtle] bg-transparent text-[--text-primary] hover:bg-[--ghost-hover]",
        secondary:
          "bg-[--surface-elevated] text-[--text-primary] hover:bg-[--surface-hover] shadow-sm",
        ghost:
          "text-[--text-primary] hover:bg-[--ghost-hover]",
        link:
          "text-[--primary-accent] underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-[--radius-base] px-3 text-xs",
        lg: "h-11 rounded-[--radius-base] px-8 text-base",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
