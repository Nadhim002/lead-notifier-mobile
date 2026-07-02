import { useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { set } from 'firebase/database';
import { getOrCreateDeviceId, deviceRef } from '../deviceIdentity';
import { DeviceLog } from '../logger';

export function useDeviceRegistration(uid: string | null, fcmToken: string | null): void {
  useEffect(() => {
    if (!uid || !fcmToken) return;

    let cancelled = false;
    Promise.all([
      getOrCreateDeviceId(),
      AsyncStorage.getItem('notificationStyle'),
    ]).then(([deviceId, storedStyle]) => {
      if (cancelled) return;
      const notificationStyle = storedStyle === 'phonecall' ? 'phonecall' : 'headsup';
      set(deviceRef(uid, deviceId), { fcmToken, notificationStyle, lastSeen: Date.now() }).catch((e) =>
        DeviceLog.error('Failed to register device:', e)
      );
    });

    return () => { cancelled = true; };
  }, [uid, fcmToken]);
}
