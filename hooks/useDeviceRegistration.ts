import { useEffect } from 'react';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Application from 'expo-application';
import { ref, set } from 'firebase/database';
import { db } from '../firebase';

function randomUuid(): string {
  // Simple UUID v4-ish without crypto.randomUUID (not available everywhere)
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

// Derive a platform-stable device identifier so the same physical phone always
// reuses the same Firebase record (devices/{uid}/{deviceId}) instead of minting
// a new one on every reinstall/login — which is what inflated the "N phones" count.
async function getStableDeviceId(): Promise<string | null> {
  try {
    if (Platform.OS === 'android') {
      // Hex id unique per signing-key + user + device; stable across reinstalls.
      return Application.getAndroidId();
    }
    if (Platform.OS === 'ios') {
      // identifierForVendor; persists across reinstalls (null only briefly before
      // first unlock after reboot).
      return await Application.getIosIdForVendorAsync();
    }
  } catch {
    // fall through to the cached/random fallback
  }
  return null;
}

async function getOrCreateDeviceId(): Promise<string> {
  const stable = await getStableDeviceId();
  if (stable) {
    // Cache so it stays consistent even if a native call transiently fails later.
    await AsyncStorage.setItem('deviceId', stable);
    return stable;
  }
  // Fallback (web, or iOS returning null): reuse the cached id, else generate one.
  const stored = await AsyncStorage.getItem('deviceId');
  if (stored) return stored;
  const id = randomUuid();
  await AsyncStorage.setItem('deviceId', id);
  return id;
}

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
      const deviceRef = ref(db, `devices/${uid}/${deviceId}`);
      set(deviceRef, { fcmToken, notificationStyle, lastSeen: Date.now() }).catch((e) =>
        console.error('[DeviceReg] Failed to register device:', e)
      );
    });

    return () => { cancelled = true; };
  }, [uid, fcmToken]);
}
