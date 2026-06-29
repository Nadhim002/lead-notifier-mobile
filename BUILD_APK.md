# Local APK Build Guide — Lead Notifier

This guide covers building the Android APK locally in two modes and installing it on a physical device via USB.

---

## Prerequisites

Ensure the following are installed and configured before building:

| Tool | Check | Install |
|------|-------|---------|
| Node.js (18+) | `node -v` | [nodejs.org](https://nodejs.org) |
| Java JDK 17 | `java -version` | `brew install openjdk@17` |
| Android Studio | — | [developer.android.com/studio](https://developer.android.com/studio) |
| Android SDK (API 35) | Android Studio → SDK Manager | — |
| ADB | `adb version` | Included with Android Studio |

**Set environment variables** (add to `~/.zshrc` or `~/.bashrc`):

```bash
export ANDROID_HOME=$HOME/Library/Android/sdk
export PATH=$PATH:$ANDROID_HOME/emulator
export PATH=$PATH:$ANDROID_HOME/platform-tools
export JAVA_HOME=$(/usr/libexec/java_home -v 17)
```

Then reload: `source ~/.zshrc`

**Install dependencies** (run once from `mobile-app/`):

```bash
npm install
```

---

## Option 1 — Debug APK (runs with dev server)

Use this during active development. The app connects to a Metro bundler running on your machine, so you get fast refresh and JS logs.

### Step 1 — Start the Metro dev server

Open a terminal in `mobile-app/` and run:

```bash
npx expo start
```

Leave this terminal running.

### Step 2 — Build and install the debug APK

In a **second terminal** in `mobile-app/`:

```bash
npx expo run:android
```

This will:
- Compile the native Android code via Gradle
- Produce a debug APK at `android/app/build/outputs/apk/debug/app-debug.apk`
- Install it on any connected device/emulator automatically

> The APK is hardcoded to connect to your machine's IP on port 8081. Your phone and computer must be on the **same Wi-Fi network**, or connected via USB with ADB reverse (see below).

**ADB reverse (for USB connection without Wi-Fi):**

```bash
adb reverse tcp:8081 tcp:8081
```

Run this after plugging in your phone, then open the app.

---

## Option 2 — Release APK (standalone, no dev server needed)

Use this to produce a self-contained APK you can share or install without running Metro.

### Step 1 — Set JS bundle mode to release

From `mobile-app/`:

```bash
npx expo export --platform android
```

This pre-bundles the JS into `dist/`. Gradle picks it up automatically in release mode.

### Step 2 — Build the release APK

```bash
cd android
./gradlew assembleRelease
```

The unsigned release APK will be at:

```
android/app/build/outputs/apk/release/app-release.apk
```

> **Note:** By default this APK is unsigned and cannot be installed on devices with security restrictions. For a debug-signed release build (installable without Play Store), run:

```bash
./gradlew assembleRelease -Pandroid.injected.signing.store.file=debug.keystore \
  -Pandroid.injected.signing.store.password=android \
  -Pandroid.injected.signing.key.alias=androiddebugkey \
  -Pandroid.injected.signing.key.password=android
```

Or simply use `assembleDebug` with `DEV=false` to get a release-like build signed with the debug key:

```bash
cd android
ENVFILE=.env.production ./gradlew assembleDebug
```

> **Important:** `assembleDebug` does NOT bundle JS — it still requires Metro running.
> For a true standalone APK, always use `assembleRelease`.

```bash
cd android
./gradlew assembleRelease
# APK: android/app/build/outputs/apk/release/app-release.apk
```

---

## Installing the APK on Your Android Phone via USB

### Step 1 — Enable USB Debugging on your phone

1. Open **Settings** → **About phone**
2. Tap **Build number** 7 times until you see "You are now a developer"
3. Go back to **Settings** → **Developer options**
4. Enable **USB debugging**

### Step 2 — Connect your phone via USB

Plug in your phone. On your phone, tap **Allow** when prompted to trust the computer.

Verify the connection:

```bash
adb devices
```

You should see your device listed, e.g.:

```
List of devices attached
R58M12345XY    device
```

If it shows `unauthorized`, unplug and re-plug, then tap **Allow** on your phone again.

### Step 3 — Install the APK

**Debug APK:**

```bash
adb install android/app/build/outputs/apk/debug/app-debug.apk
```

**Release APK:**

```bash
adb install android/app/build/outputs/apk/release/app-release.apk
```

Successful output:

```
Performing Streamed Install
Success
```

The app will appear in your phone's app drawer as **Lead Notifier**.

### Reinstalling (if app already installed)

```bash
adb install -r android/app/build/outputs/apk/debug/app-debug.apk
```

The `-r` flag reinstalls without wiping app data.

---

## Quick Reference

| Goal | Command |
|------|---------|
| Start dev server | `npx expo start` |
| Build + install debug (with dev server) | `npx expo run:android` |
| Build standalone debug APK | `cd android && ./gradlew assembleDebug` |
| Build standalone release APK | `cd android && ./gradlew assembleRelease` |
| Install APK via USB | `adb install path/to/app.apk` |
| Reinstall APK via USB | `adb install -r path/to/app.apk` |
| Forward Metro port over USB | `adb reverse tcp:8081 tcp:8081` |
| Check connected devices | `adb devices` |

---

## Troubleshooting

**`SDK location not found`**
Create `android/local.properties` with:
```
sdk.dir=/Users/<your-username>/Library/Android/sdk
```

**`adb: command not found`**
Add `$ANDROID_HOME/platform-tools` to your `PATH` (see Prerequisites above).

**App crashes on open (release build)**
The release build may be missing the JS bundle. Run `npx expo export --platform android` before `assembleRelease`.

**Metro connection refused on device**
Run `adb reverse tcp:8081 tcp:8081` after connecting the phone, then shake the device and tap **Reload**.

**`INSTALL_FAILED_UPDATE_INCOMPATIBLE`**
Uninstall the existing version first:
```bash
adb uninstall com.leadnotifier.app
```
Then reinstall.
