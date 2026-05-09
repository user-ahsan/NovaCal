# 📦 📦 Component Library & Global Constants Reference

# 📦 NovaCal — Component Library & Global Constants Reference

> **Location:** `packages/shared/constants.ts` + `packages/ui/` + `apps/web/components/` **Rule:** Everything modular, highly reusable, strictly typed. No hardcoded values. No disorganized components.


---

## 🌍 1. Global Variables & Application State

These constants govern the physics, aesthetics, and business logic of the entire monorepo. Belong in `packages/shared/constants.ts` or `packages/shared/theme.config.ts`.


---

### A. The Physics Engine (Animation Globals)

#### Web (Framer Motion)

| Constant | Config | Use Case |
|----------|--------|----------|
| `SPRING_SWIFT` | `{ type: "spring", stiffness: 400, damping: 30 }` | Instant UI snaps — toggles, button clicks, switch glides |
| `SPRING_FLUID` | `{ type: "spring", stiffness: 250, damping: 25, mass: 0.5 }` | Layout shifts, page transitions, modal entries |
| `SPRING_GENTLE` | `{ type: "spring", stiffness: 150, damping: 20, mass: 1 }` | Drag-and-drop, list reordering, expand/collapse |
| `TRANSITION_STAGGER` | `{ staggerChildren: 0.05, delayChildren: 0.1 }` | Auth form field entry, settings section mounting |
| `TRANSITION_ENTER` | `{ type: "spring", stiffness: 350, damping: 25 }` | Command palette, modals, dropdown panels |
| `TRANSITION_EXIT` | `{ duration: 0.15, ease: "easeIn" }` | Dismissals — quick exit, no spring |

```typescript
// packages/shared/constants/animation.ts
export const SPRING_SWIFT = {
  type: "spring" as const,
  stiffness: 400,
  damping: 30,
};

export const SPRING_FLUID = {
  type: "spring" as const,
  stiffness: 250,
  damping: 25,
  mass: 0.5,
};

export const SPRING_GENTLE = {
  type: "spring" as const,
  stiffness: 150,
  damping: 20,
  mass: 1,
};
```

#### Mobile (Reanimated)

| Constant | Config | Use Case |
|----------|--------|----------|
| `MOBILE_SPRING` | `withSpring(value, { damping: 15, stiffness: 150, mass: 0.8 })` | All native spring animations |
| `MOBILE_SNAP` | `{ damping: 20, stiffness: 200 }` | Bottom sheet snap positions |
| `MOBILE_FADE_DURATION` | `withTiming(1, { duration: 200 })` | Quick opacity transitions |

```typescript
// packages/shared/constants/animation.mobile.ts
import { withSpring } from "react-native-reanimated";

export const MOBILE_SPRING = (value: number) =>
  withSpring(value, { damping: 15, stiffness: 150, mass: 0.8 });
```


---

### B. The Global Theme (Tailwind CSS Variables)

```css
/* apps/web/app/globals.css */

/* Dark Mode Default (Primary) */
:root {
  /* Backgrounds */
  --background: #000000;            /* Pure OLED Black */
  --surface: #09090B;               /* Deep Zinc */
  --surface-elevated: #121214;      /* Modals, dropdowns, cards */
  --surface-hover: #18181B;         /* Hover states on elevated surfaces */
  
  /* Accent */
  --primary-accent: #6366F1;        /* Electric Indigo — use sparingly */
  --primary-accent-muted: rgba(99, 102, 241, 0.15);  /* 15% opacity for event blocks */
  --primary-accent-glow: rgba(99, 102, 241, 0.3);    /* Glow effects */
  
  /* Borders & Dividers */
  --border-subtle: rgba(255, 255, 255, 0.1);
  --border-elevated: rgba(255, 255, 255, 0.05);      /* 1px inner border */
  
  /* Ghost / Hover */
  --ghost-hover: rgba(255, 255, 255, 0.05);
  --ghost-active: rgba(255, 255, 255, 0.1);
  
  /* Text */
  --text-primary: #FFFFFF;
  --text-secondary: #A1A1AA;        /* zinc-400 */
  --text-muted: #52525B;            /* zinc-600 */
  
  /* Status */
  --destructive: #EF4444;           /* red-500 */
  --success: #22C55E;               /* green-500 */
  --warning: #F59E0B;               /* amber-500 */
  
  /* Typography */
  --font-sans: 'Inter', sans-serif;
  --font-mono: 'JetBrains Mono', monospace;
  
  /* Radii */
  --radius-base: 8px;
  --radius-lg: 12px;                /* Elevated cards, modals */
  --radius-full: 9999px;            /* Pills, badges */
  
  /* Shadows */
  --shadow-elevated: 0px 20px 40px rgba(0, 0, 0, 0.3);
  --shadow-modal: 0px 25px 50px rgba(0, 0, 0, 0.4);
}
```

| Variable | Default (Dark) | Usage |
|----------|----------------|-------|
| `--background` | `#000000`      | App root background |
| `--surface` | `#09090B`      | Sidebar, secondary panels |
| `--surface-elevated` | `#121214`      | Cards, modals, dropdowns |
| `--primary-accent` | `#6366F1`      | CTA, current time, active states |
| `--ghost-hover` | `rgba(255,255,255,0.05)` | Row hover, button ghost hover |
| `--border-subtle` | `rgba(255,255,255,0.1)` | Hairline dividers |
| `--radius-base` | `8px`          | Inputs, buttons, cards |
| `--radius-lg` | `12px`         | Modals, elevated panels |
| `--font-sans` | `'Inter', sans-serif` | All UI text |
| `--font-mono` | `'JetBrains Mono', monospace` | Time blocks, API keys, code |


---

### C. System & Business Logic Constants

```typescript
// packages/shared/constants/system.ts

// ─── Roles ───
export const WORKSPACE_ROLES = [
  "OWNER",
  "ADMIN",
  "EDITOR",
  "VIEWER",
  "FREE_BUSY",
] as const;

export type WorkspaceRole = (typeof WORKSPACE_ROLES)[number];

export const ROLE_HIERARCHY: Record<WorkspaceRole, number> = {
  OWNER: 100,
  ADMIN: 80,
  EDITOR: 60,
  VIEWER: 40,
  FREE_BUSY: 20,
};

// ─── Time ───
export const DEFAULT_TIMEZONE = "UTC";
export const SLOT_INCREMENT_MINUTES = 15;
export const MIN_EVENT_DURATION_MINUTES = 15;
export const MAX_EVENT_DURATION_HOURS = 24;
export const DEFAULT_WORKING_HOURS = { start: 9, end: 17 };
export const DEFAULT_START_OF_WEEK = 1; // Monday

// ─── Cache / TTL ───
export const QR_TTL_SECONDS = 60;
export const QR_REFRESH_INTERVAL_MS = 60_000; // matches QR_TTL
export const RATE_LIMIT_MAX_REQUESTS = 100;   // per minute
export const SESSION_CACHE_TTL_SECONDS = 3600; // 1 hour

// ─── View Types ───
export const CALENDAR_VIEWS = ["day", "3-day", "week", "month", "year"] as const;
export type CalendarView = (typeof CALENDAR_VIEWS)[number];

// ─── Pagination ───
export const DEFAULT_PAGE_SIZE = 50;
export const MAX_PAGE_SIZE = 200;
export const AGENDA_PAGE_SIZE = 100;

// ─── WebSocket ───
export const WS_EVENTS = {
  EVENT_CREATED: "event.created",
  EVENT_UPDATED: "event.updated",
  EVENT_DELETED: "event.deleted",
  LOGIN_SUCCESS: "LOGIN_SUCCESS",
  USER_ONLINE: "user.online",
  USER_OFFLINE: "user.offline",
} as const;

// ─── Share Links ───
export const SHARE_HASH_BYTES = 32; // crypto.randomBytes(32)
export const SHARE_DEFAULT_EXPIRY_DAYS = 7;
export const SHARE_MAX_EXPIRY_DAYS = 365;
```


---

## 📦 2. The shadcn/ui Imports (The Primitives)

Do not build these from scratch. Run `npx shadcn-ui@latest add [component]` for each. These are the foundational accessibility-first primitives — heavily style them to match the dark OLED aesthetic.

| Component | Package | Usage in NovaCal |
|-----------|---------|------------------|
| **Button** | `shadcn/ui` | Every CTA. Needs heavy modification to support `SPRING_SWIFT` hover effects + `<MagneticButton>` glow |
| **Input** | `shadcn/ui` | Forms, event creation, workspace naming — borderless variant, `24px` title font |
| **Textarea** | `shadcn/ui` | Markdown description editor — replaced by custom `<MarkdownEditor>` but used as base |
| **Command** | `shadcn/ui` (cmdk) | The core of Cmd+K spotlight search and AI prompt input |
| **Dialog** | `shadcn/ui` | Modals for "Create Event", "Invite User", and "Settings" |
| **Popover** | `shadcn/ui` | Crucial for custom Date Pickers and small contextual menus |
| **Select** | `shadcn/ui` | Timezone selection, Role assignment, View switching |
| **DropdownMenu** | `shadcn/ui` | User menu, event quick-actions (Edit/Delete), workspace switcher |
| **Avatar** | `shadcn/ui` | User profiles in navbar and member directory |
| **Badge** | `shadcn/ui` | Displaying roles (`<Badge variant="outline">Admin</Badge>`) |
| **Switch** | `shadcn/ui` | Toggles for "All Day" events, Dark Mode, Public Link sharing |
| **Table** | `shadcn/ui` | Member management directory and API Key lists |
| **ScrollArea** | `shadcn/ui` | The infinite Agenda view and sidebar navigation |
| **Skeleton** | `shadcn/ui` | Data-loading states — replaces traditional spinner |
| **Toast / Sonner** | `shadcn/ui` | Global notification system ("Event Created", "QR Scanned") |
| **Tooltip** | `shadcn/ui` | Hover states for icons (e.g., hovering over the Delete trash can) |

### shadcn/ui Styling Overrides

Each import must be styled to match the DLS:

```tsx
// Example: Dark-themed Button with spring hover
<Button
  className={cn(
    "bg-primary-accent text-white rounded-[--radius-base]",
    "hover:bg-primary-accent/90",
    "transition-none" // We use Framer Motion, not CSS transitions
  )}
  asChild
>
  <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
    {children}
  </motion.button>
</Button>
```

**Rule:** shadcn/ui provides accessibility and keyboard navigation. Framer Motion provides the feel. Never mix CSS transitions with Framer Motion — use `transition-none` on shadcn base classes.


---

## 🛠️ 3. Manually Designed Components (The "Bespoke" Layer)

These are the complex, highly specific components that shadcn cannot provide. Build manually using Framer Motion (Web) and Reanimated (Mobile).


---

### A. Web Components (Next.js / Framer Motion)

| Component | Complexity | Description | Key Props |
|-----------|------------|-------------|-----------|
| `<GridCanvas />` | 🔴 **Extreme** | The most complex component. Calculates Y-axis pixels based on time, X-axis positioning by day. Handles overlapping event logic. | `view: CalendarView`, `date: Date`, `events: Event[]`, `onEventDrop: fn` |
| `<EventBlock />` | 🔴 **High** | Colored rectangle representing a meeting. Must accept drag props, snap to 15-min grids, use `<motion.div layoutId>` for smooth morphing. | `event: Event`, `layoutId: string`, `drag?: boolean`, `onResize: fn` |
| `<TimeLineIndicator />` | 🟡 **Medium** | Glowing horizontal red line. Requires `useEffect` interval to calculate absolute Y-position every 60 seconds. | `containerRef: RefObject` |
| `<DynamicQRCode />` | 🟡 **Medium** | Wraps an SVG QR library. Handles WebSocket subscription to refresh token every 60s without reloading UI. | `wsUrl: string`, `onScanApproved: fn` |
| `<MarkdownEditor />` | 🟡 **Medium** | Custom borderless textarea for event descriptions. Parses markdown syntax on the fly. | `value: string`, `onChange: fn`, `onAIFormat: fn` |
| `<MiniMonthNavigator />` | 🟡 **Medium** | Small 30-day calendar in sidebar for rapid date jumping. | `selectedDate: Date`, `onDateSelect: fn` |
| `<RRuleBuilder />` | 🔴 **High** | Highly complex custom form component. Handles "Every 3rd Tuesday until next year" type configurations. | `value: RRule`, `onChange: fn` |
| `<AICommandBar />` | 🟡 **Medium** | Sticky input field that sends text to MCP server. Displays parsing skeleton loader while agent processes. | `onSubmit: fn`, `placeholder: string` |
| `<MagneticButton />` | 🟡 **Medium** | Button with radial glow tracking mouse position via Framer Motion pointer events. | `children: ReactNode`, `onClick: fn`, `variant: "primary"` \| `"ghost"` |
| `<FloatingLabelInput />` | 🟢 **Low** | Borderless input with label that floats above on focus. | `label: string`, `value: string`, `onChange: fn` |
| `<GhostSlot />` | 🟢 **Low** | Faded dashed-border block on grid hover. Shows exactly where a click would create an event. | `date: Date`, `time: string`, `onClick: fn` |
| `<CodeBlockCopy />` | 🟢 **Low** | Monospace code block with copy-to-clipboard and animated icon swap. | `code: string`, `language?: string` |
| `<SyncProgressRing />` | 🟡 **Medium** | Circular SVG stroke animating strokeDashoffset for SQLite→Postgres sync progress. | `progress: number` (0–100), `status: "syncing"` \| `"idle"` \| `"offline"` |

#### GridCanvas — Architecture Notes

```
Inputs:
  - view: 'day' | '3-day' | 'week' | 'month' | 'year'
  - date: Date (anchor date)
  - events: Event[] (filtered & sorted)

Computation:
  1. Calculate total grid height = hoursVisible * hourHeightPx
  2. Map each event to { top, height, left, width } based on:
     - top = (startTime.hours - visibleStartHour) * hourHeightPx
     - height = durationMinutes * (hourHeightPx / 60)
     - left = dayIndex * dayColumnWidth
     - width = dayColumnWidth (with overlap reduction for concurrent events)
  3. Overlap detection: group overlapping events → distribute column positions

Rendering:
  - Fixed grid lines (30-min or 60-min intervals)
  - Absolutely positioned EventBlocks
  - TimeLineIndicator overlay
  - GhostSlot on hover
```


---

### B. Mobile Components (React Native / Expo)

| Component | Complexity | Description | Key Libraries |
|-----------|------------|-------------|---------------|
| `<CameraScanner />` | 🔴 **High** | Wraps `expo-camera`. Custom absolute-positioned SVG overlay for `<TargetingReticle>` that scales using Reanimated. | `expo-camera`, `react-native-reanimated`, `react-native-svg` |
| `<SwipeableGrid />` | 🔴 **Extreme** | Mobile calendar view. Must use `react-native-gesture-handler` for buttery smooth left/right swiping between weeks/months. | `react-native-gesture-handler`, `react-native-reanimated` |
| `<BottomSheetDateSelector />` | 🟡 **Medium** | Custom action sheet sliding up over UI. Native scroll wheels with haptic feedback on every scroll tick. | `@react-native-picker/picker`, `expo-haptics` |
| `<EventChip />` | 🟡 **Medium** | Mobile equivalent of EventBlock. Uses Shared Element Transitions to expand into full-screen view. | `react-native-reanimated` (SharedElement) |
| `<SyncProgressRing />` | 🟡 **Medium** | Built from scratch using Skia. Circular SVG stroke animating strokeDashoffset. | `@shopify/react-native-skia` |
| `<TargetingReticle />` | 🟢 **Low** | Viewfinder corner brackets for QR scanner. Constant breathe animation via Reanimated. | `react-native-reanimated` |
| `<ApprovalBottomSheet />` | 🟡 **Medium** | Slides up from bottom on QR detection, blurs camera behind. | `react-native-reanimated`, `expo-blur` |
| `<StatusDot />` | 🟢 **Low** | Animated dot showing connection status (grey→orange→green state machine). | `react-native-reanimated` |
| `<SyncStatusIndicator />` | 🟢 **Low** | Compact status badge showing sync state in settings. | `react-native-reanimated` |


---

## ✅ Component Inventory Checklist

### shadcn/ui Primitives (17 total)

- [ ] `Button` — with Framer Motion hover/tap overrides, `transition-none` on CSS
- [ ] `Input` — borderless variant with floating label
- [ ] `Textarea` — base for MarkdownEditor
- [ ] `Command` — Cmd+K search backbone
- [ ] `Dialog` — Event creation, invite, settings modals
- [ ] `Popover` — Date pickers, contextual menus
- [ ] `Select` — Timezone, role, view selectors
- [ ] `DropdownMenu` — User menu, event quick-actions
- [ ] `Avatar` — Navbar, member directory
- [ ] `Badge` — Role labels, status indicators
- [ ] `Switch` — All Day, Dark Mode, Public Link toggles
- [ ] `Table` — Members, API keys data tables
- [ ] `ScrollArea` — Agenda view, sidebar
- [ ] `Skeleton` — Loading states (no spinners)
- [ ] `Toast / Sonner` — Global notifications
- [ ] `Tooltip` — Icon hover explanations

### Bespoke Web Components (13 total)

- [ ] `<GridCanvas />` — Core grid rendering + overlap logic
- [ ] `<EventBlock />` — Draggable, layoutId, 15-min snap
- [ ] `<TimeLineIndicator />` — 60s interval position update
- [ ] `<DynamicQRCode />` — WebSocket refresh, scan callback
- [ ] `<MarkdownEditor />` — Live markdown parsing
- [ ] `<MiniMonthNavigator />` — Sidebar date jumper
- [ ] `<RRuleBuilder />` — Complex recurrence form
- [ ] `<AICommandBar />` — MCP-connected input bar
- [ ] `<MagneticButton />` — Pointer-tracking glow
- [ ] `<FloatingLabelInput />` — Floating label pattern
- [ ] `<GhostSlot />` — Hover placeholder on grid
- [ ] `<CodeBlockCopy />` — Copy + animated icon swap
- [ ] `<SyncProgressRing />` — Skia circular progress

### Bespoke Mobile Components (9 total)

- [ ] `<CameraScanner />` — QR scan with reticle overlay
- [ ] `<SwipeableGrid />` — Gesture handler swipe
- [ ] `<BottomSheetDateSelector />` — Haptic scroll wheel
- [ ] `<EventChip />` — Shared element transition
- [ ] `<SyncProgressRing />` — Skia circular progress
- [ ] `<TargetingReticle />` — Animated viewfinder
- [ ] `<ApprovalBottomSheet />` — QR approval slide-up
- [ ] `<StatusDot />` — Connection state machine
- [ ] `<SyncStatusIndicator />` — Compact sync badge
