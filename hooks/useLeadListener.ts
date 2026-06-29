import { useEffect } from 'react';
import { AppState } from 'react-native';
import { ref, onChildAdded, query, orderByChild, startAt } from 'firebase/database';
import { db } from '../firebase';
import { fireLeadNotification } from '../notifications';
import { PhonecallNotification } from '../modules/PhonecallNotification';
import { navigateToIncomingLead } from '../navigation';
import { useNotificationStyle } from './useNotificationStyle';
import { LeadsLog } from '../logger';
import { LeadPayload } from '../types/lead';

export function useLeadListener(uid: string | null): void {
  const [notificationStyle] = useNotificationStyle(uid);

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
        if (AppState.currentState === 'active') {
          // Foreground: navigate directly
          navigateToIncomingLead(lead);
        } else {
          // Backgrounded: navigate so IncomingLeadScreen is ready, then post
          // the fullscreen-intent notification which brings the app over the
          // lock screen showing the already-rendered IncomingLeadScreen.
          navigateToIncomingLead(lead);
          const title = lead.title ?? 'New Lead Purchased';
          const parts = [lead.buyerName, lead.city, lead.state].filter(Boolean);
          const body = parts.length > 0 ? parts.join(' — ') : 'New lead purchased!';
          PhonecallNotification.present(title, body, JSON.stringify(lead));
        }
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
