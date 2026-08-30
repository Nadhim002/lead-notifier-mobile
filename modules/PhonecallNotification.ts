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

  /** Starts the looping ringtone + vibration (call-style). No-op off Android, or if already ringing. */
  startRinging(): void {
    if (Platform.OS === 'android' && Native) Native.startRinging();
  },

  /** Stops the looping ringtone + vibration. No-op off Android. */
  stopRinging(): void {
    if (Platform.OS === 'android' && Native) Native.stopRinging();
  },

  /** True if the native ring/vibrate loop is currently active. */
  isRinging(): Promise<boolean> {
    if (Platform.OS === 'android' && Native) return Native.isRinging();
    return Promise.resolve(false);
  },

  /**
   * True if the app may launch full-screen intents. On Android 14+ this is
   * revoked by default for non-dialer/alarm apps. This is the ONLY permission
   * required to select Phone Call Alert style.
   */
  canUseFullScreenIntent(): Promise<boolean> {
    if (Platform.OS === 'android' && Native) return Native.canUseFullScreenIntent();
    return Promise.resolve(true);
  },

  /**
   * The permission gate for selecting Phone Call Alert style: full-screen
   * intent only. If missing, explains why and offers to open the system
   * settings page ("Not now" / "Open settings"); never requested silently.
   * No-op off Android or if already granted.
   */
  async ensurePhonecallPermissions(): Promise<void> {
    if (Platform.OS !== 'android' || !Native) return;

    const fsiOk: boolean = await Native.canUseFullScreenIntent();
    if (fsiOk) return;

    Alert.alert(
      'Allow full-screen alerts',
      'Allow full-screen notifications for Lead Notifier on the next screen so ' +
        'lead calls can appear over the lock screen, even when your phone is locked.',
      [
        { text: 'Not now', style: 'cancel' },
        { text: 'Open settings', onPress: () => Native.openFullScreenIntentSettings() },
      ]
    );
  },

  /** True if the app may draw over other apps (background activity launch on aggressive OEMs). */
  canDrawOverlays(): Promise<boolean> {
    if (Platform.OS === 'android' && Native) return Native.canDrawOverlays();
    return Promise.resolve(true);
  },

  /**
   * OPTIONAL reliability improvement, not a prerequisite for Phone Call Alert
   * style. On Xiaomi/HyperOS, ColorOS, FuntouchOS and realme UI, granting
   * "Display over other apps" is what lets the full-screen call activity
   * launch while the app is killed/backgrounded — those OEMs restrict
   * background activity starts beyond stock Android. Skippable; the app
   * still rings and shows a heads-up alert without it.
   */
  requestOverlayForReliability(): void {
    if (Platform.OS !== 'android' || !Native) return;
    Alert.alert(
      'Improve reliability on this phone',
      'Some phone brands (Xiaomi, realme, vivo, OPPO) can block the lead call ' +
        'screen from appearing while the app is in the background unless you allow ' +
        '"Display over other apps". This is optional — lead alerts still ring and ' +
        'show without it — but turning it on helps them appear reliably on these brands.',
      [
        { text: 'Not now', style: 'cancel' },
        { text: 'Open settings', onPress: () => Native.openOverlaySettings() },
      ]
    );
  },
};
