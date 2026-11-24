// Одноразовая настройка бота: POST /api/tg-setup с заголовком x-setup-secret = TG_WEBHOOK_SECRET.
// Регистрирует адрес webhook, команды и описание бота.
import { json, tg, SITE } from "../lib/core.mjs";

const CMDS = {
  ru: [{ command: "start", description: "Главное меню" }, { command: "catalog", description: "Каталог ESA Black Series" }, { command: "my", description: "Мои заказы" }, { command: "size", description: "Размерная сетка" }, { command: "lang", description: "Язык / Тил / Language" }],
  ky: [{ command: "start", description: "Башкы меню" }, { command: "catalog", description: "ESA Black Series каталогу" }, { command: "my", description: "Менин буйрутмаларым" }, { command: "size", description: "Өлчөм таблицасы" }, { command: "lang", description: "Язык / Тил / Language" }],
  en: [{ command: "start", description: "Main menu" }, { command: "catalog", description: "ESA Black Series catalog" }, { command: "my", description: "My orders" }, { command: "size", description: "Size chart" }, { command: "lang", description: "Язык / Тил / Language" }],
};
const DESC = {
  ru: "ESA Store — магазин бренда ESA. Коллекция ESA Black Series 2026: худи, футболки, куртки, брюки, аксессуары и гейминг. Заказ на сайте или здесь, статусы заказа — в этом чате. DREAM · CREATE · ACHIEVE",
  ky: "ESA Store — ESA брендинин дүкөнү. ESA Black Series 2026 коллекциясы: худи, футболкалар, курткалар, шымдар, аксессуарлар жана гейминг. Буйрутманы сайтта же ушул жерде бериңиз, статустар ушул чатка келет. DREAM · CREATE · ACHIEVE",
  en: "ESA Store — the official ESA brand store. ESA Black Series 2026: hoodies, T-shirts, jackets, pants, accessories and gaming gear. Order on the website or right here; order updates come to this chat. DREAM · CREATE · ACHIEVE",
};
const SHORT = {
  ru: "Магазин ESA: одежда и аксессуары ESA Black Series 2026. Ош, Кыргызстан.",
  ky: "ESA дүкөнү: ESA Black Series 2026 кийимдери жана аксессуарлары. Ош, Кыргызстан.",
  en: "ESA store: ESA Black Series 2026 apparel & accessories. Osh, Kyrgyzstan.",
};

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
    commands: await tg("setMyCommands", { commands: CMDS.ru }),
    commandsKy: await tg("setMyCommands", { commands: CMDS.ky, language_code: "ky" }),
    commandsEn: await tg("setMyCommands", { commands: CMDS.en, language_code: "en" }),
    description: await tg("setMyDescription", { description: DESC.ru }),
    descriptionKy: await tg("setMyDescription", { description: DESC.ky, language_code: "ky" }),
    descriptionEn: await tg("setMyDescription", { description: DESC.en, language_code: "en" }),
    short: await tg("setMyShortDescription", { short_description: SHORT.ru }),
    shortKy: await tg("setMyShortDescription", { short_description: SHORT.ky, language_code: "ky" }),
    shortEn: await tg("setMyShortDescription", { short_description: SHORT.en, language_code: "en" }),
  };
  return json({ ok: true, results });
};
