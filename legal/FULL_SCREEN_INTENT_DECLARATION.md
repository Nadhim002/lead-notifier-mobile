# Play Console — USE_FULL_SCREEN_INTENT declaration

**App:** Lead Notifier (`com.leadnotifier.app`)
**Where:** Play Console → Policy → App content → **Full-screen intent permission**
**Prepared:** 16 August 2026

---

## Read this before you submit

Google's stated policy is that `USE_FULL_SCREEN_INTENT` is **auto-granted at install** only to apps whose core functionality is calling or alarms/timers. Lead Notifier is neither, so answer this declaration honestly ("no permitted core functionality") — **that is not a rejection and not a publishing blocker.**

Per [Play Console Help](https://support.google.com/googleplay/android-developer/answer/13392821): "For apps that did not complete the declaration or have not been approved for default enabling, developers will need to prompt users to grant permission on new installs and gracefully degrade the experience if denied." That is exactly what this app already does — it prompts via `Settings.ACTION_MANAGE_APP_USE_FULL_SCREEN_INTENT` only after the user opts into Phone Call Alert style, and falls back to a standard heads-up notification if the user declines. The declaration only decides whether the permission is pre-granted at install; it does not decide whether the app may ship.

What genuinely helps here is that the feature is *alarm-like*, *off by default*, *explicitly opted into by the user*, and *degrades safely*. All four are true of your code, and the text below leads with them rather than trying to argue you are a dialer.

**Contingency, not the expected outcome:** the app's default notification style is `headsup` ([usePhoneDevices.ts:62](../hooks/usePhoneDevices.ts#L62)), so even in the unlikely event Play required removing the permission outright, that would cost only the phone-call alert style and nothing else. Fallback plan is at the bottom.

---

## Declaration text — paste this into the form

> Lead Notifier is a real-time alerting tool for small-business sellers. When a sales enquiry is purchased on the user's linked marketplace account, the seller must respond within minutes — enquiries are distributed to several sellers at once and, in practice, the first to call the buyer wins the order. A missed alert is direct lost revenue.
>
> To serve this, the app offers two notification styles, chosen by the user per device in Settings:
>
> 1. **Banner Notification** — a standard heads-up notification. **This is the default.** No full-screen intent is used.
> 2. **Phone Call Alert** — an opt-in, alarm-style alert that rings and takes over the screen so an incoming lead is not missed when the device is locked, face-down, or idle.
>
> `USE_FULL_SCREEN_INTENT` is used **only** for style 2, and **only** after the user explicitly selects it. Selecting it triggers an in-app explanation and sends the user to the system settings page to grant the permission themselves; the app never attempts to obtain it silently or on first launch. Users can switch back to banner notifications at any time.
>
> The full-screen alert is time-critical and user-initiated in the same sense as an alarm: it fires only on a discrete, unpredictable, high-urgency event that the user has asked to be woken for, it presents a single actionable item, and it is dismissed by the user. It is never used for marketing, promotions, engagement prompts, re-engagement, or any content the user did not ask to be interrupted for. Exactly one full-screen notification is posted per lead.
>
> If the permission is not granted, the app degrades gracefully to a standard high-priority heads-up notification with no loss of core functionality and no repeated prompting.

---

## Supporting answers the form may ask for

**Is the permission required for core functionality?**
No. It enhances an opt-in alert style. The app is fully functional without it.

**What happens if the user denies it?**
The alert is delivered as a standard heads-up notification. `canUseFullScreenIntent()` is checked before use and the app takes the non-full-screen path when it returns false.

**How often is a full-screen intent shown?**
Only on receipt of a new purchased lead — an event the user pays for and has explicitly asked to be alerted about. One notification per lead. No recurring, scheduled, or promotional use.

**Is the user informed before the permission is requested?**
Yes. Selecting "Phone Call Alert" shows an in-app dialog explaining what is needed and why, with "Not now" and "Open settings" options. Nothing is requested until the user taps through.

---

## Where a reviewer can verify each claim

| Claim | Evidence |
|---|---|
| Banner is the default; phone-call is opt-in | [hooks/useNotificationStyle.ts](../hooks/useNotificationStyle.ts) — `DEFAULT: NotificationStyle = 'headsup'` |
| User must explicitly select the style | [SettingsScreen.tsx](../screens/SettingsScreen.tsx) — `selectPhonecall` runs only on tap |
| Explained before requesting | [PhonecallNotification.ts](../modules/PhonecallNotification.ts) — `ensurePhonecallPermissions()`, an `Alert.alert` with "Not now" / "Open settings" |
| Permission never taken silently | [PhonecallNotificationModule.kt](../android/app/src/main/java/com/leadnotifier/app/PhonecallNotificationModule.kt) (generated by [plugins/withFullScreenIntent.ts](../plugins/withFullScreenIntent.ts)) — `canUseFullScreenIntent` gate; settings opened only on user action |
| Categorised as a call-style alert | Same file — `CATEGORY_CALL`, one notification ID, `setAutoCancel(true)` |
| One notification per lead | Fixed `NOTIFICATION_ID = 9001` — a new lead replaces the previous alert rather than stacking |

---

## Also expect to justify: SYSTEM_ALERT_WINDOW

"Display over other apps" appears in your manifest and Play scrutinises it separately. It is now **fully optional and never gates any feature** — selecting Phone Call Alert style requires only full-screen-intent; overlay is offered afterward as a separate, skippable reliability row in Settings, shown only on devices that haven't granted it. If asked:

> The permission is optional and is never required to use any feature of the app — Phone Call Alert style works without it. On several Android OEM distributions (Xiaomi/HyperOS, ColorOS, FuntouchOS, realme UI), background activity launch is restricted beyond stock Android unless "Display over other apps" is granted, which can prevent the full-screen lead alert from appearing while the app is backgrounded or killed on those specific builds. The app surfaces this as a separate, skippable "improve reliability" option in Settings — distinct from, and requested independently of, the Phone Call Alert style itself — explains the reason in a dialog, and opens the standard system settings page for the user to grant it. It is never used to draw overlays on top of other applications, to obscure system UI, or to display any content outside the user-initiated lead alert.

That is an accurate description of [PhonecallNotification.ts](../modules/PhonecallNotification.ts) (`canDrawOverlays`, `requestOverlayForReliability`, `openOverlaySettings`) and [SettingsScreen.tsx](../screens/SettingsScreen.tsx) (the "Improve Reliability" section, shown only while the permission is missing).

---

## Fallback if the declaration is rejected

This applies only in the unlikely event Play required removing `USE_FULL_SCREEN_INTENT` outright, rather than the normal outcome (prompt-and-degrade). SYSTEM_ALERT_WINDOW is unaffected either way — it's an independent, optional permission not tied to this declaration.

Three changes, roughly ten minutes of work, then rebuild:

1. Remove `USE_FULL_SCREEN_INTENT` from `android.permissions` in [app.json](../app.json) (and let the manifest regenerate via prebuild).
2. Hide the "Phone Call Alert" option in [SettingsScreen.tsx](../screens/SettingsScreen.tsx) so no user can select a style the build can no longer honour.
3. Keep the native module in place — `LeadNotificationService` still routes pushes correctly; only the full-screen path goes unused.

Everything else — heads-up alerts, lead history, device management, sign-in — is untouched.

---

*Prepared with AI assistance from the app's source. Verify each claim against the code before submitting; you are attesting to its accuracy.*
