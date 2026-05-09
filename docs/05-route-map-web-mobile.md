# 🗺️ 🗺️ Route Map — Web & Mobile Page Hierarchy

# 🗺️ NovaCal — Route Map

> **Web:** Next.js 15 App Router **Mobile:** React Native / Expo Router **Philosophy:** No marketing pages. The app assumes deployment behind a reverse proxy and goes straight to business.


---

## 🌐 Web Application (Next.js App Router)

### 1. Initialization & Auth — `/app/(auth)`

```
/                          Root route.
                           → Unauthenticated: renders minimal Login/QR screen.
                           → Authenticated: redirects to /calendar.

/setup                     "First Run" wizard. Triggers only once when the Docker
                           container boots for the very first time to create the
                           Instance Admin account.

/login                     Email/password fallback.

/login/qr                  The dynamic WebSocket QR code for the mobile bridge.

/auth/callback             (System) Invisible route handling Better Auth session
                           tokens. No UI — purely a redirect handler.
```

**Layout:** Minimal, centered card layout. No sidebar, no navigation.\n**Middleware:** `middleware.ts` at root checks session token. Redirects `/` → `/calendar` if authenticated, or renders auth UI if not.


---

### 2. Core Application — `/app/(dashboard)`

```
/calendar                  The main grid view.
                           → Default landing page after authentication.
                           → Renders the edge-to-edge calendar grid.

/calendar/day              Specific day view. URL carries query params for date.

/calendar/week             Specific week view. URL carries query params for week.

/agenda                    Infinite scroll list view of all upcoming chronological
                           events. Sticky date headers.

/search                    Full-page PostgreSQL FTS interface.
                           → Search bar autofocuses on mount.
                           → Results rendered as a filterable list.
                           → Supports keyboard navigation (↑↓ to select, Enter to open).
```

**Layout:** Sidebar + edge-to-edge canvas. Translucent sidebar with calendar toggles, mini-month navigator.\n**Auth required:** Yes — all routes in this group require an active session.


---

### 3. Developer & MCP Integrations — `/app/(developer)`

```
/developer/mcp             The AI Agent configuration hub.
                           → Displays the mcp.json payload for local agents.
                           → Shows connection string, instructions for Cursor/Claude.
                           → "Copy Config" button.

/developer/api-keys        Generate and revoke standard REST API keys.
                           → Key table: name, prefix, created date, last used.
                           → "Create Key" button → reveals full key once.

/developer/webhooks        Configure outgoing webhooks.
                           → Event triggers: event.created, event.updated, event.deleted
                           → Target URL input + secret token.
                           → Delivery log table (status, timestamp, response code).
```

**Layout:** Developer-oriented — slightly denser UI, monospace for keys and payloads.\n**Auth required:** Yes — Admin or Owner role only.


---

### 4. Team & Workspace Management — `/app/(workspace)`

```
/w/[workspaceId]/settings          Workspace configuration.
                                   → Name, custom branding, default timezone.
                                   → Danger Zone: delete workspace.

/w/[workspaceId]/members           Data table of workspace members.
                                   → Columns: Name, Email, Role, Joined, Actions.
                                   → Role dropdown per user (Owner/Admin/Editor/Viewer/Free-Busy).
                                   → "Invite Member" button → generates one-time link.
```

**Layout:** Settings-style layout with left nav tabs (Settings | Members).\n**Auth required:** Yes — scoped to workspace role permissions.


---

### 5. Instance Administration — `/app/(admin)`

Since NovaCal is self-hosted, a "God Mode" manages the instance itself, independent of individual workspaces.

```
/admin/dashboard           Global instance metrics.
                           → Total users, total events, total workspaces.
                           → Active WebSocket connections (live count).
                           → Database size, Redis memory usage.

/admin/users               Global user management.
                           → User table: Name, Email, Status, Created, Last Login.
                           → Actions: force reset password, ban/unban user.
                           → Search + filter.

/admin/system              System diagnostics.
                           → Redis cache memory usage and connection health.
                           → PostgreSQL connection pool status.
                           → Uptime, version info.
                           → Logs viewer (last 100 lines of stdout).
```

**Layout:** Admin-specific sidebar with dashboard-style cards and charts.\n**Auth required:** Yes — Instance Admin role only (the account created in `/setup`).


---

### 6. User Settings — `/app/(settings)`

```
/settings/profile          Name, avatar upload, personal timezone selector.

/settings/security         Change password, 2FA setup (TOTP).

/settings/sessions         Active device ledger.
                           → Table: Device, IP, Last Active, Created.
                           → "Revoke" button per session.
                           → "Log out of all devices" panic button.

/settings/preferences      UI theme (dark/light/system), start of week (Mon/Sun),
                           default calendar view, time format (12h/24h).
```

**Layout:** Settings-style layout with left nav tabs.\n**Auth required:** Yes.


---

### 7. Public Sharing — `/app/(public)`

```
/p/[hash]                  Read-only public calendar view.
                           → Cryptographically secure hash.
                           → No login required. Renders a clean, minimal calendar.
                           → Respects share settings (password, expiration).

/p/[hash]/auth             (System) Password challenge screen.
                           → Only shown if the shared link has a password set.
                           → Simple centered form. On success, redirects to /p/[hash].

/e/[hash]                  Single event landing page.
                           → Standalone page for one event.
                           → Shows: title, time, description, location.
                           → "Add to Calendar" quick action button (generates .ics download).
```

**Layout:** Minimal, no sidebar, no nav. Clean centered rendering.\n**Auth required:** No — these are public-by-design.


---

### 8. System & Error States

```
not-found.tsx (/404)       Minimalist 404.
                           → "This page doesn't exist."
                           → Link back to /calendar.
                           → No illustration — just clean typography.

error.tsx (/500)           Global error boundary.
                           → Raw stack trace dump (since target users are developers).
                           → "Something broke. Here's what happened:"
                           → Collapsible error details.
                           → "Reload" button.
```


---

### ✅ Web Route Summary

| Group | Base Path | Auth | Layout |
|-------|-----------|------|--------|
| Auth  | `/`       | Public (or redirect) | Centered minimal |
| Dashboard | `/calendar`, `/agenda`, `/search` | Required | Sidebar + canvas |
| Developer | `/developer/*` | Required (Admin/Owner) | Developer compact |
| Workspace | `/w/[id]/*` | Required + role-scoped | Settings tabs |
| Admin | `/admin/*` | Required (Instance Admin) | Admin dashboard |
| Settings | `/settings/*` | Required | Settings tabs |
| Public | `/p/[hash]`, `/e/[hash]` | Public | Minimal |


---

## 📱 Mobile Application (React Native / Expo Router)

For a self-hosted FOSS app, the mobile app **cannot hardcode a backend URL**. The user must point the app to their instance first.

### 1. Instance Connection & Auth Stack — `/app/(auth)`

```
/connect                   The very first screen.
                           → Single input field: "Instance URL"
                           → e.g., https://cal.yourdomain.com
                           → "Connect" button → validates reachability.
                           → On success: persists URL in secure storage, navigates to /login.

/login                     Email/password input routed to the provided instance URL.
                           → Fields: Email, Password.
                           → "Log In" button → POSTs to {instanceUrl}/api/auth/login.
                           → On success: stores session token, navigates to tabs.

/scanner                   The QR Bridge.
                           → Camera viewfinder to scan the Web UI QR code.
                           → Glowing corner brackets, darkened overlay.
                           → On scan: sends challenge to {instanceUrl}/api/auth/approve-qr.
                           → On success: navigates directly to tabs (no password needed).
```

**Stack:** Auth stack (not in tab navigator). Shown only when no valid session exists.


---

### 2. The Main Tab Navigator — `/app/(tabs)`

```
/(tabs)/calendar           Swipeable month/day grid.
                           → Month view by default. Swipe left for next month.
                           → Tap a day → transitions to day view.
                           → Pull down to refresh.

/(tabs)/agenda             Vertical scrolling chronological list.
                           → Sticky date headers.
                           → Each card: time, title, location, color dot.
                           → Tap → opens /event/[id] modal.

/(tabs)/notifications      Feed of team invites and AI scheduling confirmations.
                           → Notification cards: type icon, message, timestamp.
                           → Tap invite → accept/decline sheet.
                           → Tap AI confirmation → opens the created event.

/(tabs)/settings           Main settings hub.
                           → Rows: Profile, Workspaces, Notifications, Appearance,
                             Database Sync, Server Info.
                           → Tap → navigates to /settings/* screens.
```

**Layout:** Bottom tab bar with 4 tabs (Calendar, Agenda, Notifications, Settings).\n**Auth required:** Yes.


---

### 3. Full-Screen Modals — `/app/(modals)`

```
/event/new                 Form to create a new event.
                           → Title, date/time, duration, location, description (Markdown).
                           → Workspace selector (if in multiple workspaces).
                           → "Save" → optimistically updates local SQLite, queues sync.

/event/[id]                View details of an existing event.
                           → Read-only display of all fields.
                           → Bottom action bar: "Edit", "Delete", "Add to Calendar" (.ics).

/event/[id]/edit           Modify an existing event.
                           → Same form layout as /event/new, pre-filled.
                           → If recurring: "This event" vs "All events" prompt.
                           → "Save" → optimistic local update + sync queue.

/search                    Full-screen search overlay.
                           → Search bar autofocuses on mount (keyboard visible).
                           → Results stream in as user types (local SQLite FTS first,
                             then server-side PostgreSQL FTS fallback).
                           → Tap result → opens /event/[id].
```

**Presentation:** Modal presentation (slides up from bottom on iOS, fade in on Android).\n**Auth required:** Yes.


---

### 4. Settings & Diagnostics — `/app/(settings)`

```
/settings/profile               Edit display name.

/settings/workspaces            Switch active workspace context.
                                → List of workspaces the user belongs to.
                                → Current workspace highlighted.
                                → Tap → sets active context, goes back.

/settings/notifications         Push notification preferences.
                                → Toggles: Event reminders, Team invites,
                                  AI scheduling confirmations.
                                → Reminder timing: 10min, 30min, 1hr, 1 day.

/settings/appearance            Theme overrides.
                                → Dark / Light / System.
                                → Accent color picker (optional).

/settings/database-sync         (System) Critical for offline-first architecture.
                                → SQLite local file size display.
                                → Sync queue: pending items count.
                                → Last sync timestamp.
                                → "Force Push" button → immediately syncs all queued
                                  mutations to the VPS backend.
                                → "Pull Latest" button → fetches remote changes.

/settings/server-info           Displays the connected Instance URL and current
                                server ping latency.
                                → Instance URL (read-only).
                                → Ping latency in ms (live, updated every tap).
                                → Server version.
```

**Layout:** List-based settings screens with push navigation.\n**Auth required:** Yes.


---

### 5. System Screens

```
+not-found.tsx              Fallback screen for broken deep links.
                            → "Screen not found"
                            → "Go Home" button → navigates to tabs root.

_layout.tsx                 Root layout wrapping the entire app.
                            → SQLite provider (initializes local DB on mount).
                            → Global toast container.
                            → Network status listener (online/offline → sync engine trigger).
                            → Deep link handler.
```


---

### ✅ Mobile Route Summary

| Group | Base Path | Presentation | Entry Condition |
|-------|-----------|--------------|-----------------|
| Auth  | `/connect`, `/login`, `/scanner` | Full-screen stack | No valid session |
| Tabs  | `/calendar`, `/agenda`, `/notifications`, `/settings` | Bottom tab bar | Authenticated   |
| Modals | `/event/*`, `/search` | Slide-up modal | Any tab         |
| Settings | `/settings/*` | Push navigation | From settings tab |
| System | `+not-found`, `_layout` | —            | Always active   |


---

## 🔗 Web ↔ Mobile Route Mapping

| Action | Web Route | Mobile Route | Notes |
|--------|-----------|--------------|-------|
| First visit | `/` → Login/QR | `/connect` → Instance URL first | Mobile needs instance URL first |
| Login  | `/login`  | `/login`     | Both email/password |
| QR auth | `/login/qr` | `/scanner`   | Web generates QR, mobile scans |
| Calendar view | `/calendar` | `/(tabs)/calendar` | Both show grid |
| Agenda | `/agenda` | `/(tabs)/agenda` | Both infinite scroll |
| Search | `/search` | `/search`    | Both FTS-powered |
| Event detail | Click grid event | `/(modals)/event/[id]` | Web: modal/panel, Mobile: full-screen modal |
| Event create | Click ghost block | `/(modals)/event/new` | Web: popup, Mobile: slide-up |
| Settings | `/settings/*` | `/settings/*` | Different layout but same concerns |
| MCP config | `/developer/mcp` | Not on mobile | Developer features are web-only |
| Admin  | `/admin/*` | Not on mobile | Admin is web-only |
| Public share | `/p/[hash]` | Not on mobile | Public links open in browser |
