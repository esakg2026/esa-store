// API приложения владельца: /api/admin/*. Доступ только с ADMIN_TOKEN (заголовок Authorization: Bearer ...).
import { json, orders, misc, sameKey, rateLimited, STATUS, DELIVERY, CATALOG, setOrderStatus, setOrderTotal, notifyOwner, ID_RE } from "../lib/core.mjs";
import { saveSubscription } from "../lib/push.mjs";

function authorized(req) {
  const token = process.env.ADMIN_TOKEN || "";
  const given = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  return token.length >= 24 && sameKey(given, token);
}

export default async (req, context) => {
  const path = new URL(req.url).pathname.replace(/\/+$/, "");

  if (path === "/api/admin/vapid") return json({ key: process.env.VAPID_PUBLIC_KEY || null });

  if (await rateLimited(req, context, "admin-all", 300, 600)) return json({ error: "Слишком много запросов" }, 429);
  if (!authorized(req)) return json({ error: "Нет доступа" }, 401);

  let body = {};
  if (req.method === "POST") { try { body = await req.json(); } catch { return json({ error: "Неверный формат" }, 400); } }

  if (path === "/api/admin/data" && req.method === "GET") {
    const store = orders();
    const { blobs } = await store.list();
    const all = (await Promise.all(blobs.map((b) => store.get(b.key)))).filter(Boolean)
      .map(({ key, ...rest }) => rest) // секретный ключ клиента наружу не отдаём
      .sort((a, b) => b.createdAt - a.createdAt);
    return json({
      orders: all,
      statuses: STATUS,
      delivery: DELIVERY,
      products: CATALOG.products.map(({ id, title, cat, price, inStock, images }) => ({ id, title, cat, price, inStock, image: images?.[0] || null })),
      categories: CATALOG.categories,
      serverTime: Date.now(),
    });
  }

  if (path === "/api/admin/status" && req.method === "POST") {
    const res = await setOrderStatus(String(body.id || ""), String(body.status || ""));
    if (!res) return json({ error: "Заказ или статус не найден" }, 404);
    return json({ ok: true, status: res.order.status, clientNotified: res.clientNotified });
  }

  if (path === "/api/admin/total" && req.method === "POST") {
    const o = await setOrderTotal(String(body.id || ""), body.total);
    if (!o) return json({ error: "Неверная сумма или заказ не найден" }, 400);
    return json({ ok: true, total: o.total });
  }

  if (path === "/api/admin/delete" && req.method === "POST") {
    const id = String(body.id || "");
    if (!ID_RE.test(id)) return json({ error: "Неверный номер" }, 400);
    const o = await orders().get(id);
    if (!o) return json({ error: "Заказ не найден" }, 404);
    await orders().delete(id);
    if (o.chatId) {
      const list = ((await misc().get(`my/${o.chatId}`)) || []).filter((x) => x !== id);
      await misc().setJSON(`my/${o.chatId}`, list);
    }
    return json({ ok: true });
  }

  if (path === "/api/admin/subscribe" && req.method === "POST") {
    if (!(await saveSubscription(misc(), body.subscription))) return json({ error: "Неверная подписка" }, 400);
    return json({ ok: true });
  }

  if (path === "/api/admin/test-push" && req.method === "POST") {
    await notifyOwner({ title: "🔔 Проверка уведомлений ESA Store", body: `Всё работает! ${new Date().toLocaleString("ru-RU", { timeZone: "Asia/Bishkek" })}`, tag: "test", url: "/admin/" });
    return json({ ok: true });
  }

  return json({ error: "Не найдено" }, 404);
};
