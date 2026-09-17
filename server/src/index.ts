import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import { createApp } from "./app.ts";
import { adminPassword, isProduction, sessionSecret } from "./auth.ts";
import { openDatabase, upsertCatalog } from "./db.ts";
import { seedDemoListings } from "./seed.ts";
import { processDueAuctions } from "./auction.ts";
import { withTx } from "./db.ts";
import { mountStaticFrontend } from "./frontend.ts";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
dotenv.config({ path: path.join(root, ".env") });

function listenPort(): number {
  const n = Number(process.env.PORT || 3001);
  if (!Number.isInteger(n) || n <= 0 || n > 65535) {
    throw new Error(`PORT inválido: ${process.env.PORT ?? ""}`);
  }
  return n;
}

if (isProduction()) {
  // Falla al arrancar si faltan secretos (no uses la contraseña de desarrollo).
  adminPassword();
  sessionSecret();
} else if (!process.env.ADMIN_PASSWORD) {
  console.warn(
    "[aviso] ADMIN_PASSWORD no está definido. En desarrollo se usa la contraseña local de .env.example.",
  );
}

const dbPath = process.env.DATABASE_PATH || path.join(root, "data/noches.db");
const db = openDatabase(path.isAbsolute(dbPath) ? dbPath : path.join(root, dbPath));
upsertCatalog(db);
seedDemoListings(db);

const app = createApp(db);

const clientDist = path.join(root, "client/dist");
const frontendMounted = mountStaticFrontend(app, clientDist);
if (!frontendMounted) {
  const msg =
    "No está client/dist. En producción ejecuta: npm run build && npm start (un solo origen: API + web).";
  if (isProduction()) {
    console.error(msg);
    process.exit(1);
  }
  console.warn(`[aviso] ${msg} En desarrollo usa npm run dev (Vite en :5173).`);
}

const port = listenPort();
const host = process.env.HOST || "0.0.0.0";

setInterval(() => {
  try {
    withTx(db, () => processDueAuctions(db));
  } catch (err) {
    console.error("tick processDueAuctions", err);
  }
}, 2000).unref();

app.listen(port, host, () => {
  console.log(`Noches de Escape en http://${host}:${port}`);
  console.log("Fuente de verdad: SQLite. Las pujas se comparten entre sesiones.");
  console.log("Pagos: SIMULADOS. Cloudbeds: NO integrado.");
  if (frontendMounted) {
    console.log("Frontend: Express sirve client/dist (mismo origen).");
  }
});
