# Feature Specification: Lead Handling

**Feature Branch**: `004-lead-handling` (spec directory only — no dedicated git branch; written directly against `main`)

**Created**: 2026-08-28

**Status**: Baseline (documents existing, shipped behavior — not a new-feature proposal)

**Input**: Retroactive documentation of lead delivery-while-running, history, detail viewing, and
test-lead labeling, as implemented in `hooks/useLeadListener.ts`, `hooks/useLeadHistory.ts`,
`screens/HomeScreen.tsx`, `screens/IncomingLeadScreen.tsx`, `components/LeadDetailModal.tsx`,
`components/DummyLeadBadge.tsx`, `dummyLead.ts`, and `types/lead.ts`, so future changes to how
leads are shown have a spec to anchor against.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Get alerted the instant a lead is purchased (Priority: P1)

While the app is running, a user is alerted the moment a new lead is purchased on their paired PC,
in whichever style (banner or full-screen phone-call) they've chosen.

**Why this priority**: Immediate alerting is the entire reason this app exists — a lead the user
doesn't notice in time can be bought by a competitor first.

**Independent Test**: With the app open and a notification style selected, have a new lead written
to the account (e.g., via the test-push script) and confirm the alert appears in the selected
style within moments, with no manual refresh needed.

**Acceptance Scenarios**:

1. **Given** the app is open in the foreground and "Phone Call" style is selected, **When** a new
   lead arrives, **Then** the full-screen incoming-lead view appears immediately with ringing and
   vibration.
2. **Given** the app is backgrounded and "Phone Call" style is selected, **When** a new lead
   arrives, **Then** the incoming-lead view is ready and a full-screen alert brings it to the
   front.
3. **Given** "Banner" style is selected, **When** a new lead arrives while the app is running,
   **Then** a heads-up banner notification is shown instead of the full-screen takeover.
4. **Given** the user changes their notification style, **When** the next lead arrives, **Then**
   it uses the newly selected style — no app restart required.

---

### User Story 2 - Browse past leads (Priority: P2)

A user opens the app and sees their previously purchased leads, grouped by the day they were
purchased, and can load older ones as needed.

**Why this priority**: Users need to revisit leads they've already seen (e.g., to call a buyer
back later), but this matters only once at least one lead exists — it's secondary to being alerted
to new ones.

**Independent Test**: With an account that has more leads than fit on one page, open the app and
confirm leads are grouped under headers like "Today" / "Yesterday" / a date, newest first, and
that tapping "Load more" reveals older leads.

**Acceptance Scenarios**:

1. **Given** the signed-in account has purchased leads, **When** the user opens the app, **Then**
   they see those leads grouped by purchase day, most recent group first.
2. **Given** more leads exist than are currently shown, **When** the user taps "Load more," **Then**
   the next page of older leads is appended to the list.
3. **Given** the lead list fails to load, **When** the failure happens, **Then** the user sees an
   error message with a retry action.
4. **Given** the account has no purchased leads yet, **When** the user opens the app, **Then** they
   see a message explaining that purchased leads will show up there.
5. **Given** the user pulls down on the list, **When** the refresh completes, **Then** the list
   reflects the latest leads.

---

### User Story 3 - See full lead details and call the buyer (Priority: P2)

From either an incoming alert or the history list, a user opens a lead to see its full details and
can call the buyer directly if a number is available.

**Why this priority**: Calling the buyer quickly is the payoff of the whole alerting pipeline —
without this, an alert is just a notice with nothing actionable behind it.

**Independent Test**: Tap a lead in the history list and confirm a detail view shows buyer name,
mobile, quantity, price, and location (whichever are present), with a working "Call Buyer" button
when a mobile number exists.

**Acceptance Scenarios**:

1. **Given** a lead has a buyer mobile number, **When** the user views its details, **Then** a
   "Call Buyer" action is available and starts a phone call to that number.
2. **Given** a lead has no buyer mobile number, **When** the user views its details, **Then** the
   call action is disabled and clearly labeled "No Number" instead of being silently hidden.
3. **Given** a lead is missing an optional field (e.g., no price), **When** the user views its
   details, **Then** that field is simply omitted rather than shown as blank or "N/A".

---

### User Story 4 - Tell a test lead apart from a real one (Priority: P3)

Wherever a lead can appear — the history list, the detail view, or the full-screen incoming alert
— a synthetic test lead is clearly marked as such, so it's never mistaken for a real purchase.

**Why this priority**: Test leads are pushed through the same real pipeline used for actual leads
(to verify the pipeline end-to-end), so without a visible marker a tester could mistake a test
lead for lost revenue, or worse, call a fake "buyer" number.

**Independent Test**: Trigger a test lead via the test-push script and confirm it shows a "Test
Lead" badge everywhere it appears — the home list tile, the detail modal, and the full-screen
incoming view.

**Acceptance Scenarios**:

1. **Given** a lead's buyer mobile number matches the shared test sentinel number, **When** it
   appears anywhere in the app, **Then** it is shown with a visible "Test Lead" badge.
2. **Given** a real lead's buyer mobile number does not match the sentinel, **When** it appears
   anywhere in the app, **Then** no "Test Lead" badge is shown.

---

### Edge Cases

- What happens if a lead is purchased while the app is fully killed (not just backgrounded)? The
  live in-app listener only catches leads purchased while the app is running; delivery while
  killed depends on the push/notification pipeline reaching the app first — that delivery
  mechanism is out of scope for this spec (see the Notifications feature) but it ultimately opens
  the same incoming-lead view this feature defines.
- What happens if the notification style is changed mid-session? The change takes effect for the
  very next lead that arrives; it does not retroactively affect anything already alerted.
- What happens when "Load more" is tapped but fewer leads exist than a full page? No further
  "Load more" option is shown afterward — the list is understood to be exhausted.
- What happens if the user dismisses the full-screen incoming-lead view, or successfully starts a
  call from it? Either action stops the ringing/vibration immediately.
- What happens if a lead is missing its purchase timestamp? It is grouped under the current date
  by default rather than causing an error.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST alert the user, in their currently selected notification style, the
  moment a new lead is added to their account's lead list while the app is running.
- **FR-002**: System MUST let a signed-in user browse their previously purchased leads, grouped by
  the calendar day of purchase, most recent group first.
- **FR-003**: System MUST let the user load additional, older leads in pages when more exist than
  are currently shown, and MUST indicate when no further leads remain.
- **FR-004**: System MUST let the user open any lead — from history or from an incoming alert — to
  see its full available details: buyer name, buyer mobile, quantity, price, and location.
- **FR-005**: System MUST omit any optional lead field that has no value, rather than showing an
  empty or placeholder value for it.
- **FR-006**: System MUST let the user place a phone call to the buyer directly from a lead's
  detail view when a buyer mobile number is present.
- **FR-007**: System MUST clearly indicate, rather than silently omit, when no buyer mobile number
  is available for a lead.
- **FR-008**: System MUST visibly mark any lead identified as a test/synthetic lead everywhere it
  can be displayed (history tile, detail view, full-screen incoming alert).
- **FR-009**: System MUST NOT mark a lead as a test lead unless its buyer mobile number matches the
  designated test sentinel value.
- **FR-010**: System MUST provide a ringing/vibrating alert while the full-screen incoming-lead
  view is shown, and MUST stop it immediately when the user dismisses that view or starts a call
  from it.
- **FR-011**: System MUST apply whatever notification style is currently selected to the next lead
  that arrives, without requiring an app restart.
- **FR-012**: System MUST let the user manually refresh their lead history and MUST show a retry
  option if a load attempt fails.

### Key Entities

- **Lead**: A single purchased buyer enquiry — title, buyer name, buyer mobile, quantity, price,
  city, state, and purchase timestamp, all optional except title. May be identified as a test lead
  by its buyer mobile matching a fixed sentinel value.
- **Lead history**: The date-grouped, paginated view of a signed-in account's past leads, newest
  first.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A lead purchased while the app is open reaches the user as a visible/audible alert
  with no perceptible delay beyond the live-update round trip — no manual refresh needed.
- **SC-002**: A user can reach any previously purchased lead using only repeated "Load more" taps,
  with no lead becoming permanently unreachable.
- **SC-003**: A user with a buyer mobile number on a lead can start a call to that buyer in exactly
  one tap from either the incoming alert or the detail view.
- **SC-004**: Every test lead shown anywhere in the app carries a visible "Test Lead" marker, and
  no real lead is ever shown with that marker.
- **SC-005**: A notification-style change takes effect for the next lead without the user needing
  to restart the app.

## Assumptions

- Notification delivery mechanics — push channels, full-screen-intent plumbing, and cold-start/
  backgrounded handling — belong to the Notifications feature; this spec covers what happens once
  a lead is live-listened-for or already delivered to the app's UI layer, not how delivery works
  while the app is backgrounded or killed.
- The test-lead sentinel (a specific buyer mobile number) is a convention shared with the paired
  PC extension and local test scripts; changing it requires coordinated updates outside this app.
- Lead data itself (what fields exist, their meaning) is produced by the PC extension and is
  treated here as given input, not something this feature validates or corrects beyond omitting
  absent fields.
