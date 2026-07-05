# Architecture — Lead Notifier (mobile app)

How the phone app is wired: the auth session seam, device registration, the lead listener, the four
ways a lead reaches the UI, the native full-screen-intent path, and the Firebase data model. Read the
[README](../README.md) first for setup; this covers the "why".

---

## App wiring

`index.ts` registers `App`. `App` provides the single auth session and, once signed in, mounts the
navigation stack and starts the background pieces.

```mermaid
flowchart TB
  Root["index.ts → App"] --> AP["AuthProvider (one onAuthStateChanged)"]
  AP --> Shell["AppShell — useAuth()"]
  Shell -->|not signed in| SignIn["SignInScreen"]
  Shell -->|no/expired sub| Lock["LockoutScreen"]
  Shell -->|no phone seat| Limit["DeviceLimitScreen"]
  Shell -->|entitled| Nav["Navigator: Home · IncomingLead · Settings"]
  Shell --> Setup["setupNotifications() → Expo push token"]
  Shell --> Ent["useEntitlement(email)"]
  Shell --> Dev["usePhoneDevices(email, token, entitlement)"]
  Home["HomeScreen"] --> Listen["useLeadListener(email)"]
  Ent --> FB[(Firebase RTDB)]
  Dev --> FB
  Listen --> FB
```

- **`AuthProvider` (`hooks/AuthProvider.tsx`)** holds the **one** `onAuthStateChanged` subscription
  for the whole app and configures Google Sign-In once. Every screen reads it via `useAuth()`.
- **`setupNotifications()`** requests permission, creates the Android channels, and returns the Expo
  push token.
- **`useEntitlement(email)`** subscribes to `accounts/{email}/subscription`. Signed in but no valid,
  non-expired subscription → **full lockout** (`LockoutScreen`); registration and the lead listener
  do not run. `tier` (free/paid) is only a label.
- **`usePhoneDevices(email, token, entitlement)`** registers/heartbeats this phone under
  `accounts/{email}/phones/{deviceId}` — only when entitled and a seat is free (never before the
  roster loads). At the `maxPhones` cap it exposes the roster for `DeviceLimitScreen` (pure
  self-service removal, each device shown with `lastSeen`). Shared to Settings via `DevicesContext`.
- **`useLeadListener(email)`** (mounted by `HomeScreen`) subscribes to `accounts/{email}/leads/new`
  and fires the alert.

---

## Device identity (`deviceIdentity.ts`)

One module owns the device's identity and its Firebase location, consumed by both
`usePhoneDevices` (writes the record) and `useNotificationStyle` (updates the style):

- `getOrCreateDeviceId()` — a **stable** id (Android ID / iOS identifierForVendor), cached in
  AsyncStorage, with a random fallback. Stable ids stop the "N phones" count inflating on reinstall.
- `getStoredDeviceId()` — the cached id only (no side effect), for callers that must not create one.
- `defaultPhoneName()` — a friendly default name (manufacturer + model) set on first registration;
  the user can rename it in Settings.
- `deviceRef(accountKey, id)` — the `accounts/{accountKey}/phones/{deviceId}` reference, defined once
  (`accountKey` = `sanitizeEmail(email)` from `email.ts`).

---

## How a lead reaches the UI

A lead can arrive through **four** paths, all converging on `navigateToIncomingLead(lead)`
(`navigation.ts`). This redundancy covers foreground, background, and killed states:

| Path | When | Where |
|---|---|---|
| **Live listener** | app running, new lead written to RTDB | `useLeadListener` (`onChildAdded`) |
| **Notification tap** | user taps a notification (app backgrounded) | `App.tsx` response listener |
| **Cold start** | app launched by tapping a notification | `App.tsx` `getLastNotificationResponseAsync` |
| **Full-screen intent** | phonecall style, killed/warm state | `App.tsx` `PhonecallNotification.getInitialLeadData()` |

In the live listener, **phonecall** style navigates immediately (foreground) or posts the native
full-screen intent (background); **headsup** style calls `fireLeadNotification` (banner). Both derive
their text from the single `leadNotificationText(payload)` in `notifications.ts`.

---

## Native full-screen intent (phonecall style)

The full-screen "incoming call" behavior isn't standard Expo — it's a native Android module written
by the Expo **config plugin** `plugins/withFullScreenIntent.ts` at prebuild, bridged to JS via
`modules/PhonecallNotification.ts`.

```mermaid
sequenceDiagram
  participant EX as Extension (Expo push, data-only)
  participant SVC as Native LeadNotificationService
  participant JS as App (JS)
  participant UI as IncomingLeadScreen

  EX->>SVC: data-only push (type: phonecall, lead JSON)
  SVC->>SVC: fire full-screen intent (over lock screen)
  SVC->>JS: intent carries lead data
  JS->>JS: PhonecallNotification.getInitialLeadData()
  JS->>UI: navigateToIncomingLead(lead)
```

A **data-only** push (no title/body) is used so Android doesn't auto-display it as a banner — the
native service decides how to present it. Android 14+ requires the user to grant full-screen-intent
permission (requested from Settings when phonecall is selected).

---

## Firebase RTDB data model

Both apps share one Realtime Database, account-centric and keyed by the sanitized email
(`accountKey = sanitizeEmail(email)`; see `email.ts`). The admin dashboard writes `subscription`;
security rules keep it read-only to the user.

```
accounts/{accountKey}/
  subscription   { tier, expiryDate, lastPaidDate, maxComputers, maxPhones, createdAt, updatedAt }
                 ← admin-only write; this app reads via useEntitlement (lockout if missing/expired)

  leads/new/{pushId}   ← extension writes; this app's useLeadListener reads (onChildAdded)
    { title, buyerName, buyerMobile, quantity, city, state, timestamp }

  phones/{deviceId}    ← this app writes; the extension reads to know where to push
    { name, fcmToken, notificationStyle: "headsup" | "phonecall", lastSeen }

  computers/{installId}  ← the extension's own device seats (this app only counts them indirectly)
```

The listener queries `accounts/{accountKey}/leads/new` ordered by `timestamp`, starting at the moment
it mounts, so only genuinely new leads fire an alert.

`tier` is only a label — validity is "subscription exists and `expiryDate` is in the future".
`sanitizeEmail` and the `subscription` shape are duplicated here (`email.ts`, `entitlement.ts`) and
must stay identical to the extension's `src/shared/email.ts` and `entitlement.ts`.

---

## Cross-repo wire contract

This app and the [extension](https://github.com/Nadhim002/indiamart-extension) are separate repos
sharing three formats **by convention, not shared code**:

1. **Channel IDs** (`channels.ts` ↔ extension `src/shared/channels.ts`) — a mismatch makes Android
   silently drop the notification.
2. **Firebase project + account schema** — both talk to the same RTDB and the same
   `accounts/{accountKey}` tree. `sanitizeEmail` must be identical across this app, the extension,
   and the admin dashboard, or the clients won't meet.
3. **Expo push payload** — the phonecall (data-only) vs banner shape the extension's
   `buildExpoMessage` produces and this app consumes.
4. **Entitlement model** — the `subscription` fields and `evaluateSubscription` semantics mirror the
   extension's `src/shared/entitlement.ts`.

Change any of these and update both repos together.
