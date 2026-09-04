import React, { createContext, useContext } from 'react';
import type { useNotificationStyle } from './useNotificationStyle';

// Shares the single useNotificationStyle instance (owned by AppShell) with
// Settings and the in-app lead listener, so a style change made in Settings
// takes effect immediately instead of only after Home remounts.
type NotificationStyleValue = ReturnType<typeof useNotificationStyle>;

const NotificationStyleContext = createContext<NotificationStyleValue | null>(null);

export function NotificationStyleProvider({
  value,
  children,
}: {
  value: NotificationStyleValue;
  children: React.ReactNode;
}) {
  return (
    <NotificationStyleContext.Provider value={value}>{children}</NotificationStyleContext.Provider>
  );
}

export function useNotificationStyleContext(): NotificationStyleValue {
  const ctx = useContext(NotificationStyleContext);
  if (!ctx) throw new Error('useNotificationStyleContext must be used within a NotificationStyleProvider');
  return ctx;
}
