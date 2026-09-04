import { useCallback, useRef, useState } from 'react';
import { ref, query, orderByChild, limitToLast, endBefore, get } from 'firebase/database';
import { db } from '../firebase';
import { sanitizeEmail } from '../email';
import { LeadPayload } from '../types/lead';
import { LeadsLog } from '../logger';

const PAGE_SIZE = 10;

export interface LeadGroup {
  label: string;
  leads: LeadPayload[];
}

function dateLabel(timestamp: number): string {
  const date = new Date(timestamp);
  const now = new Date();
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const diffDays = Math.round((startOfDay(now) - startOfDay(date)) / 86400000);
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  return date.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

function groupByDate(leads: LeadPayload[]): LeadGroup[] {
  const groups: LeadGroup[] = [];
  for (const lead of leads) {
    const label = dateLabel(lead.timestamp ?? Date.now());
    const last = groups[groups.length - 1];
    if (last && last.label === label) {
      last.leads.push(lead);
    } else {
      groups.push({ label, leads: [lead] });
    }
  }
  return groups;
}

function parseSnapshotValue(value: Record<string, any> | null): LeadPayload[] {
  if (!value) return [];
  return Object.entries(value)
    .map(([id, data]: [string, any]) => ({
      id,
      title: data.title ?? 'New Lead Purchased',
      buyerName: data.buyerName ?? null,
      buyerMobile: data.buyerMobile ?? null,
      quantity: data.quantity ?? null,
      price: data.price ?? null,
      city: data.city ?? null,
      state: data.state ?? null,
      timestamp: data.timestamp,
    }))
    .sort((a, b) => (b.timestamp ?? 0) - (a.timestamp ?? 0));
}

export function useLeadHistory(email: string | null) {
  const [leads, setLeads] = useState<LeadPayload[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadMoreError, setLoadMoreError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const accountKeyRef = useRef<string | null>(null);

  const refresh = useCallback(async () => {
    if (!email) return;
    accountKeyRef.current = sanitizeEmail(email);
    setLoading(true);
    setError(null);
    try {
      const snapshot = await get(
        query(
          ref(db, `accounts/${accountKeyRef.current}/leads/new`),
          orderByChild('timestamp'),
          limitToLast(PAGE_SIZE)
        )
      );
      const newest = parseSnapshotValue(snapshot.val());
      setLeads(newest);
      setHasMore(newest.length === PAGE_SIZE);
    } catch (e) {
      LeadsLog.error('Failed to load lead history:', e);
      setError('Could not load leads.');
    } finally {
      setLoading(false);
    }
  }, [email]);

  const loadMore = useCallback(async () => {
    if (!accountKeyRef.current || leads.length === 0 || loadingMore) return;
    const oldestTimestamp = leads[leads.length - 1].timestamp;
    if (oldestTimestamp == null) return;
    setLoadingMore(true);
    setLoadMoreError(null);
    try {
      const snapshot = await get(
        query(
          ref(db, `accounts/${accountKeyRef.current}/leads/new`),
          orderByChild('timestamp'),
          endBefore(oldestTimestamp),
          limitToLast(PAGE_SIZE)
        )
      );
      const older = parseSnapshotValue(snapshot.val());
      setLeads((prev) => [...prev, ...older]);
      setHasMore(older.length === PAGE_SIZE);
    } catch (e) {
      LeadsLog.error('Failed to load more leads:', e);
      setLoadMoreError('Could not load more leads.');
    } finally {
      setLoadingMore(false);
    }
  }, [leads, loadingMore]);

  return {
    groups: groupByDate(leads),
    loading,
    loadingMore,
    error,
    loadMoreError,
    hasMore,
    refresh,
    loadMore,
  };
}
