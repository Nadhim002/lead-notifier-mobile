import { useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ref, onValue, set, update, remove } from 'firebase/database';
import { db } from '../firebase';
import { sanitizeEmail } from '../email';
import { getOrCreateDeviceId, deviceRef, defaultPhoneName } from '../deviceIdentity';
import { Entitlement, PhoneRecord } from '../entitlement';
import { DeviceLog } from '../logger';

export interface PhoneView {
  id: string;
  name: string;
  lastSeen?: number;
  isThisDevice: boolean;
}

// Owns the account's phone roster under accounts/{email}/phones. Registers and
// heartbeats THIS phone (only when entitled and a seat is free — never before
// the roster loads, or we could exceed maxPhones), and exposes the list plus
// rename/remove for the device manager and the seat-limit screen. Mirrors the
// extension's useAccountDevices.
export function usePhoneDevices(
  email: string | null,
  fcmToken: string | null,
  entitlement: Entitlement | null
) {
  const [phones, setPhones] = useState<Record<string, PhoneRecord>>({});
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  const accountKey = email ? sanitizeEmail(email) : null;

  useEffect(() => {
    getOrCreateDeviceId().then(setDeviceId);
  }, []);

  useEffect(() => {
    if (!accountKey) return;
    const unsub = onValue(ref(db, `accounts/${accountKey}/phones`), (s) => {
      setPhones((s.val() ?? {}) as Record<string, PhoneRecord>);
      setLoaded(true);
    });
    return () => unsub();
  }, [accountKey]);

  const maxPhones = entitlement?.maxPhones ?? 0;
  const phoneCount = Object.keys(phones).length;
  const thisRegistered = deviceId ? Boolean(phones[deviceId]) : false;
  const seatAvailable = thisRegistered || phoneCount < maxPhones;

  // Register or heartbeat this phone once the roster is known and there's room.
  useEffect(() => {
    if (!accountKey || !deviceId || !loaded || !entitlement?.valid || !fcmToken) return;
    const myRef = deviceRef(accountKey, deviceId);
    if (thisRegistered) {
      update(myRef, { fcmToken, lastSeen: Date.now() }).catch((e) =>
        DeviceLog.error('heartbeat failed:', e)
      );
    } else if (phoneCount < maxPhones) {
      AsyncStorage.getItem('notificationStyle').then((storedStyle) => {
        const notificationStyle = storedStyle === 'phonecall' ? 'phonecall' : 'headsup';
        const record: PhoneRecord = {
          name: defaultPhoneName(),
          fcmToken,
          notificationStyle,
          lastSeen: Date.now(),
        };
        set(myRef, record).catch((e) => DeviceLog.error('register failed:', e));
      });
    }
  }, [accountKey, deviceId, loaded, entitlement?.valid, fcmToken, thisRegistered, phoneCount, maxPhones]);

  const renamePhone = useCallback(
    (id: string, name: string) => {
      if (!accountKey) return Promise.resolve();
      return update(deviceRef(accountKey, id), { name });
    },
    [accountKey]
  );

  const removePhone = useCallback(
    (id: string) => {
      if (!accountKey) return Promise.resolve();
      return remove(deviceRef(accountKey, id));
    },
    [accountKey]
  );

  const phoneViews: PhoneView[] = Object.entries(phones).map(([id, p]) => ({
    id,
    name: p.name || 'Phone',
    lastSeen: p.lastSeen,
    isThisDevice: id === deviceId,
  }));

  return {
    loaded,
    phones: phoneViews,
    phoneCount,
    maxPhones,
    seatAvailable,
    thisRegistered,
    deviceId,
    renamePhone,
    removePhone,
  };
}
