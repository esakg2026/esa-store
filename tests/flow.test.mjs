// Автотесты магазина: хранилище — в памяти, Telegram API подменён заглушкой.
// Запуск: npm test
import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";

delete process.env.DATABASE_URL;
const sent = [];
let msgId = 1000;
globalThis.fetch = async (url, opts) => {
  const method = String(url).split("/").pop();
  sent.push({ method, ...JSON.parse(opts.body) });
  return { json: async () => ({ ok: true, result: { message_id: ++msgId } }) };
};
Object.assign(process.env, {
  TG_BOT_TOKEN: "test-token", TG_OWNER_CHAT_ID: "111", TG_WEBHOOK_SECRET: "s3cret",
  TG_BOT_USERNAME: "esa_store_test_bot", PAY_INFO: "MBank / Optima +996 222 063 616", URL: "https://store.example",
  ADMIN_TOKEN: "admin-test-token-abcdefghijklmnop",
});

const order = (await import("../api/order.mjs")).default;
const products = (await import("../api/products.mjs")).default;
const bot = (await import("../api/telegram.mjs")).default;
const admin = (await import("../api/admin.mjs")).default;

const ctx = (ip = "1.1.1.1") => ({ ip });
const post = (path, body, headers = {}) => new Request(`https://store.example${path}`, { method: "POST", headers: { "content-type": "application/json", ...headers }, body: JSON.stringify(body) });
const get = (path) => new Request(`https://store.example${path}`);
const adminReq = (path, body, tok = process.env.ADMIN_TOKEN) => new Request(`https://store.example${path}`, {
  method: body ? "POST" : "GET", headers: { "content-type": "application/json", authorization: `Bearer ${tok}` }, body: body ? JSON.stringify(body) : undefined });
const tgUpdate = (u) => bot(post("/api/telegram", u, { "x-telegram-bot-api-secret-token": "s3cret" }));
const msg = (chatId, text, extra = {}) => ({ message: { message_id: ++msgId, chat: { id: chatId, type: "private" }, from: { id: chatId, first_name: "Айбек" }, text, ...extra } });
const cb = (chatId, data) => ({ callback_query: { id: "cb" + msgId++, from: { id: chatId }, data, message: { message_id: 1, chat: { id: chatId } } } });

beforeEach(() => { sent.length = 0; });

const goodOrder = {
  name: "<b>Нурлан</b>", phone: "+996 555 123 456", city: "Ош", delivery: "courier", address: "ул. Ленина 1", comment: "Oversize <script>",
  items: [{ pid: "hoodie-black-series", size: "M", color: "black", qty: 2 }, { pid: "cap", size: "One size", color: "black", qty: 1 }],
};

test("каталог отдаётся без служебных полей, цены не выдуманы", async () => {
  const j = await (await products()).json();
  assert.ok(j.products.length >= 15);
  assert.equal(j._help, undefined);
  assert.equal(j.bot, "esa_store_test_bot");
  assert.ok(j.products.every((p) => p.price === null), "по умолчанию цен нет — «Цену уточняйте»");
});

test("заказ: проверка полей и корзины", async () => {
  const bad = async (patch, re) => {
    const r = await order(post("/api/order", { ...goodOrder, ...patch }), ctx("9.9.9.1"));
    assert.equal(r.status, 400); assert.match((await r.json()).error, re);
  };
  await bad({ items: [] }, /Корзина пуста/);
  await bad({ items: [{ pid: "nope", qty: 1 }] }, /не найден/);
  await bad({ items: [{ pid: "hoodie-black-series", size: "XXXL", color: "black", qty: 1 }] }, /размер/);
  await bad({ items: [{ pid: "hoodie-black-series", size: "M", color: "pink", qty: 1 }] }, /цвет/);
  await bad({ items: [{ pid: "hoodie-black-series", size: "M", color: "black", qty: 0 }] }, /количество/);
  await bad({ phone: "123" }, /телефон/);
  await bad({ address: "" }, /адрес/);
  const r = await order(post("/api/order", { ...goodOrder, website: "spam" }), ctx("9.9.9.2"));
  assert.equal(r.status, 200);
  assert.equal(sent.length, 0, "заказ из ловушки не уходит владельцу");
});

let siteOrder;
test("заказ с сайта: сохраняется, владелец получает карточку с кнопками и экранированием", async () => {
  const r = await order(post("/api/order", goodOrder), ctx("2.2.2.2"));
  assert.equal(r.status, 200);
  siteOrder = await r.json();
  assert.match(siteOrder.id, /^ESS-\d{6}$/);
  assert.ok(siteOrder.botLink.startsWith(`https://t.me/esa_store_test_bot?start=${siteOrder.id}_`));
  const card = sent.find((s) => s.method === "sendMessage" && s.chat_id === "111");
  assert.ok(card.text.includes("&lt;b&gt;Нурлан") && card.text.includes("&lt;script&gt;"));
  assert.ok(card.text.includes("Худи ESA Black Series · M · Чёрный × 2"));
  assert.ok(JSON.stringify(card.reply_markup).includes(`acc:${siteOrder.id}`));
});

test("статус: по ключу и по телефону; без ключа — нельзя; реквизиты скрыты до подтверждения", async () => {
  let r = await order(get(`/api/order?id=${siteOrder.id}&k=${siteOrder.key}`), ctx());
  let j = await r.json();
  assert.equal(j.status, "new"); assert.equal(j.payInfo, null); assert.equal(j.key, undefined);
  r = await order(get(`/api/order?id=${siteOrder.id}&phone=0555123456`), ctx());
  assert.equal(r.status, 200);
  r = await order(get(`/api/order?id=${siteOrder.id}&k=wrongwrongwrongw`), ctx());
  assert.equal(r.status, 404);
  r = await order(get(`/api/order?id=${siteOrder.id}&phone=0700000000`), ctx());
  assert.equal(r.status, 404);
});

test("бот: клиент подключает Telegram по ссылке, владелец подтверждает — клиент получает реквизиты", async () => {
  await tgUpdate(msg(222, `/start ${siteOrder.id}_${siteOrder.key}`));
  assert.ok(sent.some((s) => s.chat_id === 222 && s.text.includes("привязан")));
  sent.length = 0;
  await tgUpdate(msg(111, `/sum ${siteOrder.id} 5400`));
  await tgUpdate(cb(111, `acc:${siteOrder.id}`));
  const toClient = sent.find((s) => s.chat_id === 222);
  assert.ok(toClient.text.includes("подтверждён") && toClient.text.includes("+996 222 063 616") && toClient.text.includes("5 400"));
  const j = await (await order(get(`/api/order?id=${siteOrder.id}&k=${siteOrder.key}`), ctx())).json();
  assert.equal(j.status, "accepted"); assert.ok(j.payInfo.includes("222 063 616")); assert.equal(j.total, 5400); assert.equal(j.telegram, true);
});

test("бот: чужой человек не может менять статус", async () => {
  await tgUpdate(cb(333, `done:${siteOrder.id}`));
  const j = await (await order(get(`/api/order?id=${siteOrder.id}&k=${siteOrder.key}`), ctx())).json();
  assert.equal(j.status, "accepted");
  const r = await bot(post("/api/telegram", msg(1, "/start"), { "x-telegram-bot-api-secret-token": "bad" }));
  assert.equal(r.status, 403);
});

test("бот: заказ в чате — каталог → товар → размер → цвет → телефон", async () => {
  await tgUpdate(msg(444, "/start"));
  await tgUpdate(cb(444, "m:cat"));
  assert.ok(sent.some((s) => JSON.stringify(s.reply_markup || {}).includes("c:hoodies")));
  await tgUpdate(cb(444, "p:tee-classic"));
  assert.ok(sent.some((s) => s.method === "sendPhoto" && s.photo.endsWith("/img/p/tee.webp")));
  await tgUpdate(cb(444, "q:tee-classic"));
  await tgUpdate(cb(444, "q:tee-classic:3"));
  await tgUpdate(cb(444, "q:tee-classic:3:2"));
  sent.length = 0;
  await tgUpdate(msg(444, "", { contact: { phone_number: "+996700111222" } }));
  const card = sent.find((s) => s.chat_id === "111");
  assert.ok(card.text.includes("Футболка ESA · L · ESA Blue × 1"));
  assert.ok(sent.some((s) => s.chat_id === 444 && /оформлен/.test(s.text)));
});

test("приложение владельца: доступ по ключу, статус, сумма, удаление", async () => {
  let r = await admin(adminReq("/api/admin/data", null, "wrong-token-wrong-token-wrong"), ctx("5.5.5.5"));
  assert.equal(r.status, 401);
  r = await admin(adminReq("/api/admin/data"), ctx("5.5.5.5"));
  const d = await r.json();
  assert.ok(d.orders.length >= 2);
  assert.ok(d.orders.every((o) => o.key === undefined), "секретный ключ клиента не отдаётся");
  r = await admin(adminReq("/api/admin/status", { id: siteOrder.id, status: "paid" }), ctx("5.5.5.5"));
  assert.equal((await r.json()).clientNotified, true);
  r = await admin(adminReq("/api/admin/total", { id: siteOrder.id, total: 6000 }), ctx("5.5.5.5"));
  assert.equal((await r.json()).total, 6000);
  const j = await (await order(get(`/api/order?id=${siteOrder.id}&k=${siteOrder.key}`), ctx())).json();
  assert.equal(j.payInfo, null, "после оплаты реквизиты больше не показываются");
  r = await admin(adminReq("/api/admin/delete", { id: siteOrder.id }), ctx("5.5.5.5"));
  assert.equal(r.status, 200);
  r = await order(get(`/api/order?id=${siteOrder.id}&k=${siteOrder.key}`), ctx());
  assert.equal(r.status, 404);
});

test("лимит заказов с одного адреса", async () => {
  let last;
  for (let i = 0; i < 7; i++) last = await order(post("/api/order", goodOrder), ctx("7.7.7.7"));
  assert.equal(last.status, 429);
});
