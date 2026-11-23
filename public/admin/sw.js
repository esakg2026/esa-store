// Service worker приложения владельца: показывает push-уведомления о заказах.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
  let p = {};
  try { p = event.data ? event.data.json() : {}; } catch { p = { title: "ESA", body: event.data?.text() || "" }; }
  event.waitUntil((async () => {
    await self.registration.showNotification(p.title || "ESA Store", {
      body: p.body || "",
      tag: p.tag || undefined,
      icon: "/admin/icon-192.png",
      badge: "/admin/badge-96.png",
      vibrate: [200, 100, 200],
      timestamp: Date.now(),
      requireInteraction: Boolean(p.tag && p.tag.startsWith("ESS-")),
      data: { url: p.url || "/admin/" },
    });
    const wins = await self.clients.matchAll({ type: "window" });
    wins.forEach((w) => w.postMessage("refresh"));
  })());
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = new URL(event.notification.data?.url || "/admin/", self.location.origin).href;
  event.waitUntil((async () => {
    const wins = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const w of wins) if (w.url.includes("/admin/")) { await w.navigate(url).catch(() => {}); return w.focus(); }
    return self.clients.openWindow(url);
  })());
});
