import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import type { Request, Response } from "express";
import type { DatabaseSync } from "node:sqlite";
import { AppError } from "./errors.ts";

export type SessionPayload =
  | { role: "admin"; iat: number }
  | { role: "guest"; guestId: string; iat: number };

const COOKIE = "nde_session";

export function isProduction(): boolean {
  return process.env.NODE_ENV === "production";
}

/** Cookie Secure: HTTPS in production; override with COOKIE_SECURE=true|false. */
export function cookieSecure(): boolean {
  if (process.env.COOKIE_SECURE === "true") return true;
  if (process.env.COOKIE_SECURE === "false") return false;
  return isProduction();
}

export function sessionCookieOptions(): {
  httpOnly: true;
  sameSite: "lax";
  secure: boolean;
  path: "/";
  maxAge: number;
} {
  return {
    httpOnly: true,
    sameSite: "lax",
    secure: cookieSecure(),
    path: "/",
    maxAge: 7 * 24 * 60 * 60 * 1000,
  };
}

export function sessionSecret(): string {
  const secret = process.env.SESSION_SECRET?.trim();
  if (secret) return secret;
  if (isProduction()) {
    throw new Error(
      "SESSION_SECRET es obligatorio en producción. Defínelo en el panel del host (Render/Railway).",
    );
  }
  return "dev-session-secret-noches-de-escape";
}

export function adminPassword(): string {
  const password = process.env.ADMIN_PASSWORD;
  if (password) return password;
  if (isProduction()) {
    throw new Error(
      "ADMIN_PASSWORD es obligatorio en producción. Usa un secreto fuerte; no uses la contraseña de desarrollo.",
    );
  }
  return "posada-admin";
}

export function signSession(payload: SessionPayload): string {
  const data = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  const sig = createHmac("sha256", sessionSecret()).update(data).digest("base64url");
  return `${data}.${sig}`;
}

export function readSession(token: string | undefined): SessionPayload | null {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [data, sig] = parts;
  const expected = createHmac("sha256", sessionSecret()).update(data).digest("base64url");
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    return JSON.parse(Buffer.from(data, "base64url").toString("utf8")) as SessionPayload;
  } catch {
    return null;
  }
}

export function setSessionCookie(res: Response, payload: SessionPayload): void {
  res.cookie(COOKIE, signSession(payload), sessionCookieOptions());
}

export function clearSessionCookie(res: Response): void {
  const { maxAge: _maxAge, ...clearOpts } = sessionCookieOptions();
  res.clearCookie(COOKIE, clearOpts);
}

export function sessionFromRequest(req: Request): SessionPayload | null {
  return readSession(req.cookies?.[COOKIE]);
}

export function requireAdmin(req: Request): void {
  const s = sessionFromRequest(req);
  if (!s || s.role !== "admin") {
    throw new AppError(401, "Se requiere sesión de administrador", "ADMIN_REQUIRED");
  }
}

export function requireGuest(req: Request): { guestId: string } {
  const s = sessionFromRequest(req);
  if (!s || s.role !== "guest") {
    throw new AppError(401, "Regístrate o inicia sesión como huésped para continuar", "GUEST_REQUIRED");
  }
  return { guestId: s.guestId };
}

export function safeCompare(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length !== bb.length) {
    timingSafeEqual(ba, ba);
    return false;
  }
  return timingSafeEqual(ba, bb);
}

export function upsertGuest(
  db: DatabaseSync,
  input: { name: string; email: string; whatsapp?: string | null },
): { id: string; name: string; email: string; whatsapp: string | null } {
  const name = input.name.trim();
  const email = input.email.trim().toLowerCase();
  const whatsapp = input.whatsapp?.trim() || null;
  if (name.length < 2) throw new AppError(400, "Escribe tu nombre", "NAME");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new AppError(400, "Escribe un correo válido", "EMAIL");
  }

  const existing = db.prepare("SELECT * FROM guests WHERE email = ?").get(email) as
    | { id: string; name: string; email: string; whatsapp: string | null }
    | undefined;

  if (existing) {
    db.prepare("UPDATE guests SET name = ?, whatsapp = ? WHERE id = ?").run(name, whatsapp, existing.id);
    return { id: existing.id, name, email, whatsapp };
  }

  const id = randomUUID();
  db.prepare(
    "INSERT INTO guests (id, name, email, whatsapp, created_at) VALUES (?, ?, ?, ?, ?)",
  ).run(id, name, email, whatsapp, Date.now());
  return { id, name, email, whatsapp };
}

export function getGuest(db: DatabaseSync, id: string) {
  return db.prepare("SELECT id, name, email, whatsapp, created_at FROM guests WHERE id = ?").get(id) as
    | { id: string; name: string; email: string; whatsapp: string | null; created_at: number }
    | undefined;
}
