// Общая логика магазина: каталог, проверка заказа, хранилище, Telegram.
import { readFileSync } from "node:fs";
import { createHash, randomBytes } from "node:crypto";
import { getStore } from "./store.mjs";
import { pushOwner } from "./push.mjs";

// ---------- Каталог (products.json — единственный файл, где владелец меняет товары и цены)
export const CATALOG = JSON.parse(readFileSync(new URL("../products.json", import.meta.url), "utf8"));
export const PRODUCTS = new Map(CATALOG.products.map((p) => [p.id, p]));
export const CUR = CATALOG.currency || "сом";
export const colorName = (id) => CATALOG.colors[id]?.name || id || "";
export const money = (n) => `${Number(n).toLocaleString("ru-RU").replace(/ /g, " ")} ${CUR}`;
export const priceText = (p) => (typeof p === "number" && p > 0 ? money(p) : "Цену уточняйте");

export const STATUS = {
  new: "🆕 Новый — ждёт подтверждения",
  accepted: "✅ Подтверждён — ожидается оплата",
  paid: "💳 Оплачен — собираем заказ",
  shipped: "🚚 Отправлен / готов к выдаче",
  done: "🎉 Получен",
  rejected: "❌ Отменён",
};
export const STATUS_ORDER = ["new", "accepted", "paid", "shipped", "done"];

export const DELIVERY = {
  pickup: "Самовывоз (Ош)",
  courier: "Курьер по городу",
  region: "Доставка в регион",
};

// ---------- Утилиты
export const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });

export const esc = (s = "") =>
  String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

export const clean = (v, max) =>
  typeof v === "string" ? v.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "").trim().slice(0, max) : "";

export const ID_RE = /^ESS-\d{6}$/;
export function newOrderId() {
  const n = (randomBytes(4).readUInt32BE(0) % 900000) + 100000;
  return `ESS-${n}`;
}
export const newKey = () => randomBytes(12).toString("base64url");
export const sameKey = (a, b) =>
  typeof a === "string" && typeof b === "string" && a.length > 0 && a.length === b.length &&
  createHash("sha256").update(a).digest().equals(createHash("sha256").update(b).digest());
export const phoneDigits = (s) => String(s || "").replace(/\D/g, "");

// Проверка корзины: только товары, размеры и цвета из products.json.
export function validateItems(raw) {
  if (!Array.isArray(raw) || !raw.length) return { ok: false, error: "Корзина пуста" };
  if (raw.length > 30) return { ok: false, error: "Слишком много позиций в одном заказе" };
  const items = [];
  for (const it of raw) {
    const p = PRODUCTS.get(String(it?.pid || ""));
    if (!p) return { ok: false, error: "Товар не найден — обновите страницу" };
    const size = String(it.size || "");
    const color = String(it.color || "");
    if (p.sizes.length ? !p.sizes.includes(size) : size) return { ok: false, error: `Выберите размер: ${p.title}` };
    if ((p.soldOut || []).includes(size)) return { ok: false, error: `Размера ${size} нет в наличии: ${p.title}` };
    if (p.colors.length ? !p.colors.includes(color) : color) return { ok: false, error: `Выберите цвет: ${p.title}` };
    const qty = Number(it.qty);
    if (!Number.isInteger(qty) || qty < 1 || qty > 20) return { ok: false, error: "Неверное количество" };
    const price = typeof p.price === "number" && p.price > 0 ? p.price : null;
    items.push({ pid: p.id, title: p.title, size, color, colorName: colorName(color), qty, price });
  }
  return { ok: true, items };
}

export const itemsTotal = (items) => (items.every((i) => i.price) ? items.reduce((s, i) => s + i.price * i.qty, 0) : null);

// Проверка заказа с сайта. quick=true — «купить в 1 клик»: только имя и телефон.
export function validateOrder(body) {
  if (!body || typeof body !== "object") return { ok: false, error: "Пустой запрос" };
  if (clean(body.website, 200)) return { ok: false, error: "spam" }; // скрытое поле-ловушка для ботов
  const v = validateItems(body.items);
  if (!v.ok) return v;
  const quick = body.quick === true;
  const o = {
    items: v.items,
    name: clean(body.name, 80),
    phone: clean(body.phone, 40),
    city: clean(body.city, 60),
    delivery: DELIVERY[body.delivery] ? body.delivery : quick ? "" : "pickup",
    address: clean(body.address, 300),
    comment: clean(body.comment, 1000),
    quick,
  };
  if (o.name.length < 2) return { ok: false, error: "Укажите имя" };
  const d = phoneDigits(o.phone);
  if (d.length < 9 || d.length > 15) return { ok: false, error: "Укажите номер телефона (например +996 555 123 456)" };
  if (!quick) {
    if (o.city.length < 2) return { ok: false, error: "Укажите город" };
    if (o.delivery !== "pickup" && o.address.length < 5) return { ok: false, error: "Укажите адрес доставки" };
  }
  o.total = itemsTotal(o.items);
  return { ok: true, order: o };
}

// ---------- Хранилище
export const orders = () => getStore("orders");
export const misc = () => getStore("misc");

// Ограничение частоты: не больше `limit` действий за `windowSec` с одного адреса.
export async function rateLimited(req, context, bucket, limit, windowSec) {
  const ip = context?.ip || "unknown";
  const key = `rl/${bucket}/${createHash("sha256").update(ip).digest("hex").slice(0, 24)}`;
  const store = misc();
  const now = Date.now();
  const hits = ((await store.get(key)) || []).filter((t) => now - t < windowSec * 1000);
  if (hits.length >= limit) return true;
  hits.push(now);
  await store.setJSON(key, hits);
  return false;
}

// ---------- Telegram
const TG = () => `https://api.telegram.org/bot${process.env.TG_BOT_TOKEN}`;
export const tgEnabled = () => Boolean(process.env.TG_BOT_TOKEN && process.env.TG_OWNER_CHAT_ID);
export const OWNER = () => String(process.env.TG_OWNER_CHAT_ID || "");
export const SITE = () => process.env.URL || "";

export async function tg(method, payload) {
  if (!process.env.TG_BOT_TOKEN) return null;
  try {
    const r = await fetch(`${TG()}/${method}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await r.json();
    if (!data.ok) console.error("Telegram error", method, data.description);
    return data;
  } catch (e) {
    console.error("Telegram fetch failed", method, e.message);
    return null;
  }
}
export const send = (chat_id, text, extra = {}) =>
  tg("sendMessage", { chat_id, text, parse_mode: "HTML", disable_web_page_preview: true, ...extra });

const fmtTime = (ts) => new Date(ts).toLocaleString("ru-RU", { timeZone: "Asia/Bishkek", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

export const itemLine = (i) =>
  `• ${i.title}${i.size ? ` · ${i.size}` : ""}${i.colorName ? ` · ${i.colorName}` : ""} × ${i.qty}${i.price ? ` — ${money(i.price * i.qty)}` : ""}`;

export const totalText = (o) => (o.total ? money(o.total) : "уточнить и вписать: /sum " + o.id + " 0000");

export function orderCard(o) {
  return [
    `<b>🛍 Заказ ${esc(o.id)}</b>${o.quick ? " · ⚡ в 1 клик" : ""}`,
    `<b>Статус:</b> ${esc(STATUS[o.status] || o.status)}`,
    "",
    (o.items || []).map((i) => esc(itemLine(i))).join("\n") || esc(o.comment || ""),
    `<b>Итого:</b> ${esc(totalText(o))}`,
    "",
    `<b>Имя:</b> ${esc(o.name)}`,
    `<b>Телефон:</b> ${esc(o.phone)}`,
    o.city && `<b>Город:</b> ${esc(o.city)}`,
    o.delivery && `<b>Получение:</b> ${esc(DELIVERY[o.delivery] || o.delivery)}`,
    o.address && `<b>Адрес:</b> ${esc(o.address)}`,
    o.comment && o.items?.length && `<b>Комментарий:</b> ${esc(o.comment)}`,
    o.chatId && `\n💬 Клиент в Telegram — можно ответить ему ответом (reply) на это сообщение.`,
    `<i>Источник: ${esc(o.source || "сайт")} · ${new Date(o.createdAt).toLocaleString("ru-RU", { timeZone: "Asia/Bishkek" })}</i>`,
  ].filter((x) => typeof x === "string").join("\n").replace(/\n{3,}/g, "\n\n");
}

export const ownerOrderButtons = (id) => ({
  inline_keyboard: [
    [{ text: "✅ Подтвердить", callback_data: `acc:${id}` }, { text: "💳 Оплачен", callback_data: `paid:${id}` }],
    [{ text: "🚚 Отправлен", callback_data: `ship:${id}` }, { text: "🎉 Получен", callback_data: `done:${id}` }],
    [{ text: "❌ Отменить", callback_data: `rej:${id}` }],
  ],
});
export const BTN_STATUS = { acc: "accepted", paid: "paid", ship: "shipped", done: "done", rej: "rejected" };

export async function notifyOwner(payload) {
  try { await pushOwner(misc(), payload); } catch (e) { console.error("push error", e.message); }
}

export async function saveNewOrder(data, source, chatId) {
  const o = { ...data, id: newOrderId(), key: newKey(), status: "new", source, chatId: chatId || null, createdAt: Date.now(), history: [] };
  while (await orders().get(o.id)) o.id = newOrderId();
  await orders().setJSON(o.id, o);
  const first = o.items?.[0];
  await notifyOwner({
    title: `🛍 Новый заказ ${o.id}`,
    body: `${o.name} · ${o.phone} · ${fmtTime(o.createdAt)}\n${first ? first.title + (o.items.length > 1 ? ` и ещё ${o.items.length - 1}` : "") : (o.comment || "").slice(0, 100)}`,
    tag: o.id, url: `/admin/#order=${o.id}`,
  });
  if (tgEnabled()) await send(OWNER(), orderCard(o), { reply_markup: ownerOrderButtons(o.id) });
  return o;
}

export const payInfo = () => process.env.PAY_INFO || "";
export const statusLink = (o) => `${SITE()}/#/order/${o.id}?k=${o.key}`;

// Тексты клиенту при смене статуса (Telegram). Реквизиты — только после подтверждения.
export const CLIENT_TEXT = {
  accepted: (o) => `✅ Ваш заказ <b>${esc(o.id)}</b> подтверждён!\n\n${o.total ? `К оплате: <b>${esc(money(o.total))}</b>\n` : "Менеджер сообщит точную сумму.\n"}${payInfo() ? `💳 Оплата переводом:\n${esc(payInfo())}\n\nПосле оплаты пришлите сюда скриншот чека.` : ""}`,
  paid: (o) => `💳 Оплата по заказу <b>${esc(o.id)}</b> получена. Собираем ваш заказ!`,
  shipped: (o) => `🚚 Заказ <b>${esc(o.id)}</b> ${o.delivery === "pickup" ? "готов к выдаче" : "отправлен"}! Если есть вопросы — пишите сюда.`,
  done: (o) => `🎉 Заказ <b>${esc(o.id)}</b> получен. Спасибо, что выбрали ESA! DREAM · CREATE · ACHIEVE 🏔`,
  rejected: (o) => `Заказ <b>${esc(o.id)}</b> отменён. Если это ошибка — напишите сюда, разберёмся.`,
  new: (o) => `🆕 Заказ <b>${esc(o.id)}</b> снова ожидает подтверждения.`,
};

// Смена статуса владельцем (из бота или из приложения).
export async function setOrderStatus(id, status) {
  if (!STATUS[status]) return null;
  const o = await orders().get(id);
  if (!o) return null;
  o.status = status;
  o.history = [...(o.history || []), { status, at: Date.now() }];
  await orders().setJSON(o.id, o);
  let clientNotified = false;
  if (o.chatId && tgEnabled()) clientNotified = Boolean((await send(o.chatId, CLIENT_TEXT[status](o)))?.ok);
  return { order: o, clientNotified };
}

// Владелец вписывает итоговую сумму (если цены в products.json не указаны или есть доставка).
export async function setOrderTotal(id, total) {
  const n = Math.round(Number(total));
  if (!Number.isFinite(n) || n < 0 || n > 10_000_000) return null;
  const o = await orders().get(id);
  if (!o) return null;
  o.total = n || null;
  await orders().setJSON(o.id, o);
  return o;
}

// Что видит клиент на странице статуса. Реквизиты — только когда заказ подтверждён и ждёт оплаты.
export function publicOrder(o) {
  return {
    id: o.id, status: o.status, statusText: STATUS[o.status], createdAt: o.createdAt,
    items: o.items, total: o.total, delivery: o.delivery ? DELIVERY[o.delivery] : "", city: o.city,
    history: (o.history || []).map((h) => ({ status: h.status, at: h.at })),
    payInfo: o.status === "accepted" ? payInfo() || null : null,
    telegram: Boolean(o.chatId),
  };
}
