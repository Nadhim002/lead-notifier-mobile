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
};
