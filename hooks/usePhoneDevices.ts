import { useState, useEffect, useCallback, useRef } from 'react';
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
  const [rosterError, setRosterError] = useState<string | null>(null);
  const [retryTick, setRetryTick] = useState(0);
  const [error, setError] = useState<string | null>(null);
  // Set when the user removes THIS device's own record from Settings. Without
  // it, the roster update from that removal frees a seat and the registration
  // effect below immediately re-registers this phone — the "removal" never
  // sticks. Cleared only by relaunching the app (fresh hook instance).
  const selfRemovedRef = useRef(false);

  const accountKey = email ? sanitizeEmail(email) : null;

  useEffect(() => {
    getOrCreateDeviceId().then(setDeviceId);
  }, []);

  useEffect(() => {
    if (!accountKey) return;
    setRosterError(null);
    const unsub = onValue(
      ref(db, `accounts/${accountKey}/phones`),
      (s) => {
        setPhones((s.val() ?? {}) as Record<string, PhoneRecord>);
        setLoaded(true);
      },
      (e) => {
        DeviceLog.error('roster read failed:', e);
        setRosterError('Could not load your devices. Check your connection and try again.');
      }
    );
    return () => unsub();
  }, [accountKey, retryTick]);

  const retryRoster = useCallback(() => {
    setLoaded(false);
    setRetryTick((t) => t + 1);
  }, []);

  const maxPhones = entitlement?.maxPhones ?? 0;
  const phoneCount = Object.keys(phones).length;
  const thisRegistered = deviceId ? Boolean(phones[deviceId]) : false;
  const seatAvailable = thisRegistered || phoneCount < maxPhones;

  // Register or heartbeat this phone once the roster is known and there's room.
  useEffect(() => {
    if (!accountKey || !deviceId || !loaded || !entitlement?.valid || !fcmToken) return;
    if (selfRemovedRef.current) return;
    const myRef = deviceRef(accountKey, deviceId);
    if (thisRegistered) {
      // Re-assert the device's chosen notificationStyle on every heartbeat so it
      // can never drift from what the user selected in-app. The one-shot write in
      // useNotificationStyle can miss (e.g. toggled before sign-in / before the
      // deviceId was stored), which otherwise leaves the server stuck on the
      // 'headsup' default and the extension keeps sending banners.
      AsyncStorage.getItem('notificationStyle').then((storedStyle) => {
        const notificationStyle = storedStyle === 'phonecall' ? 'phonecall' : 'headsup';
        update(myRef, { fcmToken, notificationStyle, lastSeen: Date.now() }).catch((e) => {
          DeviceLog.error('heartbeat failed:', e);
          setError('Could not update this device. Check your connection.');
        });
      });
    } else if (phoneCount < maxPhones) {
      AsyncStorage.getItem('notificationStyle').then((storedStyle) => {
        const notificationStyle = storedStyle === 'phonecall' ? 'phonecall' : 'headsup';
        const record: PhoneRecord = {
          name: defaultPhoneName(),
          fcmToken,
          notificationStyle,
          lastSeen: Date.now(),
        };
        set(myRef, record).catch((e) => {
          DeviceLog.error('register failed:', e);
          setError('Could not register this device. Check your connection.');
        });
      });
    }
  }, [accountKey, deviceId, loaded, entitlement?.valid, fcmToken, thisRegistered, phoneCount, maxPhones]);

  const renamePhone = useCallback(
    (id: string, name: string) => {
      if (!accountKey) return Promise.resolve();
      setError(null);
      return update(deviceRef(accountKey, id), { name }).catch((e) => {
        DeviceLog.error('rename failed:', e);
        setError('Could not rename device. Try again.');
      });
    },
    [accountKey]
  );

  const removePhone = useCallback(
    (id: string) => {
      if (!accountKey) return Promise.resolve();
      const isSelf = id === deviceId;
      if (isSelf) selfRemovedRef.current = true;
      setError(null);
      return remove(deviceRef(accountKey, id)).catch((e) => {
        if (isSelf) selfRemovedRef.current = false;
        DeviceLog.error('remove failed:', e);
        setError('Could not remove device. Try again.');
      });
    },
    [accountKey, deviceId]
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
    error,
    rosterError,
    retryRoster,
  };
}
