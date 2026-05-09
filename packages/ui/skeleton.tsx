import * as React from "react"
import { cn } from "./lib/utils"

function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "animate-pulse rounded-[--radius-base] bg-[--surface-elevated]",
        className
      )}
      {...props}
    />
  )
}

export { Skeleton }
