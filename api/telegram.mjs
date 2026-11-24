// Telegram-бот ESA Store (webhook). Клиентам — на их языке (ru / ky / en):
// каталог с фото, заказ в чате, мои заказы, размерная сетка, доставка, связь с менеджером, статусы.
// Владельцу (по-русски): карточки заказов с кнопками статусов, /orders, /o, /sum, ответы клиентам через reply.
import {
  CATALOG, PRODUCTS, STATUS, json, esc, sameKey, validateOrder, money,
  orders, misc, tg, send, OWNER, SITE, orderCard, ownerOrderButtons, BTN_STATUS, saveNewOrder, setOrderStatus, setOrderTotal,
  itemLine, statusLink, ID_RE, clientText,
} from "../lib/core.mjs";
import { tx, loc, normLang } from "../lib/i18n.mjs";

const isOwner = (chatId) => OWNER() && String(chatId) === OWNER();
const site = (path = "", lang = "ru") => `${SITE()}/${lang !== "ru" ? `?lang=${lang}` : ""}${path}`;

// ---------- Язык чата: выбранный вручную → язык заказа по ссылке → язык Telegram
async function getLang(chatId, from) {
  const saved = await misc().get(`lang/${chatId}`);
  if (saved) return normLang(saved);
  return normLang(from?.language_code);
}
const setLang = (chatId, l) => misc().setJSON(`lang/${chatId}`, normLang(l));

const pTitle = (p, l) => loc(p, l, "title");
const cName = (id, l) => loc(CATALOG.colors[id], l, "name") || id;
const priceOf = (p, l) => (typeof p.price === "number" && p.price > 0 ? money(p.price) : { ru: "Цену уточняйте", ky: "Баасын тактаңыз", en: "Price on request" }[l]);

const MENU = (l) => {
  const T = tx(l);
  return {
    inline_keyboard: [
      [{ text: T.menuCatalog, callback_data: "m:cat" }, { text: T.menuShop, url: site("", l) || "https://t.me" }],
      [{ text: T.menuMy, callback_data: "m:my" }, { text: T.menuSize, callback_data: "m:size" }],
      [{ text: T.menuDelivery, callback_data: "m:delivery" }, { text: T.menuTalk, callback_data: "m:talk" }],
      [{ text: T.menuLang, callback_data: "m:lang" }],
    ],
  };
};
const LANG_KB = { inline_keyboard: [[{ text: "🇷🇺 Русский", callback_data: "lang:ru" }, { text: "🇰🇬 Кыргызча", callback_data: "lang:ky" }, { text: "🇬🇧 English", callback_data: "lang:en" }]] };

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
const sizeText = (l) => {
  const T = tx(l);
  const rows = CATALOG.sizeChart.map((r) => `${r.size.padEnd(5)}${r.chest.padEnd(9)}${r.waist.padEnd(9)}${r.hips}`);
  return `<b>${T.sizeTitle}</b>\n<pre>${T.sizeHead}\n${rows.join("\n")}</pre>\n${T.sizeTip}`;
};
const deliveryText = (l) => { const T = tx(l); return T.delivery(T.deliv.pickup, T.deliv.courier, T.deliv.region); };
const lineText = (i, l) => {
  const p = PRODUCTS.get(i.pid);
  return `• ${p ? pTitle(p, l) : i.title}${i.size ? ` · ${i.size}` : ""}${i.color ? ` · ${cName(i.color, l)}` : ""} × ${i.qty}${i.price ? ` — ${money(i.price * i.qty)}` : ""}`;
};

function productCaption(p, l) {
  const T = tx(l);
  const avail = p.sizes.filter((s) => !(p.soldOut || []).includes(s));
  const lines = [
    `<b>${esc(pTitle(p, l))}</b>`,
    loc(p, l, "subtitle") ? `<i>${esc(loc(p, l, "subtitle"))}</i>` : null,
    "",
    `${T.price} ${esc(priceOf(p, l))}`,
    p.sizes.length ? `${T.sizes}: ${esc(avail.join(", "))}` : null,
    p.colors.length ? `${T.colors}: ${esc(p.colors.map((c) => cName(c, l)).join(", "))}` : null,
    p.inStock ? T.inStock : T.preorder,
    "",
    esc(loc(p, l, "desc") || ""),
    p.includes ? `\n${T.includes}: ${esc((loc(p, l, "includes") || p.includes).join(", "))}` : null,
  ];
  return lines.filter((x) => x !== null).join("\n").replace(/\n{3,}/g, "\n\n").slice(0, 1000);
}

// ---------- Клиент
async function clientMessage(msg) {
  const chatId = msg.chat.id;
  const text = (msg.text || "").trim();
  let l = await getLang(chatId, msg.from);
  let T = tx(l);

  if (text.startsWith("/start")) {
    const param = text.split(" ")[1] || "";
    const m = param.match(/^(ESS-\d{6})_([A-Za-z0-9_-]{16})$/);
    if (m) {
      const o = await orders().get(m[1]);
      if (o && sameKey(m[2], o.key)) {
        if (o.lang && !(await misc().get(`lang/${chatId}`))) { l = normLang(o.lang); T = tx(l); await setLang(chatId, l); }
        await linkOrderToChat(o, chatId);
        await send(OWNER(), `🔗 Клиент по заказу <b>${esc(o.id)}</b> подключил Telegram — будет получать статусы.`);
        let t = T.linked(esc(o.id), esc(T.status[o.status]));
        if (o.status === "accepted") t += `\n\n${clientText("accepted", { ...o, lang: l })}`;
        return send(chatId, t, { reply_markup: MENU(l) });
      }
    }
    const pm = param.match(/^p_([a-z0-9-]{2,40})$/);
    if (pm && PRODUCTS.has(pm[1])) return showProduct(chatId, PRODUCTS.get(pm[1]), l);
    await clearState(chatId);
    if (!(await misc().get(`lang/${chatId}`))) { await setLang(chatId, l); await send(chatId, T.langPick, { reply_markup: LANG_KB }); }
    return send(chatId, T.hello(esc(msg.from?.first_name || T.friend)), { reply_markup: MENU(l) });
  }
  if (text === "/myid") return send(chatId, `Chat id: <code>${chatId}</code>`);
  if (text === "/menu" || text === "/help") { await clearState(chatId); return send(chatId, T.mainMenu, { reply_markup: MENU(l) }); }
  if (text === "/lang") return send(chatId, T.langPick, { reply_markup: LANG_KB });
  if (text === "/catalog") return showCategories(chatId, l);
  if (text === "/my") return showMy(chatId, l);
  if (text === "/size") return send(chatId, sizeText(l));

  const st = await getState(chatId);
  if (st?.step === "phone") return finishQuickOrder(msg, st, msg.contact?.phone_number || text, l);
  if (st?.step === "talk") {
    await clearState(chatId);
    await forwardToOwner(msg, `💬 Сообщение от клиента [${l}]`);
    return send(chatId, T.talkDone, { reply_markup: MENU(l) });
  }

  // Любое другое сообщение — автоответ + пересылка владельцу (например, скриншот оплаты)
  await forwardToOwner(msg, msg.photo ? `🧾 Фото от клиента (возможно, чек) [${l}]` : `💬 Сообщение боту [${l}]`);
  return send(chatId, msg.photo ? T.thanksPhoto : T.thanks, { reply_markup: MENU(l) });
}

async function showCategories(chatId, l) {
  const T = tx(l);
  const rows = [];
  for (let i = 0; i < CATALOG.categories.length; i += 2) {
    rows.push(CATALOG.categories.slice(i, i + 2).map((c) => ({ text: loc(c, l, "title"), callback_data: `c:${c.id}` })));
  }
  rows.push([{ text: T.allOnSite, url: site("#/catalog", l) }]);
  return send(chatId, T.catTitle, { reply_markup: { inline_keyboard: rows } });
}

async function showProduct(chatId, p, l) {
  const T = tx(l);
  const kb = { inline_keyboard: [
    [{ text: T.orderInChat, callback_data: `q:${p.id}` }],
    [{ text: T.openOnSite, url: site(`#/p/${p.id}`, l) }],
  ] };
  const photo = p.images?.[0] ? `${SITE()}/img/p/${p.images[0]}` : null;
  if (photo && SITE().startsWith("https://")) {
    const r = await tg("sendPhoto", { chat_id: chatId, photo, caption: productCaption(p, l), parse_mode: "HTML", reply_markup: kb });
    if (r?.ok) return r;
  }
  return send(chatId, productCaption(p, l), { reply_markup: kb });
}

async function showMy(chatId, l) {
  const T = tx(l);
  const ids = (await misc().get(`my/${chatId}`)) || [];
  if (!ids.length) return send(chatId, T.noOrders, { reply_markup: { inline_keyboard: [[{ text: T.menuCatalog, callback_data: "m:cat" }]] } });
  const list = (await Promise.all(ids.map((id) => orders().get(id)))).filter(Boolean);
  return send(chatId, list.map((o) => `<b>${esc(o.id)}</b> · ${esc(T.status[o.status])}\n${(o.items || []).map((i) => esc(lineText(i, l))).join("\n")}\n<a href="${esc(statusLink(o))}">${T.orderPage}</a>`).join("\n\n"));
}

async function askPhone(chatId, st, l) {
  const T = tx(l);
  await setState(chatId, { ...st, step: "phone" });
  const p = PRODUCTS.get(st.pid);
  const what = `${esc(pTitle(p, l))}${st.size ? ` · ${esc(st.size)}` : ""}${st.color ? ` · ${esc(cName(st.color, l))}` : ""}`;
  return send(chatId, T.askPhone(what), {
    reply_markup: { keyboard: [[{ text: T.sendPhone, request_contact: true }]], resize_keyboard: true, one_time_keyboard: true },
  });
}

async function finishQuickOrder(msg, st, phone, l) {
  const T = tx(l);
  const chatId = msg.chat.id;
  const from = msg.from || {};
  const name = [from.first_name, from.last_name].filter(Boolean).join(" ") || "Клиент";
  const v = validateOrder({
    items: [{ pid: st.pid, size: st.size || "", color: st.color || "", qty: 1 }],
    name, phone: String(phone || ""), quick: true, lang: l,
    comment: from.username ? `Telegram @${from.username}` : "",
  });
  if (!v.ok) return send(chatId, `⚠️ ${esc(v.error)}`);
  const o = await saveNewOrder(v.order, "Telegram-бот", chatId);
  await linkOrderToChat(o, chatId);
  await clearState(chatId);
  await send(chatId, T.phoneOk, { reply_markup: { remove_keyboard: true } });
  return send(chatId, T.ordered(esc(o.id), esc(lineText(o.items[0], l)), esc(statusLink(o))), { reply_markup: MENU(l) });
}

async function clientCallback(cb) {
  const chatId = cb.message.chat.id;
  const d = cb.data || "";
  if (d.startsWith("lang:")) {
    const nl = normLang(d.slice(5));
    await setLang(chatId, nl);
    return send(chatId, tx(nl).langSet, { reply_markup: MENU(nl) });
  }
  const l = await getLang(chatId, cb.from);
  const T = tx(l);

  if (d === "m:lang") return send(chatId, T.langPick, { reply_markup: LANG_KB });
  if (d === "m:cat") return showCategories(chatId, l);
  if (d === "m:size") return send(chatId, sizeText(l));
  if (d === "m:delivery") return send(chatId, deliveryText(l));
  if (d === "m:my") return showMy(chatId, l);
  if (d === "m:talk") {
    await setState(chatId, { step: "talk" });
    return send(chatId, T.talkAsk);
  }
  if (d.startsWith("c:")) {
    const cat = CATALOG.categories.find((c) => c.id === d.slice(2));
    if (!cat) return;
    const list = CATALOG.products.filter((p) => p.cat === cat.id);
    return send(chatId, `<b>${esc(loc(cat, l, "title"))}</b>\n\n${list.map((p) => `• ${esc(pTitle(p, l))} — ${esc(priceOf(p, l))}`).join("\n")}\n\n${T.tapProduct}`, {
      reply_markup: { inline_keyboard: [...list.map((p) => [{ text: pTitle(p, l), callback_data: `p:${p.id}` }]), [{ text: T.back, callback_data: "m:cat" }]] },
    });
  }
  if (d.startsWith("p:")) {
    const p = PRODUCTS.get(d.slice(2));
    return p ? showProduct(chatId, p, l) : undefined;
  }
  // Заказ в чате: q:<id> → размер → цвет → телефон
  if (d.startsWith("q:")) {
    const [, pid, si, ci] = d.split(":");
    const p = PRODUCTS.get(pid);
    if (!p) return;
    const sizes = p.sizes.filter((s) => !(p.soldOut || []).includes(s));
    if (p.sizes.length && si === undefined) {
      if (!sizes.length) return send(chatId, T.soldOut);
      const rows = [];
      for (let i = 0; i < sizes.length; i += 3) rows.push(sizes.slice(i, i + 3).map((s) => ({ text: s, callback_data: `q:${pid}:${p.sizes.indexOf(s)}` })));
      rows.push([{ text: T.menuSize, callback_data: "m:size" }]);
      return send(chatId, T.pickSize(esc(pTitle(p, l))), { reply_markup: { inline_keyboard: rows } });
    }
    const size = p.sizes.length ? p.sizes[Number(si)] : "";
    if (p.sizes.length && !size) return;
    if (p.colors.length > 1 && ci === undefined) {
      return send(chatId, T.pickColor, { reply_markup: { inline_keyboard: [p.colors.map((c, i) => ({ text: cName(c, l), callback_data: `q:${pid}:${si ?? ""}:${i}` }))] } });
    }
    const color = p.colors.length > 1 ? p.colors[Number(ci)] : p.colors[0] || "";
    if (p.colors.length && !color) return;
    return askPhone(chatId, { pid, size, color }, l);
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
    if (r?.ok) {
      await send(target, tx(await getLang(target)).managerReply);
      return send(chatId, "✅ Отправлено клиенту.");
    }
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
  if (text === "/start" || text === "/help") await send(chatId, OWNER_HELP);
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


