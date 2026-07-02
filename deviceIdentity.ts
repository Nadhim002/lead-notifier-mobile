import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Application from 'expo-application';
import { ref, type DatabaseReference } from 'firebase/database';
import { db } from './firebase';

// Single source of truth for a phone's device identity and its Firebase record
// location. Both useDeviceRegistration (write) and useNotificationStyle (update)
// consume this, so the `devices/{uid}/{deviceId}` path and the id-minting rules
// live in exactly one place.

const DEVICE_ID_KEY = 'deviceId';

function randomUuid(): string {
  // Simple UUID v4-ish without crypto.randomUUID (not available everywhere)
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

// Derive a platform-stable device identifier so the same physical phone always
// reuses the same Firebase record instead of minting a new one on every
// reinstall/login — which is what inflated the "N phones" count.
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

// Resolve the stable device id, caching it. Creates a fallback id when the
// platform cannot supply one (web, or iOS returning null).
export async function getOrCreateDeviceId(): Promise<string> {
  const stable = await getStableDeviceId();
  if (stable) {
    // Cache so it stays consistent even if a native call transiently fails later.
    await AsyncStorage.setItem(DEVICE_ID_KEY, stable);
    return stable;
  }
  const stored = await AsyncStorage.getItem(DEVICE_ID_KEY);
  if (stored) return stored;
  const id = randomUuid();
  await AsyncStorage.setItem(DEVICE_ID_KEY, id);
  return id;
}

// The already-cached device id, or null if this device has never registered.
// Used by callers that must not create a record as a side effect.
export function getStoredDeviceId(): Promise<string | null> {
  return AsyncStorage.getItem(DEVICE_ID_KEY);
}

// The Firebase location for this device's record.
export function deviceRef(uid: string, deviceId: string): DatabaseReference {
  return ref(db, `devices/${uid}/${deviceId}`);
}
