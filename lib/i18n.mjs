// Тексты бота и уведомлений клиенту на трёх языках: ru / ky / en.
// Владельцу бот всегда пишет по-русски. Кыргызские тексты — проверить носителем языка.
export const LANGS = ["ru", "ky", "en"];
export const normLang = (l) => (LANGS.includes(l) ? l : String(l || "").startsWith("ky") ? "ky" : String(l || "").startsWith("en") ? "en" : "ru");

const ru = {
  menuCatalog: "🛍 Каталог", menuShop: "🌐 Открыть магазин", menuMy: "📦 Мои заказы", menuSize: "📏 Размерная сетка",
  menuDelivery: "🚚 Доставка и оплата", menuTalk: "💬 Менеджер", menuLang: "🌍 Язык / Тил / Language",
  hello: (name) => `Салам, ${name}! 👋\nЭто <b>ESA Store</b> — магазин бренда ESA.\n\n🏔 Коллекция <b>ESA Black Series 2026</b>: худи, футболки, куртки, брюки, аксессуары и гейминг.\n<i>Стиль. Технологии. Будущее.</i>\n\nЧто посмотрим?`,
  friend: "друг", mainMenu: "Главное меню:",
  linked: (id, st) => `✅ Заказ <b>${id}</b> привязан к этому чату.\n${st}\n\nСюда придут подтверждение, реквизиты для оплаты и статусы доставки.`,
  sizeTitle: "📏 Размерная сетка ESA (см)", sizeHead: "Разм Грудь    Талия    Бёдра", sizeTip: "Между размерами? Берите больший — или напишите менеджеру, подскажем.",
  delivery: (pick, cour, reg) => `<b>🚚 Доставка и оплата</b>\n\n• ${pick}\n• ${cour} — Ош, Бишкек\n• ${reg} — по всему Кыргызстану\n\nСтоимость и срок доставки менеджер сообщит при подтверждении заказа.\n\n💳 Оплата — переводом (MBank / Optima) <b>после подтверждения</b> заказа. Реквизиты придут сюда в чат и на страницу заказа.`,
  price: "💰", sizes: "📏 Размеры", colors: "🎨 Цвета", inStock: "✅ В наличии", preorder: "🕓 Под заказ", includes: "В комплекте",
  orderInChat: "⚡ Заказать в чате", openOnSite: "🛒 Открыть на сайте",
  catTitle: "<b>Каталог ESA Black Series 2026</b>\nВыберите категорию:", allOnSite: "🌐 Весь каталог на сайте", back: "⬅️ Категории",
  tapProduct: "Нажмите на товар, чтобы посмотреть фото:",
  noOrders: "У вас пока нет заказов. Посмотрим каталог?", orderPage: "Страница заказа",
  pickSize: (t) => `Выберите размер — <b>${t}</b>:`, pickColor: "Выберите цвет:", soldOut: "Этого товара сейчас нет в наличии 😔 Напишите менеджеру — сообщим о поступлении.",
  askPhone: (what) => `Отлично: <b>${what}</b>\n\nОтправьте номер телефона для связи — кнопкой ниже или напишите сообщением.`,
  sendPhone: "📱 Отправить мой номер", phoneOk: "Номер получил ✅",
  ordered: (id, line, link) => `🎉 Заказ <b>${id}</b> оформлен!\n${line}\n\nМенеджер свяжется с вами, уточнит доставку и подтвердит заказ. Реквизиты для оплаты придут сюда после подтверждения.\n\n<a href="${link}">Страница заказа</a>`,
  talkAsk: "Напишите сообщение — передам менеджеру ✍️", talkDone: "Передал менеджеру ✅ Ответ придёт сюда же.",
  thanks: "Спасибо! Менеджер ответит здесь, как только сможет 🙌", thanksPhoto: "Спасибо! Передал менеджеру — он проверит и обновит статус заказа ✅",
  managerReply: "↩️ <i>Это ответ менеджера ESA Store. Можно ответить прямо здесь.</i>",
  langPick: "Выберите язык / Тилди тандаңыз / Choose language:", langSet: "Язык: русский ✅",
  toPay: "К оплате", payBy: "💳 Оплата переводом:", payTip: "После оплаты пришлите сюда скриншот чека.", sumLater: "Менеджер сообщит точную сумму.",
  accepted: "✅ Ваш заказ <b>{id}</b> подтверждён!", paid: "💳 Оплата по заказу <b>{id}</b> получена. Собираем ваш заказ!",
  shippedPickup: "🚚 Заказ <b>{id}</b> готов к выдаче! Если есть вопросы — пишите сюда.", shipped: "🚚 Заказ <b>{id}</b> отправлен! Если есть вопросы — пишите сюда.",
  done: "🎉 Заказ <b>{id}</b> получен. Спасибо, что выбрали ESA! DREAM · CREATE · ACHIEVE 🏔",
  rejected: "Заказ <b>{id}</b> отменён. Если это ошибка — напишите сюда, разберёмся.", new: "🆕 Заказ <b>{id}</b> снова ожидает подтверждения.",
  status: { new: "🆕 Новый — ждёт подтверждения", accepted: "✅ Подтверждён — ожидается оплата", paid: "💳 Оплачен — собираем заказ", shipped: "🚚 Отправлен / готов к выдаче", done: "🎉 Получен", rejected: "❌ Отменён" },
  deliv: { pickup: "Самовывоз (Ош)", courier: "Курьер по городу", region: "Доставка в регион" },
};

const ky = {
  menuCatalog: "🛍 Каталог", menuShop: "🌐 Дүкөндү ачуу", menuMy: "📦 Менин буйрутмаларым", menuSize: "📏 Өлчөм таблицасы",
  menuDelivery: "🚚 Жеткирүү жана төлөм", menuTalk: "💬 Менеджер", menuLang: "🌍 Язык / Тил / Language",
  hello: (name) => `Салам, ${name}! 👋\nБул <b>ESA Store</b> — ESA брендинин дүкөнү.\n\n🏔 <b>ESA Black Series 2026</b> коллекциясы: худи, футболкалар, курткалар, шымдар, аксессуарлар жана гейминг.\n<i>Стиль. Технология. Келечек.</i>\n\nЭмнени көрөбүз?`,
  friend: "досум", mainMenu: "Башкы меню:",
  linked: (id, st) => `✅ <b>${id}</b> буйрутмасы ушул чатка туташтырылды.\n${st}\n\nБул жерге ырастоо, төлөм реквизиттери жана жеткирүү статустары келет.`,
  sizeTitle: "📏 ESA өлчөм таблицасы (см)", sizeHead: "Өлч  Төш      Бел      Жамбаш", sizeTip: "Эки өлчөмдүн ортосундасызбы? Чоңун алыңыз — же менеджерге жазыңыз, кеңеш беребиз.",
  delivery: (pick, cour, reg) => `<b>🚚 Жеткирүү жана төлөм</b>\n\n• ${pick}\n• ${cour} — Ош, Бишкек\n• ${reg} — бүт Кыргызстан боюнча\n\nЖеткирүүнүн баасын жана мөөнөтүн менеджер буйрутманы ырастоодо айтат.\n\n💳 Төлөм — которуу менен (MBank / Optima) буйрутма <b>ырасталгандан кийин</b>. Реквизиттер ушул чатка жана буйрутма барагына келет.`,
  price: "💰", sizes: "📏 Өлчөмдөр", colors: "🎨 Түстөр", inStock: "✅ Бар", preorder: "🕓 Буйрутма менен", includes: "Комплектте",
  orderInChat: "⚡ Чатта буйрутма берүү", openOnSite: "🛒 Сайтта ачуу",
  catTitle: "<b>ESA Black Series 2026 каталогу</b>\nКатегорияны тандаңыз:", allOnSite: "🌐 Бардык каталог сайтта", back: "⬅️ Категориялар",
  tapProduct: "Сүрөтүн көрүү үчүн товарды басыңыз:",
  noOrders: "Сизде азырынча буйрутма жок. Каталогду карайлыбы?", orderPage: "Буйрутма барагы",
  pickSize: (t) => `Өлчөмдү тандаңыз — <b>${t}</b>:`, pickColor: "Түстү тандаңыз:", soldOut: "Бул товар азыр жок 😔 Менеджерге жазыңыз — келгенде кабарлайбыз.",
  askPhone: (what) => `Сонун: <b>${what}</b>\n\nБайланыш үчүн телефон номериңизди жөнөтүңүз — төмөнкү баскыч менен же билдирүү кылып жазыңыз.`,
  sendPhone: "📱 Номеримди жөнөтүү", phoneOk: "Номер алынды ✅",
  ordered: (id, line, link) => `🎉 <b>${id}</b> буйрутмасы кабыл алынды!\n${line}\n\nМенеджер сиз менен байланышып, жеткирүүнү тактап, буйрутманы ырастайт. Төлөм реквизиттери ырасталгандан кийин ушул жерге келет.\n\n<a href="${link}">Буйрутма барагы</a>`,
  talkAsk: "Билдирүү жазыңыз — менеджерге жеткирем ✍️", talkDone: "Менеджерге жеткирдим ✅ Жооп ушул жерге келет.",
  thanks: "Рахмат! Менеджер мүмкүн болушунча тез ушул жерде жооп берет 🙌", thanksPhoto: "Рахмат! Менеджерге жеткирдим — текшерип, буйрутманын статусун жаңыртат ✅",
  managerReply: "↩️ <i>Бул ESA Store менеджеринин жообу. Ушул жерден жооп берсеңиз болот.</i>",
  langPick: "Выберите язык / Тилди тандаңыз / Choose language:", langSet: "Тил: кыргызча ✅",
  toPay: "Төлөөгө", payBy: "💳 Которуу менен төлөө:", payTip: "Төлөгөндөн кийин чектин скриншотун ушул жерге жөнөтүңүз.", sumLater: "Менеджер так сумманы айтат.",
  accepted: "✅ <b>{id}</b> буйрутмаңыз ырасталды!", paid: "💳 <b>{id}</b> буйрутмасы үчүн төлөм алынды. Буйрутмаңызды чогултуп жатабыз!",
  shippedPickup: "🚚 <b>{id}</b> буйрутмасы алууга даяр! Суроолор болсо — ушул жерге жазыңыз.", shipped: "🚚 <b>{id}</b> буйрутмасы жөнөтүлдү! Суроолор болсо — ушул жерге жазыңыз.",
  done: "🎉 <b>{id}</b> буйрутмасы алынды. ESAны тандаганыңыз үчүн рахмат! DREAM · CREATE · ACHIEVE 🏔",
  rejected: "<b>{id}</b> буйрутмасы жокко чыгарылды. Эгер бул ката болсо — ушул жерге жазыңыз, чечебиз.", new: "🆕 <b>{id}</b> буйрутмасы кайрадан ырастоону күтүүдө.",
  status: { new: "🆕 Жаңы — ырастоону күтүүдө", accepted: "✅ Ырасталды — төлөм күтүлүүдө", paid: "💳 Төлөндү — буйрутманы чогултуп жатабыз", shipped: "🚚 Жөнөтүлдү / алууга даяр", done: "🎉 Алынды", rejected: "❌ Жокко чыгарылды" },
  deliv: { pickup: "Өзүңүз алып кетүү (Ош)", courier: "Шаар ичинде курьер", region: "Аймакка жеткирүү" },
};

const en = {
  menuCatalog: "🛍 Catalog", menuShop: "🌐 Open the store", menuMy: "📦 My orders", menuSize: "📏 Size chart",
  menuDelivery: "🚚 Delivery & payment", menuTalk: "💬 Manager", menuLang: "🌍 Язык / Тил / Language",
  hello: (name) => `Hi, ${name}! 👋\nThis is <b>ESA Store</b> — the official ESA brand store.\n\n🏔 The <b>ESA Black Series 2026</b> collection: hoodies, T-shirts, jackets, pants, accessories and gaming gear.\n<i>Style. Technology. Future.</i>\n\nWhat would you like to see?`,
  friend: "friend", mainMenu: "Main menu:",
  linked: (id, st) => `✅ Order <b>${id}</b> is now linked to this chat.\n${st}\n\nYou'll get the confirmation, payment details and delivery updates here.`,
  sizeTitle: "📏 ESA size chart (cm)", sizeHead: "Size Chest    Waist    Hips", sizeTip: "Between sizes? Take the larger one — or message the manager for advice.",
  delivery: (pick, cour, reg) => `<b>🚚 Delivery & payment</b>\n\n• ${pick}\n• ${cour} — Osh, Bishkek\n• ${reg} — anywhere in Kyrgyzstan\n\nThe manager will tell you the delivery cost and timing when confirming your order.\n\n💳 Payment by bank transfer (MBank / Optima) <b>after the order is confirmed</b>. The payment details will arrive here and on your order page.`,
  price: "💰", sizes: "📏 Sizes", colors: "🎨 Colors", inStock: "✅ In stock", preorder: "🕓 Made to order", includes: "Includes",
  orderInChat: "⚡ Order in chat", openOnSite: "🛒 Open on the website",
  catTitle: "<b>ESA Black Series 2026 catalog</b>\nChoose a category:", allOnSite: "🌐 Full catalog on the website", back: "⬅️ Categories",
  tapProduct: "Tap an item to see photos:",
  noOrders: "You have no orders yet. Shall we look at the catalog?", orderPage: "Order page",
  pickSize: (t) => `Choose a size — <b>${t}</b>:`, pickColor: "Choose a color:", soldOut: "This item is out of stock right now 😔 Message the manager and we'll let you know when it's back.",
  askPhone: (what) => `Great: <b>${what}</b>\n\nSend your phone number so we can contact you — tap the button below or type it.`,
  sendPhone: "📱 Share my number", phoneOk: "Got your number ✅",
  ordered: (id, line, link) => `🎉 Order <b>${id}</b> placed!\n${line}\n\nThe manager will contact you, arrange delivery and confirm the order. Payment details will arrive here after confirmation.\n\n<a href="${link}">Order page</a>`,
  talkAsk: "Type your message — I'll pass it to the manager ✍️", talkDone: "Sent to the manager ✅ The reply will come here.",
  thanks: "Thank you! The manager will reply here as soon as possible 🙌", thanksPhoto: "Thank you! I've passed it to the manager — they'll check it and update your order status ✅",
  managerReply: "↩️ <i>This is a reply from the ESA Store manager. You can answer right here.</i>",
  langPick: "Выберите язык / Тилди тандаңыз / Choose language:", langSet: "Language: English ✅",
  toPay: "Amount due", payBy: "💳 Pay by bank transfer:", payTip: "After paying, send a screenshot of the receipt here.", sumLater: "The manager will tell you the exact amount.",
  accepted: "✅ Your order <b>{id}</b> is confirmed!", paid: "💳 Payment for order <b>{id}</b> received. We're packing your order!",
  shippedPickup: "🚚 Order <b>{id}</b> is ready for pickup! Any questions — message us here.", shipped: "🚚 Order <b>{id}</b> has been shipped! Any questions — message us here.",
  done: "🎉 Order <b>{id}</b> delivered. Thank you for choosing ESA! DREAM · CREATE · ACHIEVE 🏔",
  rejected: "Order <b>{id}</b> has been cancelled. If this is a mistake, message us here and we'll sort it out.", new: "🆕 Order <b>{id}</b> is awaiting confirmation again.",
  status: { new: "🆕 New — awaiting confirmation", accepted: "✅ Confirmed — awaiting payment", paid: "💳 Paid — packing your order", shipped: "🚚 Shipped / ready for pickup", done: "🎉 Delivered", rejected: "❌ Cancelled" },
  deliv: { pickup: "Pickup (Osh)", courier: "City courier", region: "Regional delivery" },
};

export const TXT = { ru, ky, en };
export const tx = (lang) => TXT[normLang(lang)];

// Название товара / категории / цвета на нужном языке (переводы из products.json)
export const loc = (obj, lang, field = "title") => {
  const l = normLang(lang);
  if (l === "ru" || !obj) return obj?.[field];
  const v = obj[l];
  if (v && typeof v === "object") return v[field] ?? obj[field];
  if (typeof v === "string") return v; // категории и цвета: "ky": "..."
  return obj[field];
};
