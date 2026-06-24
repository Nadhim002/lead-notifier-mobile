import { useEffect } from 'react';
import { ref, onChildAdded, query, orderByChild, startAt } from 'firebase/database';
import { db } from '../firebase';
import { fireLeadNotification } from '../notifications';

export function useLeadListener(uid: string | null): void {
  useEffect(() => {
    if (!uid) return;

    const startTime = Date.now();
    const leadsRef = query(
      ref(db, `leads/${uid}/new`),
      orderByChild('timestamp'),
      startAt(startTime)
    );

    const unsubscribe = onChildAdded(leadsRef, (snapshot) => {
      const data = snapshot.val();
      if (!data) return;
      const title = data.title ?? 'New Lead Purchased';
      fireLeadNotification(title);
    });

    return () => unsubscribe();
  }, [uid]);
}
