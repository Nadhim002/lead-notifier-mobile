import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export async function setupNotifications(): Promise<void> {
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    console.warn('Notification permission not granted');
    return;
  }

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('lead-alerts', {
      name: 'Lead Alerts',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
    });
  }
}

export async function fireLeadNotification(title: string): Promise<void> {
  await Notifications.scheduleNotificationAsync({
    content: {
      title,
      body: '',
    },
    trigger: null,
  });
}
