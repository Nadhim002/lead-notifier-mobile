const tag = (label: string) => ({
  log: (...args: unknown[]) => console.log(`[${label}]`, ...args),
  warn: (...args: unknown[]) => console.warn(`[${label}]`, ...args),
  error: (...args: unknown[]) => console.error(`[${label}]`, ...args),
});

export const AppLog = tag('APP');
export const AuthLog = tag('AUTH');
export const NotifLog = tag('NOTIF');
export const LeadsLog = tag('LEADS');
export const HomeLog = tag('HOME');
export const DeviceLog = tag('DEVICE');
