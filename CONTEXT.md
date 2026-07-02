# CONTEXT — domain glossary

Shared vocabulary for the Lead Notifier mobile app. The
[extension](https://github.com/Nadhim002/indiamart-extension) uses the same glossary so both repos
speak one language.

| Term | Meaning |
|---|---|
| **Lead** | A buyer enquiry the extension purchased on IndiaMART and forwarded to this phone. Arrives as a `LeadPayload` (title, buyer name/mobile, quantity, city, state, timestamp). |
| **Auth session** | The single signed-in Google identity for the app, owned by `AuthProvider` and read via `useAuth()`. One `onAuthStateChanged` subscription for the whole app. |
| **Device / registration** | This phone's record at `devices/{uid}/{deviceId}` in Firebase, holding its Expo push token and notification style. Created by `useDeviceRegistration`. |
| **Device identity** | The stable per-phone id and its Firebase ref, owned by `deviceIdentity.ts`. |
| **Channel** | An Android notification channel: **banner** (`lead-alerts-banner`) or **call** (`lead-alerts-call`). IDs in `channels.ts`, must match the extension. |
| **Notification style** | Per-device preference: `headsup` (banner) or `phonecall` (full-screen incoming-call takeover). Stored locally and synced to Firebase. |
| **Full-screen intent** | The native Android mechanism that opens the "incoming lead" screen over the lock screen for phonecall style. Provided by the `withFullScreenIntent` config plugin + `PhonecallNotification`. |
| **Lead listener** | `useLeadListener` — the Firebase subscription (`onChildAdded` on `leads/{uid}/new`) that fires an alert when a new lead arrives while the app runs. |
| **Notification-entry path** | One of the four ways a lead reaches the UI (live listener, notification tap, cold start, full-screen intent) — all converge on `navigateToIncomingLead`. |
| **Expo push** | The delivery mechanism. The extension sends an Expo push message; a **data-only** push is used for phonecall style so Android doesn't auto-display it. |
