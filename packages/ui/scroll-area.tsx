import * as React from "react"
import * as ScrollAreaPrimitives from "@radix-ui/react-scroll-area"
import { cn } from "./lib/utils"

const ScrollArea = React.forwardRef<
  React.ComponentRef<typeof ScrollAreaPrimitives.Root>,
  React.ComponentPropsWithoutRef<typeof ScrollAreaPrimitives.Root>
>(({ className, children, ...props }, ref) => (
  <ScrollAreaPrimitives.Root
    ref={ref}
    className={cn("relative overflow-hidden", className)}
    {...props}
  >
    <ScrollAreaPrimitives.Viewport className="h-full w-full rounded-[inherit]">
      {children}
    </ScrollAreaPrimitives.Viewport>
    <ScrollBar />
    <ScrollAreaPrimitives.Corner />
  </ScrollAreaPrimitives.Root>
))
ScrollArea.displayName = ScrollAreaPrimitives.Root.displayName

const ScrollBar = React.forwardRef<
  React.ComponentRef<typeof ScrollAreaPrimitives.ScrollAreaScrollbar>,
  React.ComponentPropsWithoutRef<typeof ScrollAreaPrimitives.ScrollAreaScrollbar>
>(({ className, orientation = "vertical", ...props }, ref) => (
  <ScrollAreaPrimitives.ScrollAreaScrollbar
    ref={ref}
    orientation={orientation}
    className={cn(
      "flex touch-none select-none transition-none",
      orientation === "vertical" &&
        "h-full w-2.5 border-l border-l-transparent p-px",
      orientation === "horizontal" &&
        "h-2.5 flex-col border-t border-t-transparent p-px",
      className
    )}
    {...props}
  >
    <ScrollAreaPrimitives.ScrollAreaThumb className="relative flex-1 rounded-full bg-[--border-subtle]" />
  </ScrollAreaPrimitives.ScrollAreaScrollbar>
))
ScrollBar.displayName = ScrollAreaPrimitives.ScrollAreaScrollbar.displayName

export { ScrollArea, ScrollBar }
