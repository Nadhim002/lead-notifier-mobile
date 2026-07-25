import { NativeModules, Platform, Alert } from 'react-native';

const { PhonecallNotification: Native } = NativeModules;

export const PhonecallNotification = {
  /**
   * Post a fullscreen-intent notification on Android.
   * When the screen is locked this shows IncomingLeadScreen directly over
   * the lock screen. When unlocked it shows as a MAX-priority heads-up banner.
   */
  present(title: string, body: string, leadDataJson: string): void {
    if (Platform.OS === 'android' && Native) {
      Native.present(title, body, leadDataJson);
    }
  },

  /**
   * Returns the lead JSON string if the app was cold-started by tapping a
   * fullscreen-intent notification, otherwise null. Consumes the value so it
   * is only returned once.
   */
  getInitialLeadData(): Promise<string | null> {
    if (Platform.OS === 'android' && Native) {
      return Native.getInitialLeadData();
    }
    return Promise.resolve(null);
  },

  /** Starts the looping ringtone (call-style). No-op off Android. */
  startRinging(): void {
    if (Platform.OS === 'android' && Native) Native.startRinging();
  },

  /** Stops the looping ringtone. No-op off Android. */
  stopRinging(): void {
    if (Platform.OS === 'android' && Native) Native.stopRinging();
  },

  /**
   * Ensures the app may launch full-screen intents. On Android 14+ this
   * permission is revoked by default for non-dialer apps; if missing, this
   * sends the user to the system settings page to grant it. No-op elsewhere.
   * Call this when the user opts into phonecall-style alerts.
   */
  ensureFullScreenIntentPermission(): Promise<void> {
    if (Platform.OS === 'android' && Native) {
      return Native.canUseFullScreenIntent().then((ok: boolean) => {
        if (!ok) Native.openFullScreenIntentSettings();
      });
    }
    return Promise.resolve();
  },

  /** True if the app may draw over other apps (background activity launch). */
  canDrawOverlays(): Promise<boolean> {
    if (Platform.OS === 'android' && Native) return Native.canDrawOverlays();
    return Promise.resolve(true);
  },

  /**
   * The GENERAL phonecall permission gate. For the full-screen call to appear
   * over the lock screen when the phone is killed/idle, two standard Android
   * permissions must be granted (this is cross-OEM — no per-model code):
   *   1. USE_FULL_SCREEN_INTENT (Android 14+) — lets us post a full-screen alert
   *   2. SYSTEM_ALERT_WINDOW / "Display over other apps" — lets that alert's
   *      activity LAUNCH from the background (the piece aggressive OEMs block).
   * Checks both and, for any that's missing, explains why and opens the
   * relevant settings page (one per tap; re-run when the user returns). No-op
   * off Android. Call when the user opts into phonecall-style alerts.
   */
  async ensurePhonecallPermissions(): Promise<void> {
    if (Platform.OS !== 'android' || !Native) return;

    const overlayOk: boolean = await Native.canDrawOverlays();
    const fsiOk: boolean = await Native.canUseFullScreenIntent();
    if (overlayOk && fsiOk) return;

    // Grant the overlay permission first — it's the one that actually blocks the
    // full-screen call from launching; full-screen-intent only affects Android 14+.
    if (!overlayOk) {
      Alert.alert(
        'Allow full-screen call alerts',
        'To make new leads ring and take over the screen (even when your phone ' +
          'is locked), allow "Display over other apps" for Lead Notifier on the ' +
          'next screen.',
        [
          { text: 'Not now', style: 'cancel' },
          { text: 'Open settings', onPress: () => Native.openOverlaySettings() },
        ]
      );
      return;
    }

    if (!fsiOk) {
      Alert.alert(
        'Allow full-screen alerts',
        'Allow full-screen notifications for Lead Notifier on the next screen so ' +
          'lead calls can appear over the lock screen.',
        [
          { text: 'Not now', style: 'cancel' },
          { text: 'Open settings', onPress: () => Native.openFullScreenIntentSettings() },
        ]
      );
    }
  },
};
