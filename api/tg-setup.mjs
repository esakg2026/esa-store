// Одноразовая настройка бота: POST /api/tg-setup с заголовком x-setup-secret = TG_WEBHOOK_SECRET.
// Регистрирует адрес webhook, команды и описание бота.
import { json, tg, SITE } from "../lib/core.mjs";

export default async (req) => {
  const secret = process.env.TG_WEBHOOK_SECRET;
  if (req.method !== "POST" || !secret || req.headers.get("x-setup-secret") !== secret) return json({ error: "forbidden" }, 403);
  const base = SITE();
  const results = {
    webhook: await tg("setWebhook", {
      url: `${base}/api/telegram`,
      secret_token: secret,
      allowed_updates: ["message", "callback_query"],
      drop_pending_updates: true,
    }),
    commands: await tg("setMyCommands", {
      commands: [
        { command: "start", description: "Главное меню" },
        { command: "catalog", description: "Каталог ESA Black Series" },
        { command: "my", description: "Мои заказы" },
        { command: "size", description: "Размерная сетка" },
      ],
    }),
    description: await tg("setMyDescription", {
      description: "ESA Store — магазин бренда ESA. Коллекция ESA Black Series 2026: худи, футболки, куртки, брюки, аксессуары и гейминг. Заказ на сайте или здесь, статусы заказа — в этом чате. DREAM · CREATE · ACHIEVE",
    }),
    short: await tg("setMyShortDescription", { short_description: "Магазин ESA: одежда и аксессуары ESA Black Series 2026. Ош, Кыргызстан." }),
  };
  return json({ ok: true, results });
};
