# Feature Specification: Legal & Compliance

**Feature Branch**: `006-legal-compliance` (spec directory only — no dedicated git branch; written directly against `main`)

**Created**: 2026-08-28

**Status**: Baseline (documents existing, shipped behavior — not a new-feature proposal)

**Input**: Retroactive documentation of the app's privacy policy, Play Console Data Safety
declaration, and full-screen-intent permission declaration, as implemented in
`legal/PRIVACY_POLICY.md`, `legal/DATA_SAFETY.md`, `legal/FULL_SCREEN_INTENT_DECLARATION.md`, and
the hosted copy at `docs/privacy.html`, so future changes to data handling have a compliance spec
to anchor against. Unlike the other features in this app, there is no in-app screen for this one —
it lives entirely in hosted documents and Play Console form answers.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Request account deletion without the browser extension (Priority: P1)

A user who wants their account and data deleted, but cannot access the paired PC browser
extension (the primary deletion route), can still get it done by email.

**Why this priority**: Without a working fallback, a user who has lost access to their PC (or
never had the extension) would have no way to exercise a basic data right — this is the one
end-user-facing legal capability that isn't just documentation.

**Independent Test**: Send an email to the published contact address with the subject "Delete my
account" from the account's signed-in address, and confirm account data is deleted and confirmed
by reply within the published time window.

**Acceptance Scenarios**:

1. **Given** a user cannot access the browser extension, **When** they email the published
   contact address with the specified subject line from their account's email, **Then** their
   account data is deleted within the published window and they receive a confirmation reply.
2. **Given** a user removes a single phone instead of deleting the whole account, **When** they do
   so from Settings, **Then** only that device's record and push access are removed — the rest of
   the account is untouched.
3. **Given** a user just signs out, **When** they do so, **Then** no data is deleted — sign-out
   and deletion are distinct actions and the policy does not conflate them.

---

### User Story 2 - Pass Play Store review with an accurate privacy/data declaration (Priority: P1)

A Play Store reviewer evaluating the app finds a privacy policy and Data Safety declaration that
accurately match what the app collects and does, and a test account that lets them get past the
subscription gate to evaluate the rest of the app.

**Why this priority**: The app cannot be distributed on Google Play at all if this fails —
under-declaring data collection is called out as the single most common cause of Data Safety
enforcement, and a reviewer who can't sign in can't approve anything else about the app.

**Independent Test**: Compare every data type declared in the Data Safety answer sheet against
what the code actually sends off-device, confirm none are missing; separately, sign in with the
provided reviewer test account and confirm it has an active, non-expired subscription so it clears
the lockout screen.

**Acceptance Scenarios**:

1. **Given** the code sends a category of data off-device (account identity, device identifiers,
   lead/buyer data), **When** the Data Safety form is filled out, **Then** that category is
   declared as collected, not omitted.
2. **Given** the app uses a third-party processor (Firebase, Google Sign-In, Expo push), **When**
   the privacy policy lists processors, **Then** that processor and what it receives is named
   explicitly, including that Expo's relayed alert text contains buyer name and city.
3. **Given** a reviewer needs to sign in to evaluate the app, **When** they use the supplied test
   credentials, **Then** those credentials have an active, non-expired subscription so the
   reviewer reaches the app past the entitlement lockout.
4. **Given** the app later adds a new SDK or data type (e.g., analytics or crash reporting),
   **When** that change ships, **Then** the Data Safety declaration is revisited and updated
   before the next submission — it is not treated as a one-time answer sheet.

---

### User Story 3 - Justify the full-screen-intent permission, with a safe fallback (Priority: P2)

A Play reviewer evaluating the app's use of the full-screen-intent (and related overlay)
permission finds a clear justification that the feature is opt-in, off by default, explained to
the user before it's requested, and that the app works fully without it.

**Why this priority**: This permission is scrutinized separately from the general Data Safety
form and carries real rejection risk (Google's stated policy favors calling/alarm apps); it
matters less than Stories 1–2 because the app has a documented, low-effort fallback if it's
rejected.

**Independent Test**: Review the declaration text against the code paths it cites, and confirm
that removing the permission (per the documented fallback) leaves every other feature intact.

**Acceptance Scenarios**:

1. **Given** the declaration states banner alerts are the default and phone-call alerts are
   opt-in, **When** checked against the code, **Then** the default notification style is
   confirmed to be the non-full-screen one.
2. **Given** the declaration states the app explains the permission before requesting it, **When**
   checked against the code, **Then** an in-app explanation with "Not now"/"Open settings" is
   confirmed to run before the system permission screen ever opens.
3. **Given** the full-screen-intent declaration is rejected by Play, **When** the documented
   fallback is applied (remove the full-screen-intent permission, hide the phone-call option),
   **Then** every other feature — heads-up alerts, lead history, device management, sign-in —
   continues to work unchanged. (The "display over other apps" permission is independent of this
   declaration and unaffected either way — it is already optional and never gates any feature.)

---

### Edge Cases

- What happens if a deletion request by email doesn't come from the account's own signed-in
  address? The published process specifies the request must come from that address; a request
  from elsewhere isn't guaranteed to be honored the same way.
- What happens if the app starts collecting a new kind of data (e.g., adds crash reporting) without
  updating these documents? The declarations become inaccurate, which the source documents
  themselves flag as the most likely cause of Play enforcement — this is treated as a compliance
  bug, not a documentation nicety.
- What happens if a reviewer's test account's subscription expires before review completes?
  The reviewer would hit the same lockout screen as any other user with an expired subscription —
  the test account must be kept valid for the duration of review.
- What happens if the full-screen-intent declaration is rejected? A specific, scoped fallback
  (remove one permission, hide one Settings option) is documented so the app is never left in a
  half-working state waiting on a permission decision. This is a contingency, not the expected
  outcome: per Play's own policy, not qualifying for default-grant only means the app must prompt
  the user and degrade gracefully if denied — which it already does — not that the app can't ship.
- What happens to data stored outside India (Firebase's Singapore region, Expo's US-touching
  infrastructure)? The policy discloses this transfer explicitly rather than staying silent on it.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The published privacy policy MUST accurately list every category of personal data
  the app actually collects — account identity, device identifiers, and lead/buyer data — with no
  category the code collects left undeclared.
- **FR-002**: The privacy policy MUST name a responsible party and a working contact address for
  privacy questions, requests, and complaints.
- **FR-003**: There MUST be at least one account/data deletion path that works for a user who
  cannot access the paired browser extension (the primary deletion route), with a stated maximum
  turnaround time and a confirmation step.
- **FR-004**: The Data Safety declaration submitted to Play MUST match the data categories in
  FR-001 and MUST be revisited whenever the app's data collection changes (a new SDK, a new data
  type).
- **FR-005**: The privacy policy MUST name every third-party processor that receives user or lead
  data (currently Firebase, Google Sign-In, Expo) and what each one receives.
- **FR-006**: A working reviewer test account with an active, non-expired subscription MUST be
  available for Play Store review, since the entitlement gate blocks evaluation otherwise.
- **FR-007**: The full-screen-intent permission declaration MUST state that the feature is
  opt-in, off by default, explained to the user before the system permission prompt, and that the
  app degrades to a standard notification if the permission is absent.
- **FR-008**: A documented, low-effort fallback MUST exist to remove full-screen-intent-dependent
  functionality without breaking any other feature, for use if the permission declaration is
  rejected.
- **FR-009**: The privacy policy MUST disclose the region(s) where user and lead data is stored
  and processed, including any cross-border transfer.

### Key Entities

- **Privacy Policy**: The hosted, dated document (markdown source plus a published HTML mirror)
  describing what data is collected, why, by whom it's processed, and how a user exercises their
  rights.
- **Data Safety declaration**: The Play Console form answers, each traceable to a specific place
  in the code that actually performs the collection or transmission being declared.
- **Full-screen-intent declaration**: The Play Console justification text for the
  `USE_FULL_SCREEN_INTENT` and related overlay permissions, plus its fallback plan.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A user with no access to the browser extension can still get their account deleted
  through a single email, within the published time window.
- **SC-002**: Zero data categories the app actually collects are missing from the Data Safety
  declaration at the time of any given Play submission.
- **SC-003**: A Play reviewer using the supplied test account reaches the app's normal screens
  without needing to contact the developer.
- **SC-004**: If the full-screen-intent permission is unavailable — denied by the user or rejected
  by Play — every lead alert is still delivered, just without the full-screen takeover.
- **SC-005**: Every third-party processor and storage region named in the privacy policy matches
  what the shipped code actually uses, with no undisclosed data flow.

## Assumptions

- These documents live outside the app's UI (hosted pages, Play Console form answers), not as an
  in-app screen; there is currently no in-app privacy/legal screen to spec separately.
- Deletion of a full account and its lead history is primarily performed via the paired browser
  extension, which is a separate repository out of scope here; this feature covers only the email
  fallback and this app's description of that primary route.
- These documents were prepared with AI assistance from the code and are explicitly not legal
  advice, per the disclaimer already present in the privacy policy; they are expected to be
  reviewed by a qualified professional before being relied upon.
- Compliance content is coupled to the current code, not a one-time deliverable — any change to
  what data is collected or which third parties process it requires a corresponding update here.
