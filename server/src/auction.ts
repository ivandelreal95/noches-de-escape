import { randomUUID } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";
import { AppError } from "./errors.ts";
import { nightsBetween } from "./db.ts";
import type { BidRow, GuestRow, ListingRow, PurchaseRow } from "./types.ts";

export const MIN_INCREMENT_MXN = 50;
export const ANTI_SNIPE_WINDOW_MS = 2 * 60 * 1000;
export const ANTI_SNIPE_EXTEND_MS = 2 * 60 * 1000;
export const PAYMENT_WINDOW_MS = 20 * 60 * 1000;

type SqlGet = {
  get: (...params: unknown[]) => unknown;
  all: (...params: unknown[]) => unknown[];
  run: (...params: unknown[]) => unknown;
};

function one<T>(db: DatabaseSync, sql: string, ...params: unknown[]): T | undefined {
  return (db.prepare(sql) as SqlGet).get(...params) as T | undefined;
}

function many<T>(db: DatabaseSync, sql: string, ...params: unknown[]): T[] {
  return (db.prepare(sql) as SqlGet).all(...params) as T[];
}

export function getListing(db: DatabaseSync, id: string): ListingRow | undefined {
  return one<ListingRow>(db, "SELECT * FROM listings WHERE id = ?", id);
}

export function highestBid(db: DatabaseSync, listingId: string): BidRow | undefined {
  return one<BidRow>(
    db,
    "SELECT * FROM bids WHERE listing_id = ? ORDER BY amount_mxn DESC, created_at ASC LIMIT 1",
    listingId,
  );
}

export function nextMinBid(listing: ListingRow, currentHigh: number | null): number {
  if (listing.mode !== "AUCTION" || listing.auction_min_total == null) {
    throw new AppError(400, "Esta publicación no es una subasta");
  }
  if (currentHigh == null) return listing.auction_min_total;
  return currentHigh + MIN_INCREMENT_MXN;
}

export type PlaceBidResult = {
  bid: BidRow;
  listing: ListingRow;
  extended: boolean;
  previousHigh: number | null;
};

export function placeBid(
  db: DatabaseSync,
  input: { listingId: string; guestId: string; amountMxn: number; now?: number },
): PlaceBidResult {
  const now = input.now ?? Date.now();
  const amount = input.amountMxn;

  if (!Number.isInteger(amount) || amount <= 0) {
    throw new AppError(400, "La puja debe ser un monto entero en MXN mayor a cero", "INVALID_AMOUNT");
  }

  const listing = getListing(db, input.listingId);
  if (!listing) throw new AppError(404, "Publicación no encontrada", "NOT_FOUND");
  if (listing.mode !== "AUCTION") {
    throw new AppError(400, "Esta publicación no acepta pujas", "NOT_AUCTION");
  }
  if (listing.status === "PAUSED") {
    throw new AppError(409, "La subasta está pausada", "PAUSED");
  }
  if (listing.status !== "LIVE") {
    throw new AppError(409, "La subasta no está abierta a pujas", "NOT_LIVE");
  }
  if (listing.auction_ends_at == null) {
    throw new AppError(500, "La subasta no tiene hora de cierre", "NO_END");
  }
  if (now >= listing.auction_ends_at) {
    throw new AppError(409, "La subasta ya cerró", "AUCTION_ENDED");
  }

  const guest = one<GuestRow>(db, "SELECT * FROM guests WHERE id = ?", input.guestId);
  if (!guest) throw new AppError(401, "Sesión de huésped no válida", "NO_GUEST");

  const current = highestBid(db, listing.id);
  const minRequired = nextMinBid(listing, current?.amount_mxn ?? null);

  if (amount < minRequired) {
    const reason = current
      ? `El incremento mínimo es $${MIN_INCREMENT_MXN} MXN. La siguiente puja válida es de al menos $${minRequired.toLocaleString("es-MX")} MXN.`
      : `La primera puja debe ser al menos el mínimo de $${minRequired.toLocaleString("es-MX")} MXN.`;
    throw new AppError(400, reason, current ? "INCREMENT_TOO_SMALL" : "BELOW_MIN");
  }

  const bid: BidRow = {
    id: randomUUID(),
    listing_id: listing.id,
    guest_id: input.guestId,
    amount_mxn: amount,
    created_at: now,
  };

  db.prepare(
    "INSERT INTO bids (id, listing_id, guest_id, amount_mxn, created_at) VALUES (?, ?, ?, ?, ?)",
  ).run(bid.id, bid.listing_id, bid.guest_id, bid.amount_mxn, bid.created_at);

  let extended = false;
  let newEndsAt = listing.auction_ends_at;
  const remaining = listing.auction_ends_at - now;
  if (remaining <= ANTI_SNIPE_WINDOW_MS) {
    newEndsAt = listing.auction_ends_at + ANTI_SNIPE_EXTEND_MS;
    extended = true;
    db.prepare("UPDATE listings SET auction_ends_at = ?, updated_at = ? WHERE id = ?").run(
      newEndsAt,
      now,
      listing.id,
    );
  } else {
    db.prepare("UPDATE listings SET updated_at = ? WHERE id = ?").run(now, listing.id);
  }

  const updated = getListing(db, listing.id)!;
  return {
    bid,
    listing: updated,
    extended,
    previousHigh: current?.amount_mxn ?? null,
  };
}

export type CloseResult = {
  listingId: string;
  outcome: "SOLD_PENDING" | "EXPIRED_NO_BIDS" | "UNPAID_RELEASED";
};

/**
 * Cierra subastas vencidas y libera cupos no pagados.
 * No adjudica al segundo lugar si el ganador no paga.
 */
export function processDueAuctions(db: DatabaseSync, now = Date.now()): CloseResult[] {
  const results: CloseResult[] = [];

  const liveEnded = many<ListingRow>(
    db,
    `SELECT * FROM listings
     WHERE mode = 'AUCTION' AND status = 'LIVE' AND auction_ends_at IS NOT NULL AND auction_ends_at <= ?`,
    now,
  );

  for (const listing of liveEnded) {
    const top = highestBid(db, listing.id);
    if (!top) {
      db.prepare(
        "UPDATE listings SET status = 'EXPIRED', updated_at = ? WHERE id = ?",
      ).run(now, listing.id);
      results.push({ listingId: listing.id, outcome: "EXPIRED_NO_BIDS" });
      continue;
    }

    const deadline = now + PAYMENT_WINDOW_MS;
    const purchaseId = randomUUID();
    db.prepare(
      `UPDATE listings
       SET status = 'CLOSED', winner_guest_id = ?, payment_deadline_at = ?, updated_at = ?
       WHERE id = ?`,
    ).run(top.guest_id, deadline, now, listing.id);

    db.prepare(
      `INSERT INTO purchases (id, listing_id, guest_id, amount_mxn, kind, status, created_at, paid_at)
       VALUES (?, ?, ?, ?, 'AUCTION_WIN', 'SIMULATED_PENDING', ?, NULL)`,
    ).run(purchaseId, listing.id, top.guest_id, top.amount_mxn, now);

    results.push({ listingId: listing.id, outcome: "SOLD_PENDING" });
  }

  const unpaid = many<ListingRow>(
    db,
    `SELECT * FROM listings
     WHERE mode = 'AUCTION' AND status = 'CLOSED'
       AND payment_deadline_at IS NOT NULL AND payment_deadline_at <= ?`,
    now,
  );

  for (const listing of unpaid) {
    const pending = one<PurchaseRow>(
      db,
      `SELECT * FROM purchases
       WHERE listing_id = ? AND kind = 'AUCTION_WIN' AND status = 'SIMULATED_PENDING'
       ORDER BY created_at DESC LIMIT 1`,
      listing.id,
    );
    if (!pending) continue;

    db.prepare("UPDATE purchases SET status = 'UNPAID_EXPIRED' WHERE id = ?").run(pending.id);
    db.prepare(
      `UPDATE listings
       SET status = 'UNPAID_EXPIRED',
           quantity_available = quantity,
           winner_guest_id = NULL,
           payment_deadline_at = NULL,
           updated_at = ?
       WHERE id = ?`,
    ).run(now, listing.id);
    results.push({ listingId: listing.id, outcome: "UNPAID_RELEASED" });
  }

  return results;
}

export function buyNow(
  db: DatabaseSync,
  input: { listingId: string; guestId: string; now?: number },
): { purchase: PurchaseRow; listing: ListingRow } {
  const now = input.now ?? Date.now();
  const listing = getListing(db, input.listingId);
  if (!listing) throw new AppError(404, "Publicación no encontrada", "NOT_FOUND");
  if (listing.mode !== "BUY_NOW") {
    throw new AppError(400, "Esta publicación no es de compra inmediata", "NOT_BUY_NOW");
  }
  if (listing.status === "PAUSED") {
    throw new AppError(409, "La publicación está pausada", "PAUSED");
  }
  if (listing.status !== "LIVE") {
    throw new AppError(409, "La publicación no está disponible", "NOT_LIVE");
  }
  if (listing.quantity_available < 1) {
    throw new AppError(409, "Ya no hay cupos en esta publicación", "NO_SLOTS");
  }
  if (listing.buy_now_price_total == null) {
    throw new AppError(500, "Falta el precio de compra inmediata", "NO_PRICE");
  }

  const guest = one<GuestRow>(db, "SELECT * FROM guests WHERE id = ?", input.guestId);
  if (!guest) throw new AppError(401, "Sesión de huésped no válida", "NO_GUEST");

  const newQty = listing.quantity_available - 1;
  const newStatus = newQty === 0 ? "SOLD" : "LIVE";

  db.prepare(
    "UPDATE listings SET quantity_available = ?, status = ?, updated_at = ? WHERE id = ?",
  ).run(newQty, newStatus, now, listing.id);

  const purchase: PurchaseRow = {
    id: randomUUID(),
    listing_id: listing.id,
    guest_id: input.guestId,
    amount_mxn: listing.buy_now_price_total,
    kind: "BUY_NOW",
    status: "SIMULATED_PENDING",
    created_at: now,
    paid_at: null,
  };

  db.prepare(
    `INSERT INTO purchases (id, listing_id, guest_id, amount_mxn, kind, status, created_at, paid_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, NULL)`,
  ).run(
    purchase.id,
    purchase.listing_id,
    purchase.guest_id,
    purchase.amount_mxn,
    purchase.kind,
    purchase.status,
    purchase.created_at,
  );

  return { purchase, listing: getListing(db, listing.id)! };
}

export function simulatePayment(
  db: DatabaseSync,
  input: { purchaseId: string; guestId: string; now?: number },
): PurchaseRow {
  const now = input.now ?? Date.now();
  const purchase = one<PurchaseRow>(db, "SELECT * FROM purchases WHERE id = ?", input.purchaseId);
  if (!purchase) throw new AppError(404, "Compra no encontrada", "NOT_FOUND");
  if (purchase.guest_id !== input.guestId) {
    throw new AppError(403, "Esta compra no te pertenece", "FORBIDDEN");
  }
  if (purchase.status === "SIMULATED_PAID") {
    return purchase;
  }
  if (purchase.status !== "SIMULATED_PENDING") {
    throw new AppError(409, "Esta compra ya no se puede pagar", "NOT_PAYABLE");
  }

  const listing = getListing(db, purchase.listing_id);
  if (!listing) throw new AppError(404, "Publicación no encontrada", "NOT_FOUND");

  if (purchase.kind === "AUCTION_WIN") {
    if (listing.status !== "CLOSED") {
      throw new AppError(409, "La subasta ya no está pendiente de pago", "NOT_CLOSED");
    }
    if (listing.winner_guest_id !== input.guestId) {
      throw new AppError(403, "No eres el ganador de esta subasta", "NOT_WINNER");
    }
    if (listing.payment_deadline_at != null && now > listing.payment_deadline_at) {
      throw new AppError(409, "Se venció el tiempo de pago simulado (20 minutos)", "PAYMENT_WINDOW");
    }
    db.prepare(
      "UPDATE listings SET status = 'SOLD', updated_at = ? WHERE id = ?",
    ).run(now, listing.id);
  }

  db.prepare("UPDATE purchases SET status = 'SIMULATED_PAID', paid_at = ? WHERE id = ?").run(
    now,
    purchase.id,
  );

  return one<PurchaseRow>(db, "SELECT * FROM purchases WHERE id = ?", purchase.id)!;
}

export function validateStayDates(checkIn: string, checkOut: string): number {
  const nights = nightsBetween(checkIn, checkOut);
  if (nights < 1) {
    throw new AppError(400, "La estancia debe ser de al menos 1 noche", "INVALID_DATES");
  }
  return nights;
}
