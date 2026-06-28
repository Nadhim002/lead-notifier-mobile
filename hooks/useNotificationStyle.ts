import { useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type NotificationStyle = 'fullscreen' | 'headsup';

const STORAGE_KEY = 'notificationStyle';
const DEFAULT: NotificationStyle = 'fullscreen';

export function useNotificationStyle(): [NotificationStyle, (s: NotificationStyle) => void] {
  const [style, setStyleState] = useState<NotificationStyle>(DEFAULT);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((val) => {
      if (val === 'fullscreen' || val === 'headsup') setStyleState(val);
    });
  }, []);

  const setStyle = (s: NotificationStyle) => {
    setStyleState(s);
    AsyncStorage.setItem(STORAGE_KEY, s);
  };

  return [style, setStyle];
}
