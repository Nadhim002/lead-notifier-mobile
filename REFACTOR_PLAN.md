# Refactor Plan — mobile-app (Lead Notifier)

> Paste this into a GitHub issue on `Nadhim002/lead-notifier-mobile`. Scope agreed: **structure + dedup only.** No new tests, no type-safety hardening pass, no secret/artifact cleanup in this refactor (see Out of Scope).

## Problem Statement

The app works, but its structure and patterns are inconsistent. There is no `src/` root: logic files (`firebase.ts`, `notifications.ts`, `channels.ts`, `logger.ts`, `navigation.ts`) sit loose at the repository root next to config files, and naming clashes (lowercase modules vs. PascalCase `App.tsx` vs. camelCase hooks). Several things are duplicated or dead:

- The notification body-builder (`[buyerName, city, state].filter(Boolean)…`) is re-implemented in three places.
- `fireLeadNotification` and `firePhonecallNotification` are near-identical, differing only by channel ID — and `firePhonecallNotification` is never imported (dead).
- `hooks/useFirebaseAuth.ts` is never imported (dead), superseded by `useGoogleAuth`.
- `HomeScreen` still ships the debug string "Listening for Leads two".
- A `logger.ts` abstraction exists, but three hooks bypass it with raw `console.log`/`console.error` and hand-typed prefixes.
- The Firebase device path `devices/${uid}/${deviceId}` and deviceId minting are duplicated across two hooks.
- The same color palette is re-declared inline in every screen (no shared theme).

The net effect is that a reader has to bounce between loose root files with clashing names, and small format changes have to be made in several spots.

## Solution

Remove the dead code first, then collapse each duplication into a single helper (notification body, notification firing, Firebase device path, theme palette) and route all logging through the existing `logger.ts`. Finally, introduce a `src/` root and standardize file naming so the layout is predictable. The cross-repo contract with the extension (channels, Firebase config) stays a documented convention (not shared code) by decision.

## Commits

Each commit leaves the app buildable and `tsc --noEmit` clean; run the app (`npm run android`) and confirm sign-in, a lead notification, and settings after the notable ones.

1. **Delete confirmed dead code and fix the debug string.** Remove `hooks/useFirebaseAuth.ts` (unused) and the unused `firePhonecallNotification` export, and correct the "Listening for Leads two" copy in `HomeScreen`. Verify `tsc --noEmit` is clean and the app builds. Smallest possible first step — remove before moving.

2. **Route the three raw-`console` hooks through `logger.ts`.** Update `useGoogleAuth`, `useDeviceRegistration`, and `useNotificationStyle` to use the tagged loggers (adding any missing tags), and stop logging full auth response payloads. Verify tagged logs appear.

3. **Consolidate the notification body-builder into one helper.** Extract the `buyerName/city/state` parts logic into a single function used by `notifications.ts` and `useLeadListener`. Verify a lead notification body is unchanged.

4. **Collapse notification firing into one channel-parameterized function.** With the phonecall variant already removed, keep a single notification function that takes the channel ID. Verify a lead notification still fires on both channels as configured.

5. **Extract the Firebase device-path + deviceId logic into one module.** Define `devices/${uid}/${deviceId}` construction and deviceId minting once, consumed by `useDeviceRegistration` and `useNotificationStyle`. Verify device registration and notification-style updates still write to the right path.

6. **Extract a shared theme tokens module.** Move the repeated palette (`#f8faff`, `#0f172a`, `#6b7280`, `#16a34a`, …) into one tokens module and have each screen import it. Verify visual parity across screens.

7. **Create `src/` and move the loose root logic files in, in small batches.** Move `logger.ts`, then `channels.ts`, then `firebase.ts`, then `notifications.ts`, then `navigation.ts` (one or two per commit), updating imports and running `tsc --noEmit` between each. Keep `index.ts` (Expo root registration) and `App.tsx` where Expo expects them; leave configs (`app.json`, `eas.json`, `tsconfig.json`, etc.) at the root.

8. **Move `screens/`, `hooks/`, `modules/`, `types/` under `src/`.** Update imports and verify the app builds and navigates.

9. **Standardize file naming.** Settle on one convention — PascalCase for components/screens, camelCase `useX.ts` for hooks, and a single style for plain modules — and rename outliers to match. Verify imports resolve and the app runs.

## Decision Document

- **Dead code is removed before any restructuring**, so later moves touch fewer files.
- **Each duplicated concept collapses to a single helper/module within this repo:** the notification body-builder, the notification-firing function (channel-parameterized), the Firebase device path/id, and the theme palette.
- **All logging goes through the existing tagged logger**; hooks stop using raw `console` and stop logging auth response payloads.
- **A `src/` root is introduced** to separate application code from root-level config; Expo's entry (`index.ts`) and `App.tsx` remain where the framework expects them.
- **File naming becomes consistent** across components, hooks, and modules.
- **The cross-repo contract with the extension stays documented, not shared code** — no monorepo or shared package by decision.

## Testing Decisions

- No test harness exists today and none is added in this refactor (out of scope by decision). Verification for every commit is: `tsc --noEmit` is clean, the app builds, and a manual smoke test of Google sign-in, receiving a lead notification (both heads-up and full-screen call styles), and changing the notification style in Settings passes.
- A good test here would assert **external behavior** — e.g. "given this lead payload, the notification body reads exactly this" — not the internals of a hook.
- The helpers extracted in commits 3 and 5 (notification body-builder, device-path builder) are the natural first candidates for a future test pass; they are pure and framework-free. There is no prior art for tests in this repo.

## Out of Scope

- Adding a test runner or any tests.
- A type-safety hardening pass — e.g. removing the `as unknown as LeadPayload` / `as any` casts (that is a separate, optional follow-up).
- Introducing a state-management library or changing the hooks-only data-fetching approach.
- Secret/keystore hygiene: untracking `google-services.json` (tracked in two locations) and `android/app/debug.keystore`, moving the loose root `.jks` files out of the working tree, or moving the inline Firebase web config to env/`expo-constants`.
- Reducing the oversized `assets/icon.png` (393 KB).
- Extracting a shared package/monorepo across the two repos.

## Further Notes

- **SDK versions are unusually high** (Expo 56 / RN 0.85 / React 19); `AGENTS.md` warns to read the versioned docs before coding. Keep changes framework-neutral where possible.
- The `as unknown as` / `as any` casts (App.tsx ×2, notifications.ts ×2, `SignInScreen as any`) are noted but intentionally left for a future type-hardening pass so this refactor stays purely structural.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
