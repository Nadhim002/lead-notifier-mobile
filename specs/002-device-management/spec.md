# Feature Specification: Device Management

**Feature Branch**: `002-device-management` (spec directory only — no dedicated git branch; written directly against `main`)

**Created**: 2026-08-28

**Status**: Baseline (documents existing, shipped behavior — not a new-feature proposal)

**Input**: Retroactive documentation of device registration and management as implemented in
`deviceIdentity.ts`, `hooks/usePhoneDevices.ts`, `hooks/DevicesContext.tsx`,
`components/PhoneDeviceList.tsx`, and `screens/DeviceLimitScreen.tsx`, so future changes to
device/seat handling have a spec to anchor against.

## Clarifications

### Session 2026-08-28

- Q: When a rename, removal, or registration/heartbeat write to the server fails (e.g., no network), should the user see a visible error, or is silent failure acceptable? → A: Add a visible error (a toast) whenever rename, removal, or registration/heartbeat fails — this is a real gap in current behavior, not an accepted design choice.
- Q: Is the "periodic" heartbeat that refreshes a phone's last-active time and notification-style meant to run on a fixed timer, or fire only when the app opens/foregrounds or the roster changes? → A: Event-driven, not timer-based — it re-asserts on sign-in, roster updates, and other relevant state changes, not on a clock.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - This phone registers itself automatically (Priority: P1)

After a user signs in on an entitled account with a free seat, this phone adds itself to the
account's phone roster without the user taking any explicit "add this device" action.

**Why this priority**: Registration is the prerequisite for every other feature in the app — a
phone that isn't registered can't receive push notifications for leads at all. Everything else
(rename, remove, seat limits) only matters once a phone exists on the roster.

**Independent Test**: Sign in on an entitled account that has a free seat, grant notification
permissions, and confirm this phone appears in "My Phones" in Settings without any explicit
registration step.

**Acceptance Scenarios**:

1. **Given** a signed-in, entitled account with a free seat and this phone has a push token,
   **When** the app determines the account's current phone roster, **Then** this phone's record is
   created automatically under that account.
2. **Given** this phone is reinstalled or the user signs out and back in, **When** it registers
   again, **Then** it reuses its previous record instead of creating a second entry, because its
   device identifier is stable across reinstalls/logins on the same physical device.
3. **Given** this phone does not yet have a push token (e.g., permission not yet granted),
   **When** the app checks whether to register, **Then** no record is created until a token is
   available.

---

### User Story 2 - View and manage the phones on my account (Priority: P2)

From Settings, a user sees every phone registered on their account, including which one is "this
device" and when each was last active, and can rename or remove any of them.

**Why this priority**: Once multiple phones share an account (personal + work phone, or a team),
users need visibility and control to make sense of who's using which seat.

**Independent Test**: Open Settings with at least one other phone registered on the account, and
confirm the phone list shows every phone's name, last-active time, and a "this device" marker on
the current one; rename one and remove another and confirm both actions take effect immediately.

**Acceptance Scenarios**:

1. **Given** two or more phones are registered on the account, **When** the user opens Settings,
   **Then** they see all of them listed with a name and a relative "last active" time, and the
   current phone is marked as "this device."
2. **Given** the user renames a phone, **When** they submit the new name, **Then** the list
   reflects the new name without needing to leave and re-enter the screen.
3. **Given** the user chooses to remove a phone, **When** they confirm the removal in the
   confirmation prompt, **Then** that phone disappears from the list and no longer counts against
   the account's phone limit.
4. **Given** the user starts to remove a phone, **When** they cancel the confirmation prompt,
   **Then** no phone is removed.

---

### User Story 3 - Free up a seat when the phone limit is reached (Priority: P3)

A user whose account is entitled but has no free seat for this phone is shown a self-service
screen where they can remove another phone to make room, or contact an admin for more seats.

**Why this priority**: Without this, hitting the phone limit would be a dead end requiring manual
admin intervention every time; this priority is lower than P1/P2 because it only triggers for
accounts that already have multiple phones in active use.

**Independent Test**: On an account where every seat is already taken, sign in with a new phone
and confirm a device-limit screen appears showing the current phones and a way to remove one;
removing one should let this phone proceed into the app.

**Acceptance Scenarios**:

1. **Given** the account is entitled but every seat is taken and this phone isn't one of them,
   **When** this phone tries to proceed past sign-in, **Then** it is shown a device-limit screen
   instead of the normal app, listing the current phones and how many of the limit are in use.
2. **Given** the user is on the device-limit screen, **When** they remove one of the listed
   phones, **Then** this phone can proceed into the normal app once a seat is free.
3. **Given** the user wants more seats than the plan allows, **When** they tap the admin-contact
   link on the device-limit screen, **Then** their device's default email app opens addressed to
   the admin contact.
4. **Given** the user is stuck on the device-limit screen, **When** they choose to sign out
   instead, **Then** they are returned to the sign-in screen.

---

### Edge Cases

- What happens if the device identifier can't be read from the platform (e.g., iOS
  `identifierForVendor` returning null briefly after a reboot, before first unlock)? The app falls
  back to a previously cached identifier, or mints and caches a new random one if none exists yet.
- What happens if this same physical phone is reinstalled? Because Android/iOS provide a
  platform-stable identifier tied to the device (and, on Android, the app's signing key), the phone
  reuses its existing record rather than creating a new one — this is what keeps the phone count
  from inflating on every reinstall.
- What happens if the locally selected notification style (banner vs. phone call) was set before
  this phone had a stored device id or before sign-in, so the one-time write to the server was
  missed? The event-driven heartbeat re-asserts the current local preference on the next relevant
  state change, so the server value can't permanently drift from what the user picked in-app.
- What happens if a user tries to remove the phone they're currently using? The remove action has
  no special guard against this — removing "this device" deletes its own seat, and it will attempt
  to re-register if a seat later becomes free.
- What happens when the account has zero phones registered yet? The phone list shows an empty
  state ("No phones yet") rather than an error.
- What happens if a rename, removal, or this device's own registration/heartbeat write fails
  (e.g., no network at that moment)? The user MUST see a visible error (e.g., a toast) rather than
  the action failing with no feedback; the phone list itself still reflects whatever the server's
  last known state is via the live roster listener.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST derive a device identifier for this phone that remains stable across
  app reinstalls and sign-in/sign-out cycles on the same physical device.
- **FR-002**: System MUST register this phone on the signed-in account's phone roster only when
  the account is entitled, a push token is available for this phone, and a seat is free (this
  phone is already registered, or the roster is under the account's phone limit).
- **FR-003**: System MUST let the user view every phone registered on their account, showing each
  phone's name, its last-active time, and whether it is the phone the user is currently using.
- **FR-004**: System MUST let the user rename any phone registered on their account.
- **FR-005**: System MUST let the user remove any phone from their account, and MUST require an
  explicit confirmation step before the removal happens.
- **FR-006**: System MUST refresh a registered phone's last-active time and notification-style
  preference on the server whenever relevant app state changes (sign-in, roster updates,
  entitlement changes) for as long as it stays registered. This refresh is event-driven, not
  timer-based — it is not guaranteed to happen on any fixed schedule while the app sits idle with
  nothing relevant changing.
- **FR-011**: System MUST show the user a visible error (e.g., a toast) when a rename or removal
  they initiated fails to save to the server, rather than failing silently.
- **FR-012**: System MUST show the user a visible error (e.g., a toast) when this device's own
  registration or heartbeat write fails, rather than failing silently.
- **FR-007**: System MUST show a dedicated screen — instead of the normal app — when the account
  is entitled but this phone has no free seat, listing the current phones and the seat limit.
- **FR-008**: System MUST let the user free a seat from that screen by removing one of the listed
  phones, after which this phone MUST be able to proceed into the normal app.
- **FR-009**: System MUST offer a way to contact an admin for additional seats from the
  device-limit screen.
- **FR-010**: System MUST NOT create more than one phone record per distinct device identifier,
  regardless of how many times that device signs in or reinstalls the app.

### Key Entities

- **Phone (device record)**: One entry in an account's roster — id (device identifier), display
  name, push token, notification-style preference, and last-active timestamp. Stored per account.
- **Phone roster**: The complete set of Phone records belonging to one account, bounded by that
  account's phone limit (owned by the Entitlement feature — see its spec for how the limit itself
  is determined).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A newly signed-in, entitled user with a free seat sees their phone listed in "My
  Phones" without performing any explicit registration action.
- **SC-002**: A rename or removal a user makes is reflected in the phone list immediately, with no
  app restart required.
- **SC-003**: Reinstalling the app on the same physical device never results in two entries for
  that device in the phone list.
- **SC-004**: A user who hits the phone limit can reach their normal app screens again, using only
  in-app self-service (no admin action required), by removing one existing phone.
- **SC-005**: A phone's notification-style preference shown on the server never permanently
  disagrees with what the user last selected in-app, even if an earlier sync attempt was missed.
- **SC-006**: A user is never left wondering whether a rename, removal, or this device's own
  registration succeeded — a failure always produces a visible error, not silence.

## Assumptions

- The phone limit (`maxPhones`) and whether the account is entitled at all are determined by the
  Entitlement feature and treated here as given inputs, not something this feature computes.
- Device identity relies on platform-provided stable identifiers (Android ID, iOS
  `identifierForVendor`) with a locally cached random fallback; this feature does not guarantee
  identity stability across a full device data wipe or OS reinstall, only across app
  reinstall/sign-in cycles on an otherwise-unchanged device.
- A phone with no push token yet (permission not granted) is expected to remain unregistered until
  a token becomes available; this is treated as a deferred, not failed, registration.
- Removing "this device" from the phone list is allowed with no extra warning beyond the standard
  removal confirmation; re-registration afterward is out of the user's explicit control.
