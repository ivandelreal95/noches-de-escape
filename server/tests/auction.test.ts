import assert from "node:assert/strict";
import type { DatabaseSync } from "node:sqlite";
import test from "node:test";
import {
  ANTI_SNIPE_EXTEND_MS,
  ANTI_SNIPE_WINDOW_MS,
  MIN_INCREMENT_MXN,
  PAYMENT_WINDOW_MS,
  placeBid,
  processDueAuctions,
  simulatePayment,
} from "../src/auction.ts";
import { AppError } from "../src/errors.ts";
import { openDatabase, upsertCatalog, withTx } from "../src/db.ts";
import { createApp } from "../src/app.ts";
import { CATEGORIES, HOTELS } from "../src/catalog.ts";

function memDb(): DatabaseSync {
  const db = openDatabase(":memory:");
  upsertCatalog(db);
  return db;
}

function insertGuest(db: DatabaseSync, id: string, email: string) {
  db.prepare(
    "INSERT INTO guests (id, name, email, whatsapp, created_at) VALUES (?, ?, ?, NULL, ?)",
  ).run(id, `Huésped ${id}`, email, Date.now());
}

function insertAuction(
  db: DatabaseSync,
  opts: { id: string; min: number; endsAt: number; status?: string },
) {
  const now = Date.now();
  db.prepare(
    `INSERT INTO listings (
      id, hotel_id, category_id, check_in, check_out, nights, quantity, quantity_available,
      mode, buy_now_price_total, auction_min_total, status, auction_ends_at,
      payment_deadline_at, winner_guest_id, notes, created_at, updated_at
    ) VALUES (?, 'posada-real', 'pr-hab-4', '2026-10-06', '2026-10-08', 2, 1, 1,
      'AUCTION', NULL, ?, ?, ?, NULL, NULL, 'test', ?, ?)`,
  ).run(opts.id, opts.min, opts.status ?? "LIVE", opts.endsAt, now, now);
}

test("rechaza primera puja por debajo del mínimo", () => {
  const db = memDb();
  insertGuest(db, "g1", "a@test.com");
  const endsAt = Date.now() + 10 * 60 * 1000;
  insertAuction(db, { id: "L1", min: 1590, endsAt });

  assert.throws(
    () => withTx(db, () => placeBid(db, { listingId: "L1", guestId: "g1", amountMxn: 1589 })),
    (err: unknown) => err instanceof AppError && err.code === "BELOW_MIN",
  );
});

test("acepta primera puja igual al mínimo", () => {
  const db = memDb();
  insertGuest(db, "g1", "a@test.com");
  const now = 1_000_000;
  insertAuction(db, { id: "L1", min: 1590, endsAt: now + 10 * 60 * 1000 });
  const result = withTx(db, () =>
    placeBid(db, { listingId: "L1", guestId: "g1", amountMxn: 1590, now }),
  );
  assert.equal(result.bid.amount_mxn, 1590);
  assert.equal(result.extended, false);
});

test("rechaza incremento menor a $50", () => {
  const db = memDb();
  insertGuest(db, "g1", "a@test.com");
  insertGuest(db, "g2", "b@test.com");
  const now = 1_000_000;
  insertAuction(db, { id: "L1", min: 1000, endsAt: now + 10 * 60 * 1000 });
  withTx(db, () => placeBid(db, { listingId: "L1", guestId: "g1", amountMxn: 1000, now }));
  assert.throws(
    () =>
      withTx(db, () =>
        placeBid(db, { listingId: "L1", guestId: "g2", amountMxn: 1000 + MIN_INCREMENT_MXN - 1, now: now + 1 }),
      ),
    (err: unknown) => err instanceof AppError && err.code === "INCREMENT_TOO_SMALL",
  );
});

test("acepta incremento de $50", () => {
  const db = memDb();
  insertGuest(db, "g1", "a@test.com");
  insertGuest(db, "g2", "b@test.com");
  const now = 1_000_000;
  insertAuction(db, { id: "L1", min: 1000, endsAt: now + 10 * 60 * 1000 });
  withTx(db, () => placeBid(db, { listingId: "L1", guestId: "g1", amountMxn: 1000, now }));
  const result = withTx(db, () =>
    placeBid(db, {
      listingId: "L1",
      guestId: "g2",
      amountMxn: 1000 + MIN_INCREMENT_MXN,
      now: now + 1,
    }),
  );
  assert.equal(result.bid.amount_mxn, 1050);
});

test("puja en los últimos 2 minutos extiende el cierre +2 minutos", () => {
  const db = memDb();
  insertGuest(db, "g1", "a@test.com");
  const now = 5_000_000;
  const endsAt = now + ANTI_SNIPE_WINDOW_MS - 1_000;
  insertAuction(db, { id: "L1", min: 1000, endsAt });
  const result = withTx(db, () =>
    placeBid(db, { listingId: "L1", guestId: "g1", amountMxn: 1000, now }),
  );
  assert.equal(result.extended, true);
  assert.equal(result.listing.auction_ends_at, endsAt + ANTI_SNIPE_EXTEND_MS);
});

test("puja fuera de la ventana anti-snipe no extiende", () => {
  const db = memDb();
  insertGuest(db, "g1", "a@test.com");
  const now = 5_000_000;
  const endsAt = now + ANTI_SNIPE_WINDOW_MS + 30_000;
  insertAuction(db, { id: "L1", min: 1000, endsAt });
  const result = withTx(db, () =>
    placeBid(db, { listingId: "L1", guestId: "g1", amountMxn: 1000, now }),
  );
  assert.equal(result.extended, false);
  assert.equal(result.listing.auction_ends_at, endsAt);
});

test("al cierre gana la más alta; si no paga, se libera y no se adjudica al 2º", () => {
  const db = memDb();
  insertGuest(db, "g1", "second@test.com");
  insertGuest(db, "g2", "winner@test.com");
  const t0 = 10_000_000;
  insertAuction(db, { id: "L1", min: 1000, endsAt: t0 + 5 * 60 * 1000 });

  withTx(db, () => placeBid(db, { listingId: "L1", guestId: "g1", amountMxn: 1000, now: t0 }));
  withTx(db, () =>
    placeBid(db, { listingId: "L1", guestId: "g2", amountMxn: 1100, now: t0 + 1000 }),
  );

  const closeAt = t0 + 5 * 60 * 1000;
  const closed = withTx(db, () => processDueAuctions(db, closeAt));
  assert.equal(closed[0]?.outcome, "SOLD_PENDING");

  const listing = db.prepare("SELECT * FROM listings WHERE id = 'L1'").get() as {
    status: string;
    winner_guest_id: string;
    payment_deadline_at: number;
    quantity_available: number;
  };
  assert.equal(listing.status, "CLOSED");
  assert.equal(listing.winner_guest_id, "g2");
  assert.equal(listing.payment_deadline_at, closeAt + PAYMENT_WINDOW_MS);

  const afterDeadline = listing.payment_deadline_at;
  const released = withTx(db, () => processDueAuctions(db, afterDeadline));
  assert.equal(released[0]?.outcome, "UNPAID_RELEASED");

  const after = db.prepare("SELECT * FROM listings WHERE id = 'L1'").get() as {
    status: string;
    winner_guest_id: string | null;
    quantity_available: number;
  };
  assert.equal(after.status, "UNPAID_EXPIRED");
  assert.equal(after.winner_guest_id, null);
  assert.equal(after.quantity_available, 1);

  const purchase = db.prepare("SELECT * FROM purchases WHERE listing_id = 'L1'").get() as {
    status: string;
    guest_id: string;
  };
  assert.equal(purchase.status, "UNPAID_EXPIRED");
  assert.equal(purchase.guest_id, "g2");

  assert.throws(
    () => withTx(db, () => simulatePayment(db, { purchaseId: "nope", guestId: "g1" })),
    (err: unknown) => err instanceof AppError && err.code === "NOT_FOUND",
  );
});

test("el catálogo coincide con la especificación v1", () => {
  const prices: Record<string, number> = {
    "pr-hab-2": 1300,
    "pr-hab-4": 1600,
    "pr-hab-5": 1750,
    "pr-hab-6": 2000,
    "pr-hab-7": 2150,
    "pr-bung-4": 1800,
    "pr-bung-6": 2100,
    "pr-bung-8": 2700,
    "ic-bung-4": 2050,
  };
  for (const [id, price] of Object.entries(prices)) {
    assert.equal(CATEGORIES.find((c) => c.id === id)?.tariffBaseMxn, price, id);
  }
  assert.equal(CATEGORIES.filter((c) => c.hotelId === "posada-real").length, 8);
  assert.equal(CATEGORIES.filter((c) => c.hotelId === "isla-coral").length, 1);
  assert.equal(CATEGORIES.filter((c) => c.hotelId === "real-del-sol").length, 0);
  assert.equal(HOTELS.find((h) => h.id === "real-del-sol")?.sellable, false);
});

test("dos sesiones ven la misma puja en el servidor", async () => {
  const db = memDb();
  insertGuest(db, "g1", "uno@test.com");
  const now = Date.now();
  insertAuction(db, { id: "Lshare", min: 1000, endsAt: now + 10 * 60 * 1000 });
  withTx(db, () => placeBid(db, { listingId: "Lshare", guestId: "g1", amountMxn: 1000, now }));

  const app = createApp(db);
  const { default: http } = await import("node:http");
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const addr = server.address();
  if (!addr || typeof addr === "string") throw new Error("no port");
  const port = addr.port;

  const a = await fetch(`http://127.0.0.1:${port}/api/listings/Lshare`);
  const b = await fetch(`http://127.0.0.1:${port}/api/listings/Lshare`);
  const ja = (await a.json()) as { listing: { highBidMxn: number }; bids: unknown[] };
  const jb = (await b.json()) as { listing: { highBidMxn: number }; bids: unknown[] };
  assert.equal(ja.listing.highBidMxn, 1000);
  assert.equal(jb.listing.highBidMxn, 1000);
  assert.equal(ja.bids.length, jb.bids.length);
  server.close();
});

test("Real del Sol no se puede publicar para venta", async () => {
  const db = memDb();
  const app = createApp(db);
  const { default: http } = await import("node:http");

  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const addr = server.address();
  if (!addr || typeof addr === "string") throw new Error("no port");
  const port = addr.port;

  const login = await fetch(`http://127.0.0.1:${port}/api/auth/admin`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ password: process.env.ADMIN_PASSWORD || "posada-admin" }),
  });
  assert.equal(login.status, 200);
  const cookie = login.headers.get("set-cookie") ?? "";

  const res = await fetch(`http://127.0.0.1:${port}/api/admin/listings`, {
    method: "POST",
    headers: { "content-type": "application/json", cookie },
    body: JSON.stringify({
      hotelId: "real-del-sol",
      categoryId: "pr-hab-2",
      checkIn: "2026-10-06",
      checkOut: "2026-10-08",
      mode: "BUY_NOW",
      buyNowPriceTotal: 1000,
      quantity: 1,
    }),
  });
  assert.equal(res.status, 400);
  const body = (await res.json()) as { code?: string };
  assert.equal(body.code, "NOT_SELLABLE");
  server.close();
});
