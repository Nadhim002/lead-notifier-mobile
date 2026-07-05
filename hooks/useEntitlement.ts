import { useState, useEffect } from 'react';
import { ref, onValue } from 'firebase/database';
import { db } from '../firebase';
import { sanitizeEmail } from '../email';
import { evaluateSubscription, Entitlement, Subscription } from '../entitlement';

// Live entitlement for the signed-in phone user. Subscribes to the subscription
// node so admin changes lock/unlock the app instantly. Returns `null` while the
// first value is still loading.
export function useEntitlement(email: string | null): Entitlement | null {
  const [entitlement, setEntitlement] = useState<Entitlement | null>(null);

  useEffect(() => {
    setEntitlement(null);
    if (!email) {
      setEntitlement({ valid: false, reason: 'no-account' });
      return;
    }
    const subRef = ref(db, `accounts/${sanitizeEmail(email)}/subscription`);
    const unsub = onValue(
      subRef,
      (snap) => {
        const sub = (snap.val() ?? null) as Subscription | null;
        setEntitlement(evaluateSubscription(sub, Date.now()));
      },
      () => setEntitlement((prev) => prev ?? { valid: false, reason: 'no-account' })
    );
    return () => unsub();
  }, [email]);

  return entitlement;
}
