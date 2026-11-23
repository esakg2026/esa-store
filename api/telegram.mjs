// Telegram-бот ESA Store (webhook).
// Клиентам: каталог с фото, заказ прямо в чате, мои заказы, размерная сетка, доставка, связь с менеджером, статусы.
// Владельцу: карточки заказов с кнопками статусов, /orders, /o, /sum, ответы клиентам через reply.
import {
  CATALOG, PRODUCTS, STATUS, DELIVERY, json, esc, sameKey, validateOrder, priceText, colorName, money,
  orders, misc, tg, send, OWNER, SITE, orderCard, ownerOrderButtons, BTN_STATUS, saveNewOrder, setOrderStatus, setOrderTotal,
  itemLine, statusLink, ID_RE,
} from "../lib/core.mjs";

const isOwner = (chatId) => OWNER() && String(chatId) === OWNER();
const site = (path = "") => `${SITE()}/${path}`;

const MENU = () => ({
  inline_keyboard: [
    [{ text: "🛍 Каталог", callback_data: "m:cat" }, { text: "🌐 Открыть магазин", url: site() || "https://t.me" }],
    [{ text: "📦 Мои заказы", callback_data: "m:my" }, { text: "📏 Размерная сетка", callback_data: "m:size" }],
    [{ text: "🚚 Доставка и оплата", callback_data: "m:delivery" }, { text: "💬 Менеджер", callback_data: "m:talk" }],
  ],
});

const getState = (chatId) => misc().get(`state/${chatId}`);
const setState = (chatId, s) => misc().setJSON(`state/${chatId}`, s);
const clearState = (chatId) => misc().delete(`state/${chatId}`);

async function linkOrderToChat(o, chatId) {
  o.chatId = chatId;
  await orders().setJSON(o.id, o);
  const list = (await misc().get(`my/${chatId}`)) || [];
  if (!list.includes(o.id)) { list.unshift(o.id); await misc().setJSON(`my/${chatId}`, list.slice(0, 20)); }
}

async function forwardToOwner(msg, prefix) {
  const from = msg.from || {};
  const who = `${esc(from.first_name || "")} ${esc(from.last_name || "")}`.trim() + (from.username ? ` (@${esc(from.username)})` : "");
  const r = await send(OWNER(), `<b>${prefix}</b>\nОт: ${who}\n\n${esc(msg.text || msg.caption || "[фото/файл — см. ниже]")}\n\n<i>Ответьте на это сообщение (reply) — бот перешлёт ответ клиенту.</i>`);
  if (r?.ok) await misc().setJSON(`fwd/${r.result.message_id}`, { chatId: msg.chat.id });
  if (msg.photo || msg.document || msg.voice) {
    const f = await tg("forwardMessage", { chat_id: OWNER(), from_chat_id: msg.chat.id, message_id: msg.message_id });
    if (f?.ok) await misc().setJSON(`fwd/${f.result.message_id}`, { chatId: msg.chat.id });
  }
}

// ---------- Тексты
const SIZE_TEXT = () => {
  const rows = CATALOG.sizeChart.map((r) => `${r.size.padEnd(4)}${r.chest.padEnd(9)}${r.waist.padEnd(9)}${r.hips}`);
  return `<b>📏 Размерная сетка ESA (см)</b>\n<pre>Разм Грудь    Талия    Бёдра\n${rows.join("\n")}</pre>\nМежду размерами? Берите больший — или напишите менеджеру, подскажем.`;
};
const DELIVERY_TEXT = () =>
  `<b>🚚 Доставка и оплата</b>\n\n• ${DELIVERY.pickup}\n• ${DELIVERY.courier} — Ош, Бишкек\n• ${DELIVERY.region} — по всему Кыргызстану\n\nСтоимость и срок доставки менеджер сообщит при подтверждении заказа.\n\n💳 Оплата — переводом (MBank / Optima) <b>после подтверждения</b> заказа. Реквизиты придут сюда в чат и на страницу заказа.`;

function productCaption(p) {
  const colors = p.colors.map(colorName).join(", ");
  return [
    `<b>${esc(p.title)}</b>`,
    p.subtitle ? `<i>${esc(p.subtitle)}</i>` : "",
    "",
    `💰 ${esc(priceText(p.price))}`,
    p.sizes.length ? `📏 Размеры: ${esc(p.sizes.filter((s) => !(p.soldOut || []).includes(s)).join(", "))}` : "",
    colors ? `🎨 Цвета: ${esc(colors)}` : "",
    p.inStock ? "✅ В наличии" : "🕓 Под заказ",
    "",
    esc(p.desc || ""),
    p.includes ? `\nВ комплекте: ${esc(p.includes.join(", "))}` : "",
  ].filter((x, i, a) => x || (a[i - 1] && i < a.length - 1)).join("\n").slice(0, 1000);
}

// ---------- Клиент
async function clientMessage(msg) {
  const chatId = msg.chat.id;
  const text = (msg.text || "").trim();

  if (text.startsWith("/start")) {
    const param = text.split(" ")[1] || "";
    const m = param.match(/^(ESS-\d{6})_([A-Za-z0-9_-]{16})$/);
    if (m) {
      const o = await orders().get(m[1]);
      if (o && sameKey(m[2], o.key)) {
        await linkOrderToChat(o, chatId);
        await send(OWNER(), `🔗 Клиент по заказу <b>${esc(o.id)}</b> подключил Telegram — будет получать статусы.`);
        let t = `✅ Заказ <b>${esc(o.id)}</b> привязан к этому чату.\n${esc(STATUS[o.status])}\n\nСюда придут подтверждение, реквизиты для оплаты и статусы доставки.`;
        if (o.status === "accepted") t += `\n\n${CLIENT_ACCEPTED(o)}`;
        return send(chatId, t, { reply_markup: MENU() });
      }
    }
    const pm = param.match(/^p_([a-z0-9-]{2,40})$/);
    if (pm && PRODUCTS.has(pm[1])) return showProduct(chatId, PRODUCTS.get(pm[1]));
    await clearState(chatId);
    return send(chatId, `Салам, ${esc(msg.from?.first_name || "друг")}! 👋\nЭто <b>ESA Store</b> — магазин бренда ESA.\n\n🏔 Коллекция <b>ESA Black Series 2026</b>: худи, футболки, куртки, брюки, аксессуары и гейминг.\n<i>Стиль. Технологии. Будущее.</i>\n\nЧто посмотрим?`, { reply_markup: MENU() });
  }
  if (text === "/myid") return send(chatId, `Ваш chat id: <code>${chatId}</code>`);
  if (text === "/menu" || text === "/help") { await clearState(chatId); return send(chatId, "Главное меню:", { reply_markup: MENU() }); }
  if (text === "/catalog") return showCategories(chatId);
  if (text === "/my") return showMy(chatId);
  if (text === "/size") return send(chatId, SIZE_TEXT());

  const st = await getState(chatId);
  if (st?.step === "phone") {
    const phone = msg.contact?.phone_number || text;
    return finishQuickOrder(msg, st, phone);
  }
  if (st?.step === "talk") {
    await clearState(chatId);
    await forwardToOwner(msg, "💬 Сообщение от клиента");
    return send(chatId, "Передал менеджеру ✅ Ответ придёт сюда же.", { reply_markup: MENU() });
  }

  // Любое другое сообщение — автоответ + пересылка владельцу (например, скриншот оплаты)
  await forwardToOwner(msg, msg.photo ? "🧾 Фото от клиента (возможно, чек)" : "💬 Сообщение боту");
  return send(chatId, msg.photo ? "Спасибо! Передал менеджеру — он проверит и обновит статус заказа ✅" : "Спасибо! Менеджер ответит здесь, как только сможет 🙌", { reply_markup: MENU() });
}

const CLIENT_ACCEPTED = (o) =>
  `${o.total ? `К оплате: <b>${esc(money(o.total))}</b>\n` : ""}${process.env.PAY_INFO ? `💳 Оплата переводом:\n${esc(process.env.PAY_INFO)}` : ""}`;

async function showCategories(chatId) {
  const rows = [];
  for (let i = 0; i < CATALOG.categories.length; i += 2) {
    rows.push(CATALOG.categories.slice(i, i + 2).map((c) => ({ text: c.title, callback_data: `c:${c.id}` })));
  }
  rows.push([{ text: "🌐 Весь каталог на сайте", url: site("#/catalog") }]);
  return send(chatId, "<b>Каталог ESA Black Series 2026</b>\nВыберите категорию:", { reply_markup: { inline_keyboard: rows } });
}

async function showProduct(chatId, p) {
  const kb = { inline_keyboard: [
    [{ text: "⚡ Заказать в чате", callback_data: `q:${p.id}` }],
    [{ text: "🛒 Открыть на сайте", url: site(`#/p/${p.id}`) }],
  ] };
  const photo = p.images?.[0] ? site(`img/p/${p.images[0]}`) : null;
  if (photo && SITE().startsWith("https://")) {
    const r = await tg("sendPhoto", { chat_id: chatId, photo, caption: productCaption(p), parse_mode: "HTML", reply_markup: kb });
    if (r?.ok) return r;
  }
  return send(chatId, productCaption(p), { reply_markup: kb });
}

async function showMy(chatId) {
  const ids = (await misc().get(`my/${chatId}`)) || [];
  if (!ids.length) return send(chatId, "У вас пока нет заказов. Посмотрим каталог?", { reply_markup: { inline_keyboard: [[{ text: "🛍 Каталог", callback_data: "m:cat" }]] } });
  const list = (await Promise.all(ids.map((id) => orders().get(id)))).filter(Boolean);
  return send(chatId, list.map((o) => `<b>${esc(o.id)}</b> · ${esc(STATUS[o.status])}\n${(o.items || []).map((i) => esc(itemLine(i))).join("\n")}\n<a href="${esc(statusLink(o))}">Страница заказа</a>`).join("\n\n"));
}

async function askPhone(chatId, st) {
  await setState(chatId, { ...st, step: "phone" });
  const p = PRODUCTS.get(st.pid);
  return send(chatId, `Отлично: <b>${esc(p.title)}</b>${st.size ? ` · ${esc(st.size)}` : ""}${st.color ? ` · ${esc(colorName(st.color))}` : ""}\n\nОтправьте номер телефона для связи — кнопкой ниже или напишите сообщением.`, {
    reply_markup: { keyboard: [[{ text: "📱 Отправить мой номер", request_contact: true }]], resize_keyboard: true, one_time_keyboard: true },
  });
}

async function finishQuickOrder(msg, st, phone) {
  const chatId = msg.chat.id;
  const from = msg.from || {};
  const name = [from.first_name, from.last_name].filter(Boolean).join(" ") || "Клиент";
  const v = validateOrder({
    items: [{ pid: st.pid, size: st.size || "", color: st.color || "", qty: 1 }],
    name, phone: String(phone || ""), quick: true,
    comment: from.username ? `Telegram @${from.username}` : "",
  });
  if (!v.ok) return send(chatId, `⚠️ ${esc(v.error)}`);
  const o = await saveNewOrder(v.order, "Telegram-бот", chatId);
  await linkOrderToChat(o, chatId);
  await clearState(chatId);
  await send(chatId, "Номер получил ✅", { reply_markup: { remove_keyboard: true } });
  return send(chatId, `🎉 Заказ <b>${esc(o.id)}</b> оформлен!\n${esc(itemLine(o.items[0]))}\n\nМенеджер свяжется с вами, уточнит доставку и подтвердит заказ. Реквизиты для оплаты придут сюда после подтверждения.\n\n<a href="${esc(statusLink(o))}">Страница заказа</a>`, { reply_markup: MENU() });
}

async function clientCallback(cb) {
  const chatId = cb.message.chat.id;
  const d = cb.data || "";

  if (d === "m:cat") return showCategories(chatId);
  if (d === "m:size") return send(chatId, SIZE_TEXT());
  if (d === "m:delivery") return send(chatId, DELIVERY_TEXT());
  if (d === "m:my") return showMy(chatId);
  if (d === "m:talk") {
    await setState(chatId, { step: "talk" });
    return send(chatId, "Напишите сообщение — передам менеджеру ✍️");
  }
  if (d.startsWith("c:")) {
    const cat = CATALOG.categories.find((c) => c.id === d.slice(2));
    if (!cat) return;
    const list = CATALOG.products.filter((p) => p.cat === cat.id);
    return send(chatId, `<b>${esc(cat.title)}</b>\n\n${list.map((p) => `• ${esc(p.title)} — ${esc(priceText(p.price))}`).join("\n")}\n\nНажмите на товар, чтобы посмотреть фото:`, {
      reply_markup: { inline_keyboard: [...list.map((p) => [{ text: p.title, callback_data: `p:${p.id}` }]), [{ text: "⬅️ Категории", callback_data: "m:cat" }]] },
    });
  }
  if (d.startsWith("p:")) {
    const p = PRODUCTS.get(d.slice(2));
    if (p) return showProduct(chatId, p);
    return;
  }
  // Заказ в чате: q:<id> → размер → цвет → телефон
  if (d.startsWith("q:")) {
    const [, pid, si, ci] = d.split(":");
    const p = PRODUCTS.get(pid);
    if (!p) return;
    const sizes = p.sizes.filter((s) => !(p.soldOut || []).includes(s));
    if (p.sizes.length && si === undefined) {
      if (!sizes.length) return send(chatId, "Этого товара сейчас нет в наличии 😔 Напишите менеджеру — сообщим о поступлении.");
      const rows = [];
      for (let i = 0; i < sizes.length; i += 3) rows.push(sizes.slice(i, i + 3).map((s) => ({ text: s, callback_data: `q:${pid}:${p.sizes.indexOf(s)}` })));
      rows.push([{ text: "📏 Размерная сетка", callback_data: "m:size" }]);
      return send(chatId, `Выберите размер — <b>${esc(p.title)}</b>:`, { reply_markup: { inline_keyboard: rows } });
    }
    const size = p.sizes.length ? p.sizes[Number(si)] : "";
    if (p.sizes.length && !size) return;
    if (p.colors.length > 1 && ci === undefined) {
      return send(chatId, "Выберите цвет:", { reply_markup: { inline_keyboard: [p.colors.map((c, i) => ({ text: colorName(c), callback_data: `q:${pid}:${si ?? ""}:${i}` }))] } });
    }
    const color = p.colors.length > 1 ? p.colors[Number(ci)] : p.colors[0] || "";
    if (p.colors.length && !color) return;
    return askPhone(chatId, { pid, size, color });
  }
}

// ---------- Владелец
const OWNER_HELP = "Команды владельца:\n/orders — активные заказы\n/o ESS-123456 — карточка заказа\n/sum ESS-123456 4500 — вписать сумму к оплате (сом)\n/menu — меню покупателя\nОтветить клиенту — ответьте (reply) на его сообщение или карточку заказа.";

async function ownerMessage(msg) {
  const chatId = msg.chat.id;
  const text = (msg.text || "").trim();
  if (msg.reply_to_message) {
    const rid = msg.reply_to_message.message_id;
    let target = (await misc().get(`fwd/${rid}`))?.chatId;
    if (!target) {
      const m = (msg.reply_to_message.text || msg.reply_to_message.caption || "").match(/ESS-\d{6}/);
      if (m) target = (await orders().get(m[0]))?.chatId;
    }
    if (!target) return send(chatId, "⚠️ Не нашёл, кому ответить: клиент не подключил Telegram. Позвоните по телефону из заказа.");
    const r = await tg("copyMessage", { chat_id: target, from_chat_id: chatId, message_id: msg.message_id });
    if (r?.ok) return send(chatId, "✅ Отправлено клиенту.");
    return send(chatId, "⚠️ Не удалось отправить (клиент мог заблокировать бота).");
  }
  if (text === "/orders") {
    const store = orders();
    const { blobs } = await store.list();
    const all = (await Promise.all(blobs.slice(-300).map((b) => store.get(b.key)))).filter(Boolean);
    all.sort((a, b) => b.createdAt - a.createdAt);
    const active = all.filter((o) => !["done", "rejected"].includes(o.status)).slice(0, 15);
    if (!active.length) return send(chatId, "Активных заказов нет 🙌");
    return send(chatId, active.map((o) => `<b>${esc(o.id)}</b> · ${esc(o.name)} · ${esc(o.phone)}\n${esc(STATUS[o.status])}`).join("\n\n") + "\n\nКарточка: /o ESS-XXXXXX");
  }
  let m = text.match(/^\/o\s+(ESS-\d{6})$/i);
  if (m) {
    const o = await orders().get(m[1].toUpperCase());
    if (!o) return send(chatId, "Заказ не найден");
    return send(chatId, orderCard(o), { reply_markup: ownerOrderButtons(o.id) });
  }
  m = text.match(/^\/sum\s+(ESS-\d{6})\s+(\d{1,8})$/i);
  if (m) {
    const o = await setOrderTotal(m[1].toUpperCase(), m[2]);
    if (!o) return send(chatId, "Заказ не найден");
    return send(chatId, `💰 Сумма к оплате по <b>${esc(o.id)}</b>: ${esc(o.total ? money(o.total) : "не указана")}\nТеперь нажмите «✅ Подтвердить» — клиент получит сумму и реквизиты.`, { reply_markup: ownerOrderButtons(o.id) });
  }
  if (text === "/myid") return send(chatId, `Ваш chat id: <code>${chatId}</code>`);
  if (text === "/start" || text === "/help") {
    await send(chatId, OWNER_HELP);
  }
  return clientMessage(msg); // владелец может пользоваться ботом как покупатель (для проверки)
}

async function ownerCallback(cb) {
  const [act, id] = (cb.data || "").split(":");
  const status = BTN_STATUS[act];
  if (!status || !ID_RE.test(id || "")) return tg("answerCallbackQuery", { callback_query_id: cb.id });
  const res = await setOrderStatus(id, status);
  if (!res) return tg("answerCallbackQuery", { callback_query_id: cb.id, text: "Заказ не найден" });
  const o = res.order;
  await tg("editMessageText", { chat_id: cb.message.chat.id, message_id: cb.message.message_id, text: orderCard(o), parse_mode: "HTML", reply_markup: ownerOrderButtons(o.id) });
  let note = `Статус: ${STATUS[o.status]}`;
  note += o.chatId ? (res.clientNotified ? " · клиенту отправлено" : " · не удалось отправить клиенту") : " · клиент не в Telegram — позвоните ему";
  return tg("answerCallbackQuery", { callback_query_id: cb.id, text: note.slice(0, 190), show_alert: !o.chatId });
}

// ---------- Точка входа
export default async (req) => {
  if (req.method !== "POST") return json({ ok: true });
  const secret = process.env.TG_WEBHOOK_SECRET;
  if (!secret || req.headers.get("x-telegram-bot-api-secret-token") !== secret) return json({ error: "forbidden" }, 403);

  let u;
  try { u = await req.json(); } catch { return json({ ok: true }); }
  try {
    if (u.message && u.message.chat?.type === "private") {
      if (isOwner(u.message.chat.id)) await ownerMessage(u.message);
      else await clientMessage(u.message);
    } else if (u.callback_query?.message) {
      const cb = u.callback_query;
      if (isOwner(cb.from.id) && /^(acc|paid|ship|done|rej):/.test(cb.data || "")) await ownerCallback(cb);
      else { await tg("answerCallbackQuery", { callback_query_id: cb.id }); await clientCallback(cb); }
    }
  } catch (e) {
    console.error("bot error", e);
  }
  return json({ ok: true }); // всегда 200, чтобы Telegram не повторял запрос бесконечно
};
