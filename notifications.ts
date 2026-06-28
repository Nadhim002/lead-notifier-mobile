import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { NotifLog } from './logger';
import { LeadPayload } from './types/lead';

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
    await Notifications.setNotificationChannelAsync('lead-alerts-v2', {
      name: 'Lead Alerts',
      importance: Notifications.AndroidImportance.MAX,
      sound: 'default',
      vibrationPattern: [0, 600, 300, 600, 300, 600, 300, 600, 300, 600, 300, 600, 300, 600, 300, 600],
      enableVibrate: true,
      enableLights: true,
      lightColor: '#FF0000',
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
      bypassDnd: true,
      showBadge: true,
    });
    await Notifications.setNotificationChannelAsync('lead-alerts-phonecall', {
      name: 'Lead Alerts — Phone Call',
      importance: Notifications.AndroidImportance.MAX,
      sound: 'default',
      vibrationPattern: [0, 800, 400, 800, 400, 800, 400, 800, 400, 800, 400, 800],
      enableVibrate: true,
      enableLights: true,
      lightColor: '#FF0000',
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
      bypassDnd: true,
      showBadge: true,
    });
    NotifLog.log('Android channels created: lead-alerts-v2, lead-alerts-phonecall');
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
    trigger: null,
  });
}
