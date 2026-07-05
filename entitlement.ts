// Phone-side entitlement model. Mirrors the extension's shared/entitlement +
// types. The phone reads accounts/{sanitizedEmail}/subscription and locks out
// the app when there is no valid, non-expired subscription. Tier is only a
// label — validity is "record exists and not expired".

export type Tier = 'free' | 'paid';

export interface Subscription {
  tier: Tier;
  lastPaidDate?: number | null;
  expiryDate: number;
  maxComputers: number;
  maxPhones: number;
  createdAt: number;
  updatedAt: number;
}

export type EntitlementReason = 'ok' | 'no-account' | 'expired';

export interface Entitlement {
  valid: boolean;
  reason: EntitlementReason;
  tier?: Tier;
  expiryDate?: number;
  maxComputers?: number;
  maxPhones?: number;
}

export interface PhoneRecord {
  name?: string;
  fcmToken?: string;
  notificationStyle?: string;
  lastSeen?: number;
}

export function evaluateSubscription(sub: Subscription | null, now: number): Entitlement {
  if (!sub || typeof sub.expiryDate !== 'number') {
    return { valid: false, reason: 'no-account' };
  }
  const fields = {
    tier: sub.tier,
    expiryDate: sub.expiryDate,
    maxComputers: sub.maxComputers,
    maxPhones: sub.maxPhones,
  };
  if (sub.expiryDate <= now) {
    return { valid: false, reason: 'expired', ...fields };
  }
  return { valid: true, reason: 'ok', ...fields };
}
