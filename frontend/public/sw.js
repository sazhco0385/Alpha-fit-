/* AlphaFit Service Worker — Web Push handler */
const SW_VERSION = 'alphafit-sw-v1';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('push', (event) => {
  let data = { title: 'Alpha Fit', body: '🛡️ Push received', url: '/dashboard', tag: 'alphafit' };
  try {
    if (event.data) data = { ...data, ...event.data.json() };
  } catch (e) {
    // not JSON, ignore
  }
  const options = {
    body: data.body,
    icon: '/alphafit-helmet-256.png',
    badge: '/alphafit-helmet-192.png',
    tag: data.tag,
    renotify: true,
    data: { url: data.url || '/dashboard' },
    vibrate: [120, 60, 120],
  };
  event.waitUntil(self.registration.showNotification(data.title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || '/dashboard';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((winList) => {
      // Focus an existing client if one is open
      for (const c of winList) {
        if ('focus' in c) {
          c.navigate(url).catch(() => {});
          return c.focus();
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(url);
    })
  );
});

self.addEventListener('pushsubscriptionchange', (event) => {
  // Browser auto-rotated subscription — re-fetch from server
  // (handled client-side on next app open)
});
