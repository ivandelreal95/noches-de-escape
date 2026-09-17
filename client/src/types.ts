export type Hotel = {
  id: string;
  name: string;
  shortName: string;
  inventoryRef: number | null;
  inventoryNote: string;
  kidsPolicy: string;
  amenities: string[];
  description: string;
  phrase: string | null;
  sellable: boolean;
  comingSoon: boolean;
  taxNote: string;
  disclaimer: string;
  categories: Category[];
};

export type Category = {
  id: string;
  hotelId: string;
  name: string;
  distribution: string;
  adults: number;
  kitchen: boolean;
  tariffBaseMxn: number;
  roomAmenities: string;
};

export type Listing = {
  id: string;
  hotel: Hotel;
  category: Category;
  checkIn: string;
  checkOut: string;
  nights: number;
  quantity: number;
  quantityAvailable: number;
  mode: "BUY_NOW" | "AUCTION";
  buyNowPriceTotal: number | null;
  auctionMinTotal: number | null;
  status: string;
  auctionEndsAt: number | null;
  paymentDeadlineAt: number | null;
  highBidMxn: number | null;
  bidCount: number;
  nextMinBidMxn: number | null;
  listRateStayMxn: number;
  notes: string | null;
  createdAt: number;
  updatedAt: number;
  winnerIsYou?: boolean;
};

export type Bid = {
  id: string;
  amountMxn: number;
  createdAt: number;
  guestName: string;
  listingId?: string;
};

export type Purchase = {
  id: string;
  listingId: string;
  amountMxn: number;
  kind: string;
  status: string;
  createdAt: number;
  paidAt: number | null;
  simulated: true;
};

export type Me =
  | { role: "anonymous" }
  | { role: "admin" }
  | {
      role: "guest";
      guest: { id: string; name: string; email: string; whatsapp: string | null } | null;
    };

export type StatusPayload = {
  implemented: string[];
  simulated: string[];
  pendingExternal: string[];
};
