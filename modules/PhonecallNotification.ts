import { NativeModules, Platform } from 'react-native';

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
};
