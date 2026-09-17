import type { DatabaseSync } from "node:sqlite";
import { nightsBetween } from "./db.ts";

/**
 * Cupos de demostración: inventario MANUAL, no sincronizado con Cloudbeds.
 * Fechas de entre semana en octubre 2026 (relleno, no temporada inventada).
 */
export function seedDemoListings(db: DatabaseSync, now = Date.now()): void {
  const count = db.prepare("SELECT COUNT(*) AS c FROM listings").get() as { c: number };
  if (count.c > 0) return;

  const insert = db.prepare(`
    INSERT INTO listings (
      id, hotel_id, category_id, check_in, check_out, nights, quantity, quantity_available,
      mode, buy_now_price_total, auction_min_total, status, auction_ends_at,
      payment_deadline_at, winner_guest_id, notes, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL, ?, ?, ?)
  `);

  const buyNights = nightsBetween("2026-10-06", "2026-10-08");
  insert.run(
    "demo-buynow-pr-hab4",
    "posada-real",
    "pr-hab-4",
    "2026-10-06",
    "2026-10-08",
    buyNights,
    2,
    2,
    "BUY_NOW",
    2800,
    null,
    "LIVE",
    null,
    "Cupo de demostración (inventario manual). Precio especial de esta publicación, no un descuento permanente. Lista de referencia: $1,600 × 2 noches = $3,200 MXN.",
    now,
    now,
  );

  const auctionANights = nightsBetween("2026-10-13", "2026-10-15");
  insert.run(
    "demo-auction-pr-bung4",
    "posada-real",
    "pr-bung-4",
    "2026-10-13",
    "2026-10-15",
    auctionANights,
    1,
    1,
    "AUCTION",
    null,
    1590,
    "LIVE",
    now + 12 * 60 * 1000,
    "Cupo de demostración. Mínimo $1,590 MXN por 2 noches = ejemplo HYPOTHETICAL del método de piso (docs/floor-price.md). NO usar como piso real. Lista: $1,800 × 2 = $3,600 MXN.",
    now,
    now,
  );

  const auctionBNights = nightsBetween("2026-10-20", "2026-10-21");
  insert.run(
    "demo-auction-ic-bung",
    "isla-coral",
    "ic-bung-4",
    "2026-10-20",
    "2026-10-21",
    auctionBNights,
    1,
    1,
    "AUCTION",
    null,
    1400,
    "LIVE",
    now + 25 * 60 * 1000,
    "Cupo de demostración Isla Coral. Mínimo ilustrativo (HYPOTHETICAL) — no es costo real. Lista: $2,050 MXN/noche. Sin tarifas de temporada, mínimos ni 4ª noche gratis.",
    now,
    now,
  );
}
