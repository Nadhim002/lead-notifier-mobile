# Play Console — Data Safety answer sheet

**App:** Lead Notifier (`com.leadnotifier.app`)
**Prepared:** 16 August 2026
**Where to enter this:** Play Console → your app → Policy → App content → **Data safety**

This is an answer sheet, not a document to upload. Work through the form and enter these answers. Every answer below is derived from the actual code — the file references let you re-verify any of it.

---

## Section 1 — Data collection and security

| Question | Answer | Why |
|---|---|---|
| Does your app collect or share any of the required user data types? | **Yes** | Email, device IDs, and lead contact data all leave the device |
| Is all of the user data collected by your app encrypted in transit? | **Yes** | Firebase SDK and FCM are TLS-only |
| Do you provide a way for users to request that their data is deleted? | **Yes** | Deletion via the browser extension, plus an email route in the privacy policy §9 |

> **Deletion URL:** `https://nadhim002.github.io/lead-notifier-mobile/privacy.html#deletion`

---

## Section 2 — Data types to declare

For every row: **Collected = Yes**, **Shared = No**, **Processed ephemerally = No**, **Required or optional = Required** (unless stated), **Data deletion = users can request deletion**.

"Shared = No" is correct because Firebase and Expo are service providers acting on your instructions, which Play explicitly excludes from "sharing".

### Personal info

| Data type | Collected | Purposes | Notes |
|---|---|---|---|
| **Email address** | Yes | App functionality; Account management | Google Sign-In → [AuthProvider.tsx:56](../hooks/AuthProvider.tsx#L56) |
| **User IDs** | Yes | App functionality; Account management | Firebase UID |
| **Name** | Yes | App functionality | **Buyer name** in lead records — [types/lead.ts](../types/lead.ts) |
| **Phone number** | Yes | App functionality | **Buyer mobile** in lead records — [types/lead.ts](../types/lead.ts) |
| **Address** | Yes | App functionality | City and state only, in lead records. Declare under "Other info" if you prefer, but City/State maps most honestly here |

> The Name / Phone number / Address rows are your customers' data, not the app user's. Play's form has no "third-party contact data" category, so declare them normally. **Do not omit them** — under-declaration is the single most common cause of Data Safety enforcement.

### Device or other IDs

| Data type | Collected | Purposes | Notes |
|---|---|---|---|
| **Device or other IDs** | Yes | App functionality; Fraud prevention, security and compliance | Android ID for device-seat identity ([deviceIdentity.ts:38](../deviceIdentity.ts#L38)), plus the Expo/FCM push token |

### App activity

| Data type | Collected | Purposes | Notes |
|---|---|---|---|
| **Other user-generated content** | Yes | App functionality | Lead title, quantity, price, timestamp |
| **App interactions** | No | — | No analytics SDK is present |

### Everything else — declare as NOT collected

Location · Financial info (no payment data is handled in-app) · Health and fitness · Messages · Photos and videos · Audio files · Files and docs · Calendar · Contacts · Search history · Installed apps · Web browsing history · Crash logs · Diagnostics · Advertising ID

**Verify before submitting:** there is no advertising, analytics, or crash-reporting SDK in [package.json](../package.json). If you later add Crashlytics or Sentry, you must come back and declare Crash logs and Diagnostics.

---

## Section 3 — Purposes, in Play's vocabulary

Use only these purposes:

- **App functionality** — delivering alerts, displaying leads, signing in
- **Account management** — creating and maintaining your account
- **Fraud prevention, security and compliance** — device identity for enforcing subscription seat limits

Do **not** tick: Advertising or marketing · Analytics · Personalisation · Developer communications.

---

## Section 4 — Third parties to be aware of

| Provider | What it receives | Play treatment |
|---|---|---|
| Google Firebase (Auth, Realtime Database, Cloud Messaging) | Account data, device records, lead records | Service provider — not "sharing" |
| Google Sign-In | Email, account identifier | Service provider |
| **Expo Push Notification Service** | Push tokens, **and the alert title/body containing buyer name and city** | Service provider — but disclose it in the privacy policy, which we do at §5 |

The Expo hop is easy to miss: [notifications.ts:63](../notifications.ts#L63) calls `getExpoPushTokenAsync`, so notifications route through `exp.host` before reaching FCM. The alert body is built from buyer name, city, and state at [notifications.ts:80](../notifications.ts#L80).

---

## Section 5 — Other Play Console sections you must also complete

Data Safety is one form among several. These are all mandatory:

| Section | Answer |
|---|---|
| **Privacy policy URL** | `https://nadhim002.github.io/lead-notifier-mobile/privacy.html` |
| **App access** | Provide **working test credentials** — the app is fully gated behind Google Sign-In *and* an active subscription. A reviewer who cannot get past [LockoutScreen](../screens/LockoutScreen.tsx) will reject the app. Create a test account with a valid, non-expired subscription record and supply it here. **This is the most likely cause of rejection after the full-screen intent declaration.** |
| **Ads** | No ads |
| **Content rating** | Complete the questionnaire. Business/productivity tool, no user-generated public content → expect Everyone / 3+ |
| **Target audience** | 18 and over. Do not select any child age band |
| **News app** | No |
| **COVID-19 apps** | No |
| **Data deletion** | Provide the deletion URL described in Section 1 |
| **Government apps** | No |
| **Financial features** | No |
| **Health** | No |

---

## Deletion URL — resolved

Hosted at `https://nadhim002.github.io/lead-notifier-mobile/privacy.html#deletion`, anchored to §9, which names both routes (extension, and email fallback).

---

*Prepared with AI assistance from the app's source. Re-verify each row against the code before submitting — you are attesting to its accuracy, and Play enforces against inaccurate declarations.*
