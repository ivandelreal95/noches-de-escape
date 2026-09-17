import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import express from "express";
import { createApp } from "./app.ts";
import { openDatabase, upsertCatalog } from "./db.ts";
import { seedDemoListings } from "./seed.ts";
import { processDueAuctions } from "./auction.ts";
import { withTx } from "./db.ts";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
dotenv.config({ path: path.join(root, ".env") });

const dbPath = process.env.DATABASE_PATH || path.join(root, "data/noches.db");
const db = openDatabase(path.isAbsolute(dbPath) ? dbPath : path.join(root, dbPath));
upsertCatalog(db);
seedDemoListings(db);

const app = createApp(db);

const clientDist = path.join(root, "client/dist");
if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.use((req, res, next) => {
    if (req.path.startsWith("/api") || req.method !== "GET") return next();
    res.sendFile(path.join(clientDist, "index.html"));
  });
}

const port = Number(process.env.PORT || 3001);

if (!process.env.ADMIN_PASSWORD) {
  console.warn(
    "[aviso] ADMIN_PASSWORD no está definido. Se usa la contraseña de desarrollo «posada-admin».",
  );
}

setInterval(() => {
  try {
    withTx(db, () => processDueAuctions(db));
  } catch (err) {
    console.error("tick processDueAuctions", err);
  }
}, 2000).unref();

app.listen(port, () => {
  console.log(`Noches de Escape API en http://127.0.0.1:${port}`);
  console.log("Fuente de verdad: SQLite. Las pujas se comparten entre sesiones.");
  console.log("Pagos: SIMULADOS. Cloudbeds: NO integrado.");
});
