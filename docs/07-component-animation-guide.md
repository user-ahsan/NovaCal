# ⚡ ⚡ Component & Animation Implementation Guide

# ⚡ NovaCal — Component & Animation Implementation Guide

> **Web:** Framer Motion — spring physics throughout **Mobile:** React Native Reanimated — 60/120fps native thread animations **Philosophy:** Every interaction tactile. Every transition intentional. No linear animations. No stock spinners.


---

## 🌐 Web Application (Next.js / Framer Motion)


---

### 1. Initialization & Auth — `/app/(auth)`

#### Layout Component: `<AuthLayout>`

```tsx
<motion.div
  initial={{ opacity: 0, y: 10 }}
  animate={{ opacity: 1, y: 0 }}
  transition={{ staggerChildren: 0.05 }}
>
  {children}
</motion.div>
```

| Property | Value |
|----------|-------|
| Entry    | `opacity: 0, y: 10` |
| Exit     | Reverse |
| Stagger  | `0.05s` between children |
| Spring   | Default (subtle) |


---

#### `/setup` & `/login`

**Components:**

* `<FloatingLabelInput>` — Borderless input with label that floats above on focus
* `<MagneticButton>` — Button with radial glow tracking mouse position

**Form animation:** Fields stagger in via parent staggerChildren config.

**MagneticButton hover effect** — Uses Framer Motion's `usePointerPosition` pattern:

```
On hover:
  → A subtle radial gradient glow tracks the mouse inside the button
  → Glow center = pointer position relative to button bounds
  → Button slightly scales: scale: 1.02 with spring
```


---

#### `/login/qr`

**Components:**

* `<DynamicQRCode>` — Generates QR, auto-refreshes every 60s
* `<ConnectingSpinner>` — Custom SVG spinner (no stock loading icons)

**Text:** *"Awaiting Mobile Connection…"*, *"Scan to bypass"*

**QR Code Animations:**

| State | Animation |
|-------|-----------|
| **Idle / Waiting** | QR code at resting scale (1.0). A glowing SVG overlay line sweeps top-to-bottom endlessly. |
| **Sweep line** | `animate={{ y: ["0%", "100%", "0%"] }}` with `ease: "linear"`, 3s loop |
| **QR Scale** | Uses Swift spring (mass: 1, stiffness: 280, damping: 25) |
| **On successful scan** | QR shrinks to `scale: 0.8`, turns neon green (`#22C55E`), glow intensifies |
| **Redirect** | Full-page circular reveal (clip-path expanding circle) → calendar dashboard |

```
Idle:                    Scanned:
┌────────────────┐      ┌────────────────┐
│  ┌──────────┐  │      │  ┌──────────┐  │
│  │ ░░░░░░░░ │  │      │  │ 🟢🟢🟢🟢 │  │  ← shrinks to 0.8, green
│  │ ░░ QR ░░ │  │      │  │ 🟢🟢🟢🟢 │  │
│  │ ░░░░░░░░ │  │      │  └──────────┘  │
│  └──────────┘  │      │    glow +      │
│  ← sweep line →│      │  circle reveal │
└────────────────┘      └────────────────┘
```


---

### 2. Core Application — `/app/(dashboard)`

#### `/calendar` (The Grid)

**Components:**

| Component | Role |
|-----------|------|
| `<GridCanvas>` | The edge-to-edge time grid (horizontal week lines, vertical hour columns) |
| `<TimeLineIndicator>` | The glowing "Now" line with pulsing dot |
| `<EventBlock>` | Individual event card on the grid |
| `<GhostSlot>` | Faded placeholder on hover over empty slots |

##### TimeLineIndicator

```tsx
<motion.div
  animate={{ opacity: [0.5, 1, 0.5] }}
  transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
/>
```

| Property | Value |
|----------|-------|
| Loop     | 2-second pulse |
| Colors   | Accent neon (e.g., indigo-500) |
| Dot      | Pulsing circle at left edge, synchronised with opacity loop |

##### EventBlock

```tsx
<motion.div
  layoutId={`event-${event.id}`}          // Shared element transitions
  drag="x, y"                              // Free drag on grid
  dragElastic={0.1}                        // Subtle rubber band
  dragSnapToOrigin={false}                 // Don't snap back
  whileDrag={{
    scale: 1.02,
    boxShadow: "0px 20px 40px rgba(0,0,0,0.2)",
    cursor: "grabbing",
  }}
>
```

| Feature | Implementation |
|---------|----------------|
| **Layout transitions** | `layoutId` prop — when an EventBlock is clicked, it morphs seamlessly into the View Modal |
| **Drag & drop** | `drag="x, y"` with 15-min snap on drop (via `onDragEnd` → round to nearest 15min) |
| **Drop elevation** | `whileDrag` applies scale 1.02x + heavy shadow |
| **Hover** | Slight shadow + reveal quick-action icons (Edit, Delete) |

##### GhostSlot

* Rendered when cursor hovers over an empty position on the grid
* Faded dashed border block showing exactly where a click would create an event
* `initial={{ opacity: 0 }} animate={{ opacity: 0.4 }}` on hover in

##### View Switching (Month ↔ Week ↔ Day)

```
On view change:
  1. Old grid: fade out + slide left (x: -20, opacity: 0)
  2. New grid: slide in from right (x: 20 → 0, opacity: 0 → 1)
  3. Both use fluid spring: type: "spring", stiffness: 200, damping: 30
  4. Duration: ~250ms total
```


---

#### `/search` (Command Palette Overlay)

**Components:**

| Component | Role |
|-----------|------|
| `<BlurBackdrop>` | Backdrop with `backdrop-filter: blur(24px)` |
| `<CommandPalette>` | Centered search panel |
| `<ResultItem>` | Individual FTS result row |

```tsx
<AnimatePresence>
  {isOpen && (
    <>
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      />
      
      {/* Palette */}
      <motion.div
        initial={{ scale: 0.95, y: -10, opacity: 0 }}
        animate={{ scale: 1, y: 0, opacity: 1 }}
        exit={{ scale: 0.95, y: -10, opacity: 0 }}
        transition={{ type: "spring", stiffness: 350, damping: 25 }}
      >
        <CommandPalette>
          <AnimatePresence mode="popLayout">
            {results.map((item) => (
              <motion.div
                key={item.id}
                layout                              // Smooth reorder
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
              >
                <ResultItem {...item} />
              </motion.div>
            ))}
          </AnimatePresence>
        </CommandPalette>
      </motion.div>
    </>
  )}
</AnimatePresence>
```

| Aspect | Detail |
|--------|--------|
| **Backdrop** | Fades in/out |
| **Palette entry** | Scale 0.95 → 1, y: -10 → 0, spring |
| **Results** | `layout` prop for smooth filtering as user types. New items animate in from left, removed ones exit right |
| **FTS behavior** | Local filter first, fallback to PostgreSQL tsquery for large datasets |


---

### 3. Developer & MCP Integrations — `/app/(developer)`

#### `/developer/mcp` & `/developer/api-keys`

**Components:**

| Component | Role |
|-----------|------|
| `<CodeBlockCopy>` | Monospace code block with copy button |
| `<APIKeyTable>` | Table of generated keys with status badges |

**Text:** *"Agent Configuration"*, *"Active SSE Connections"*

**Animations:**

| Element | Animation |
|---------|-----------|
| **Code block hover** | Subtle 1px border gradient sweep on hover |
| **Copy button click** | Icon swaps to checkmark: `animate={{ scale: [1, 1.2, 1] }}` quick pop (200ms) |
| **API key reveal** | Key text slides from `●●●●●●●●` to plaintext with a flip animation (rotateX) |


---

### 4. Team & Workspace Management — `/app/(workspace)`

#### `/w/[workspaceId]/members`

**Components:**

| Component | Role |
|-----------|------|
| `<MemberRow>` | Single row in the member table |
| `<RoleDropdown>` | Dropdown to change user role |
| `<InviteModal>` | Modal to generate invitation link |

**Animations:**

| Element | Animation |
|---------|-----------|
| **Member row layout** | `<motion.tr layout>` — when a user is removed or role changes, rows organically glide up/down to fill the gap |
| **Role dropdown open** | `transformOrigin: "top right"` with scale + fade in |
| **Invite modal** | Standard spring pop from center |


---

### 5. User Settings & Administration — `/app/(settings)`, `/app/(admin)`

**Components:**

| Component | Role |
|-----------|------|
| `<SettingsSidebar>` | Left nav with settings sections |
| `<SectionCard>` | Individual settings panel |
| `<SwitchToggle>` | On/off toggle |

**SwitchToggle Animation:**

```
Internal circle: <motion.div layout> glides left/right (spring)
Background: crossfades between zinc-700 and accent color
Duration: ~200ms
```

**Sidebar Navigation Animation:**

```tsx
<LayoutGroup>
  {/* Active indicator pill slides behind the selected item */}
  <motion.div layoutId="active-pill" className="absolute ..." />
  
  {items.map((item) => (
    <SidebarItem key={item.id} ... />
  ))}
</LayoutGroup>
```

| Element | Animation |
|---------|-----------|
| **Active pill** | Uses Framer Motion `LayoutGroup` — the pill background smoothly slides vertically to the selected item |
| **Section enter** | Cards fade in with slight upward drift on mount |


---

## 📱 Mobile Application (React Native / Reanimated)


---

### 1. Instance Connection & Auth Stack — `/app/(auth)`

#### `/connect`

**Components:**

| Component | Role |
|-----------|------|
| `<ServerURLInput>` | Input for the self-hosted instance URL |
| `<StatusDot>` | Animated dot showing connection status |

**Text:** *"Enter Node Address"*, *"Self-Hosted Root"*

**StatusDot Animation:**

```
State machine: grey → orange (pinging) → green (connected)

Using withSpring:
  1. Initial: grey, scale: 1.0
  2. User enters URL: turns orange, subtle pulse (scale: [1, 1.2, 1])
  3. Pinging server: orange pulsing (reanimated withRepeat)
  4. Connected: shrinks to green dot (withSpring, stiffness: 200)
  5. Error: turns red, shakes (translateX oscillation with decay)
```


---

#### `/scanner`

**Components:**

| Component | Role |
|-----------|------|
| `<CameraView>` | Live camera preview |
| `<TargetingReticle>` | Animated viewfinder brackets |
| `<ApprovalBottomSheet>` | Bottom sheet that slides up on QR detect |

**TargetingReticle Animation:**

```tsx
// Constant subtle breathe — indicates camera is actively scanning
const reticleScale = useAnimatedStyle(() => ({
  transform: [{ scale: withRepeat(withSpring(1.02), -1, true) }],
}));
```

| State | Behavior |
|-------|----------|
| **Scanning** | Reticle constantly scales `[0.98, 1.02]` — subtle breathe |
| **QR detected** | Neon bounding box snaps to QR code location (spring) |
| **QR validated** | Box turns green, ApprovalBottomSheet slides up |
| **Bottom sheet** | Slides up using `withSpring` from bottom edge, camera view blurs behind |


---

### 2. The Main Tab Navigator — `/app/(tabs)`

#### `/(tabs)/calendar`

**Components:**

| Component | Role |
|-----------|------|
| `<SwipeableGrid>` | Month grid with horizontal swipe |
| `<MiniMonthHeader>` | Compact month header |
| `<EventChip>` | Small event indicator on the grid |

**Scroll Parallax:**

```tsx
const scrollHandler = useAnimatedScrollHandler({
  onScroll: (event) => {
    headerTranslate.value = event.contentOffset.y * -0.3; // Parallax factor
  },
});

const headerStyle = useAnimatedStyle(() => ({
  transform: [{ translateY: headerTranslate.value }],
}));
```

| Aspect | Detail |
|--------|--------|
| **Parallax factor** | `0.3` — header moves at 30% of scroll speed |
| **Animation driver** | `useAnimatedScrollHandler` on UI thread (native) |

**EventChip → Full-Screen Transition:**

```tsx
// Shared Element Transition using Reanimated
// Tapping an EventChip triggers:
// 1. Chip physically lifts out of grid (scale: 1.05, elevation increase)
// 2. Morphs into full-screen event view
// 3. Uses withSpring, stiffness: 200, damping: 20
// 4. Return gesture: swipe down reverses the transition
```

| Phase | Animation |
|-------|-----------|
| **Tap** | Chip scales 1.05x, shadow increases |
| **Expand** | Morphs to fill screen — shared element transition |
| **Dismiss** | Swipe down → reverses to chip position (spring with decay) |


---

#### `/(tabs)/agenda`

**Components:**

| Component | Role |
|-----------|------|
| `<StickyDateHeader>` | Date header that sticks to top |
| `<AgendaRow>` | Individual event row |

**Scroll Behavior:**

* As user scrolls, `<StickyDateHeader>` pushes the previous one out of the way smoothly
* Items entering the viewport fade up slightly (`opacity: 0 → 1, translateY: 10 → 0`)
* Uses `useAnimatedScrollHandler` + `useSharedValue` for native-thread performance


---

### 3. Full-Screen Modals — `/app/(modals)`

#### `/event/new`

**Components:**

| Component | Role |
|-----------|------|
| `<BottomSheetDateSelector>` | Custom time picker (replaces native wheel) |
| `<SegmentedControl>` | Toggle between sections |

**Custom Time Wheel:**

```tsx
// Reanimated drag-wheel with heavy haptic feedback
// Each tick triggers:
Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

// Simulates a physical dial — friction, momentum, snap
// Implementation: PanGestureHandler → withDecay → snap to interval
```

| Property | Value |
|----------|-------|
| **Haptic** | `ImpactFeedbackStyle.Light` on every tick |
| **Snap interval** | 15 minutes |
| **Physics** | `withDecay` for momentum scrolling + snap |


---

#### `/search`

**Components:**

| Component | Role |
|-----------|------|
| `<KeyboardAvoidingOverlay>` | Full-screen overlay, pushes up with keyboard |
| `<SkeletonRow>` | Shimmer placeholder while loading |

**Search bar animation:**

```tsx
// Slides down from top edge on mount
const searchStyle = useAnimatedStyle(() => ({
  transform: [{ translateY: withSpring(0, { stiffness: 300 }) }],
}));
// Initial: translateY: -100 (off-screen above)
// Animate to: translateY: 0
```

**SkeletonRow shimmer:**

```tsx
// Before SQLite returns results, shimmer placeholders animate
const shimmerStyle = useAnimatedStyle(() => ({
  opacity: withRepeat(withTiming(0.3, { duration: 800 }), -1, true),
}));

// Linear gradient mask sweeps left-to-right continuously
```

| Aspect | Detail |
|--------|--------|
| **Search bar** | Springs down from top edge |
| **Results** | Local SQLite FTS first (instant), fallback to server |
| **Skeleton** | Pulse opacity 0.3 ↔ 1.0, 800ms loop |
| **Autofocus** | Keyboard visible on mount |


---

### 4. Settings & Diagnostics — `/app/(settings)`

#### `/settings/database-sync`

**Text:** *"Local SQLite Cache"*, *"Pending Mutations"*

**Components:**

| Component | Role |
|-----------|------|
| `<SyncProgressRing>` | Circular progress indicator (React Native Skia) |
| `<ForcePushBtn>` | Button to force sync all queued mutations |

**SyncProgressRing Animation:**

```tsx
// Drawn with @shopify/react-native-skia
// strokeDashoffset animates smoothly from 0 to circumference

// Syncing: strokeDashoffset decreases from circumference → 0 (fills ring)
// duration: animates proportionally to queue size (faster for small queues)

// Idle: ring is full (100%), static green
// Offline: ring pulses softly in orange
const pulseStyle = useAnimatedStyle(() => ({
  opacity: withRepeat(withTiming(0.5, { duration: 1500 }), -1, true),
}));
```

| State | Ring Style |
|-------|------------|
| **Syncing** | strokeDashoffset animates, accent color |
| **Synced (idle)** | Full ring, static green |
| **Offline** | Orange pulsing (0.5↔1.0 opacity, 1.5s loop) |
| **Error** | Red, short shake animation |


---

#### `/settings/appearance`

**Theme Switch Animation:**

```tsx
// Dark ↔ Light mode triggers a circular reveal animation
// 1. User taps a toggle / swatch
// 2. Capture tap position (x, y)
// 3. Circular clip-path expands from tap point:
//    initial: circle(0% at x y)
//    animate: circle(150% at x y)
// 4. Theme context flips underneath
// 5. Duration: ~400ms spring
```

| Property | Value |
|----------|-------|
| **Origin** | User's tap point |
| **Shape** | Expanding circle (clip-path) |
| **Duration** | \~400ms spring |
| **Content** | Theme context flips during reveal |


---

## ✅ Implementation Checklist

### Web (Framer Motion)

- [ ] `<AuthLayout>` stagger animation (0.05s delay between children)
- [ ] `<MagneticButton>` pointer-tracking radial glow
- [ ] QR code sweep line animation (linear y-loop)
- [ ] QR code scan-success shrink + green + circle reveal
- [ ] `<EventBlock>` with `layoutId` for shared element transitions
- [ ] `<EventBlock>` drag="x, y" with 15-min snap
- [ ] `<TimeLineIndicator>` 2-second opacity pulse loop
- [ ] View switching (Month/Week/Day) — slide left/right with spring
- [ ] `<CommandPalette>` with AnimatePresence (scale + fade)
- [ ] Search results with `layout` prop for smooth filtering
- [ ] Copy button pop animation (`scale: [1, 1.2, 1]`)
- [ ] Member rows with `<motion.tr layout>` for glide reorder
- [ ] `<SwitchToggle>` with `<motion.div layout>` glide
- [ ] Sidebar `LayoutGroup` for active-pill sliding

### Mobile (Reanimated)

- [ ] `<StatusDot>` withSpring state machine (grey → orange → green)
- [ ] QR reticle withRepeat scale breathe
- [ ] ApprovalBottomSheet withSpring slide-up + blur
- [ ] Scroll parallax header (0.3 factor on animated scroll handler)
- [ ] EventChip shared element transition (lift + expand)
- [ ] Sticky date header push (native-thread)
- [ ] Agenda item fade-up on scroll enter
- [ ] Custom time wheel with haptics + withDecay snap
- [ ] Search bar spring from top edge
- [ ] SkeletonRow shimmer (opacity withRepeat 800ms)
- [ ] SyncProgressRing strokeDashoffset (Skia)
- [ ] Offline ring pulse (orange withRepeat)
- [ ] Theme switch circular reveal from tap point
