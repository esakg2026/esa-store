// ESA Store — витрина без библиотек. Данные выводятся через textContent (без innerHTML для данных).
"use strict";
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
function h(tag, props = {}, ...kids) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (v == null || v === false) continue;
    if (k === "class") n.className = v;
    else if (k === "text") n.textContent = v;
    else if (k.startsWith("on")) n.addEventListener(k.slice(2), v);
    else if (k === "style") n.style.cssText = v; // через CSSOM — разрешено политикой CSP
    else if (k in n && k !== "list") n[k] = v;
    else n.setAttribute(k, v === true ? "" : v);
  }
  for (const k of kids.flat(3)) if (k != null && k !== false) n.append(k.nodeType ? k : String(k));
  return n;
}
const svgIcon = (d) => { const s = document.createElementNS("http://www.w3.org/2000/svg", "svg"); s.setAttribute("viewBox", "0 0 24 24"); s.setAttribute("aria-hidden", "true"); const p = document.createElementNS("http://www.w3.org/2000/svg", "path"); p.setAttribute("d", d); s.append(p); return s; };

const store = {
  get(k, d) { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
};

let C = null; // каталог
const P = new Map();
const img = (f) => `/img/p/${f}`;
const colorOf = (id) => C.colors[id] || { name: id, hex: "#333" };
const money = (n) => `${Number(n).toLocaleString("ru-RU")} ${C.currency}`;
const hasPrice = (p) => typeof p.price === "number" && p.price > 0;
const priceText = (p) => (hasPrice(p) ? money(p.price) : t("Цену уточняйте"));
const catTitle = (id) => C.categories.find((c) => c.id === id)?.title || "";

// ---------- Корзина
let cart = store.get("esa_cart", []);
const lineKey = (l) => `${l.pid}|${l.size}|${l.color}`;
function saveCart() {
  cart = cart.filter((l) => P.has(l.pid));
  store.set("esa_cart", cart);
  const n = cart.reduce((s, l) => s + l.qty, 0);
  $$("[data-cart-count]").forEach((e) => { e.textContent = n; e.hidden = !n; });
}
function addToCart(item) {
  const ex = cart.find((l) => lineKey(l) === lineKey(item));
  if (ex) ex.qty = Math.min(20, ex.qty + item.qty); else cart.push(item);
  saveCart();
}
const myOrders = () => store.get("esa_orders", []);
function rememberOrder(id, key) { store.set("esa_orders", [{ id, key, at: Date.now() }, ...myOrders().filter((o) => o.id !== id)].slice(0, 20)); }

// ---------- Уведомление
let toastT;
function toast(text, link) {
  const t = $("#toast");
  t.replaceChildren(...[h("span", { text }), link ? h("a", { href: link.href, text: link.text }) : null].filter(Boolean));
  t.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => (t.hidden = true), 3200);
}

// ---------- API
async function api(path, opts) {
  const r = await fetch(path, opts);
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(t(j.error || "Нет связи с сервером. Попробуйте ещё раз."));
  return j;
}

// ---------- Компоненты
function productCard(p) {
  return h("a", { class: "card", href: `#/p/${p.id}` },
    h("div", { class: "ph" },
      h("img", { src: img(p.images[0]), alt: p.title, loading: "lazy", decoding: "async", width: 400, height: 500 }),
      p.inStock ? (p.featured ? h("span", { class: "tag", text: "Black Series" }) : null) : h("span", { class: "tag pre", text: t("Под заказ") })),
    h("div", { class: "t", text: p.title }),
    h("div", { class: "p" + (hasPrice(p) ? " has" : ""), text: priceText(p) }),
    p.colors.length > 1 ? h("div", { class: "sw" }, p.colors.map((c) => h("span", { class: "dot", style: `background:${colorOf(c).hex}`, title: colorOf(c).name }))) : null);
}
function secHead(title, en, link) {
  return h("div", { class: "sec-head" }, h("h2", {}, title, en ? h("span", { class: "en", text: en }) : null), link ? h("a", { href: link[0], text: link[1] }) : null);
}
const ICONS = {
  gem: "M6 3h12l3 6-9 12L3 9l3-6Zm-3 6h18M9 3l3 18 3-18",
  truck: "M3 7h11v9H3zM14 10h4l3 3v3h-7zM7 19a2 2 0 1 0 0-.01M17 19a2 2 0 1 0 0-.01",
  shield: "M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6l-8-3Zm-3.5 9 2.5 2.5L16 10",
};
const perk = (icon, text) => h("div", { class: "perk" }, svgIcon(ICONS[icon]), text);

// ---------- Страницы
const view = () => $("#view");
function setPage(nodes, { title, tab, buybar = false } = {}) {
  document.title = title ? `${title} — ESA Store` : t("ESA Store — одежда и аксессуары ESA Black Series 2026");
  view().replaceChildren(...[nodes].flat());
  document.body.classList.toggle("has-buybar", buybar);
  $$(".tabbar a").forEach((a) => a.classList.toggle("on", a.dataset.tab === tab));
  $$(".nav a").forEach((a) => a.classList.toggle("on", location.hash.startsWith(a.getAttribute("href"))));
}

function pageHome() {
  const featured = C.products.filter((p) => p.featured);
  const set = P.get("complete-set");
  const catImg = (id) => C.products.find((p) => p.cat === id)?.images[0];
  setPage([
    h("section", { class: "hero" },
      h("img", { class: "hero-bg", src: "/img/p/backview.webp", alt: "", fetchpriority: "high" }),
      h("div", { class: "hero-in" },
        h("div", { class: "badge-blue" }, h("span", { text: "ESA BLACK SERIES 2026" })),
        h("p", { class: "slogan", text: "DREAM · CREATE · ACHIEVE" }),
        h("h1", {}, t("ESA — больше, чем бренд")),
        h("p", { class: "lead", text: t("Стиль. Технологии. Будущее. Одежда для тех, кто стремится к большему.") }),
        h("div", { class: "cta" },
          h("a", { class: "btn btn-blue", href: "#/catalog", text: t("Перейти в каталог →") }),
          h("a", { class: "btn btn-ghost", href: "#/p/complete-set", text: t("Полный комплект") })))),
    h("div", { class: "wrap" },
      h("div", { class: "perks" }, perk("gem", t("Премиальное качество")), perk("truck", t("Доставка по Кыргызстану")), perk("shield", t("Оплата после подтверждения"))),
      h("section", { class: "block" }, secHead(t("Коллекции"), "ESA Collections", ["#/catalog", t("Весь каталог →")]),
        h("div", { class: "cats" }, C.categories.map((c) => h("a", { class: "cat", href: `#/catalog?cat=${c.id}` },
          h("img", { src: img(catImg(c.id)), alt: "", loading: "lazy" }), h("span", {}, c.title, h("small", { text: c.en }))))) ),
      h("section", { class: "block" }, secHead(t("Хиты Black Series"), "Bestsellers", ["#/catalog", t("Смотреть все →")]),
        h("div", { class: "rail" }, featured.map(productCard))),
      set ? h("section", { class: "block" },
        h("div", { class: "set" },
          h("img", { src: img("set.webp"), alt: set.title, loading: "lazy" }),
          h("div", {},
            h("p", { class: "slogan", text: "COMPLETE SET №01" }),
            h("h2", { text: t("Полный комплект ESA") }),
            h("p", { class: "muted", text: t("Всё сразу в фирменной коробке — образ ESA с головы до ног.") }),
            h("ul", { class: "checks" }, (set.includes || []).map((t) => h("li", { text: t }))),
            h("a", { class: "btn btn-blue", href: "#/p/complete-set", text: t("Собрать комплект") })))) : null),
    h("div", { class: "band" }, h("b", { text: "DREAM · CREATE · ACHIEVE" }), h("span", { text: t("Стиль нового поколения из Оша") })),
    h("div", { class: "wrap" },
      h("section", { class: "block look" },
        h("img", { src: img("models.webp"), alt: t("Лукбук ESA Black Series"), loading: "lazy" }),
        h("div", {}, secHead(t("Лукбук 2026"), "Styles & fit"),
          h("p", { class: "muted", text: t("Oversize, Regular, Slim Fit и Classic — подберите посадку под себя. Размеры XS–XXL, точная размерная сетка — на странице каждого товара.") }),
          h("button", { class: "btn", onclick: () => openSizes(), text: t("Размерная сетка") }), " ",
          h("a", { class: "btn btn-ghost", href: "#/about", text: t("О бренде") })))),
  ], { tab: "home" });
}

function parseQuery(q) { return Object.fromEntries(new URLSearchParams(q || "")); }
function pageCatalog(q) {
  const f = { cat: q.cat || "", size: q.size || "", color: q.color || "", stock: q.stock || "" };
  const go = (patch) => { const n = { ...f, ...patch }; const s = new URLSearchParams(Object.entries(n).filter(([, v]) => v)).toString(); location.hash = `#/catalog${s ? "?" + s : ""}`; };
  let list = C.products.filter((p) => (!f.cat || p.cat === f.cat) && (!f.size || p.sizes.includes(f.size) && !(p.soldOut || []).includes(f.size)) && (!f.color || p.colors.includes(f.color)) && (!f.stock || p.inStock));
  const sizes = ["XS", "S", "M", "L", "XL", "XXL"];
  const nActive = [f.size, f.color, f.stock].filter(Boolean).length;
  const filters = h("details", { class: "filters", open: nActive > 0 },
    h("summary", {}, h("span", { text: `${t("Фильтры")}${nActive ? ` · ${nActive}` : ""}` }), h("span", { class: "count", text: `${list.length} ${t("товаров")}` })),
    h("div", { class: "fbody" },
      h("div", { class: "fgroup" }, h("span", { class: "lbl", text: t("Размер") }), sizes.map((s) => h("button", { class: "mini" + (f.size === s ? " on" : ""), "aria-pressed": f.size === s, onclick: () => go({ size: f.size === s ? "" : s }), text: s }))),
      h("div", { class: "fgroup" }, h("span", { class: "lbl", text: t("Цвет") }), Object.entries(C.colors).map(([id, c]) => h("button", { class: "cdot" + (f.color === id ? " on" : ""), style: `background:${c.hex}`, title: c.name, "aria-label": c.name, "aria-pressed": f.color === id, onclick: () => go({ color: f.color === id ? "" : id }) }))),
      h("div", { class: "fgroup" }, h("button", { class: "mini" + (f.stock ? " on" : ""), "aria-pressed": !!f.stock, onclick: () => go({ stock: f.stock ? "" : "1" }), text: t("Только в наличии") }),
        nActive ? h("button", { class: "link", onclick: () => go({ size: "", color: "", stock: "" }), text: t("Сбросить") }) : null)));
  setPage(h("div", { class: "wrap" },
    h("div", { class: "page-head" }, h("h1", { style: "font-size:clamp(26px,7vw,40px)", text: f.cat ? catTitle(f.cat) : t("Каталог") }), h("p", { class: "muted", text: t("ESA Black Series 2026 · одежда, аксессуары, гейминг") })),
    h("div", { class: "chips", role: "tablist" },
      h("a", { class: "chip" + (!f.cat ? " on" : ""), href: "#/catalog", text: t("Все") }),
      C.categories.map((c) => h("a", { class: "chip" + (f.cat === c.id ? " on" : ""), href: `#/catalog?cat=${c.id}`, text: c.title }))),
    filters,
    list.length ? h("div", { class: "grid" }, list.map(productCard)) : h("p", { class: "empty", text: t("Ничего не нашлось. Попробуйте убрать фильтры.") }),
    h("div", { style: "height:30px" })), { title: f.cat ? catTitle(f.cat) : t("Каталог"), tab: "catalog" });
}

function pageProduct(id) {
  const p = P.get(id);
  if (!p) return pageNotFound();
  const st = { size: p.sizes.length === 1 ? p.sizes[0] : "", color: p.colors[0] || "", qty: 1 }; // цвет по умолчанию — первый (обычно чёрный)
  const avail = (s) => !(p.soldOut || []).includes(s);

  const slides = h("div", { class: "slides" }, p.images.map((f, i) => h("img", { src: img(f), alt: `${p.title} — ${t("фото")} ${i + 1}`, loading: i ? "lazy" : "eager", width: 800, height: 1000 })));
  const dots = h("div", { class: "dots" }, p.images.length > 1 ? p.images.map((_, i) => h("i", { class: i ? "" : "on" })) : null);
  const thumbs = h("div", { class: "thumbs" }, p.images.length > 1 ? p.images.map((f, i) => h("button", { class: i ? "" : "on", "aria-label": `${t("Фото")} ${i + 1}`, onclick: () => slides.scrollTo({ left: i * slides.clientWidth, behavior: "smooth" }) }, h("img", { src: img(f), alt: "", loading: "lazy" }))) : null);
  slides.addEventListener("scroll", () => {
    const i = Math.round(slides.scrollLeft / slides.clientWidth);
    $$("i", dots).forEach((d, k) => d.classList.toggle("on", k === i));
    $$("button", thumbs).forEach((d, k) => d.classList.toggle("on", k === i));
  }, { passive: true });

  const sizeVal = h("span", { class: "val", text: st.size || t("не выбран") });
  const sizeOpt = p.sizes.length ? h("div", { class: "opt", id: "optSize" },
    h("div", { class: "opt-head" }, h("span", {}, t("Размер: "), sizeVal), p.sizeChart ? h("button", { class: "link", type: "button", onclick: () => openSizes(), text: t("Размерная сетка") }) : null),
    h("div", { class: "sizes", role: "radiogroup", "aria-label": t("Размер") }, p.sizes.map((s) => {
      const b = h("button", { type: "button", class: "size" + (avail(s) ? "" : " na") + (st.size === s ? " on" : ""), role: "radio", "aria-checked": st.size === s, "aria-disabled": !avail(s), title: avail(s) ? s : t("Нет в наличии"), text: s,
        onclick: () => { if (!avail(s)) return toast(`${t("Нет в наличии")}: ${s}`); st.size = s; sizeVal.textContent = s; $$(".size", sizeOpt).forEach((x) => { x.classList.toggle("on", x === b); x.setAttribute("aria-checked", x === b); }); sizeOpt.classList.remove("need"); syncBuy(); } });
      return b;
    }))) : null;

  const colorVal = h("span", { class: "val", text: st.color ? colorOf(st.color).name : t("не выбран") });
  const colorOpt = p.colors.length ? h("div", { class: "opt", id: "optColor" },
    h("div", { class: "opt-head" }, h("span", {}, t("Цвет: "), colorVal)),
    h("div", { class: "colors", role: "radiogroup", "aria-label": t("Цвет") }, p.colors.map((c) => {
      const b = h("button", { type: "button", class: "cdot" + (st.color === c ? " on" : ""), role: "radio", "aria-checked": st.color === c, style: `background:${colorOf(c).hex}`, title: colorOf(c).name, "aria-label": colorOf(c).name,
        onclick: () => { st.color = c; colorVal.textContent = colorOf(c).name; $$(".cdot", colorOpt).forEach((x) => { x.classList.toggle("on", x === b); x.setAttribute("aria-checked", x === b); }); colorOpt.classList.remove("need"); } });
      return b;
    }))) : null;

  const qtyOut = h("output", { text: "1" });
  const qty = h("div", { class: "opt" }, h("div", { class: "opt-head", text: t("Количество") }),
    h("div", { class: "qty" }, h("button", { type: "button", "aria-label": t("Меньше"), onclick: () => { st.qty = Math.max(1, st.qty - 1); qtyOut.textContent = st.qty; }, text: "−" }), qtyOut,
      h("button", { type: "button", "aria-label": t("Больше"), onclick: () => { st.qty = Math.min(20, st.qty + 1); qtyOut.textContent = st.qty; }, text: "+" })));

  function ready() {
    if (p.sizes.length && !st.size) { sizeOpt.classList.remove("need"); void sizeOpt.offsetWidth; sizeOpt.classList.add("need"); sizeOpt.scrollIntoView({ block: "center", behavior: "smooth" }); toast(t("Выберите размер")); return false; }
    if (p.colors.length && !st.color) { colorOpt.classList.remove("need"); void colorOpt.offsetWidth; colorOpt.classList.add("need"); colorOpt.scrollIntoView({ block: "center", behavior: "smooth" }); toast(t("Выберите цвет")); return false; }
    return true;
  }
  const item = () => ({ pid: p.id, size: st.size, color: st.color, qty: st.qty });
  const onAdd = () => { if (!ready()) return; addToCart(item()); toast(t("Добавлено в корзину"), { href: "#/cart", text: t("Корзина →") }); };
  const onQuick = () => { if (!ready()) return; openQuick(p, item()); };
  const addBtns = [];
  const mkAdd = () => { const b = h("button", { class: "btn btn-white", onclick: onAdd, text: t("В корзину") }); addBtns.push(b); return b; };
  function syncBuy() { addBtns.forEach((b) => (b.textContent = p.sizes.length && !st.size ? t("Выберите размер") : t("В корзину"))); }

  const info = h("div", { class: "info" },
    h("details", { open: true }, h("summary", { text: t("Описание") }), h("div", { class: "in" }, h("p", { text: p.desc }), p.includes ? h("ul", { class: "checks" }, p.includes.map((t) => h("li", { text: t }))) : null)),
    p.features?.length ? h("details", {}, h("summary", { text: t("Особенности") }), h("div", { class: "in" }, h("ul", {}, p.features.map((t) => h("li", { text: t }))))) : null,
    h("details", {}, h("summary", { text: t("Доставка и оплата") }), h("div", { class: "in" },
      h("p", { text: t("Самовывоз в Оше, курьер по Ошу и Бишкеку, отправка во все регионы Кыргызстана. Стоимость доставки менеджер сообщит при подтверждении.") }),
      h("p", { text: "Оплата переводом MBank / Optima — только после того, как мы подтвердим заказ." }),
      h("a", { href: "#/delivery", class: "link", text: t("Подробнее") }))));

  const related = C.products.filter((x) => x.cat === p.cat && x.id !== p.id).concat(C.products.filter((x) => x.featured && x.cat !== p.cat && x.id !== p.id)).slice(0, 8);
  setPage([
    h("div", { class: "wrap" },
      h("div", { class: "pdp" },
        h("div", {}, h("div", { class: "gallery" }, slides, dots), thumbs),
        h("div", {},
          h("div", { class: "crumbs" }, h("a", { href: "#/catalog", text: t("Каталог") }), " / ", h("a", { href: `#/catalog?cat=${p.cat}`, text: catTitle(p.cat) })),
          h("h1", { text: p.title }),
          p.subtitle ? h("p", { class: "muted", style: "margin:0", text: p.subtitle }) : null,
          h("div", { class: "price" + (hasPrice(p) ? "" : " ask"), text: priceText(p) }),
          h("span", { class: "stock" + (p.inStock ? "" : " pre"), text: p.inStock ? t("В наличии") : t("Под заказ — срок уточнит менеджер") }),
          colorOpt, sizeOpt, qty,
          h("div", { class: "buy" }, mkAdd(), h("button", { class: "btn btn-blue", onclick: onQuick, text: t("Купить в 1 клик") })),
          info)),
      related.length ? h("section", { class: "block" }, secHead(t("Вам может понравиться")), h("div", { class: "rail" }, related.map(productCard))) : null),
    h("div", { class: "buybar" }, mkAdd(), h("button", { class: "btn btn-blue", onclick: onQuick, text: t("В 1 клик") })),
  ], { title: p.title, tab: "catalog", buybar: true });
  syncBuy();
}

function pageCart() {
  const lines = cart.filter((l) => P.has(l.pid));
  if (!lines.length) {
    return setPage(h("div", { class: "wrap" }, h("div", { class: "page-head" }, h("h1", { style: "font-size:32px", text: t("Корзина") })),
      h("div", { class: "empty" }, h("p", { text: t("В корзине пока пусто.") }), h("a", { class: "btn btn-blue", href: "#/catalog", text: t("Перейти в каталог") }))), { title: t("Корзина"), tab: "cart" });
  }
  const allPriced = lines.every((l) => hasPrice(P.get(l.pid)));
  const total = lines.reduce((s, l) => s + (hasPrice(P.get(l.pid)) ? P.get(l.pid).price * l.qty : 0), 0);
  const count = lines.reduce((s, l) => s + l.qty, 0);
  const rerender = () => { saveCart(); pageCart(); };
  setPage(h("div", { class: "wrap" },
    h("div", { class: "page-head" }, h("h1", { style: "font-size:32px", text: t("Корзина") }), h("p", { class: "muted", text: `${count} ${t("шт.")}` })),
    h("div", { class: "two" },
      h("div", { class: "cart-list" }, lines.map((l) => {
        const p = P.get(l.pid);
        return h("div", { class: "line" },
          h("a", { href: `#/p/${p.id}` }, h("img", { src: img(p.images[0]), alt: p.title, loading: "lazy" })),
          h("div", {},
            h("a", { class: "t", href: `#/p/${p.id}`, text: p.title }),
            h("div", { class: "m", text: [l.size && `${t("Размер")} ${l.size}`, l.color && colorOf(l.color).name].filter(Boolean).join(" · ") }),
            h("div", { class: "row" },
              h("div", { class: "qty" },
                h("button", { "aria-label": t("Меньше"), onclick: () => { l.qty > 1 ? l.qty-- : cart.splice(cart.indexOf(l), 1); rerender(); }, text: "−" }),
                h("output", { text: l.qty }),
                h("button", { "aria-label": t("Больше"), onclick: () => { l.qty = Math.min(20, l.qty + 1); rerender(); }, text: "+" })),
              h("b", { text: hasPrice(p) ? money(p.price * l.qty) : t("Цена уточняется") })),
            h("button", { class: "rm", onclick: () => { cart.splice(cart.indexOf(l), 1); rerender(); }, text: t("Удалить") })));
      })),
      h("div", { class: "summary" },
        h("div", { class: "row" }, h("span", { text: t("Товары") }), h("span", { text: `${count} ${t("шт.")}` })),
        h("div", { class: "row" }, h("span", { text: t("Доставка") }), h("span", { class: "muted", text: t("сообщит менеджер") })),
        h("div", { class: "row tot" }, h("span", { text: t("Итого") }), h("span", { text: allPriced ? money(total) : total ? `${t("от")} ${money(total)}` : t("уточнит менеджер") })),
        !allPriced ? h("p", { class: "muted small", style: "margin:0", text: t("У части товаров цена уточняется — менеджер назовёт точную сумму при подтверждении заказа.") }) : null,
        h("a", { class: "btn btn-blue wide", href: "#/checkout", text: t("Оформить заказ") }),
        h("a", { class: "btn btn-ghost wide", href: "#/catalog", text: t("Продолжить покупки") })))), { title: t("Корзина"), tab: "cart" });
}

const CITIES = ["Ош", "Бишкек", "Джалал-Абад", "Узген", "Кара-Суу", "Ноокат", "Араван", "Кара-Куль", "Майлуу-Суу", "Таш-Кумыр", "Баткен", "Кызыл-Кия", "Сулюкта", "Исфана", "Талас", "Нарын", "Каракол", "Балыкчы", "Чолпон-Ата", "Токмок", "Кант", "Кара-Балта"];
function pageCheckout() {
  const lines = cart.filter((l) => P.has(l.pid));
  if (!lines.length) { location.hash = "#/cart"; return; }
  const saved = store.get("esa_contact", {});
  const err = h("p", { class: "err", role: "alert" });
  const addrWrap = h("label", {}, t("Адрес доставки"), h("input", { name: "address", autocomplete: "street-address", maxLength: 300, placeholder: t("Улица, дом, квартира / ориентир"), value: saved.address || "" }));
  const radio = (v, title, sub) => h("label", { class: "radio" }, h("input", { type: "radio", name: "delivery", value: v, checked: (saved.delivery || "pickup") === v }), h("span", {}, h("b", { text: title }), h("small", { text: sub })));
  const form = h("form", { class: "form", novalidate: true },
    h("label", {}, t("Имя"), h("input", { name: "name", required: true, autocomplete: "name", maxLength: 80, placeholder: t("Как к вам обращаться"), value: saved.name || "" })),
    h("label", {}, t("Телефон / WhatsApp"), h("input", { name: "phone", type: "tel", inputMode: "tel", required: true, autocomplete: "tel", maxLength: 40, placeholder: "+996 555 123 456", value: saved.phone || "" })),
    h("label", {}, t("Город"), h("input", { name: "city", required: true, autocomplete: "address-level2", maxLength: 60, list: "cities", placeholder: t("Ош"), value: saved.city || "" })),
    h("datalist", { id: "cities" }, CITIES.map((c) => h("option", { value: c }))),
    h("fieldset", { style: "border:0;padding:0;margin:0" }, h("legend", { style: "font-weight:600;font-size:13.5px;margin-bottom:6px", text: t("Получение") }),
      h("div", { class: "radios" },
        radio("pickup", t("Самовывоз — Ош"), t("Бесплатно. Адрес и время сообщит менеджер")),
        radio("courier", t("Курьер по городу"), t("Ош и Бишкек. Стоимость сообщит менеджер")),
        radio("region", t("Доставка в регион"), t("По всему Кыргызстану. Стоимость и срок — при подтверждении")))),
    addrWrap,
    h("label", {}, h("span", {}, t("Комментарий "), h("span", { class: "opt-lbl", text: t("(необязательно)") })), h("textarea", { name: "comment", maxLength: 1000, placeholder: t("Крой (Oversize/Regular), удобное время звонка, пожелания") })),
    h("input", { class: "hp", name: "website", tabIndex: -1, autocomplete: "off", "aria-hidden": "true" }),
    h("div", { class: "note", text: "💳 Оплата — переводом MBank / Optima после подтверждения заказа. Реквизиты появятся на странице заказа и придут в Telegram, когда менеджер подтвердит наличие и сумму." }),
    err,
    h("button", { class: "btn btn-blue wide", type: "submit", text: t("Подтвердить заказ") }));
  const syncAddr = () => { addrWrap.hidden = form.delivery.value === "pickup"; };
  form.addEventListener("change", syncAddr);
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const fd = Object.fromEntries(new FormData(form));
    if (fd.name.trim().length < 2) return (err.textContent = t("Укажите имя")), form.name.focus();
    if (fd.phone.replace(/\D/g, "").length < 9) return (err.textContent = t("Укажите номер телефона полностью")), form.phone.focus();
    if (fd.city.trim().length < 2) return (err.textContent = t("Укажите город")), form.city.focus();
    if (fd.delivery !== "pickup" && fd.address.trim().length < 5) return (err.textContent = t("Укажите адрес доставки")), form.address.focus();
    err.textContent = "";
    const btn = $("button[type=submit]", form); btn.disabled = true; btn.textContent = t("Отправляем…");
    try {
      const r = await api("/api/order", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...fd, lang: LANG, items: lines }) });
      store.set("esa_contact", { name: fd.name, phone: fd.phone, city: fd.city, delivery: fd.delivery, address: fd.address });
      rememberOrder(r.id, r.key);
      cart = []; saveCart();
      location.hash = `#/order/${r.id}?k=${encodeURIComponent(r.key)}&new=1`;
    } catch (ex) { err.textContent = ex.message; btn.disabled = false; btn.textContent = t("Подтвердить заказ"); }
  });
  const allPriced = lines.every((l) => hasPrice(P.get(l.pid)));
  const total = lines.reduce((s, l) => s + (hasPrice(P.get(l.pid)) ? P.get(l.pid).price * l.qty : 0), 0);
  setPage(h("div", { class: "wrap" },
    h("div", { class: "page-head" }, h("h1", { style: "font-size:30px", text: t("Оформление заказа") }), h("p", { class: "muted", text: t("Без регистрации — займёт минуту.") })),
    h("div", { class: "two" }, form,
      h("div", { class: "summary" }, h("b", { text: t("Ваш заказ") }),
        lines.map((l) => { const p = P.get(l.pid); return h("div", { class: "row small" }, h("span", { text: `${p.title}${l.size ? " · " + l.size : ""}${l.color ? " · " + colorOf(l.color).name : ""} × ${l.qty}` }), h("span", { text: hasPrice(p) ? money(p.price * l.qty) : "—" })); }),
        h("div", { class: "row tot" }, h("span", { text: t("Итого") }), h("span", { text: allPriced ? money(total) : t("уточнит менеджер") })),
        h("a", { class: "link small", href: "#/cart", text: t("Изменить корзину") }))),
    h("div", { style: "height:30px" })), { title: t("Оформление"), tab: "cart" });
  syncAddr();
}

const STATUS_LABEL = { new: "🆕 Новый — ждёт подтверждения", accepted: "✅ Подтверждён — ожидается оплата", paid: "💳 Оплачен — собираем заказ", shipped: "🚚 Отправлен / готов к выдаче", done: "🎉 Получен", rejected: "❌ Отменён" };
const DELIVERY_LABEL = { pickup: "Самовывоз (Ош)", courier: "Курьер по городу", region: "Доставка в регион" };
const STEPS = [["new", t("Заказ принят"), t("Ждёт подтверждения менеджером")], ["accepted", t("Подтверждён"), t("Ожидается оплата")], ["paid", t("Оплачен"), t("Собираем заказ")], ["shipped", t("Отправлен / готов к выдаче"), ""], ["done", t("Получен"), t("Спасибо, что выбрали ESA!")]];
let pollT;
async function pageOrder(id, q) {
  clearInterval(pollT);
  const key = q.k || myOrders().find((o) => o.id === id)?.key || "";
  const phone = q.phone || "";
  setPage(h("div", { class: "wrap" }, h("p", { class: "loading", text: t("Загружаем заказ…") })), { title: `${t("Заказ")} ${id}`, tab: "track" });
  let o;
  try { o = await api(`/api/order?id=${encodeURIComponent(id)}${key ? `&k=${encodeURIComponent(key)}` : `&phone=${encodeURIComponent(phone)}`}`); }
  catch (e) { return setPage(h("div", { class: "wrap" }, h("div", { class: "page-head" }, h("h1", { style: "font-size:28px", text: t("Заказ не найден") }), h("p", { class: "muted", text: e.message }), h("a", { class: "btn", href: "#/track", text: t("Найти заказ по номеру и телефону") }))), { tab: "track" }); }
  if (key) rememberOrder(o.id, key);
  const idx = STEPS.findIndex(([s]) => s === o.status);
  const hist = Object.fromEntries((o.history || []).map((x) => [x.status, x.at]));
  const fmt = (ts) => new Date(ts).toLocaleString("ru-RU", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
  const botLink = C.bot && key ? `https://t.me/${C.bot}?start=${o.id}_${key}` : null;
  const copy = (text) => navigator.clipboard?.writeText(text).then(() => toast(t("Скопировано")), () => {});
  setPage(h("div", { class: "wrap" },
    h("div", { class: "page-head" },
      q.new ? h("p", { class: "slogan", style: "color:var(--ok)", text: t("✓ ЗАКАЗ ОТПРАВЛЕН") }) : null,
      h("p", { class: "muted", style: "margin:0", text: t("Номер заказа") }),
      h("div", { class: "order-id", text: o.id }),
      h("span", { class: "status-pill " + o.status, text: t(STATUS_LABEL[o.status] || o.statusText) })),
    q.new ? h("div", { class: "note", style: "margin-bottom:14px", text: t("Спасибо! Менеджер свяжется с вами, проверит наличие и подтвердит заказ. Сохраните эту страницу — здесь виден статус.") }) : null,
    o.payInfo ? h("div", { class: "pay" },
      h("b", { text: t("💳 Заказ подтверждён — можно оплачивать") }),
      o.total ? h("p", { style: "margin:6px 0 0" }, t("К оплате: "), h("b", { text: money(o.total) })) : null,
      h("div", { class: "num", text: o.payInfo }),
      h("button", { class: "btn btn-blue", onclick: () => copy((o.payInfo.match(/\+?\d[\d\s]{8,}/) || [o.payInfo])[0].replace(/\s/g, "")), text: t("Скопировать номер") }),
      h("p", { class: "muted small", text: t("После оплаты отправьте скриншот чека в Telegram-бот магазина или менеджеру — мы обновим статус.") })) : null,
    botLink && !o.telegram && !["done", "rejected"].includes(o.status) ? h("div", { class: "order-box" },
      h("b", { text: t("Получайте статусы в Telegram") }),
      h("p", { class: "muted", text: t("Подтверждение, реквизиты для оплаты и доставка — сообщением от бота ESA Store.") }),
      h("a", { class: "btn btn-blue wide", href: botLink, target: "_blank", rel: "noopener", text: t("Подключить Telegram") })) : null,
    o.status === "rejected" ? h("div", { class: "order-box" }, h("b", { text: t("Заказ отменён") }), h("p", { class: "muted", text: t("Если это ошибка — напишите нам в Telegram-бот, разберёмся.") })) :
      h("div", { class: "order-box" }, h("b", { text: t("Статус") }),
        h("ol", { class: "steps" }, STEPS.map(([s, t, sub], i) => h("li", { class: i < idx ? "done" : i === idx ? "cur done" : "" }, t, h("small", { text: hist[s] ? fmt(hist[s]) : i === 0 ? fmt(o.createdAt) : i === idx ? sub : "" }))))),
    h("div", { class: "order-box" }, h("b", { text: t("Состав заказа") }),
      (o.items || []).map((i) => h("div", { class: "irow" },
        h("span", { text: `${P.get(i.pid)?.title || i.title}${i.size ? " · " + i.size : ""}${i.color ? " · " + colorOf(i.color).name : ""} × ${i.qty}` }), h("span", { text: i.price ? money(i.price * i.qty) : "" }))),
      h("div", { class: "irow tot" }, h("span", { text: t("Итого") }), h("span", { text: o.total ? money(o.total) : t("уточнит менеджер") })),
      o.deliveryKey ? h("p", { class: "muted small", text: `${t(DELIVERY_LABEL[o.deliveryKey] || "")}${o.city ? " · " + o.city : ""}` }) : null),
    h("a", { class: "btn btn-ghost wide", href: "#/catalog", text: t("Вернуться в каталог") }),
    h("div", { style: "height:30px" })), { title: `${t("Заказ")} ${o.id}`, tab: "track" });
  if (!["done", "rejected"].includes(o.status)) {
    const hash = location.hash;
    pollT = setInterval(async () => {
      if (location.hash !== hash) return clearInterval(pollT);
      if (document.visibilityState !== "visible") return;
      try { const n = await api(`/api/order?id=${encodeURIComponent(id)}${key ? `&k=${encodeURIComponent(key)}` : `&phone=${encodeURIComponent(phone)}`}`); if (n.status !== o.status) { clearInterval(pollT); pageOrder(id, { ...q, new: "" }); } } catch {}
    }, 20000);
  }
}

function pageTrack() {
  const err = h("p", { class: "err", role: "alert" });
  const form = h("form", { class: "form" },
    h("label", {}, t("Номер заказа"), h("input", { name: "id", required: true, placeholder: "ESS-123456", autocapitalize: "characters", maxLength: 12 })),
    h("label", {}, t("Телефон, указанный в заказе"), h("input", { name: "phone", type: "tel", inputMode: "tel", required: true, placeholder: "+996 555 123 456", value: store.get("esa_contact", {}).phone || "" })),
    err, h("button", { class: "btn btn-blue wide", type: "submit", text: t("Найти заказ") }));
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    let id = form.id.value.trim().toUpperCase().replace(/\s/g, "");
    if (/^\d{6}$/.test(id)) id = "ESS-" + id;
    if (!/^ESS-\d{6}$/.test(id)) return (err.textContent = t("Номер заказа выглядит так: ESS-123456"));
    location.hash = `#/order/${id}?phone=${encodeURIComponent(form.phone.value)}`;
  });
  const mine = myOrders();
  setPage(h("div", { class: "wrap prose" },
    h("div", { class: "page-head" }, h("h1", { style: "font-size:30px", text: t("Мой заказ") }), h("p", { class: "muted", text: t("Статус заказа: подтверждение, оплата, доставка.") })),
    mine.length ? h("div", { class: "order-box" }, h("b", { text: t("Заказы с этого телефона") }), mine.map((m) => h("p", { style: "margin:8px 0 0" }, h("a", { href: `#/order/${m.id}?k=${encodeURIComponent(m.key)}`, class: "link", text: m.id }), h("span", { class: "muted small", text: "  " + new Date(m.at).toLocaleDateString("ru-RU") })))) : null,
    h("div", { class: "order-box" }, h("b", { text: t("Найти по номеру") }), form),
    C.bot ? h("p", { class: "muted" }, t("Также статусы приходят в "), h("a", { href: `https://t.me/${C.bot}`, target: "_blank", rel: "noopener", text: t("Telegram-бот ESA Store") }), ".") : null), { title: t("Мой заказ"), tab: "track" });
}

function pageAbout() {
  setPage(h("div", { class: "wrap prose" },
    h("div", { class: "page-head" }, h("p", { class: "slogan", text: "DREAM · CREATE · ACHIEVE" }), h("h1", { style: "font-size:clamp(28px,8vw,44px)", text: t("ESA — больше, чем бренд") })),
    h("img", { src: img("models.webp"), alt: "ESA Black Series", style: "border-radius:16px;border:1px solid var(--line);margin-bottom:16px", loading: "lazy" }),
    h("p", { text: t("ESA — бренд из Оша, Кыргызстан. Мы соединяем стиль и технологии: одежда, аксессуары и гейминг-вещи для тех, кто мечтает, создаёт и добивается своего.") }),
    h("p", { text: t("Коллекция ESA Black Series 2026 — чёрная база, синие акценты ESA Blue и горы на логотипе как символ цели, к которой идёшь шаг за шагом.") }),
    h("div", { class: "cards3" },
      h("div", { class: "icard" }, h("b", { text: "Dream" }), h("span", { class: "muted", text: t("Мечтай масштабно — бренд для тех, кто стремится к большему.") })),
      h("div", { class: "icard" }, h("b", { text: "Create" }), h("span", { class: "muted", text: t("Создавай: IT, контент, проекты — ESA вырос из мира технологий.") })),
      h("div", { class: "icard" }, h("b", { text: "Achieve" }), h("span", { class: "muted", text: t("Добивайся — вещи, которые выдерживают ритм твоей жизни.") }))),
    h("h2", { text: t("Цвета бренда") }),
    h("div", { class: "palette" }, [["Black", "#000000"], ["White", "#FFFFFF"], ["ESA Blue", "#075BFF"], ["Gray", "#777D88"]].map(([n, c]) => h("div", { style: `background:${c}` }, n, h("br"), c))),
    h("h2", { text: t("Детали") }),
    h("ul", {}, [t("Вышивка премиум-класса"), t("Фирменная фурнитура"), t("Брендовые этикетки и бирка с QR-кодом"), t("Усиленные швы и светоотражающие элементы"), t("Подарочная упаковка: коробка, пакет, открытка")].map((t) => h("li", { text: t }))),
    h("p", {}, t("IT-услуги ESA (сайты, боты, приложения): "), h("a", { href: "https://esa-orders.onrender.com", target: "_blank", rel: "noopener", text: "esa-orders.onrender.com" })),
    h("a", { class: "btn btn-blue", href: "#/catalog", text: t("Смотреть коллекцию") }), h("div", { style: "height:30px" })), { title: t("О бренде") });
}

function pageDelivery() {
  setPage(h("div", { class: "wrap prose" },
    h("div", { class: "page-head" }, h("h1", { style: "font-size:clamp(28px,8vw,40px)", text: t("Доставка и оплата") })),
    h("h2", { text: t("Как заказать") }),
    h("ol", {}, [t("Выберите товар, размер и цвет — добавьте в корзину или нажмите «Купить в 1 клик»."), t("Оставьте имя, телефон и город. Регистрация не нужна."), t("Менеджер проверит наличие, сообщит сумму и стоимость доставки, подтвердит заказ."), t("Оплатите переводом — реквизиты появятся на странице заказа и в Telegram."), t("Получите заказ: самовывоз, курьер или доставка в ваш регион.")].map((t) => h("li", { text: t }))),
    h("h2", { text: t("Доставка по Кыргызстану") }),
    h("div", { class: "cards3" },
      h("div", { class: "icard" }, h("b", { text: t("Самовывоз — Ош") }), h("span", { class: "muted", text: t("Бесплатно. Адрес и время менеджер сообщит при подтверждении.") })),
      h("div", { class: "icard" }, h("b", { text: t("Курьер") }), h("span", { class: "muted", text: t("По Ошу и Бишкеку. Стоимость зависит от адреса — сообщим заранее.") })),
      h("div", { class: "icard" }, h("b", { text: t("Регионы") }), h("span", { class: "muted", text: t("Отправка во все области Кыргызстана. Срок и цена — при подтверждении.") }))),
    h("h2", { text: t("Оплата") }),
    h("p", { text: "Переводом на MBank или Optima — только после подтверждения заказа менеджером. Номер для перевода появится на странице вашего заказа и придёт в Telegram-бот." }),
    h("p", { text: t("Мы никогда не просим данные карты, пароли или коды из SMS.") }),
    h("h2", { text: t("Обмен и вопросы") }),
    h("p", { text: t("Не подошёл размер? Напишите нам в течение нескольких дней после получения — поможем с обменом, если вещь не носилась и сохранила бирки. Условия уточняйте у менеджера.") }),
    C.bot ? h("a", { class: "btn btn-blue", href: `https://t.me/${C.bot}`, target: "_blank", rel: "noopener", text: t("Написать в Telegram") }) : null,
    h("div", { style: "height:30px" })), { title: t("Доставка и оплата") });
}

function pageNotFound() {
  setPage(h("div", { class: "wrap" }, h("div", { class: "empty" }, h("h1", { style: "font-size:28px", text: t("Страница не найдена") }), h("a", { class: "btn btn-blue", href: "#/", text: t("На главную") }))));
}

// ---------- Окна
function openSizes() {
  $("#sizeRows").replaceChildren(...C.sizeChart.map((r) => h("tr", {}, h("td", { text: r.size }), h("td", { text: r.chest }), h("td", { text: r.waist }), h("td", { text: r.hips }))));
  $("#sizeDialog").showModal();
}
let quickItem = null;
function openQuick(p, item) {
  quickItem = item;
  $("#quickWhat").textContent = `${p.title}${item.size ? " · " + item.size : ""}${item.color ? " · " + colorOf(item.color).name : ""} × ${item.qty} — ${priceText(p)}`;
  const f = $("#quickForm"), saved = store.get("esa_contact", {});
  if (!f.name.value) f.name.value = saved.name || "";
  if (!f.phone.value) f.phone.value = saved.phone || "";
  $("#quickErr").textContent = "";
  $("#quickDialog").showModal();
}
$("#quickForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const f = e.target, err = $("#quickErr");
  if (f.name.value.trim().length < 2) return (err.textContent = t("Укажите имя"));
  if (f.phone.value.replace(/\D/g, "").length < 9) return (err.textContent = t("Укажите номер телефона полностью"));
  const btn = $("button[type=submit]", f); btn.disabled = true;
  try {
    const r = await api("/api/order", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ quick: true, lang: LANG, name: f.name.value, phone: f.phone.value, website: f.website.value, items: [quickItem] }) });
    store.set("esa_contact", { ...store.get("esa_contact", {}), name: f.name.value, phone: f.phone.value });
    rememberOrder(r.id, r.key);
    $("#quickDialog").close();
    location.hash = `#/order/${r.id}?k=${encodeURIComponent(r.key)}&new=1`;
  } catch (ex) { err.textContent = ex.message; }
  btn.disabled = false;
});
$$("dialog").forEach((d) => {
  d.addEventListener("click", (e) => { if (e.target === d || e.target.closest("[data-close]")) d.close(); });
});

// ---------- Маршрутизация (#/...)
function route() {
  clearInterval(pollT);
  const raw = location.hash.slice(1) || "/";
  const [path, query] = raw.split("?");
  const q = parseQuery(query);
  const parts = path.split("/").filter(Boolean);
  if (!parts.length) pageHome();
  else if (parts[0] === "catalog") pageCatalog(q);
  else if (parts[0] === "p") pageProduct(parts[1]);
  else if (parts[0] === "cart") pageCart();
  else if (parts[0] === "checkout") pageCheckout();
  else if (parts[0] === "order" && parts[1]) pageOrder(decodeURIComponent(parts[1]).toUpperCase(), q);
  else if (parts[0] === "track") pageTrack();
  else if (parts[0] === "about") pageAbout();
  else if (parts[0] === "delivery") pageDelivery();
  else pageNotFound();
  window.scrollTo(0, 0);
}

translateDom();
mountLangSwitch();
(async function start() {
  try { C = await api("/api/products"); }
  catch { view().replaceChildren(h("div", { class: "empty" }, h("p", { text: t("Не удалось загрузить каталог. Проверьте интернет и обновите страницу.") }), h("button", { class: "btn", onclick: () => location.reload(), text: t("Обновить") }))); return; }
  localizeCatalog(C);
  C.products.forEach((p) => P.set(p.id, p));
  if (C.bot) $$("[data-bot-link]").forEach((a) => (a.href = `https://t.me/${C.bot}`));
  else $$("[data-bot-link]").forEach((a) => (a.hidden = true));
  saveCart();
  window.addEventListener("hashchange", route);
  route();
})();
