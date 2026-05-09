# 🔄 🔄 User Flows & Requirements — All Roles, Access & Sharing

# 🔄 NovaCal — User Flows & Requirements

> **Covers:** All user roles (Owner, Admin, Editor, Viewer, Free-Busy Viewer), QR auth flow, public sharing, AI agent integration, and mobile offline flows.


---

## 👤 User Flows


---

### 1. The Passwordless QR Login Flow

```
┌─────────────────────────────────────────────────────────────────────────┐
│                                                                          │
│  1. User navigates to the web interface on a desktop browser.            │
│                                                                          │
│  2. The web interface displays a dynamically refreshing QR code.        │
│                                                                          │
│  3. User opens the authenticated mobile application                      │
│     and accesses the built-in scanner.                                  │
│                                                                          │
│  4. User scans the web QR code.                                         │
│                                                                          │
│  5. The mobile app prompts:                                              │
│     "Approve login for this browser?"                                    │
│                                                                          │
│  6. User taps "Approve."                                                │
│                                                                          │
│  7. The web interface instantly authenticates,                           │
│     bypasses the login screen, and loads the user's default workspace.   │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

**Actors:** Unauthenticated Web User, Authenticated Mobile User\n**Trigger:** Web user visits login page\n**Result:** Web session established with zero password entry


---

### 2. Owner: Workspace Initialization & Setup Flow

```
┌─────────────────────────────────────────────────────────────────────────┐
│                                                                          │
│  1. Owner creates a new Workspace                                        │
│     (e.g., "Engineering Team").                                         │
│                                                                          │
│  2. Owner sets the workspace name,                                       │
│     custom branding, and timezone defaults.                             │
│                                                                          │
│  3. Owner navigates to the member management dashboard                   │
│     to generate invitation links.                                       │
│                                                                          │
│  4. Owner retains exclusive rights to:                                   │
│     • Delete the workspace                                               │
│     • Transfer ownership to another user                                 │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

**Actors:** Owner\n**Trigger:** First-time workspace creation\n**Result:** Isolated workspace ready for team onboarding


---

### 3. Admin: Team Invitation & Onboarding Flow

```
┌─────────────────────────────────────────────────────────────────────────┐
│                                                                          │
│  1. Admin generates a secure, one-time invitation link                   │
│     via the workspace settings.                                         │
│                                                                          │
│  2. Admin pre-selects the role for the invitee                           │
│     (e.g., "Editor").                                                   │
│                                                                          │
│  3. External user clicks the link, registers for an account,             │
│     and is automatically routed to the Admin's workspace.               │
│                                                                          │
│  4. The system alerts the Admin                                           │
│     that the user has successfully joined.                              │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

**Actors:** Admin, External User (New Registration)\n**Trigger:** Admin initiates invite\n**Result:** New user onboarded into correct workspace with correct role


---

### 4. Editor: Collaborative Event Modification Flow

```
┌─────────────────────────────────────────────────────────────────────────┐
│                                                                          │
│  1. Editor views a shared team calendar.                                │
│                                                                          │
│  2. Editor clicks and drags an existing event                            │
│     to a new time slot to reschedule it.                                │
│                                                                          │
│  3. The system instantly broadcasts this change                          │
│     to all other team members currently viewing the calendar.            │
│                                                                          │
│  4. Editor updates the event description using Markdown;                 │
│     the changes are saved and synced globally                            │
│     without requiring a page refresh.                                   │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

**Actors:** Editor\n**Trigger:** Drag-and-drop or description edit\n**Result:** Real-time multi-device synchronization


---

### 5. Viewer: Read-Only Insight Flow

```
┌─────────────────────────────────────────────────────────────────────────┐
│                                                                          │
│  1. Viewer opens the shared team calendar.                              │
│                                                                          │
│  2. Viewer clicks on an upcoming team meeting.                          │
│                                                                          │
│  3. A modal opens displaying:                                           │
│     • Title                                                             │
│     • Location                                                          │
│     • Description                                                       │
│     • Attendee list                                                     │
│                                                                          │
│  4. The interface hides all "Edit," "Delete," and "Save" buttons,        │
│     restricting the Viewer to strictly consuming the information.        │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

**Actors:** Viewer\n**Trigger:** Click event on shared calendar\n**Result:** Read-only detail view, no mutation controls visible


---

### 6. Free-Busy Viewer: Privacy-Preserved Scheduling Flow

```
┌─────────────────────────────────────────────────────────────────────────┐
│                                                                          │
│  1. Free-Busy Viewer attempts to find a time                              │
│     to meet with a senior team member.                                  │
│                                                                          │
│  2. They overlay the senior member's calendar onto their own view.      │
│                                                                          │
│  3. The system displays the senior member's scheduled events             │
│     simply as grey blocks labeled "Busy."                               │
│                                                                          │
│  4. The Free-Busy Viewer finds an empty slot                              │
│     between the "Busy" blocks and sends a meeting invitation             │
│     for that specific time.                                             │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

**Actors:** Free-Busy Viewer\n**Trigger:** Attempting to schedule with a colleague\n**Result:** Privacy preserved — no titles, descriptions, or locations leaked


---

### 7. Secure Public Sharing Flow

```
┌─────────────────────────────────────────────────────────────────────────┐
│                                                                          │
│  1. User selects a specific calendar within their workspace.            │
│                                                                          │
│  2. User clicks "Share Publicly"                                         │
│     and the system generates a cryptographically secure, random URL.    │
│                                                                          │
│  3. User toggles "Require Password"                                      │
│     and sets a custom password.                                         │
│                                                                          │
│  4. User sends the URL to an external client.                           │
│                                                                          │
│  5. The client opens the URL, enters the password,                       │
│     and views a read-only rendering of the calendar.                    │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

**Actors:** Any role with share permission, External Client (Unauthenticated)\n**Trigger:** User needs to share calendar outside the platform\n**Result:** Secure, revokable, optionally password-protected public view


---

### 8. AI Agent (MCP) Automated Scheduling Flow

```
┌─────────────────────────────────────────────────────────────────────────┐
│                                                                          │
│  1. User interacts with an external AI agent                              │
│     (e.g., in their code editor) and types:                             │
│     "Schedule a code review with the frontend team tomorrow at 2 PM."   │
│                                                                          │
│  2. The AI agent connects to the system's built-in MCP server.          │
│                                                                          │
│  3. The AI agent checks the "Frontend Team" calendar                     │
│     for conflicts at 2 PM.                                              │
│                                                                          │
│  4. Finding no conflicts, the AI agent sends                            │
│     a structured command to create the event.                           │
│                                                                          │
│  5. The system creates the event and                                    │
│     it instantly appears on the user's interface.                       │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

**Actors:** User, External AI Agent (Cursor/Claude/OpenCode)\n**Trigger:** Natural language scheduling command\n**Result:** Event created via AI with conflict checking


---

### 9. Mobile Offline Creation & Synchronization Flow

```
┌─────────────────────────────────────────────────────────────────────────┐
│                                                                          │
│  1. User travels to an area with no cellular reception.                 │
│                                                                          │
│  2. User opens the mobile app,                                           │
│     which loads the cached calendar seamlessly.                         │
│                                                                          │
│  3. User creates a new event ("Flight to New York")                      │
│     for the following week.                                             │
│                                                                          │
│  4. The mobile app saves the event locally                               │
│     and queues the action.                                              │
│                                                                          │
│  5. Upon reconnecting to Wi-Fi,                                          │
│     the app silently synchronizes the queued event                      │
│     to the main server.                                                  │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

**Actors:** Mobile User\n**Trigger:** Create event while offline\n**Result:** Event queued locally, synced on reconnection


---

### 10. Single-Instance Recurrence Editing Flow

```
┌─────────────────────────────────────────────────────────────────────────┐
│                                                                          │
│  1. User clicks on an event that is part of                              │
│     a "Weekly Team Sync" recurring series.                              │
│                                                                          │
│  2. User selects "Edit Event."                                          │
│                                                                          │
│  3. The system prompts:                                                  │
│     "Edit this event only, or the entire series?"                       │
│                                                                          │
│  4. User selects "This event only"                                      │
│     and changes the time.                                               │
│                                                                          │
│  5. The system splits that specific date from the parent series,         │
│     modifying the single event while leaving                             │
│     all future and past recurrences intact.                             │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

**Actors:** Editor / Admin / Owner\n**Trigger:** Modify one occurrence of a recurring event\n**Result:** Instance split from series without affecting siblings


---

## ⚙️ 20 Functional Requirements

**FR-01 — QR-Based Passwordless Authentication**

> The system must authenticate users via a time-sensitive, QR-based challenge-response mechanism without relying on third-party OAuth providers.

**FR-02 — Active Session Ledger & Remote Revocation**

> The system must maintain an active session ledger and allow users to remotely revoke any active session from any device.

**FR-03 — Real-Time Cross-Client Synchronization**

> The system must execute real-time synchronization across all connected clients within a workspace upon any event creation, update, or deletion.

**FR-04 — UTC-Normalized Timezone Storage**

> The system must store all event timestamps internally in UTC and render them dynamically based on the requesting client's local timezone.

**FR-05 — Complex Recurrence Rule (RRule) Resolution**

> The system must process and resolve complex recurrence rules (RRule), including daily, weekly, monthly, yearly, and custom termination conditions.

**FR-06 — Single-Instance Recurrence Modification**

> The system must allow the modification or deletion of a single instance of a recurring event without altering the integrity of the parent series.

**FR-07 — API-Level RBAC Enforcement**

> The system must enforce Role-Based Access Control (RBAC) at the API level, strictly restricting write operations to Owners, Admins, and Editors.

**FR-08 — Free-Busy Data Obscuration**

> The system must obscure event titles, descriptions, and locations from users assigned the "Free-Busy Viewer" role, returning only time block availability data.

**FR-09 — AI Agent Connectivity Endpoint**

> The system must provide a continuous, long-lived connection endpoint to facilitate communication with external AI agents.

**FR-10 — Exposed Agentic Tools with Secure API Key**

> The system must expose calendar search, conflict resolution, and event creation endpoints directly to authorized AI agents through a secure API key.

**FR-11 — Multi-Attendee Conflict Detection**

> The system must detect and logically flag scheduling conflicts when multiple attendees are added to a single proposed event.

**FR-12 — Cryptographically Secure Share URLs**

> The system must generate cryptographically secure, unguessable URLs to facilitate the sharing of specific calendar views to non-registered users.

**FR-13 — Public URL Password & Expiration**

> The system must support the application of password hashing and expiration timestamps on all publicly shared URLs.

**FR-14 — .ics Feed Generation**

> The system must automatically generate and serve standard .ics formatted feeds for cross-platform calendar subscription.

**FR-15 — PostgreSQL Full-Text Search (FTS)**

> The system must execute full-text search queries across event titles, descriptions, and locations, incorporating typo tolerance and partial word matching.

**FR-16 — Mobile Offline Calendar Cache**

> The mobile application must cache calendar data locally to support full read-and-write functionality in completely offline environments.

**FR-17 — Queued Sync on Network Restoration**

> The mobile application must queue local database mutations and automatically synchronize them with the server upon detecting network restoration.

**FR-18 — Strict No-Attachments Policy**

> The system must strictly reject binary file attachments (images, PDFs) to maintain database performance and optimize payload synchronization speeds.

**FR-19 — Push Notification Reminders**

> The system must trigger push notifications to target devices based on user-defined event reminder intervals (e.g., 10 minutes prior, 1 hour prior).

**FR-20 — AI Natural Language Input Validation**

> The system must validate all incoming natural language scheduling requests from AI agents to ensure strict timestamp compliance before database insertion.


---

## ✨ 20 Feature Requirements

**FE-01 — QR Login Bridge**

> A passwordless login system bridging the mobile app and web browser via a scannable interface.

**FE-02 — Device Management Dashboard**

> An interface displaying all active logins with a global "Log out of all devices" panic button.

**FE-03 — Dynamic Calendar Grid**

> An interactive interface supporting Day, 3-Day, Work Week, Full Week, Month, and Year viewing modes.

**FE-04 — Drag-and-Drop Rescheduling**

> The ability to move events across the grid or drag the bottom edge to extend an event's duration.

**FE-05 — Infinite Agenda View**

> A continuously scrolling, list-based view of all upcoming chronological events.

**FE-06 — Rich-Text Markdown Editor**

> Support for formatting event descriptions with bold text, lists, links, and code blocks.

**FE-07 — Workspace Isolation**

> The ability to create distinctly separate environments for personal, freelance, and organizational calendars.

**FE-08 — Member Directory & Role Assignment**

> A management panel to view all workspace participants and alter their access levels via dropdown menus.

**FE-09 — Secure Invitation Links**

> One-time-use URLs generated specifically to onboard new team members into a workspace.

**FE-10 — Visual Conflict Indicators**

> Red UI highlights that appear when adding a team member to a meeting that overlaps with their existing schedule.

**FE-11 — Color Coding & Tags**

> A customizable categorization system allowing users to assign specific colors and text tags to different types of events.

**FE-12 — Event-Specific Timezones**

> A dropdown selector allowing users to schedule events in a different timezone than their current local default.

**FE-13 — Single Event Landing Pages**

> Standalone, shareable public web pages for individual events containing an "Add to Calendar" quick action button.

**FE-14 — AI Agent Configuration Hub**

> A dashboard to generate API keys and connection strings for integrating external AI assistants.

**FE-15 — Natural Language AI Inputs**

> A dedicated command bar where users can type raw text (e.g., "Lunch tomorrow at noon") to generate formatted events.

**FE-16 — "Find Common Time" Automator**

> A built-in utility that cross-references the calendars of selected team members to suggest the earliest available meeting slots.

**FE-17 — Theme Synchronization**

> Native support for dark mode, light mode, and automatic matching with the user's operating system preferences.

**FE-18 — Dedicated Mobile Scanner Module**

> A prominent, easily accessible camera interface within the mobile app built exclusively for web authentication.

**FE-19 — Customizable Push Reminders**

> Alert settings allowing users to define multiple notification triggers per event directly to their mobile lock screen.

**FE-20 — Mini-Month Navigator**

> A persistently visible, miniaturized sidebar calendar for rapid date jumping across different months and years.


---

## 🔗 Traceability Matrix

| FR # | FE # | Flow(s) |
|------|------|---------|
| FR-01 | FE-01 | Flow 1 (QR Login) |
| FR-02 | FE-02 | Flow 1, 2 |
| FR-03 | FE-03 | Flow 4 (Collaborative Editing) |
| FR-04 | FE-12 | Flow 2 (Workspace Setup), All calendar views |
| FR-05 | —    | Flow 10 (Recurrence) |
| FR-06 | —    | Flow 10 (Single-Instance Edit) |
| FR-07 | FE-08 | Flows 3, 5, 6 (Invitation, Viewer, Free-Busy) |
| FR-08 | —    | Flow 6 (Free-Busy Viewer) |
| FR-09 | FE-14 | Flow 8 (AI Agent) |
| FR-10 | FE-14, FE-15 | Flow 8 (AI Agent) |
| FR-11 | FE-10 | Flow 8 (Conflict Check) |
| FR-12 | FE-13 | Flow 7 (Public Sharing) |
| FR-13 | —    | Flow 7 (Password-Protected) |
| FR-14 | —    | Flow 7 (.ics Export) |
| FR-15 | —    | All flows |
| FR-16 | —    | Flow 9 (Offline) |
| FR-17 | —    | Flow 9 (Sync) |
| FR-18 | —    | All flows (infrastructure) |
| FR-19 | FE-19 | Flow 4, 8 |
| FR-20 | FE-15 | Flow 8 (AI Validation) |
