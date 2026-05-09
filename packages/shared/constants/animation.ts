// ─── Animation Globals (Framer Motion Spring Physics) ───
// Source: docs/02-component-library-global-constants.md §1.A

export const SPRING_SWIFT = {
  type: "spring" as const,
  stiffness: 400,
  damping: 30,
} as const;

export const SPRING_FLUID = {
  type: "spring" as const,
  stiffness: 250,
  damping: 25,
  mass: 0.5,
} as const;

export const SPRING_GENTLE = {
  type: "spring" as const,
  stiffness: 150,
  damping: 20,
  mass: 1,
} as const;

export const TRANSITION_STAGGER = {
  staggerChildren: 0.05,
  delayChildren: 0.1,
} as const;

export const TRANSITION_ENTER = {
  type: "spring" as const,
  stiffness: 350,
  damping: 25,
} as const;

export const TRANSITION_EXIT = {
  duration: 0.15,
  ease: "easeIn" as const,
} as const;
