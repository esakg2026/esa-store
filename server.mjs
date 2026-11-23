// Сервер ESA Store для Render: раздаёт сайт из public/ и API (заказы, каталог, Telegram-бот, приложение владельца).
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import { gzipSync } from "node:zlib";

// Публичный адрес (Render задаёт RENDER_EXTERNAL_URL) — нужен боту для ссылок и webhook
if (!process.env.URL && process.env.RENDER_EXTERNAL_URL) process.env.URL = process.env.RENDER_EXTERNAL_URL;

const routes = {
  "/api/products": (await import("./api/products.mjs")).default,
  "/api/order": (await import("./api/order.mjs")).default,
  "/api/telegram": (await import("./api/telegram.mjs")).default,
  "/api/tg-setup": (await import("./api/tg-setup.mjs")).default,
};
const adminApi = (await import("./api/admin.mjs")).default;

const root = fileURLToPath(new URL("./public/", import.meta.url));
const types = {
  ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "text/javascript; charset=utf-8",
  ".xml": "application/xml", ".txt": "text/plain; charset=utf-8", ".json": "application/json",
  ".webmanifest": "application/manifest+json", ".png": "image/png", ".svg": "image/svg+xml", ".webp": "image/webp", ".jpg": "image/jpeg", ".ico": "image/x-icon",
};
const compressible = new Set([".html", ".css", ".js", ".svg", ".json", ".xml", ".txt", ".webmanifest"]);
const security = {
  "x-frame-options": "DENY",
  "x-content-type-options": "nosniff",
  "referrer-policy": "strict-origin-when-cross-origin",
  "permissions-policy": "camera=(), microphone=(), geolocation=()",
  "strict-transport-security": "max-age=31536000",
  "content-security-policy": "default-src 'self'; script-src 'self'; style-src 'self' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'",
};
const cache = new Map();

const PORT = Number(process.env.PORT || 10000);
createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
    const fn = routes[url.pathname] || (url.pathname.startsWith("/api/admin/") ? adminApi : null);
    if (fn) {
      const chunks = [];
      let size = 0;
      for await (const c of req) { size += c.length; if (size > 64 * 1024) { res.writeHead(413, security); return res.end(); } chunks.push(c); }
      const ip = String(req.headers["x-forwarded-for"] || req.socket.remoteAddress || "").split(",")[0].trim();
      const request = new Request(`${process.env.URL || "http://localhost"}${url.pathname}${url.search}`, {
        method: req.method, headers: req.headers,
        body: ["GET", "HEAD"].includes(req.method) ? undefined : Buffer.concat(chunks),
      });
      const r = await fn(request, { ip });
      res.writeHead(r.status, { ...security, ...Object.fromEntries(r.headers) });
      return res.end(Buffer.from(await r.arrayBuffer()));
    }
    if (url.pathname === "/healthz") { res.writeHead(200); return res.end("ok"); }
    if (!["GET", "HEAD"].includes(req.method)) { res.writeHead(405, security); return res.end(); }
    let rel = decodeURIComponent(url.pathname);
    if (rel.endsWith("/")) rel += "index.html";
    if (rel === "/admin") { res.writeHead(301, { location: "/admin/" }); return res.end(); }
    const file = normalize(join(root, rel));
    if (!file.startsWith(normalize(root))) { res.writeHead(403, security); return res.end(); }
    const ext = extname(file);
    let entry = cache.get(file);
    if (!entry) {
      const data = await readFile(file);
      entry = { data, gz: compressible.has(ext) ? gzipSync(data) : null };
      if (process.env.NODE_ENV === "production") cache.set(file, entry);
    }
    const noCache = rel.startsWith("/admin/") || rel.endsWith("sw.js") || ext === ".html" || ext === ".js" || ext === ".css";
    const gzip = entry.gz && /\bgzip\b/.test(req.headers["accept-encoding"] || "");
    res.writeHead(200, {
      ...security,
      "content-type": types[ext] || "application/octet-stream",
      "cache-control": noCache ? "no-cache" : "public, max-age=86400",
      vary: "accept-encoding",
      ...(gzip ? { "content-encoding": "gzip" } : {}),
      ...(rel.startsWith("/admin/") ? { "x-robots-tag": "noindex" } : {}),
    });
    res.end(req.method === "HEAD" ? undefined : gzip ? entry.gz : entry.data);
  } catch (e) {
    if (e.code !== "ENOENT" && e.code !== "EISDIR") console.error(e);
    if (!res.headersSent) res.writeHead(e.code === "ENOENT" || e.code === "EISDIR" ? 404 : 500, { ...security, "content-type": "text/plain; charset=utf-8" });
    res.end(e.code === "ENOENT" ? "Не найдено" : "");
  }
}).listen(PORT, () => console.log(`ESA Store on :${PORT}`));

const { warmUp } = await import("./lib/store.mjs");
warmUp().then(() => console.log(process.env.DATABASE_URL ? "SQL-база подключена" : "Без DATABASE_URL — данные в памяти (только для проверки)")).catch((e) => console.error("SQL-база недоступна:", e.message));
