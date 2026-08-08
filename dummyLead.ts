// WIRE CONTRACT: '9000000000' is the shared test-lead sentinel mobile number.
// It's written by two producers — scripts/send-test-push.mjs and the
// extension's "Test notification" button (indiamart-extension/src/background/
// service-worker.js, runRealLeadTest) — both of which push a synthetic lead
// through the *real* accounts/{email}/leads/new path so it exercises the full
// pipeline. Update all three together if the sentinel ever changes.

import { LeadPayload } from './types/lead';

export const DUMMY_BUYER_MOBILE = '9000000000';

function normalizeMobile(mobile: string): string {
  const digits = mobile.replace(/\D/g, '');
  return digits.length === 12 && digits.startsWith('91') ? digits.slice(2) : digits;
}

export function isDummyLead(lead: Pick<LeadPayload, 'buyerMobile'>): boolean {
  if (!lead.buyerMobile) return false;
  return normalizeMobile(lead.buyerMobile) === DUMMY_BUYER_MOBILE;
}
