"use client";

import { useState, useCallback, useId, type ChangeEvent } from "react";
import { motion } from "framer-motion";
import { cn } from "@novacal/ui/lib/utils";
import { SPRING_FLUID } from "@novacal/shared";

// ─── Types ───
interface FloatingLabelInputProps {
  label: string;
  value: string;
  onChange?: (value: string) => void;
  /** Font size for the input text, e.g. "24px" for event titles. */
  fontSize?: string;
  className?: string;
  placeholder?: string;
  multiline?: boolean;
}

// ─── Variants ───
const labelVariants = {
  focused: {
    y: -28,
    scale: 0.75,
    color: "rgba(99, 102, 241, 1)",
  },
  unfocused: {
    y: 0,
    scale: 1,
    color: "rgba(161, 161, 170, 0.6)", // zinc-400 at 60%
  },
  filled: {
    y: -28,
    scale: 0.75,
    color: "rgba(161, 161, 170, 0.6)",
  },
};

// ─── Component ───
/**
 * A borderless input with a floating label.
 *
 * - Label floats above on focus (spring transition via Framer Motion).
 * - Three visual states: focused, unfocused (empty), filled.
 * - Designed for the event creation title field (24px font default).
 * - Supports both single-line and multiline (textarea) modes.
 */
export function FloatingLabelInput({
  label,
  value,
  onChange,
  fontSize = "24px",
  className,
  placeholder,
  multiline = false,
}: FloatingLabelInputProps) {
  const [isFocused, setIsFocused] = useState(false);
  const inputId = useId();

  const hasValue = value.length > 0;
  const currentVariant = isFocused ? "focused" : hasValue ? "filled" : "unfocused";

  const handleChange = useCallback(
    (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      onChange?.(e.target.value);
    },
    [onChange],
  );

  const InputComponent = multiline ? "textarea" : "input";

  return (
    <div className={cn("relative w-full", className)}>
      {/* Label — floats above on focus/fill */}
      <motion.label
        htmlFor={inputId}
        className="absolute left-0 cursor-text pointer-events-none"
        style={{
          top: 0,
          originX: 0,
          originY: 0,
          fontFamily: "var(--font-sans)",
          zIndex: 1,
        }}
        animate={currentVariant}
        variants={labelVariants}
        transition={SPRING_FLUID}
      >
        {label}
      </motion.label>

      {/* Input — borderless, transparent */}
      <InputComponent
        id={inputId}
        value={value}
        onChange={handleChange}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        placeholder={isFocused ? placeholder : ""}
        className={cn(
          "w-full bg-transparent border-none outline-none text-[--text-primary]",
          "placeholder:text-[--text-muted]",
          "transition-none",
          multiline && "resize-none min-h-[60px]",
        )}
        style={{ fontSize, fontFamily: "var(--font-sans)" }}
        {...(multiline ? { rows: 1 } : {})}
      />

      {/* Bottom hairline */}
      <div
        className={cn(
          "mt-1 h-px transition-colors duration-150",
          isFocused
            ? "bg-[--primary-accent]"
            : "bg-[--border-subtle]",
        )}
      />
    </div>
  );
}
