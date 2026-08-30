# Feature Specification: Google Sign-In Authentication

**Feature Branch**: `001-google-sign-in-auth` (spec directory only — no dedicated git branch; written directly against `main`)

**Created**: 2026-08-28

**Status**: Baseline (documents existing, shipped behavior — not a new-feature proposal)

**Input**: Retroactive documentation of the authentication feature as implemented in `screens/SignInScreen.tsx`, `hooks/AuthProvider.tsx`, and `firebase.ts`, so future changes to sign-in have a spec to anchor against.

## Clarifications

### Session 2026-08-28

- Q: Should the email/password sign-in path allow any user to create a new account, or is it restricted to accounts an admin provisions out-of-band (e.g., only the Play Store reviewer account)? → A: Admin-provisioned only — accounts must be created out-of-band (e.g. Firebase Console); no self-service sign-up is planned.
- Q: For downstream checks like entitlement and device registration, is the signed-in account identified by the Firebase `uid`, or by the email address? → A: Email address (sanitized) — this is what entitlement, device registration, and lead delivery actually key on; the Firebase `uid` differs between a Google identity and an email/password identity for the same email address and is not itself shared across them.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Sign in with Google (Priority: P1)

A user installs the app on their phone and signs in with the same Google account they use on the
paired Chrome extension on their PC, so the app can show them leads that account purchases.

**Why this priority**: This is the only sign-in path real end users take. Without it the app has no
identity to key lead delivery, device registration, or entitlement off of — nothing else in the app
is reachable.

**Independent Test**: On a fresh install with no prior session, tap "Sign in with Google," pick an
account in the native account picker, and confirm the app leaves the sign-in screen and proceeds
past the loading state to the entitlement/device checks (or Home, if already entitled).

**Acceptance Scenarios**:

1. **Given** the app is freshly installed and signed out, **When** the user taps "Sign in with
   Google" and selects a Google account, **Then** the app leaves the sign-in screen and reflects
   that account's identity (`uid`, `email`) everywhere it reads `useAuth()`.
2. **Given** the user is in the middle of the Google account picker, **When** they back out or
   cancel it, **Then** the app remains on the sign-in screen and shows no error message.
3. **Given** the device has outdated or missing Google Play Services, **When** the user taps "Sign
   in with Google," **Then** the user is prompted to update Play Services before the sign-in flow
   continues.

---

### User Story 2 - Sign in with email and password (Priority: P2)

A user for whom the Google Sign-In flow cannot complete (notably, the Google Play Store review
account) signs in instead with an email and password.

**Why this priority**: This path exists to satisfy Google Play's requirement for working reviewer
credentials, since Google's own review infrastructure frequently cannot complete a Google Sign-In
(device verification challenges on fresh accounts). It is secondary — not surfaced as the primary
option — but every downstream check (entitlement, device registration) must treat it identically to
a Google-authenticated identity.

**Independent Test**: From the sign-in screen, tap "Sign in with email instead," enter a valid
email/password pair, submit, and confirm the app reaches the same post-sign-in state (entitlement
check, then Home) that a Google sign-in would reach for that same email.

**Acceptance Scenarios**:

1. **Given** the user reveals the email form and enters a registered email and correct password,
   **When** they submit, **Then** the app signs them in and reflects the same identity shape
   (`uid`, `email`) as a Google sign-in.
2. **Given** the user enters an incorrect email or password, **When** they submit, **Then** the app
   shows a generic "Sign-in failed. Check your email and password." message and remains on the
   sign-in screen.
3. **Given** the email or password field is empty, **When** the user taps submit, **Then** no
   sign-in attempt is made.

---

### User Story 3 - Sign out (Priority: P3)

A signed-in user signs out, ending their session on this device.

**Why this priority**: Needed for account switching and support/debugging, but far less frequent
than signing in — most users sign in once and stay signed in.

**Independent Test**: While signed in, trigger sign-out and confirm the app returns to the sign-in
screen with no leftover session state (a subsequent app restart does not silently resume the old
session).

**Acceptance Scenarios**:

1. **Given** the user is signed in via Google, **When** they sign out, **Then** both the Google
   session and the Firebase session end and the app shows the sign-in screen.
2. **Given** sign-out fails (e.g., no network), **When** the user triggers it, **Then** an error
   message is shown and the app does not falsely present itself as signed out while Firebase still
   considers the user signed in.

---

### Edge Cases

- What happens when the user signs in with a **different** Google account than the one signed in
  on the paired PC extension? The sign-in itself succeeds, but the user will never see any leads,
  because the extension writes leads keyed to its own account's identity. This feature does not
  detect, warn about, or block this mismatch — it is a cross-system expectation documented in
  `CONTEXT.md`, not an enforced rule.
- What happens when Google Sign-In is cancelled or a sign-in is already in progress? No error is
  shown in either case; the user simply remains on the sign-in screen.
- What happens when Google returns no ID token? The sign-in fails and a generic error message is
  shown.
- What happens while the very first auth-state check is still pending (app just launched)? The
  app shows a loading indicator and renders neither the sign-in screen nor any authenticated
  content until the check resolves.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST let a signed-out user sign in via a native Google account picker.
- **FR-002**: System MUST let a signed-out user sign in with an email and password as a secondary
  path, for cases where Google Sign-In cannot be completed. This path MUST NOT offer self-service
  account creation — an email/password identity is only usable if it was provisioned out-of-band
  (e.g., created directly in Firebase Console by an admin), not created by the user in-app.
- **FR-003**: System MUST maintain exactly one authentication session for the app's entire runtime
  lifetime — one place that owns the current signed-in identity, read the same way by every screen.
- **FR-004**: System MUST show a loading state while the initial authentication state is being
  resolved, before rendering either the sign-in screen or authenticated content.
- **FR-005**: System MUST let a signed-in user sign out, ending both the Google-side session and
  the Firebase-side session.
- **FR-006**: System MUST show a user-facing error message when a sign-in attempt fails for a
  reason other than user cancellation or an already-in-progress attempt.
- **FR-007**: System MUST NOT show an error when the user cancels the Google account picker or
  when a sign-in is already in progress.
- **FR-008**: System MUST treat an email/password identity and a Google identity as equivalent for
  every downstream identity-keyed check (entitlement, device registration). Those checks MUST key
  on the account's (sanitized) email address, not the Firebase `uid` — the two sign-in methods
  produce different `uid`s for the same email address, so `uid` is not a safe shared key across
  them.
- **FR-009**: System MUST show the sign-in screen — and MUST NOT show Home, Settings, or any lead
  alert — whenever there is no signed-in user.

### Key Entities

- **Auth Session**: The single current identity for the app: `uid`, `email`, a `loading` flag, and
  an `error` message. Owned by `AuthProvider`; read by every screen through `useAuth()`. The `uid`
  is Firebase's own per-provider identifier and is not shared between a Google identity and an
  email/password identity on the same email address; every downstream feature keys on `email`
  (sanitized), not `uid`.
- **Google Identity**: The Google account chosen during sign-in. By convention (not enforcement)
  this MUST be the same account signed in on the paired PC Chrome extension for leads to be
  visible on this device.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A user with a working Google account and Play Services can reach a signed-in state
  without typing anything (account picker only).
- **SC-002**: A user for whom Google Sign-In cannot complete can still reach a signed-in state
  using only an email and password.
- **SC-003**: Every screen in the app reflects the same signed-in identity at the same time — there
  is never a moment where two screens disagree about who is signed in.
- **SC-004**: After sign-out, the sign-in screen appears with no residual session, and restarting
  the app does not silently restore the old session.
- **SC-005**: Cancelling the Google account picker leaves the user on the sign-in screen with zero
  error messages shown.

## Assumptions

- The user has an existing Google account; this app does not create Google accounts.
- The email/password path is intentionally not promoted as a primary option — it exists to satisfy
  Google Play reviewer access and any account for which Google Sign-In cannot complete. It is
  admin-provisioned only: there is no in-app sign-up flow, and none is planned. An email/password
  identity only works if an admin already created it out-of-band (e.g., directly in Firebase
  Console).
- Verifying that the signed-in account matches the account used on the paired Chrome extension is
  the user's responsibility; this feature does not detect or warn about a mismatch.
- Session persistence across app restarts follows the Firebase Auth SDK's default behavior; no
  custom persistence logic is defined by this feature.
- Entitlement checks, device registration, and device-limit enforcement are downstream consumers
  of the identity this feature produces — they are out of scope for this spec and are documented
  separately.
