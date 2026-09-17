import path from "node:path";
import fs from "node:fs";
import express, { type Express } from "express";

/** Serves the Vite build and SPA routes. API 404s are handled in createApp. */
export function mountStaticFrontend(app: Express, clientDist: string): boolean {
  const indexHtml = path.join(clientDist, "index.html");
  if (!fs.existsSync(indexHtml)) return false;

  app.use(express.static(clientDist, { index: false }));
  app.use((req, res, next) => {
    if (req.path.startsWith("/api")) return next();
    if (req.method !== "GET" && req.method !== "HEAD") return next();
    res.sendFile(indexHtml);
  });
  return true;
}
