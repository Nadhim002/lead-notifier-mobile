import { useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ref, set } from 'firebase/database';
import { db } from '../firebase';

async function getOrCreateDeviceId(): Promise<string> {
  const stored = await AsyncStorage.getItem('deviceId');
  if (stored) return stored;
  // Simple UUID v4-ish without crypto.randomUUID (not available everywhere)
  const id = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
  await AsyncStorage.setItem('deviceId', id);
  return id;
}

export function useDeviceRegistration(uid: string | null, fcmToken: string | null): void {
  useEffect(() => {
    if (!uid || !fcmToken) return;

    let cancelled = false;
    getOrCreateDeviceId().then((deviceId) => {
      if (cancelled) return;
      const deviceRef = ref(db, `devices/${uid}/${deviceId}`);
      set(deviceRef, { fcmToken, lastSeen: Date.now() }).catch((e) =>
        console.error('[DeviceReg] Failed to register device:', e)
      );
    });

    return () => { cancelled = true; };
  }, [uid, fcmToken]);
}
