import { mkdirSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { CATEGORIES, HOTELS } from "./catalog.ts";

export const SCHEMA_SQL = `
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS hotels (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  short_name TEXT NOT NULL,
  inventory_ref INTEGER,
  inventory_note TEXT NOT NULL,
  kids_policy TEXT NOT NULL,
  amenities_json TEXT NOT NULL,
  description TEXT NOT NULL,
  phrase TEXT,
  sellable INTEGER NOT NULL,
  coming_soon INTEGER NOT NULL,
  tax_note TEXT NOT NULL,
  disclaimer TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS categories (
  id TEXT PRIMARY KEY,
  hotel_id TEXT NOT NULL REFERENCES hotels(id),
  name TEXT NOT NULL,
  distribution TEXT NOT NULL,
  adults INTEGER NOT NULL,
  kitchen INTEGER NOT NULL,
  tariff_base_mxn INTEGER NOT NULL,
  room_amenities TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS guests (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  whatsapp TEXT,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS listings (
  id TEXT PRIMARY KEY,
  hotel_id TEXT NOT NULL REFERENCES hotels(id),
  category_id TEXT NOT NULL REFERENCES categories(id),
  check_in TEXT NOT NULL,
  check_out TEXT NOT NULL,
  nights INTEGER NOT NULL,
  quantity INTEGER NOT NULL,
  quantity_available INTEGER NOT NULL,
  mode TEXT NOT NULL,
  buy_now_price_total INTEGER,
  auction_min_total INTEGER,
  status TEXT NOT NULL,
  auction_ends_at INTEGER,
  payment_deadline_at INTEGER,
  winner_guest_id TEXT,
  notes TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS bids (
  id TEXT PRIMARY KEY,
  listing_id TEXT NOT NULL REFERENCES listings(id),
  guest_id TEXT NOT NULL REFERENCES guests(id),
  amount_mxn INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS purchases (
  id TEXT PRIMARY KEY,
  listing_id TEXT NOT NULL REFERENCES listings(id),
  guest_id TEXT NOT NULL REFERENCES guests(id),
  amount_mxn INTEGER NOT NULL,
  kind TEXT NOT NULL,
  status TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  paid_at INTEGER
);

CREATE INDEX IF NOT EXISTS idx_bids_listing ON bids(listing_id, amount_mxn DESC, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_listings_status ON listings(status, mode);
CREATE INDEX IF NOT EXISTS idx_purchases_listing ON purchases(listing_id);
`;

export function openDatabase(filePath: string): DatabaseSync {
  const dir = path.dirname(filePath);
  if (filePath !== ":memory:") {
    mkdirSync(dir, { recursive: true });
  }
  const db = new DatabaseSync(filePath);
  db.exec("PRAGMA journal_mode = WAL;");
  db.exec("PRAGMA foreign_keys = ON;");
  db.exec("PRAGMA busy_timeout = 5000;");
  db.exec(SCHEMA_SQL);
  return db;
}

export function withTx<T>(db: DatabaseSync, fn: () => T): T {
  db.exec("BEGIN IMMEDIATE");
  try {
    const result = fn();
    db.exec("COMMIT");
    return result;
  } catch (err) {
    try {
      db.exec("ROLLBACK");
    } catch {
      // ignore rollback errors
    }
    throw err;
  }
}

export function upsertCatalog(db: DatabaseSync): void {
  const hotelStmt = db.prepare(`
    INSERT INTO hotels (
      id, name, short_name, inventory_ref, inventory_note, kids_policy,
      amenities_json, description, phrase, sellable, coming_soon, tax_note, disclaimer
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      name = excluded.name,
      short_name = excluded.short_name,
      inventory_ref = excluded.inventory_ref,
      inventory_note = excluded.inventory_note,
      kids_policy = excluded.kids_policy,
      amenities_json = excluded.amenities_json,
      description = excluded.description,
      phrase = excluded.phrase,
      sellable = excluded.sellable,
      coming_soon = excluded.coming_soon,
      tax_note = excluded.tax_note,
      disclaimer = excluded.disclaimer
  `);

  for (const h of HOTELS) {
    hotelStmt.run(
      h.id,
      h.name,
      h.shortName,
      h.inventoryRef,
      h.inventoryNote,
      h.kidsPolicy,
      JSON.stringify(h.amenities),
      h.description,
      h.phrase,
      h.sellable ? 1 : 0,
      h.comingSoon ? 1 : 0,
      h.taxNote,
      h.disclaimer,
    );
  }

  const catStmt = db.prepare(`
    INSERT INTO categories (
      id, hotel_id, name, distribution, adults, kitchen, tariff_base_mxn, room_amenities
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      hotel_id = excluded.hotel_id,
      name = excluded.name,
      distribution = excluded.distribution,
      adults = excluded.adults,
      kitchen = excluded.kitchen,
      tariff_base_mxn = excluded.tariff_base_mxn,
      room_amenities = excluded.room_amenities
  `);

  for (const c of CATEGORIES) {
    catStmt.run(
      c.id,
      c.hotelId,
      c.name,
      c.distribution,
      c.adults,
      c.kitchen ? 1 : 0,
      c.tariffBaseMxn,
      c.roomAmenities,
    );
  }
}

export function nightsBetween(checkIn: string, checkOut: string): number {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(checkIn) || !/^\d{4}-\d{2}-\d{2}$/.test(checkOut)) {
    throw new Error("Las fechas deben tener formato YYYY-MM-DD");
  }
  const [y1, m1, d1] = checkIn.split("-").map(Number);
  const [y2, m2, d2] = checkOut.split("-").map(Number);
  const t1 = Date.UTC(y1, m1 - 1, d1);
  const t2 = Date.UTC(y2, m2 - 1, d2);
  const n = Math.round((t2 - t1) / 86_400_000);
  return n;
}
