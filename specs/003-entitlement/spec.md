# Feature Specification: Entitlement (Subscription Enforcement)

**Feature Branch**: `003-entitlement` (spec directory only — no dedicated git branch; written directly against `main`)

**Created**: 2026-08-28

**Status**: Baseline (documents existing, shipped behavior — not a new-feature proposal)

**Input**: Retroactive documentation of subscription-based access control as implemented in
`entitlement.ts`, `hooks/useEntitlement.ts`, and `screens/LockoutScreen.tsx`, so future changes to
access control have a spec to anchor against.

## Clarifications

### Session 2026-08-28

- Q: Between "signed in" and "entitlement determined," does the transient loading state need to be explicitly defined, or is any generic loading indicator acceptable? → A: Require a distinct, neutral loading state — never the lockout screen or normal app content — until the first entitlement value resolves.
- Q: If a subscription is valid (not expired) but its phone-seat limit is missing or zero, should the account still count as fully entitled, or should that be its own distinct not-entitled reason? → A: Treat it as not entitled — a subscription with no usable phone seats fails validity here, with its own distinguishable reason ("no-seats"), separate from "no-account" and "expired".

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Use the app on an active subscription (Priority: P1)

A signed-in user whose account has an active, non-expired subscription reaches the app's normal
screens (device checks, then Home) with no extra step beyond signing in.

**Why this priority**: This is the app's core gate — every other feature (lead alerts, device
management, settings) sits behind this check, so it must work before anything downstream matters.

**Independent Test**: Sign in on an account with a subscription record whose expiry date is in the
future, and confirm the app proceeds past the entitlement check into device checks/Home without
any lockout screen appearing.

**Acceptance Scenarios**:

1. **Given** the signed-in account has a subscription record with a future expiry date, **When**
   the app checks entitlement, **Then** the user proceeds to the rest of the app.
2. **Given** the user has just signed in and the first entitlement value hasn't loaded yet,
   **When** the app is in that transient state, **Then** it shows a distinct, neutral loading
   indicator — never the lockout screen and never normal app content — until entitlement resolves.
3. **Given** the account's subscription is renewed by an admin while the user is mid-session,
   **When** the updated record is written, **Then** the user's access updates immediately without
   needing to restart the app or sign in again.

---

### User Story 2 - Get blocked with a clear reason when not entitled (Priority: P1)

A signed-in user whose account has no subscription, whose subscription has expired, or whose
subscription has no usable phone seats, is shown a lockout screen that tells them which of the
three applies, instead of a generic error or a broken app.

**Why this priority**: Equally critical to Story 1 — a user who can't use the app needs to
understand why, so they know whether to wait for activation or to renew.

**Independent Test**: Sign in on an account with no subscription record at all and confirm the
"no active subscription" message appears; separately, sign in on an account with a subscription
whose expiry date is in the past and confirm the "subscription expired" message appears instead.

**Acceptance Scenarios**:

1. **Given** the signed-in account has no subscription record, **When** the app checks
   entitlement, **Then** the user sees a lockout screen explaining the account isn't activated yet.
2. **Given** the signed-in account has a subscription record whose expiry date has passed,
   **When** the app checks entitlement, **Then** the user sees a lockout screen explaining the
   subscription expired, distinct from the "not activated" message.
3. **Given** the signed-in account has a non-expired subscription record with a missing or zero
   phone-seat limit, **When** the app checks entitlement, **Then** the user sees a lockout screen
   explaining there are no usable phone seats, distinct from both the "not activated" and
   "expired" messages.
4. **Given** the user is on the lockout screen, **When** they look at it, **Then** they can see
   which email they're signed in as.

---

### User Story 3 - Recover from being locked out (Priority: P2)

A locked-out user can contact the admin for access, or sign out to try a different account,
directly from the lockout screen.

**Why this priority**: Secondary to knowing *why* you're locked out (Story 2), but necessary so a
locked-out user isn't stuck with no path forward.

**Independent Test**: From the lockout screen, tap the admin-contact link and confirm the device's
email app opens addressed to the admin; separately, tap sign-out and confirm the user returns to
the sign-in screen.

**Acceptance Scenarios**:

1. **Given** the user is on the lockout screen, **When** they tap the admin-contact link,
   **Then** their device's default email app opens with the admin's address pre-filled.
2. **Given** the user is on the lockout screen, **When** they tap sign out, **Then** they are
   returned to the sign-in screen and can attempt sign-in with a different account.

---

### Edge Cases

- What happens if the entitlement check itself fails to complete (e.g., the read errors out)?
  The app keeps whichever entitlement value it last had, or — if it never successfully loaded
  one — treats the account as not entitled ("no-account"). Access fails closed, never open, when
  entitlement can't be determined.
- What happens if a subscription's `tier` is set but other fields are missing or malformed (e.g.,
  no numeric expiry date)? The account is treated as not entitled, the same as having no
  subscription record at all — a record only counts if it has a usable expiry date.
- What happens if a subscription has a valid, non-expired expiry date but its phone-seat limit
  (`maxPhones`) is missing or zero? The account MUST be treated as not entitled, with a reason
  ("no-seats") distinct from both "no-account" and "expired" — a subscription that can never let
  any phone register is not meaningfully different from having no subscription at all.
- What happens if a subscription is revoked or expires while the user is actively using the app?
  Because entitlement is checked via a live subscription, the app locks the user out immediately,
  without waiting for a restart or the next sign-in.
- What happens to the "ok" reason's lockout copy that exists in the code? It is unreachable under
  current logic — the lockout screen only ever renders when entitlement is invalid, so a "valid"
  reason never reaches it. This is a defensive fallback, not an active state.
- What happens if the user isn't signed in at all? Entitlement isn't evaluated against a
  subscription in that case — sign-in is a prerequisite this feature assumes has already happened
  (see the Authentication feature).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST determine whether the signed-in account is entitled to use the app based
  on a subscription record tied to that account, kept live (updates without needing an app
  restart).
- **FR-002**: System MUST treat an account with no subscription record as not entitled, with a
  reason distinguishable from "expired."
- **FR-003**: System MUST treat a subscription whose expiry date has already passed as not
  entitled, regardless of its tier label.
- **FR-003a**: System MUST treat a non-expired subscription whose phone-seat limit (`maxPhones`)
  is missing or zero as not entitled, with a reason ("no-seats") distinguishable from both
  "no-account" and "expired".
- **FR-004**: System MUST re-evaluate entitlement immediately whenever the underlying subscription
  record changes, without requiring the user to restart the app or sign in again.
- **FR-005**: System MUST prevent access to every app screen other than the lockout screen while
  the signed-in account is not entitled.
- **FR-006**: System MUST show the user which of "no subscription yet," "subscription expired," or
  "no usable phone seats" applies, rather than a single generic locked-out message.
- **FR-007**: System MUST let a locked-out user contact an admin (via a pre-addressed email) from
  the lockout screen.
- **FR-008**: System MUST let a locked-out user sign out from the lockout screen.
- **FR-009**: If the entitlement check cannot be completed (e.g., a read error), System MUST fail
  closed — keep the account locked out rather than granting access by default.
- **FR-010**: When an account is entitled, System MUST expose that account's phone and computer
  seat limits for other features (device management) to enforce.
- **FR-011**: System MUST show a distinct, neutral loading state — never the lockout screen, never
  normal app content — for as long as the signed-in account's first entitlement value has not yet
  resolved.

### Key Entities

- **Subscription**: The record that grants access — tier (a descriptive label only), expiry date,
  phone/computer seat limits, and bookkeeping timestamps. One per account; not editable from this
  app.
- **Entitlement**: The derived, per-session answer to "can this account use the app right now,"
  and if not, why (not activated vs. expired vs. no usable phone seats) — computed live from the
  current Subscription.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: An entitled user reaches the app's normal screens with zero extra steps beyond
  signing in, passing through a neutral loading state (never the lockout screen) while the first
  entitlement value resolves.
- **SC-002**: A non-entitled user cannot reach any app screen except the lockout screen, and can
  always tell from it which of "never activated," "expired," or "no usable phone seats" applies.
- **SC-003**: Revoking or expiring a subscription locks the affected user out during their current
  session, without requiring them to restart the app.
- **SC-004**: Granting or renewing a subscription unlocks the affected user's app during their
  current session, without requiring them to restart the app.
- **SC-005**: A locked-out user can always reach the admin (via email) or sign out, with no dead
  end.

## Assumptions

- Subscription records are created and managed by admin tooling outside this app; this feature
  only reads and enforces them, it does not create, edit, or renew subscriptions itself.
- `tier` is descriptive metadata for the admin's own bookkeeping; it does not independently affect
  access — only the expiry date (and record's existence) does.
- There is a single fixed admin contact address; there is no in-app support ticketing or multiple
  admin routing.
- Device and computer seat limits (`maxPhones`, `maxComputers`) are defined on the subscription
  record but enforced by other features (see Device Management); this feature is only responsible
  for exposing them once an account is entitled.
