export interface LeadPayload {
  title: string;
  buyerName?: string | null;
  buyerMobile?: string | null;
  quantity?: string | null;
  city?: string | null;
  state?: string | null;
  timestamp?: number;
}
