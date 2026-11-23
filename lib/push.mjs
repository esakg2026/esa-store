// Push-уведомления на телефон владельца (Web Push, VAPID). Подписки хранятся в misc/push/*.
import { createHash } from "node:crypto";

let wp;
async function webpush() {
  if (!process.env.VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) return null;
  if (!wp) {
    const mod = await import("web-push");
    wp = mod.default && typeof mod.default.setVapidDetails === "function" ? mod.default : mod;
    wp.setVapidDetails("mailto:esa-store@users.noreply.github.com", process.env.VAPID_PUBLIC_KEY, process.env.VAPID_PRIVATE_KEY);
  }
  return wp;
}

const subKey = (sub) => "push/" + createHash("sha256").update(sub.endpoint).digest("hex").slice(0, 32);

export async function saveSubscription(store, sub) {
  if (!sub || typeof sub.endpoint !== "string" || !/^https:\/\//.test(sub.endpoint) || !sub.keys?.p256dh || !sub.keys?.auth) return false;
  await store.setJSON(subKey(sub), { endpoint: sub.endpoint, keys: { p256dh: sub.keys.p256dh, auth: sub.keys.auth }, at: Date.now() });
  return true;
}

export async function pushOwner(store, payload) {
  const w = await webpush();
  if (!w) return 0;
  const { blobs } = await store.list({ prefix: "push/" });
  let sent = 0;
  await Promise.all(blobs.map(async ({ key }) => {
    const sub = await store.get(key, { type: "json" });
    if (!sub) return;
    try {
      await w.sendNotification(sub, JSON.stringify(payload), { TTL: 86400, urgency: "high" });
      sent++;
    } catch (e) {
      if (e.statusCode === 404 || e.statusCode === 410) await store.delete(key); // подписка устарела
      else console.error("push failed", e.statusCode || e.message);
    }
  }));
  return sent;
}
