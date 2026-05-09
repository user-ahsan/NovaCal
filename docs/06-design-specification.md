# 🎨 🎨 Design Specification — The "Million-Dollar" Design

# 🎨 NovaCal — The "Million-Dollar" Design Specification

> **Philosophy:** Expensive, cohesive, hyper-responsive. Every pixel intentional. Every animation spring-driven. Every interaction tactile.


---

## 1. The Design Language System (DLS)

This is the foundation. Every component must adhere to these strict visual rules to ensure the app feels expensive and cohesive.

### Typography

| Role | Font | Usage |
|------|------|-------|
| **Primary UI** | Inter (Web) / SF Pro (iOS) / Roboto (Android) | All UI text. Strict tracking and kerning. |
| **Monospace** | JetBrains Mono or Geist Mono | Time blocks, dates, API/MCP configuration keys |

#### Hierarchy & Contrast

Heavy contrast between elements:

* **Massive, bold headers** — e.g., `32px Semibold`
* **Subtle secondary text** — e.g., `13px Regular`, `color: zinc-400`

```
┌─────────────────────────────────────────────┐
│  32px Semibold — Page Title / Event Name     │  ← Heavy, commands attention
│                                             │
│  13px Regular zinc-400 — Description text    │  ← Subtle, recedes
│  13px Regular zinc-400 — Metadata / timestamps│
└─────────────────────────────────────────────┘
```

### Color Palette (Dark Mode First)

| Token | Hex | Usage |
|-------|-----|-------|
| **Background** | `#000000` or `#09090B` | Deep OLED black. No muddy grays. |
| **Surface/Card** | `#121214` | Elevated surfaces. |
| **Surface Border** | `rgba(255,255,255,0.05)` | 1px inner border for depth without drop shadows. |
| **Accent** | Electric Indigo or Neon Coral | Primary CTA, current time indicator, active states only. Used sparingly. |
| **Text Primary** | `#FFFFFF` | Headers, primary labels |
| **Text Secondary** | `#A1A1AA` (zinc-400) | Body, metadata, descriptions |
| **Text Muted** | `#52525B` (zinc-600) | Placeholders, disabled states |
| **Destructive** | `#EF4444` (red-500) | Delete actions, error states |
| **Success** | `#22C55E` (green-500) | Confirmations, approved states |

#### Surface Depth Architecture

```
Depth 0: #000000           — App background (OLED)
Depth 1: #09090B           — Sidebar, secondary panels
Depth 2: #121214           — Cards, event blocks, dropdowns
Depth 3: #18181B           — Modals, sheets, hover states (elevated)

Each level has a 1px inner border: rgba(255,255,255,0.05)
```

### Motion & Physics

#### Core Principle: No Linear Animations

Every animation must use **spring physics** (Framer Motion spring, React Spring, or CSS custom spring functions).

| Property | Value |
|----------|-------|
| **Spring type** | `spring` (never `tween` or `linear`) |
| **Duration** | 150ms – 250ms maximum |
| **Stiffness** | 200–300 |
| **Damping** | 20–30 |
| **Mass** | 1     |

**Behavior:** UI elements shouldn't "slide" — they should snap into place with subtle bounce and friction. The app must feel hyper-responsive.

```typescript
// Example Framer Motion spring config
const springConfig = {
  type: "spring",
  stiffness: 260,
  damping: 25,
  mass: 1,
};
```

### Glassmorphism & Blurs

| Element | Blur | Usage |
|---------|------|-------|
| **Modals** | `backdrop-filter: blur(12px)` | The calendar grid subtly bleeds through |
| **Dropdowns** | `backdrop-filter: blur(12px)` | Menus, selectors |
| **Sticky headers** | `backdrop-filter: blur(12px)` | Date headers, toolbar |
| **Command palette** | `backdrop-filter: blur(24px)` | Heavy blur for spotlight effect |


---

## 2. Web Application (The Power-User Desktop Experience)

### A. The Global Interface

#### Edge-to-Edge Canvas

* **No hard container borders.** The calendar grid spans the entire screen, giving a sense of infinite space.
* Scrollbars are custom-styled (thin, transparent until hover).
* Left sidebar and right panels float over the grid rather than creating rigid columns.

```
┌────────────────────────────────────────────────────────────┐
│  [Sidebar] │         Calendar Grid (edge-to-edge)          │
│  ┌───────┐ │  ┌─────────────────────────────────────────┐  │
│  │ Cal 1 │ │  │  08:00 ┌──────────────────────┐        │  │
│  │ Cal 2 │ │  │        │   Standup             │        │  │
│  │ Cal 3 │ │  │  09:00 └──────────────────────┘        │  │
│  │        │ │  │        ┌──────────────────────┐        │  │
│  │        │ │  │  10:00 │   Sprint Review      │        │  │
│  │        │ │  │        └──────────────────────┘        │  │
│  └───────┘ │  └─────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────┘
```

#### The Command Palette (Cmd + K)

| Property | Detail |
|----------|--------|
| **Trigger** | `Cmd+K` (Mac) / `Ctrl+K` (Windows/Linux) |
| **Visual** | Spotlight search modal centered on screen |
| **Backdrop** | Heavy blur (`backdrop-filter: blur(24px)`) |
| **Interaction** | Keyboard navigable. Arrow keys highlight options with soft gray background. `Enter` snaps the action. |

```
┌────────────────────────────────────────────────────────────┐
│                                                             │
│              ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░              │
│           ┌──────────────────────────────────────┐         │
│           │  🔍  Search commands and events...    │         │
│           │                                      │         │
│           │  › Schedule Event                    │         │
│           │  › Jump to Date...                   │         │
│           │  › Open Settings                     │         │
│           │  › Toggle Dark Mode                  │         │
│           │  › Share Calendar                     │         │
│           │                                      │         │
│           │   7 results — use ↑↓ to navigate     │         │
│           └──────────────────────────────────────┘         │
│              ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░              │
│                                                             │
└────────────────────────────────────────────────────────────┘
```

#### The Sidebar

| Property | Detail |
|----------|--------|
| **Visual** | Translucent, hovering slightly over the main grid OR cleanly separated by a hairline 1px border |
| **Width** | 240px–280px (collapsible) |
| **Calendar toggle** | Hovering over a calendar name reveals a subtle "eye" icon to toggle visibility |

```
┌──────────────────┐
│  My Calendars    │
│                  │
│  ◉ Personal      │  👁  ← visible on hover
│  ◉ Work          │  👁
│  ◉ Freelance     │  👁  ← crossed out when hidden
│                  │
│  ─────────────   │
│  + Add Calendar  │
│                  │
│  Mini-Month      │
│  ┌────────────┐  │
│  │ Feb 2026   │  │
│  │ Mo Tu We.. │  │
│  └────────────┘  │
└──────────────────┘
```

### B. The Calendar Grid (The Core)

#### The Time Indicator (The "Now" Line)

* A **glowing, 2px neon line** stretching horizontally across the grid at the current time position.
* A **pulsing dot** at the left edge of the line.
* Color matches the accent color.
* Smoothly animates position as time progresses (no jarring jumps).

```
09:00 │
      │
10:00 │
      │ ●━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  ← 2px neon line + pulsing dot
11:00 │
```

#### Event Blocks

| Property | Value |
|----------|-------|
| **Border radius** | `radius-md` (8px) |
| **Background** | 15% opacity version of the accent color |
| **Left border** | 2px solid in the full accent color |
| **Default state** | Clean, flat, minimal |
| **Hover state** | Slightly elevated (soft shadow). Quick-action icons (Edit, Delete) appear in top-right corner. |

```
Default:                       Hover:
┌────────────────┐            ┌────────────────┐
│▌               │            │▌            ✎ 🗑│
│▌  Sprint Review│            │▌  Sprint Review│
│▌  10:00–11:00  │            │▌  10:00–11:00  │
│▌               │            │▌               │
└────────────────┘            └────────────────┘
  ↑ 2px solid border            ↑ elevated shadow
  bg: accent@15%                + action icons visible
```

#### Ghost Blocks

* When hovering over an empty slot on the grid, a **faded "ghost" block** appears.
* Shows exactly where a new event would snap if clicked.
* Uses dashed border + very low opacity fill.
* Snaps to 15-minute increments.

```
09:00 │
      │
      │  ┌ - - - - - - - - - - ┐  ← ghost block on hover
      │  │  Click to add event  │
      │  └ - - - - - - - - - - ┘
10:00 │
```

#### Drag-and-Drop Snap

* Dragging an event feels **magnetic**.
* Snaps fluidly to **15-minute increments**.
* While dragging, the event block follows the cursor with a slight scale transform (1.02x).
* A time tooltip follows the cursor showing the exact placement time.

### C. Modals & Dialogs

#### Event Creation Modal

| Property | Value |
|----------|-------|
| **Entry animation** | Slides up from bottom OR pops from center — spring animation |
| **Borders** | No hard borders |
| **Shadow** | `shadow-2xl` (soft, not harsh) |
| **Backdrop** | Blurred (`backdrop-filter: blur(12px)`) |

```
┌────────────────────────────────────────────┐
│                                            │
│  ┌──────────────────────────────────────┐  │
│  │                                      │  │
│  │   [Title — 24px, borderless input]   │  │
│  │                                      │  │
│  │   📅  Date Picker                    │  │
│  │   ⏰  Time Selector                  │  │
│  │   📍  Location (optional)            │  │
│  │                                      │  │
│  │   ┌──────────────────────────────┐   │  │
│  │   │  Description (Markdown...)   │   │  │
│  │   │                          ✨ │   │  │  ← AI Sparkle button
│  │   └──────────────────────────────┘   │  │
│  │                                      │  │
│  │   [Cancel]              [Create]     │  │
│  │                                      │  │
│  └──────────────────────────────────────┘  │
│                                            │
└────────────────────────────────────────────┘
```

**Input fields:** Borderless text inputs. The "Title" field is massive (`24px font`).

**AI Sparkle:** The description box features a subtle, glowing gradient button in the corner to trigger "AI Formatting" via the MCP server.


---

## 3. Mobile Application (The Premium On-The-Go Experience)

### A. Haptics & Tactile Feel

A million-dollar mobile app communicates through touch.

| Gesture | Haptic Feedback |
|---------|-----------------|
| **Drag event** | Light haptic tap |
| **Change view** | Light haptic tap |
| **Toggle switch** | Light haptic tap |
| **Event created successfully** | Distinct double-pulse vibration |
| **QR code approved** | Distinct double-pulse vibration |

### B. The QR Auth Scanner

| Property | Value |
|----------|-------|
| **Viewfinder** | Glowing, rounded corner brackets |
| **Background** | Darkened outside scanning area (`rgba(0,0,0,0.7)`) |
| **Detection animation** | Neon bounding box snaps to QR code → turns green → bottom sheet slides up |

```
┌──────────────────────────┐
│                          │
│    ░░░░░░░░░░░░░░░░░    │  ← darkened overlay
│    ░                 ░   │
│    ░   ┌──────────┐  ░   │
│    ░   │  Scan QR  │  ░   │  ← glowing corner brackets
│    ░   │  here     │  ░   │
│    ░   └──────────┘  ░   │
│    ░░░░░░░░░░░░░░░░░    │
│                          │
│  ┌────────────────────┐  │
│  │  ✅ Approve Login   │  │  ← bottom sheet slides up
│  │  for this browser?  │  │
│  │                    │  │
│  │     [Approve]      │  │
│  └────────────────────┘  │
└──────────────────────────┘
```

**Flow:**


1. Camera opens — darkened overlay with glowing brackets
2. QR detected — neon bounding box snaps to code
3. Code validated — box turns green
4. Bottom sheet slides up with spring animation: "Approve Login for this browser?"

### C. The Mobile Grid & Navigation

#### Bottom Sheet Navigation

Instead of jumping to new screens:

* Creating an event or viewing details pulls up an **Apple Maps-style bottom sheet**
* Can be swiped down to dismiss
* Sheet has a drag handle at the top
* Background content dims with blur

```
┌──────────────────────────┐
│                          │
│    Calendar Grid         │
│    (dimmed + blurred)    │
│                          │
│                          │
│  ┌──── ──── ──── ───┐   │
│  │  ═══  ← drag handle  │
│  │                    │   │
│  │  Sprint Review     │   │
│  │  10:00 – 11:00     │   │  ← bottom sheet
│  │  Room 204          │   │
│  │                    │   │
│  │  [Edit]  [Delete]  │   │
│  └────────────────────┘   │
└──────────────────────────┘
```

#### Pinch-to-Zoom

* Users can pinch the daily/weekly grid to expand or compress the time scale dynamically.
* Expand: see 5-minute increments (detailed planning mode).
* Compress: see 2-hour blocks (overview mode).
* Smooth spring animation between zoom levels.

#### The Agenda View

| Property | Value |
|----------|-------|
| **Scrolling** | Smooth, buttery (60/120fps target) |
| **Date headers** | Sticky — lock to top as user scrolls |
| **Visual** | Clean list cards with time on left, event details on right |

```
┌──────────────────────────┐
│  Today, May 10     📅   │  ← sticky header
├──────────────────────────┤
│  09:00                    │
│  ┌────────────────────┐  │
│  │  ▮ Standup          │  │
│  │  Team Room          │  │
│  └────────────────────┘  │
│                          │
│  10:00                    │
│  ┌────────────────────┐  │
│  │  ▮ Sprint Review    │  │
│  │  Room 204           │  │
│  └────────────────────┘  │
│                          │
│  11:00                    │
│  ┌────────────────────┐  │
│  │  ▮ 1:1 with Sarah   │  │
│  │  Virtual            │  │
│  └────────────────────┘  │
├──────────────────────────┤
│  Tomorrow, May 11   📅   │  ← next sticky header
├──────────────────────────┤
```


---

## 4. The 1% Details (What Separates Good from Elite)

### Empty States

* **No blank white screens.**
* If a user has no events, show a subtle, beautiful line-art illustration or a soft glowing gradient.
* Encouraging typography: *"Your day is clear. Breathe."*

```
┌────────────────────────────────────────────┐
│                                            │
│                                            │
│          ✦   ✧   ✦                        │
│        ✦         ✧                         │
│          ✧   ✦   ✧                        │
│            (subtle illustration)            │
│                                            │
│       Your day is clear.                   │
│       Breathe.                             │
│                                            │
│       [Create your first event]            │
│                                            │
└────────────────────────────────────────────┘
```

### Skeleton Loaders

* **No spinning circles.**
* Skeleton blocks match the **exact shape** of the calendar grid.
* Pulse with a fluid, **left-to-right shimmer** effect.
* Subtle — loading state should feel intentional, not broken.

```
┌────────────────────────────────────────────┐
│  09:00 ┌────────────────────────┐          │
│        │ ░░░░░░░░░░░░░░░░░░░░  │ ← shimmer │
│        └────────────────────────┘          │
│  10:00 ┌────────────────────────┐          │
│        │ ░░░░░░░░░░░░░░░░░░░░  │          │
│        └────────────────────────┘          │
│  11:00 ┌────────────────────────┐          │
│        │ ░░░░░░░░░░░░░░░░░░░░  │          │
│        └────────────────────────┘          │
└────────────────────────────────────────────┘
```

### Timezone Transitions

* If a user views an event in another timezone, the time **smoothly ticks/animates** to the new numbers rather than just instantly snapping.
* Example: `14:00 UTC` → smoothly counts to `10:00 EST` with a flip-clock or counter animation.
* Duration: 300–400ms spring animation.

```
Before:                    During:                    After:
┌──────────┐              ┌──────────┐              ┌──────────┐
│  14:00   │     →        │  13:45   │     →        │  10:00   │
│   UTC    │              │  anim... │              │   EST    │
└──────────┘              └──────────┘              └──────────┘
                           (smooth tick)
```


---

## ✅ Design Checklist

### Typography

- [ ] Inter / SF Pro for all UI text
- [ ] JetBrains Mono for time blocks and dates
- [ ] Heavy contrast between headers (32px) and secondary text (13px)
- [ ] Strict tracking and kerning applied

### Color

- [ ] Dark mode first — OLED black background
- [ ] Surface colors use exact hex values (`#121214`, `#09090B`)
- [ ] 1px inner border on elevated surfaces (`rgba(255,255,255,0.05)`)
- [ ] Accent color used sparingly (CTA, current time, active states only)

### Motion

- [ ] No linear animations anywhere
- [ ] Spring physics on all transitions (150–250ms)
- [ ] Drag-and-drop snaps to 15-min increments magnetically
- [ ] Pinch-to-zoom on mobile with smooth spring transitions

### Glassmorphism

- [ ] Blurred backdrops on modals, dropdowns, sticky headers
- [ ] Calendar grid bleeds through transparent panels

### Web

- [ ] Edge-to-edge canvas, no container borders
- [ ] Command palette (Cmd+K) with keyboard navigation
- [ ] Translucent sidebar with hover-reveal icons
- [ ] Glowing "Now" line with pulsing dot
- [ ] Ghost blocks on empty slot hover
- [ ] AI Sparkle button on description field
- [ ] Borderless inputs, soft shadows

### Mobile

- [ ] Light haptic taps on drag, view change, toggle
- [ ] Double-pulse success haptic on event create / QR approve
- [ ] Glowing QR scanner with corner brackets
- [ ] Bottom sheet navigation (Apple Maps style)
- [ ] Sticky date headers in agenda view
- [ ] 60/120fps target scrolling

### The 1% Details

- [ ] Beautiful empty states (line-art + encouraging text)
- [ ] Skeleton loaders (shimmer, not spinners)
- [ ] Animated timezone transitions (flip-clock style)
