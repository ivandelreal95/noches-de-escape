import { randomUUID } from "node:crypto";
import express, { type NextFunction, type Request, type Response } from "express";
import cookieParser from "cookie-parser";
import type { DatabaseSync } from "node:sqlite";
import { AppError } from "./errors.ts";
import {
  adminPassword,
  clearSessionCookie,
  getGuest,
  requireAdmin,
  requireGuest,
  safeCompare,
  sessionFromRequest,
  setSessionCookie,
  upsertGuest,
} from "./auth.ts";
import {
  buyNow,
  getListing,
  placeBid,
  processDueAuctions,
  simulatePayment,
  validateStayDates,
} from "./auction.ts";
import { assertSellableHotel, categoryById } from "./catalog.ts";
import { withTx } from "./db.ts";
import {
  loadHotel,
  loadHotels,
  serializeBid,
  serializeListing,
  serializePurchase,
  SYSTEM_STATUS,
} from "./serialize.ts";
import type { BidRow, ListingRow, PurchaseRow } from "./types.ts";

function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<void> | void,
) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

function viewerId(req: Request): string | undefined {
  const s = sessionFromRequest(req);
  return s?.role === "guest" ? s.guestId : undefined;
}

export function createApp(db: DatabaseSync) {
  const app = express();
  app.disable("x-powered-by");
  app.use(express.json({ limit: "64kb" }));
  app.use(cookieParser());

  app.use((_req, _res, next) => {
    try {
      withTx(db, () => processDueAuctions(db));
    } catch (err) {
      console.error("processDueAuctions", err);
    }
    next();
  });

  app.get("/api/health", (_req, res) => {
    res.json({ ok: true, name: "Noches de Escape", phase: 1 });
  });

  app.get("/api/status", (_req, res) => {
    res.json(SYSTEM_STATUS);
  });

  app.get(
    "/api/me",
    asyncHandler((req, res) => {
      const s = sessionFromRequest(req);
      if (!s) {
        res.json({ role: "anonymous" });
        return;
      }
      if (s.role === "admin") {
        res.json({ role: "admin" });
        return;
      }
      const guest = getGuest(db, s.guestId);
      res.json({ role: "guest", guest: guest ?? null });
    }),
  );

  app.post(
    "/api/auth/guest",
    asyncHandler((req, res) => {
      const { name, email, whatsapp } = req.body ?? {};
      const guest = upsertGuest(db, {
        name: String(name ?? ""),
        email: String(email ?? ""),
        whatsapp: whatsapp ? String(whatsapp) : null,
      });
      setSessionCookie(res, { role: "guest", guestId: guest.id, iat: Date.now() });
      res.json({
        role: "guest",
        guest,
        simulated: true,
        note: "Registro simulado: no se verifica el correo ni WhatsApp.",
      });
    }),
  );

  app.post(
    "/api/auth/admin",
    asyncHandler((req, res) => {
      const password = String(req.body?.password ?? "");
      if (!safeCompare(password, adminPassword())) {
        throw new AppError(401, "Contraseña incorrecta", "BAD_PASSWORD");
      }
      setSessionCookie(res, { role: "admin", iat: Date.now() });
      res.json({ role: "admin" });
    }),
  );

  app.post("/api/auth/logout", (_req, res) => {
    clearSessionCookie(res);
    res.json({ ok: true });
  });

  app.get("/api/hotels", (_req, res) => {
    res.json({ hotels: loadHotels(db) });
  });

  app.get(
    "/api/hotels/:id",
    asyncHandler((req, res) => {
      const hotel = loadHotel(db, String(req.params.id));
      if (!hotel) throw new AppError(404, "Hotel no encontrado", "NOT_FOUND");
      const listings = (
        db
          .prepare(
            `SELECT * FROM listings WHERE hotel_id = ? AND status IN ('LIVE','PAUSED','CLOSED')
             ORDER BY created_at DESC`,
          )
          .all(hotel.id) as ListingRow[]
      ).map((row) => serializeListing(db, row, viewerId(req)));
      res.json({ hotel, listings });
    }),
  );

  app.get(
    "/api/listings",
    asyncHandler((req, res) => {
      const rows = db
        .prepare(
          `SELECT * FROM listings
           WHERE status IN ('LIVE','PAUSED','CLOSED','SOLD')
           ORDER BY
             CASE status WHEN 'LIVE' THEN 0 WHEN 'CLOSED' THEN 1 WHEN 'PAUSED' THEN 2 ELSE 3 END,
             created_at DESC`,
        )
        .all() as ListingRow[];
      res.json({
        listings: rows.map((r) => serializeListing(db, r, viewerId(req))),
        note: "Solo cupos publicados. No representa ocupación del hotel ni inventario Cloudbeds.",
      });
    }),
  );

  app.get(
    "/api/listings/:id",
    asyncHandler((req, res) => {
      const listing = getListing(db, String(req.params.id));
      if (!listing) throw new AppError(404, "Publicación no encontrada", "NOT_FOUND");
      const bids = db
        .prepare("SELECT * FROM bids WHERE listing_id = ? ORDER BY created_at DESC")
        .all(listing.id) as BidRow[];
      res.json({
        listing: serializeListing(db, listing, viewerId(req)),
        bids: bids.map((b) => serializeBid(db, b)),
        serverNow: Date.now(),
      });
    }),
  );

  app.post(
    "/api/listings/:id/bids",
    asyncHandler((req, res) => {
      const { guestId } = requireGuest(req);
      const amountMxn = Number(req.body?.amountMxn);
      const result = withTx(db, () => {
        processDueAuctions(db);
        return placeBid(db, { listingId: String(req.params.id), guestId, amountMxn });
      });
      const bids = db
        .prepare("SELECT * FROM bids WHERE listing_id = ? ORDER BY created_at DESC")
        .all(result.listing.id) as BidRow[];
      res.status(201).json({
        ok: true,
        extended: result.extended,
        message: result.extended
          ? "Puja aceptada. Como llegó en los últimos 2 minutos, el cierre se extendió 2 minutos."
          : "Puja aceptada.",
        listing: serializeListing(db, result.listing, guestId),
        bid: serializeBid(db, result.bid),
        bids: bids.map((b) => serializeBid(db, b)),
        serverNow: Date.now(),
      });
    }),
  );

  app.post(
    "/api/listings/:id/buy-now",
    asyncHandler((req, res) => {
      const { guestId } = requireGuest(req);
      const result = withTx(db, () => buyNow(db, { listingId: String(req.params.id), guestId }));
      res.status(201).json({
        ok: true,
        simulated: true,
        message:
          "Cupo reservado. El pago es SIMULADO: usa «Simular pago». No hay cargo real ni pasarela conectada.",
        listing: serializeListing(db, result.listing, guestId),
        purchase: serializePurchase(db, result.purchase),
      });
    }),
  );

  app.post(
    "/api/purchases/:id/simulate-pay",
    asyncHandler((req, res) => {
      const { guestId } = requireGuest(req);
      const purchase = withTx(db, () => {
        processDueAuctions(db);
        return simulatePayment(db, { purchaseId: String(req.params.id), guestId });
      });
      res.json({
        ok: true,
        simulated: true,
        message: "Pago simulado registrado. No se cobró ninguna tarjeta ni se contactó a una pasarela.",
        purchase: serializePurchase(db, purchase),
      });
    }),
  );

  app.get(
    "/api/me/activity",
    asyncHandler((req, res) => {
      const { guestId } = requireGuest(req);
      const bids = db
        .prepare("SELECT * FROM bids WHERE guest_id = ? ORDER BY created_at DESC")
        .all(guestId) as BidRow[];
      const purchases = db
        .prepare("SELECT * FROM purchases WHERE guest_id = ? ORDER BY created_at DESC")
        .all(guestId) as PurchaseRow[];
      res.json({
        bids: bids.map((b) => ({
          ...serializeBid(db, b),
          listingId: b.listing_id,
        })),
        purchases: purchases.map((p) => serializePurchase(db, p)),
      });
    }),
  );

  // --- Admin ---

  app.get(
    "/api/admin/listings",
    asyncHandler((req, res) => {
      requireAdmin(req);
      const rows = db.prepare("SELECT * FROM listings ORDER BY created_at DESC").all() as ListingRow[];
      res.json({ listings: rows.map((r) => serializeListing(db, r)) });
    }),
  );

  app.post(
    "/api/admin/listings",
    asyncHandler((req, res) => {
      requireAdmin(req);
      const body = req.body ?? {};
      const hotelId = String(body.hotelId ?? "");
      const categoryId = String(body.categoryId ?? "");
      const checkIn = String(body.checkIn ?? "");
      const checkOut = String(body.checkOut ?? "");
      const mode = String(body.mode ?? "") as "BUY_NOW" | "AUCTION";
      const status = String(body.status ?? "LIVE") as ListingRow["status"];
      const notes = body.notes ? String(body.notes) : null;

      const hotel = assertSellableHotel(hotelId);
      const category = categoryById(categoryId);
      if (!category || category.hotelId !== hotel.id) {
        throw new AppError(400, "La categoría no pertenece a ese hotel", "CATEGORY");
      }
      if (mode !== "BUY_NOW" && mode !== "AUCTION") {
        throw new AppError(400, "Modo inválido", "MODE");
      }
      if (status !== "DRAFT" && status !== "LIVE") {
        throw new AppError(400, "Al crear, el estado debe ser DRAFT o LIVE", "STATUS");
      }

      const nights = validateStayDates(checkIn, checkOut);
      const now = Date.now();
      let quantity = Number(body.quantity ?? 1);
      if (!Number.isInteger(quantity) || quantity < 1) {
        throw new AppError(400, "La cantidad de cupos debe ser un entero ≥ 1", "QUANTITY");
      }

      let buyNowPriceTotal: number | null = null;
      let auctionMinTotal: number | null = null;
      let auctionEndsAt: number | null = null;

      if (mode === "AUCTION") {
        quantity = 1;
        auctionMinTotal = Number(body.auctionMinTotal);
        if (!Number.isInteger(auctionMinTotal) || auctionMinTotal <= 0) {
          throw new AppError(400, "El mínimo de subasta debe ser un entero MXN > 0", "MIN");
        }
        if (body.auctionEndsAt) {
          auctionEndsAt = Number(body.auctionEndsAt);
        } else if (body.durationMinutes) {
          auctionEndsAt = now + Number(body.durationMinutes) * 60 * 1000;
        } else {
          throw new AppError(400, "Indica duración o fecha de cierre de la subasta", "END");
        }
        if (!Number.isFinite(auctionEndsAt) || auctionEndsAt <= now) {
          throw new AppError(400, "El cierre de la subasta debe ser en el futuro", "END");
        }
      } else {
        buyNowPriceTotal = Number(body.buyNowPriceTotal);
        if (!Number.isInteger(buyNowPriceTotal) || buyNowPriceTotal <= 0) {
          throw new AppError(400, "El precio de compra inmediata debe ser un entero MXN > 0", "PRICE");
        }
      }

      const id = randomUUID();
      db.prepare(
        `INSERT INTO listings (
          id, hotel_id, category_id, check_in, check_out, nights, quantity, quantity_available,
          mode, buy_now_price_total, auction_min_total, status, auction_ends_at,
          payment_deadline_at, winner_guest_id, notes, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL, ?, ?, ?)`,
      ).run(
        id,
        hotel.id,
        category.id,
        checkIn,
        checkOut,
        nights,
        quantity,
        quantity,
        mode,
        buyNowPriceTotal,
        auctionMinTotal,
        status,
        auctionEndsAt,
        notes,
        now,
        now,
      );

      const listing = getListing(db, id)!;
      res.status(201).json({ listing: serializeListing(db, listing) });
    }),
  );

  app.patch(
    "/api/admin/listings/:id",
    asyncHandler((req, res) => {
      requireAdmin(req);
      const listing = getListing(db, String(req.params.id));
      if (!listing) throw new AppError(404, "Publicación no encontrada", "NOT_FOUND");

      const nextStatus = req.body?.status as ListingRow["status"] | undefined;
      if (!nextStatus) throw new AppError(400, "Indica el nuevo estado", "STATUS");

      const allowed: Record<string, ListingRow["status"][]> = {
        DRAFT: ["LIVE", "PAUSED"],
        LIVE: ["PAUSED"],
        PAUSED: ["LIVE"],
      };
      const ok = allowed[listing.status]?.includes(nextStatus);
      if (!ok) {
        throw new AppError(
          409,
          `No se puede pasar de ${listing.status} a ${nextStatus}. Campos críticos no se editan si ya hay pujas o compras.`,
          "STATUS_TRANSITION",
        );
      }

      if (nextStatus === "LIVE" && listing.mode === "AUCTION") {
        const bidCount = (
          db.prepare("SELECT COUNT(*) AS c FROM bids WHERE listing_id = ?").get(listing.id) as {
            c: number;
          }
        ).c;
        if (listing.auction_ends_at != null && listing.auction_ends_at <= Date.now() && bidCount === 0) {
          throw new AppError(
            409,
            "La subasta ya venció. Crea una publicación nueva en lugar de reabrir esta.",
            "ENDED",
          );
        }
      }

      db.prepare("UPDATE listings SET status = ?, updated_at = ? WHERE id = ?").run(
        nextStatus,
        Date.now(),
        listing.id,
      );
      res.json({ listing: serializeListing(db, getListing(db, listing.id)!) });
    }),
  );

  app.get(
    "/api/admin/purchases",
    asyncHandler((req, res) => {
      requireAdmin(req);
      const rows = db.prepare("SELECT * FROM purchases ORDER BY created_at DESC").all() as PurchaseRow[];
      const guests = db.prepare("SELECT id, name, email FROM guests").all() as {
        id: string;
        name: string;
        email: string;
      }[];
      const byId = new Map(guests.map((g) => [g.id, g]));
      res.json({
        purchases: rows.map((p) => ({
          ...serializePurchase(db, p),
          guest: byId.get(p.guest_id) ?? null,
        })),
        note: "Todos los pagos de esta fase son simulados.",
      });
    }),
  );

  app.get(
    "/api/admin/bids",
    asyncHandler((req, res) => {
      requireAdmin(req);
      const rows = db
        .prepare("SELECT * FROM bids ORDER BY created_at DESC LIMIT 200")
        .all() as BidRow[];
      res.json({
        bids: rows.map((b) => ({
          ...serializeBid(db, b),
          listingId: b.listing_id,
          guestId: b.guest_id,
        })),
      });
    }),
  );

  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (err instanceof AppError) {
      res.status(err.status).json({ error: err.message, code: err.code });
      return;
    }
    if (
      err instanceof Error &&
      (err.name === "NotSellableError" || err.message.includes("no admite compra"))
    ) {
      res.status(400).json({ error: err.message, code: "NOT_SELLABLE" });
      return;
    }
    console.error(err);
    res.status(500).json({ error: "Error interno del servidor", code: "INTERNAL" });
  });

  return app;
}
