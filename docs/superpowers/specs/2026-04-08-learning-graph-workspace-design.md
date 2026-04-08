# Learning Graph Workspace Design

Date: 2026-04-08
Status: Drafted for user review
Scope: Dashboard UX and routing refinement for the existing AI Learning Graph Coach MVP

## 1. Purpose

This spec defines the dashboard information architecture and user flow for the learning graph feature after the MVP backend and core concept-learning loop already exist.

The current feature exposes multiple screens in code, but the default entry route behaves like a single create form. Users entering `/dashboard/learning-graph` do not clearly see that the product also supports session continuation, concept learning, and graph visualization.

This spec fixes that problem by reshaping the feature into a multi-session workspace with a consistent session shell.

## 2. Relationship To Existing Spec

This document complements, and does not replace, the product MVP spec in [docs/superpowers/specs/2026-04-08-ai-learning-graph-coach-design.md](/home/phan-duong-quoc-nhat/workspace/InsForge/docs/superpowers/specs/2026-04-08-ai-learning-graph-coach-design.md).

The earlier spec defines the product loop, domain model, and backend architecture. This document adds the missing dashboard UX structure needed to make that product usable when a learner has multiple sessions.

## 3. Product Decision Summary

The dashboard must treat learning graph as a multi-session workspace, not a single-session wizard.

Approved decisions:

- The default route is a workspace hub, not a full-page create form.
- One user may have multiple sessions in parallel.
- The workspace prioritizes session management over create-first presentation.
- The main layout is hybrid:
  - one spotlight area for the most relevant session
  - one library area for the broader session list
- Creating a session uses a right-side drawer on desktop and a full-screen sheet on mobile.
- Clicking an active or in-progress session opens the current learning concept.
- Clicking a completed session opens that session's overview.
- Session lists sort by most recent activity first.
- The spotlight emphasizes "continue learning" ahead of raw status telemetry.

## 4. Information Architecture

The feature is split into two layers.

### 4.1 Workspace Root

Route:

- `/dashboard/learning-graph`

Responsibilities:

- show the learner's current workspace
- expose create-session entrypoint
- surface the most relevant session to resume
- list all learning sessions with quick actions

This route is the universal entrypoint for the feature.

### 4.2 Session Shell

Routes:

- `/dashboard/learning-graph/sessions/:sessionId/overview`
- `/dashboard/learning-graph/sessions/:sessionId/learn`
- `/dashboard/learning-graph/sessions/:sessionId/graph`
- `/dashboard/learning-graph/sessions/:sessionId/concepts/:conceptId`

Responsibilities:

- provide a consistent frame for one specific session
- keep sub-navigation stable while users move between overview, learn, and graph
- prevent the current fragmented feeling where users jump between unrelated pages

### 4.3 Route Resolution Rules

- Entering the workspace root always lands on the multi-session hub.
- Clicking a non-completed session from the workspace opens `/learn`.
- Clicking a completed session from the workspace opens `/overview`.
- Entering `/learn` resolves the current concept and redirects to `/concepts/:conceptId` when available.
- If no current concept can be resolved for a non-completed session, the feature falls back to `/overview` with a visible warning state.

## 5. Screen Design

### 5.1 Workspace Root

The root page should feel like an active learning control center rather than a bare form.

Layout order:

1. Page header with title, short description, and `Tạo session mới`
2. Spotlight card for the most relevant session
3. Session library section with filters, counts, and list/grid content
4. Empty-state or library content depending on data

#### Header

The header should establish that this page manages many learning paths.

Required elements:

- feature title
- one-sentence explanation
- primary CTA: `Tạo session mới`
- optional secondary count such as total sessions or active sessions

#### Spotlight

The spotlight represents the learner's best next action.

It should display:

- session title
- current concept name when present
- progress summary
- session status
- recent activity hint
- primary CTA:
  - `Tiếp tục học` for non-completed sessions
  - `Xem tổng quan` for completed sessions
- secondary CTA:
  - `Xem đồ thị`

The spotlight is an action card, not an analytics card. Progress and metadata support the action, but do not replace it.

#### Session Library

The session library is the main management surface.

Required behavior:

- sort by latest activity descending by default
- support multiple sessions without collapsing into a long create-first page
- make it obvious which session is current, completed, failed, or still preparing

For the first implementation, `updatedAt` may serve as the latest-activity proxy if there is no separate activity timestamp yet.

Presentation:

- hybrid layout
- spotlight above
- session collection below

Session cards should expose:

- goal title
- status badge
- progress
- current concept if available
- updated time
- quick actions for overview and graph

The primary click action on the card itself follows the route rules from section 4.3.

### 5.2 Create Session Drawer

Session creation should preserve workspace context.

Why drawer over page or modal:

- users can still understand where the new session will land
- the workspace remains the core surface instead of disappearing
- the input form is too large for a cramped modal

Form requirements:

- visible labels for every field
- topic as required field
- source text as optional field
- inline validation
- loading, success, and error feedback

On success:

- close the drawer
- refresh the library
- place the new session near the top through latest-activity sorting
- update spotlight selection to the new session when appropriate

### 5.3 Session Shell

The session shell gives every session a stable frame.

Required navigation:

- `Overview`
- `Learn`
- `Graph`

Shell header should show:

- session title
- high-level status
- concise progress summary
- back link to workspace

This shell solves the current discoverability issue by exposing the feature map inside every session view.

### 5.4 Overview

The overview is the summary surface for one session.

It should show:

- path summary
- progress summary
- current or last concept
- graph summary
- CTA to continue learning or review

Completed sessions default here because the learner's main need becomes recap and navigation, not forced re-entry into the last concept.

### 5.5 Learn

The learn route is a behavioral route rather than a rich standalone screen.

Its responsibility is:

- resolve the current concept for a session
- redirect to the active concept learning screen

This keeps workspace actions simple:

- user clicks session
- system takes them to the correct learning step

### 5.6 Concept View

The concept screen remains the main study surface but should inherit the session shell instead of feeling like an isolated route.

It should keep:

- explanation
- quiz
- path panel
- navigation to overview and graph through the shell

Copy and component polish should stay Vietnamese and align with the broader dashboard tone.

### 5.7 Graph View

The graph remains a secondary visualization surface.

It is useful for:

- prerequisite reasoning
- structural understanding
- review

It should not become the main entrypoint for active learning.

## 6. Visual Direction

The UI should be noticeably more intentional than the current plain card-and-form layout, but it must still fit the existing InsForge dashboard.

Guiding principles:

- keep the established dashboard visual language instead of switching to a playful onboarding aesthetic
- use stronger hierarchy for spotlight and session cards
- use subtle gradient, layered surfaces, and better spacing instead of flat empty space
- keep motion restrained and meaningful
- maintain accessible contrast and keyboard focus states

Specific UI guidance:

- spotlight uses stronger contrast and emphasis than library cards
- library cards need stable hover feedback without layout-shifting transforms
- input fields need visible labels rather than placeholder-only labeling
- drawer should feel like part of the product shell, not a generic popup
- empty states must still look like a finished workspace

## 7. Data Requirements

The dashboard needs a library-oriented read model in addition to the existing session detail endpoints.

The workspace root needs:

- all sessions for the current user
- latest activity metadata
- progress snapshot
- current concept summary where applicable

Minimum read fields for each session:

- `id`
- `goalTitle`
- `status`
- `updatedAt`
- `progress`
- `currentConcept`

Preferred interpretation:

- `updatedAt` is the MVP sort key unless a dedicated latest-activity field already exists

The detail layer keeps using session-specific endpoints for:

- overview
- concept learning
- explanation generation
- quiz generation and submission
- graph rendering

## 8. State Handling

### 8.1 Loading

- Workspace loading uses skeletons for header-adjacent content, spotlight, and library cards.
- Session shell loading should preserve frame structure instead of replacing the whole area with a spinner.

### 8.2 Empty

If the user has no sessions:

- render the full workspace layout
- show an empty-state panel in the library area
- keep `Tạo session mới` as the obvious next action

The user should never feel like the product disappeared into a blank form screen.

### 8.3 Errors

- Create-session errors keep drawer inputs intact.
- Session-level data failures should degrade locally where possible.
- Graph failures must not block overview or learning views.
- Learn-route resolution failures should fall back to overview with explicit messaging.

## 9. Testing Scope

The implementation should verify at minimum:

- `/dashboard/learning-graph` renders the workspace hub
- clicking an active session opens the learning route
- clicking a completed session opens the overview route
- creating a session updates the workspace list
- empty, loading, and error states are visible and usable

## 10. Non-Goals

This refinement does not introduce:

- classroom or teacher workflows
- cross-user collaboration
- graph editing
- advanced search or bulk session management
- a separate full-page create flow

## 11. Recommended Implementation Direction

The preferred technical direction is to introduce a proper session shell and workspace library rather than incrementally patching the current index page.

Recommended route model:

- keep `/dashboard/learning-graph` as the workspace root
- introduce `/dashboard/learning-graph/sessions/:sessionId/*` for session-scoped navigation
- keep concept and graph views under the session shell

This addresses the root problem instead of adding more conditional UI inside the current index route.
