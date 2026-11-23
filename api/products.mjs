// GET /api/products — каталог для сайта (из products.json) + имя бота.
import { CATALOG, json } from "../lib/core.mjs";

export default async () => {
  const { _help, ...data } = CATALOG;
  const r = json({ ...data, bot: process.env.TG_BOT_USERNAME || null });
  r.headers.set("cache-control", "public, max-age=120");
  return r;
};
