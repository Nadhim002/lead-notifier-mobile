export interface LeadPayload {
  id?: string;
  title: string;
  buyerName?: string | null;
  buyerMobile?: string | null;
  quantity?: string | null;
  price?: number | null;
  city?: string | null;
  state?: string | null;
  timestamp?: number;
}
