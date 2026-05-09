"use client"

import * as React from "react"
import { Toaster as SonnerToaster } from "sonner"

type ToasterProps = React.ComponentProps<typeof SonnerToaster>

const Toaster = ({
  position = "bottom-right",
  toastOptions: {
    className,
    ...toastOptions
  } = {},
  ...props
}: ToasterProps) => {
  return (
    <SonnerToaster
      position={position}
      toastOptions={{
        className:
          "border border-[--border-subtle] bg-[--surface-elevated] text-[--text-primary] shadow-[--shadow-elevated] transition-none",
        ...toastOptions,
      }}
      {...props}
    />
  )
}

export { Toaster }
