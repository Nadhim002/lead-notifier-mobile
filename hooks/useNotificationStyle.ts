import { useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { update } from 'firebase/database';
import { getStoredDeviceId, deviceRef } from '../deviceIdentity';
import { DeviceLog } from '../logger';

export type NotificationStyle = 'headsup' | 'phonecall';

const STORAGE_KEY = 'notificationStyle';
const DEFAULT: NotificationStyle = 'headsup';

export function useNotificationStyle(uid: string | null): [NotificationStyle, (s: NotificationStyle) => void] {
  const [style, setStyleState] = useState<NotificationStyle>(DEFAULT);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((val) => {
      if (val === 'headsup' || val === 'phonecall') setStyleState(val);
    });
  }, []);

  const setStyle = (s: NotificationStyle) => {
    setStyleState(s);
    AsyncStorage.setItem(STORAGE_KEY, s);

    if (uid) {
      getStoredDeviceId().then((deviceId) => {
        if (!deviceId) return;
        update(deviceRef(uid, deviceId), { notificationStyle: s }).catch((e) =>
          DeviceLog.error('Failed to update DB:', e)
        );
      });
    }
  };

  return [style, setStyle];
}
