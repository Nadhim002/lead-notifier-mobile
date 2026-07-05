import React, { createContext, useContext } from 'react';
import type { usePhoneDevices } from './usePhoneDevices';

// Shares the single usePhoneDevices instance (owned by AppShell, which has the
// fcmToken) with deeper screens like Settings, so registration/heartbeat runs
// exactly once.
type DevicesValue = ReturnType<typeof usePhoneDevices>;

const DevicesContext = createContext<DevicesValue | null>(null);

export function DevicesProvider({
  value,
  children,
}: {
  value: DevicesValue;
  children: React.ReactNode;
}) {
  return <DevicesContext.Provider value={value}>{children}</DevicesContext.Provider>;
}

export function useDevicesContext(): DevicesValue {
  const ctx = useContext(DevicesContext);
  if (!ctx) throw new Error('useDevicesContext must be used within a DevicesProvider');
  return ctx;
}
