# Feature Specification: Notifications

**Feature Branch**: `005-notifications` (spec directory only — no dedicated git branch; written directly against `main`)

**Created**: 2026-08-28

**Status**: Baseline (documents existing, shipped behavior — not a new-feature proposal)

**Input**: Retroactive documentation of notification permissions, channels, style selection, and
delivery across app states, as implemented in `notifications.ts`, `channels.ts`,
`hooks/useNotificationStyle.ts`, `modules/PhonecallNotification.ts`, and
`plugins/withFullScreenIntent.ts`, so future changes to alert delivery have a spec to anchor
against.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Get set up to receive alerts at all (Priority: P1)

On first use, the app asks for notification permission and registers this device so it can
receive lead alerts from the paired PC at all.

**Why this priority**: Nothing else in this feature — or in Lead Handling — can work without this
step; a device with no permission and no push token cannot receive a remote alert of any kind.

**Independent Test**: Install the app fresh, grant the notification permission prompt, and confirm
the app obtains a push token and creates its two alert channels, without any further user action.

**Acceptance Scenarios**:

1. **Given** a fresh install with no prior permission decision, **When** the app starts, **Then**
   the user is prompted for notification permission.
2. **Given** the user grants notification permission, **When** setup completes, **Then** the app
   has a push token and both the banner and phone-call alert channels exist on the device.
3. **Given** the user denies notification permission, **When** setup completes, **Then** the app
   has no push token and cannot receive remote lead alerts until permission is granted later.

---

### User Story 2 - Choose an alert style, with help granting what it needs (Priority: P2)

A user picks between a standard banner alert and a full-screen "phone call" style alert; choosing
phone-call style walks them through granting the one permission it requires, and separately offers
an optional reliability improvement for phones that need it.

**Why this priority**: Style choice is a personalization on top of the P1 baseline — a user who
never changes it still gets the default banner behavior, so this is important but not blocking.

**Independent Test**: From Settings, switch to "Phone Call" style on a device that hasn't granted
the full-screen-intent permission yet, and confirm the app explains why it's needed and opens the
relevant system settings screen for the user to grant it — without requiring the "display over
other apps" permission to do so.

**Acceptance Scenarios**:

1. **Given** the user selects "Banner" style, **When** the next lead arrives, **Then** it is
   delivered as a standard heads-up notification.
2. **Given** the user selects "Phone Call" style and the full-screen-intent permission is already
   granted, **When** the next lead arrives, **Then** it is delivered as a full-screen, ringing
   takeover.
3. **Given** the user selects "Phone Call" style and the "display over other apps" permission is
   missing, **When** they view Settings, **Then** they see it offered as a separate, skippable
   reliability improvement — not a requirement — for phone brands that need it.
4. **Given** the user selects "Phone Call" style and the full-screen-intent permission (Android
   14+) is missing, **When** they select it, **Then** they're shown why it's needed and taken to
   the relevant system settings screen to grant it — this is the only permission that gates the
   style.
5. **Given** the user changes their style, **When** the change is saved, **Then** it is
   remembered on this device and reflected in the account's device record for other parts of the
   system to see.

---

### User Story 3 - Get the alert reliably, no matter the app's state (Priority: P1)

Whether the app is open, backgrounded, or fully killed when a lead arrives, the user ends up on
the same incoming-lead screen with the same lead data once they respond to the alert.

**Why this priority**: A salesperson is not always looking at the app when a lead is purchased —
if delivery only worked while the app was open in the foreground, the app would fail at its one
job most of the time.

**Independent Test**: With "Phone Call" style selected and both permissions granted, lock the
phone (simulating "killed/idle"), trigger a lead, and confirm the phone rings and shows the
incoming-lead screen over the lock screen; separately, confirm tapping a banner notification while
the app is backgrounded opens the same screen with the same data.

**Acceptance Scenarios**:

1. **Given** the phone is locked or the app is not running, **When** a phone-call-style lead
   arrives, **Then** the incoming-lead screen appears as a full-screen takeover over the lock
   screen, ringing and vibrating.
2. **Given** the app is backgrounded, **When** the user taps a banner alert, **Then** the app opens
   directly to that lead's incoming-lead screen.
3. **Given** the app was fully killed, **When** the user taps the alert that relaunched it,
   **Then** the app opens directly to that lead's incoming-lead screen instead of the default
   Home screen.
4. **Given** the app is already running and the user taps a phone-call-style heads-up alert (not a
   full-screen takeover), **When** the app comes back to the foreground, **Then** it still opens
   the incoming-lead screen for that alert.
5. **Given** a lead is a test/synthetic lead, **When** its notification is shown, **Then** the
   notification's title visibly marks it as a test before the user even opens it.

---

### Edge Cases

- What happens if the user selects "Phone Call" style but never grants full-screen-intent?
  Alerts still arrive, but as a standard heads-up notification instead of a full-screen takeover —
  the user is not left with no alert at all, and it still rings.
- What happens on an OEM phone that blocks background activity launches (Xiaomi/HyperOS, ColorOS,
  FuntouchOS, realme UI) and the user hasn't granted "display over other apps"? The full-screen
  takeover may not appear even with full-screen-intent granted; the app surfaces this as an
  optional, skippable reliability row in Settings rather than requiring it up front.
- What happens if the exact data shape of a delivered push doesn't match what the app expects for
  a phone-call-style alert? The app recursively searches the delivered data for the phone-call
  marker — including values that are themselves JSON-encoded strings, to a bounded depth — before
  giving up and falling back to normal (non-full-screen) notification handling, rather than
  dropping the alert silently.
- What happens if a phone-call-style alert is posted before the alert channel exists on this
  device (e.g. the very first native delivery on a fresh install)? The channel is created natively
  at the moment of posting, matching the settings created client-side, so the notification is never
  silently dropped for lacking a channel.
- What happens if the user wants to change what an existing alert channel sounds/vibrates like
  after it's already been created on a device? Android fixes a channel's sound/vibration at first
  creation — changing it requires introducing a new channel, not editing the existing one.
- What happens if the app is already running and the user taps a phone-call-style notification
  (a "warm" tap, not a cold start)? The app refreshes its view of the tapped notification's data
  when it returns to the foreground, so the lead screen still opens.
- What happens on iOS? The full-screen "phone call" takeover mechanism is Android-only; this is an
  Android-first app and the phone-call style is not documented as available on iOS.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST request notification permission from the user and MUST NOT be able to
  receive remote lead alerts until it is granted.
- **FR-002**: System MUST obtain a push token for this device once permission is granted, so the
  paired PC extension can target alerts at it.
- **FR-003**: System MUST create the distinct alert channels needed for banner-style and
  phone-call-style delivery.
- **FR-004**: System MUST let the user choose between banner and phone-call alert styles from
  Settings.
- **FR-005**: System MUST persist the user's chosen alert style both on this device and on the
  account's device record, so it survives app restarts and is visible to other parts of the
  system.
- **FR-006**: When the user selects phone-call style, System MUST check whether the
  full-screen-intent permission is granted — the only permission that gates the style — and MUST
  guide the user to grant it if missing, explaining why it's needed. System MUST separately, and
  independently of style selection, offer the "display over other apps" permission as a skippable
  reliability improvement for phone brands that restrict background activity launches beyond
  stock Android, never as a requirement.
- **FR-007**: System MUST deliver a phone-call-style alert as a full-screen takeover over the lock
  screen when the phone is locked or the app isn't running and the full-screen-intent permission is
  granted.
- **FR-008**: System MUST fall back to a standard heads-up alert for phone-call-style leads when
  the full-screen-intent permission is not granted, rather than delivering no alert.
- **FR-009**: System MUST ring and vibrate for as long as a phone-call-style alert is active,
  starting immediately when the notification is posted — independent of whether the full-screen
  activity ever launches or the JS runtime has started — and continuing if the incoming-lead
  screen becomes visible, so a killed-app alert rings the same way regardless of whether it
  surfaces as a full-screen takeover or a heads-up notification.
- **FR-010**: System MUST open the same incoming-lead screen with the same lead data regardless of
  which delivery path triggered it: already-running listener, a tap while backgrounded, a cold
  start from a notification tap, a full-screen-intent launch, or a warm tap while already running.
- **FR-011**: System MUST visibly mark a test/synthetic lead's notification (e.g., in its title)
  as a test, distinguishably from a real lead's notification.

### Key Entities

- **Notification Channel**: An Android-level delivery configuration (banner or phone-call), whose
  sound/vibration is fixed at first creation and can only be changed by introducing a new channel.
- **Notification style preference**: The user's per-device choice of banner vs. phone-call,
  persisted locally and mirrored onto that device's account record.
- **Push token**: This device's current address for remote alert delivery, obtained once
  permission is granted.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A user who grants notification permission ends up with a working push token and both
  alert channels created, with no action beyond the permission prompt.
- **SC-002**: A user with phone-call style and full-screen-intent granted receives a full-screen,
  ringing alert regardless of whether the phone was locked or the app was killed.
- **SC-003**: A user who has not granted full-screen-intent still receives a visible, ringing
  alert for every lead — never silence — even though it's a heads-up notification rather than a
  takeover.
- **SC-004**: Every one of the alert delivery paths (live listener, background tap, cold start,
  full-screen intent, warm tap) lands the user on the same incoming-lead screen with the same lead
  data.
- **SC-005**: A test lead's notification is distinguishable from a real lead's notification by its
  title alone, before opening the app.

## Assumptions

- Android fixes a notification channel's sound/vibration settings at first creation; changing them
  on existing installs requires a new channel ID, which must be coordinated with the extension's
  copy of the same channel IDs (see the Cross-Repo Wire Contract principle in the constitution).
- The exact JSON shape of a data-only push, once routed through Expo to the native handler, is not
  contractually guaranteed — the native handler is expected to tolerate any plausible shape,
  including values nested multiple levels deep as JSON-encoded strings, rather than assuming one
  exact structure.
- The full-screen "phone call" takeover is Android-specific; this feature does not define
  equivalent iOS behavior.
- Reliable delivery depends on the paired PC extension sending to the correct, currently-valid
  channel ID and push token for this device — keeping those in sync is a cross-repo responsibility
  this feature depends on but does not itself guarantee.
