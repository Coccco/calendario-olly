// Service worker: mostra le notifiche del calendario e, al tocco, apre il calendario.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));

self.addEventListener("push", (e) => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch { d = { body: e.data && e.data.text() }; }
  e.waitUntil(self.registration.showNotification(d.title || "🎁 Calendario dell'avvento", {
    body: d.body || "C'è una nuova casella da aprire!",
    icon: "icon-192.png",
    badge: "icon-192.png",
    tag: d.tag || "avvento",
    data: { url: d.url || self.registration.scope },
  }));
});

self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const url = (e.notification.data && e.notification.data.url) || self.registration.scope;
  e.waitUntil((async () => {
    const all = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const c of all) {
      if (c.url.split("#")[0] === url && "focus" in c) { await c.navigate(url).catch(() => {}); return c.focus(); }
    }
    return self.clients.openWindow(url);
  })());
});
