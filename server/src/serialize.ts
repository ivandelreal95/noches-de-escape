import type { DatabaseSync } from "node:sqlite";
import type { BidRow, GuestRow, ListingRow, PurchaseRow } from "./types.ts";

export type PublicHotel = {
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
  categories: PublicCategory[];
};

export type PublicCategory = {
  id: string;
  hotelId: string;
  name: string;
  distribution: string;
  adults: number;
  kitchen: boolean;
  tariffBaseMxn: number;
  roomAmenities: string;
};

export type PublicListing = {
  id: string;
  hotel: PublicHotel;
  category: PublicCategory;
  checkIn: string;
  checkOut: string;
  nights: number;
  quantity: number;
  quantityAvailable: number;
  mode: ListingRow["mode"];
  buyNowPriceTotal: number | null;
  auctionMinTotal: number | null;
  status: ListingRow["status"];
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

function hotelBase(row: Record<string, unknown>): Omit<PublicHotel, "categories"> {
  return {
    id: String(row.id),
    name: String(row.name),
    shortName: String(row.short_name),
    inventoryRef: (row.inventory_ref as number | null) ?? null,
    inventoryNote: String(row.inventory_note),
    kidsPolicy: String(row.kids_policy),
    amenities: JSON.parse(String(row.amenities_json)) as string[],
    description: String(row.description),
    phrase: (row.phrase as string | null) ?? null,
    sellable: Boolean(row.sellable),
    comingSoon: Boolean(row.coming_soon),
    taxNote: String(row.tax_note),
    disclaimer: String(row.disclaimer),
  };
}

export function loadHotels(db: DatabaseSync): PublicHotel[] {
  const hotels = db.prepare("SELECT * FROM hotels").all() as Record<string, unknown>[];
  const cats = db.prepare("SELECT * FROM categories").all() as Record<string, unknown>[];
  return hotels.map((h) => ({
    ...hotelBase(h),
    categories: cats
      .filter((c) => c.hotel_id === h.id)
      .map((c) => ({
        id: String(c.id),
        hotelId: String(c.hotel_id),
        name: String(c.name),
        distribution: String(c.distribution),
        adults: Number(c.adults),
        kitchen: Boolean(c.kitchen),
        tariffBaseMxn: Number(c.tariff_base_mxn),
        roomAmenities: String(c.room_amenities),
      })),
  }));
}

export function loadHotel(db: DatabaseSync, id: string): PublicHotel | undefined {
  return loadHotels(db).find((h) => h.id === id);
}

export function serializeListing(
  db: DatabaseSync,
  listing: ListingRow,
  viewerGuestId?: string | null,
): PublicListing {
  const hotels = loadHotels(db);
  const hotel = hotels.find((h) => h.id === listing.hotel_id);
  const category = hotel?.categories.find((c) => c.id === listing.category_id);
  if (!hotel || !category) {
    throw new Error("Publicación huérfana: hotel o categoría faltante");
  }

  const high = db
    .prepare(
      "SELECT amount_mxn FROM bids WHERE listing_id = ? ORDER BY amount_mxn DESC, created_at ASC LIMIT 1",
    )
    .get(listing.id) as { amount_mxn: number } | undefined;
  const bidCount = (
    db.prepare("SELECT COUNT(*) AS c FROM bids WHERE listing_id = ?").get(listing.id) as { c: number }
  ).c;

  const highBidMxn = high?.amount_mxn ?? null;
  let nextMinBidMxn: number | null = null;
  if (listing.mode === "AUCTION" && listing.auction_min_total != null && listing.status === "LIVE") {
    nextMinBidMxn = highBidMxn == null ? listing.auction_min_total : highBidMxn + 50;
  }

  return {
    id: listing.id,
    hotel: { ...hotel, categories: hotel.categories },
    category,
    checkIn: listing.check_in,
    checkOut: listing.check_out,
    nights: listing.nights,
    quantity: listing.quantity,
    quantityAvailable: listing.quantity_available,
    mode: listing.mode,
    buyNowPriceTotal: listing.buy_now_price_total,
    auctionMinTotal: listing.auction_min_total,
    status: listing.status,
    auctionEndsAt: listing.auction_ends_at,
    paymentDeadlineAt: listing.payment_deadline_at,
    highBidMxn,
    bidCount,
    nextMinBidMxn,
    listRateStayMxn: category.tariffBaseMxn * listing.nights,
    notes: listing.notes,
    createdAt: listing.created_at,
    updatedAt: listing.updated_at,
    winnerIsYou: Boolean(viewerGuestId && listing.winner_guest_id === viewerGuestId),
  };
}

export function serializeBid(
  db: DatabaseSync,
  bid: BidRow,
): {
  id: string;
  amountMxn: number;
  createdAt: number;
  guestName: string;
} {
  const guest = db.prepare("SELECT name FROM guests WHERE id = ?").get(bid.guest_id) as
    | GuestRow
    | undefined;
  return {
    id: bid.id,
    amountMxn: bid.amount_mxn,
    createdAt: bid.created_at,
    guestName: guest?.name ?? "Huésped",
  };
}

export function serializePurchase(
  db: DatabaseSync,
  p: PurchaseRow,
): {
  id: string;
  listingId: string;
  amountMxn: number;
  kind: PurchaseRow["kind"];
  status: PurchaseRow["status"];
  createdAt: number;
  paidAt: number | null;
  simulated: true;
} {
  return {
    id: p.id,
    listingId: p.listing_id,
    amountMxn: p.amount_mxn,
    kind: p.kind,
    status: p.status,
    createdAt: p.created_at,
    paidAt: p.paid_at,
    simulated: true,
  };
}

export const SYSTEM_STATUS = {
  implemented: [
    "Catálogo Posada Real e Isla Coral según especificación",
    "Cupos manuales (fechas + cantidad) creados por admin",
    "Compra inmediata y subastas con estado en el servidor (SQLite)",
    "Motor de pujas: mínimo, incremento $50, extensión +2 min en los últimos 2 min",
    "Si el ganador no paga en 20 min: UNPAID_EXPIRED y se libera el cupo (no se adjudica al 2º)",
    "Panel admin con contraseña de entorno",
  ],
  simulated: [
    "Registro de huésped (correo + nombre; no hay verificación)",
    "Pago (botón «Simular pago» — no hay cargo real)",
    "Sesión por cookie",
  ],
  pendingExternal: [
    "Sincronización Cloudbeds (no implementada; no hay API fingida)",
    "Pagos reales (Stripe / Conekta / Mercado Pago México)",
    "Fotos reales de habitaciones (no se usan fotos de stock)",
    "Cálculo de impuestos",
    "Subastas en WhatsApp nativo",
    "Tarifario de Hotel Real del Sol",
  ],
};
