import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { NotifLog } from './logger';
import { LeadPayload } from './types/lead';
import { CHANNEL_BANNER, CHANNEL_CALL } from './channels';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export async function setupNotifications(): Promise<string | null> {
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;
  NotifLog.log('Permissions status:', existingStatus);

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
    NotifLog.log('Permissions after request:', finalStatus);
  }

  if (finalStatus !== 'granted') {
    NotifLog.warn('Notification permission not granted');
    return null;
  }

  if (Platform.OS === 'android') {
    // Standard heads-up notification — vibration matches ~2s default notification sound
    await Notifications.setNotificationChannelAsync(CHANNEL_BANNER, {
      name: 'Lead Alerts',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 2000],
      enableVibrate: true,
      enableLights: true,
      lightColor: '#FF0000',
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
      bypassDnd: true,
      showBadge: true,
    });
    // Phonecall-style — repeating ring pattern (1s on / 1s off × 3) to mimic incoming call
    await Notifications.setNotificationChannelAsync(CHANNEL_CALL, {
      name: 'Lead Alerts — Phone Call',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 1000, 1000, 1000, 1000, 1000, 1000],
      enableVibrate: true,
      enableLights: true,
      lightColor: '#FF0000',
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
      bypassDnd: true,
      showBadge: true,
    });
    NotifLog.log(`Android channels created: ${CHANNEL_BANNER}, ${CHANNEL_CALL}`);
  }

  try {
    const tokenData = await Notifications.getExpoPushTokenAsync({
      projectId: '5635e641-abc0-4da2-a750-40eee3c48a30',
    });
    NotifLog.log('Expo push token obtained:', tokenData.data.slice(0, 30) + '...');
    return tokenData.data;
  } catch (e) {
    NotifLog.error('Failed to get Expo push token:', e);
    return null;
  }
}

export async function fireLeadNotification(payload: LeadPayload): Promise<void> {
  const title = payload.title ?? 'New Lead Purchased';
  const parts = [payload.buyerName, payload.city, payload.state].filter(Boolean);
  const body = parts.length > 0 ? parts.join(' — ') : 'New lead purchased!';

  NotifLog.log('Firing local notification:', title);
  await Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
      sound: true,
      priority: Notifications.AndroidNotificationPriority.MAX,
      data: payload as unknown as Record<string, unknown>,
    },
    trigger: { channelId: CHANNEL_BANNER },
  });
}

// Used when app is backgrounded in phonecall mode — posts a heads-up notification
// so the user sees it even when app is not visible
export async function firePhonecallNotification(payload: LeadPayload): Promise<void> {
  const title = payload.title ?? 'New Lead Purchased';
  const parts = [payload.buyerName, payload.city, payload.state].filter(Boolean);
  const body = parts.length > 0 ? parts.join(' — ') : 'New lead purchased!';

  NotifLog.log('Firing phonecall notification:', title);
  await Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
      sound: true,
      priority: Notifications.AndroidNotificationPriority.MAX,
      data: payload as unknown as Record<string, unknown>,
    },
    trigger: { channelId: CHANNEL_CALL },
  });
}
