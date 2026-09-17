import assert from "node:assert/strict";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import type { DatabaseSync } from "node:sqlite";
import { createApp } from "../src/app.ts";
import { cookieSecure, sessionCookieOptions } from "../src/auth.ts";
import { openDatabase, upsertCatalog } from "../src/db.ts";
import { mountStaticFrontend } from "../src/frontend.ts";

function memDb(): DatabaseSync {
  const db = openDatabase(":memory:");
  upsertCatalog(db);
  return db;
}

async function withServer(
  app: ReturnType<typeof createApp>,
  fn: (base: string) => Promise<void>,
) {
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const addr = server.address();
  if (!addr || typeof addr === "string") throw new Error("no port");
  try {
    await fn(`http://127.0.0.1:${addr.port}`);
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close((err) => (err ? reject(err) : resolve())),
    );
  }
}

test("GET /api/health responde ok y toca SQLite", async () => {
  await withServer(createApp(memDb()), async (base) => {
    const res = await fetch(`${base}/api/health`);
    assert.equal(res.status, 200);
    const body = (await res.json()) as { ok: boolean; name: string; phase: number };
    assert.equal(body.ok, true);
    assert.equal(body.name, "Noches de Escape");
    assert.equal(body.phase, 1);
  });
});

test("GET /api/ruta-inexistente no devuelve HTML", async () => {
  await withServer(createApp(memDb()), async (base) => {
    const res = await fetch(`${base}/api/no-existe`);
    assert.equal(res.status, 404);
    const body = (await res.json()) as { code?: string };
    assert.equal(body.code, "NOT_FOUND");
  });
});

test("cookie de sesión lleva Secure cuando COOKIE_SECURE=true", async () => {
  const prev = process.env.COOKIE_SECURE;
  process.env.COOKIE_SECURE = "true";
  try {
    assert.equal(cookieSecure(), true);
    assert.equal(sessionCookieOptions().secure, true);
    await withServer(createApp(memDb()), async (base) => {
      const res = await fetch(`${base}/api/auth/admin`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ password: process.env.ADMIN_PASSWORD || "posada-admin" }),
      });
      assert.equal(res.status, 200);
      const cookie = res.headers.get("set-cookie") ?? "";
      assert.match(cookie, /nde_session=/);
      assert.match(cookie, /HttpOnly/i);
      assert.match(cookie, /Secure/i);
      assert.match(cookie, /SameSite=Lax/i);
    });
  } finally {
    if (prev === undefined) delete process.env.COOKIE_SECURE;
    else process.env.COOKIE_SECURE = prev;
  }
});

test("Express sirve client/dist y deja /api en el mismo origen", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "nde-dist-"));
  fs.writeFileSync(
    path.join(dir, "index.html"),
    "<!doctype html><title>Noches</title><div id='root'>spa</div>",
  );
  const app = createApp(memDb());
  assert.equal(mountStaticFrontend(app, dir), true);
  await withServer(app, async (base) => {
    const spa = await fetch(`${base}/hoteles/posada-real`);
    assert.equal(spa.status, 200);
    const html = await spa.text();
    assert.match(html, /spa/);

    const health = await fetch(`${base}/api/health`);
    assert.equal(health.status, 200);
    const body = (await health.json()) as { ok: boolean };
    assert.equal(body.ok, true);
  });
  fs.rmSync(dir, { recursive: true, force: true });
});
