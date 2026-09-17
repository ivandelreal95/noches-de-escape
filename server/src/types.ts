export type ListingMode = "BUY_NOW" | "AUCTION";

export type ListingStatus =
  | "DRAFT"
  | "LIVE"
  | "PAUSED"
  | "CLOSED"
  | "SOLD"
  | "EXPIRED"
  | "UNPAID_EXPIRED";

export type PurchaseKind = "BUY_NOW" | "AUCTION_WIN";

export type PurchaseStatus = "SIMULATED_PENDING" | "SIMULATED_PAID" | "UNPAID_EXPIRED";

export type ListingRow = {
  id: string;
  hotel_id: string;
  category_id: string;
  check_in: string;
  check_out: string;
  nights: number;
  quantity: number;
  quantity_available: number;
  mode: ListingMode;
  buy_now_price_total: number | null;
  auction_min_total: number | null;
  status: ListingStatus;
  auction_ends_at: number | null;
  payment_deadline_at: number | null;
  winner_guest_id: string | null;
  notes: string | null;
  created_at: number;
  updated_at: number;
};

export type BidRow = {
  id: string;
  listing_id: string;
  guest_id: string;
  amount_mxn: number;
  created_at: number;
};

export type GuestRow = {
  id: string;
  name: string;
  email: string;
  whatsapp: string | null;
  created_at: number;
};

export type PurchaseRow = {
  id: string;
  listing_id: string;
  guest_id: string;
  amount_mxn: number;
  kind: PurchaseKind;
  status: PurchaseStatus;
  created_at: number;
  paid_at: number | null;
};
