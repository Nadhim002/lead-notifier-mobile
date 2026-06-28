import { useEffect } from 'react';
import { ref, onChildAdded, query, orderByChild, startAt } from 'firebase/database';
import { db } from '../firebase';
import { fireLeadNotification } from '../notifications';
import { navigateToIncomingLead } from '../navigation';
import { useNotificationStyle } from './useNotificationStyle';
import { LeadsLog } from '../logger';
import { LeadPayload } from '../types/lead';

export function useLeadListener(uid: string | null): void {
  const [notificationStyle] = useNotificationStyle();

  useEffect(() => {
    if (!uid) return;

    LeadsLog.log('Lead listener started for uid:', uid);
    const startTime = Date.now();
    const leadsRef = query(
      ref(db, `leads/${uid}/new`),
      orderByChild('timestamp'),
      startAt(startTime)
    );

    const unsubscribe = onChildAdded(leadsRef, (snapshot) => {
      const data = snapshot.val();
      if (!data) return;
      LeadsLog.log('New lead received:', data);

      const lead: LeadPayload = {
        title: data.title ?? 'New Lead Purchased',
        buyerName: data.buyerName ?? null,
        buyerMobile: data.buyerMobile ?? null,
        quantity: data.quantity ?? null,
        city: data.city ?? null,
        state: data.state ?? null,
        timestamp: data.timestamp,
      };

      if (notificationStyle === 'phonecall') {
        navigateToIncomingLead(lead);
      } else {
        fireLeadNotification(lead);
      }
    });

    return () => {
      LeadsLog.log('Lead listener stopped for uid:', uid);
      unsubscribe();
    };
  }, [uid, notificationStyle]);
}
