# Local Debugging Guide — Lead Notifier Mobile App

## Prerequisites

- Android device or emulator connected
- `expo-dev-client` already installed (in `package.json`)
- Corporate network: prefix commands with `NODE_TLS_REJECT_UNAUTHORIZED=0`

---

## Step 1 — Build a Dev Client (one-time)

Expo Go cannot receive Firebase/FCM notifications. You need a custom dev build.

### Android (physical device or emulator)

```bash
cd mobile-app
npx expo run:android
```

This builds and installs the app on your connected Android device automatically.

### iOS (Mac only)

```bash
npx expo run:ios
```

---

## Step 2 — Start the Dev Server

After the build is installed on the device:

```bash
npx expo start --dev-client
```

Or use the shorthand scripts:

```bash
npm run android   # starts + opens on Android
npm run ios       # starts + opens on iOS
```

---

## Step 3 — Read Logs

All `console.log`, `console.warn`, and `console.error` output streams directly to the terminal where you ran `expo start`.

### Log format used in this app

```
[APP]        App lifecycle events (startup, auth, pairing)
[AUTH]       Firebase auth state changes
[NOTIF]      Notification setup and permission status
[LEADS]      Lead listener events (new lead received, firebase callbacks)
[HOME]       HomeScreen mount/unmount
```

### Example output

```
[APP] App mounted
[AUTH] Firebase auth ready, uid: abc123
[APP] Pairing state from AsyncStorage: null
[APP] Subscribed to Firebase pairing ref
[APP] isPaired set to: true
[HOME] HomeScreen mounted, listening for leads
[NOTIF] Permissions status: granted
[NOTIF] Android channel created: lead-alerts
[LEADS] Lead listener started for uid: abc123
[LEADS] New lead received: {"title":"New Lead Purchased","timestamp":1234567890}
[LEADS] Firing notification: New Lead Purchased
```

---

## Step 4 — Corporate Network Workaround

If you see `unable to get local issuer certificate`:

```bash
NODE_TLS_REJECT_UNAUTHORIZED=0 npx expo run:android
NODE_TLS_REJECT_UNAUTHORIZED=0 npx expo start --dev-client
```

---

## Troubleshooting

| Issue | Fix |
|---|---|
| App opens Expo Go instead of dev build | Uninstall Expo Go, reinstall the dev build `.apk` |
| No logs in terminal | Make sure you're running `expo start --dev-client`, not just the app |
| Notifications not received | Check `[NOTIF]` logs — permission may be denied |
| Firebase not connecting | Check `[AUTH]` logs — uid should appear within 2–3 seconds of launch |
| Lead not firing notification | Check `[LEADS]` log — confirm lead was received before blaming notification |
