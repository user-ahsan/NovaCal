// ─── Animation Globals (React Native Reanimated) ───
// Source: docs/02-component-library-global-constants.md §1.A (Mobile)

import { withSpring } from "react-native-reanimated";

export const MOBILE_SPRING = (value: number) =>
  withSpring(value, {
    damping: 15,
    stiffness: 150,
    mass: 0.8,
  });

export const MOBILE_SNAP = {
  damping: 20,
  stiffness: 200,
} as const;

export const MOBILE_FADE_DURATION = {
  duration: 200,
} as const;
