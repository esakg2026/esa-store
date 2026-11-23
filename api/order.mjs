// POST /api/order — новый заказ с сайта (корзина или «купить в 1 клик»).
// GET  /api/order?id=ESS-123456&k=ключ  — статус заказа по секретной ссылке
// GET  /api/order?id=ESS-123456&phone=+996...  — статус по номеру заказа и телефону
import { json, validateOrder, saveNewOrder, rateLimited, orders, sameKey, phoneDigits, publicOrder, ID_RE, statusLink } from "../lib/core.mjs";

export default async (req, context) => {
  if (req.method === "GET") {
    const url = new URL(req.url);
    const id = (url.searchParams.get("id") || "").trim().toUpperCase();
    const k = url.searchParams.get("k") || "";
    const phone = phoneDigits(url.searchParams.get("phone"));
    if (!ID_RE.test(id)) return json({ error: "Неверный номер заказа (пример: ESS-123456)" }, 400);
    if (await rateLimited(req, context, "status", 40, 600)) return json({ error: "Слишком часто, попробуйте позже" }, 429);
    const o = await orders().get(id);
    const byKey = o && k && sameKey(k, o.key);
    const byPhone = o && !k && phone.length >= 9 && phoneDigits(o.phone).slice(-9) === phone.slice(-9);
    if (!byKey && !byPhone) return json({ error: "Заказ не найден. Проверьте номер заказа и телефон." }, 404);
    return json(publicOrder(o));
  }

  if (req.method !== "POST") return json({ error: "Метод не поддерживается" }, 405);
  let body;
  try { body = await req.json(); } catch { return json({ error: "Неверный формат" }, 400); }

  const v = validateOrder(body);
  if (!v.ok) return v.error === "spam" ? json({ ok: true, id: "ESS-000000", key: "x" }) : json({ error: v.error }, 400);
  if (await rateLimited(req, context, "order", 6, 3600)) return json({ error: "Слишком много заказов подряд. Напишите нам в Telegram." }, 429);

  const o = await saveNewOrder(v.order, v.order.quick ? "сайт · 1 клик" : "сайт");
  const bot = process.env.TG_BOT_USERNAME;
  return json({
    ok: true,
    id: o.id,
    key: o.key,
    statusUrl: statusLink(o),
    botLink: bot ? `https://t.me/${bot}?start=${o.id}_${o.key}` : null,
  });
};
