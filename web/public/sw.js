// Service worker: odbiera powiadomienia push (np. „nowy raport gotowy”) i otwiera apkę po stuknięciu.
// Bez cache stron — apka zawsze pokazuje świeże dane z serwera.

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { body: event.data ? event.data.text() : '' };
  }
  event.waitUntil(
    // Pusty tytuł jest celowy (iPhone i tak pokazuje "from Research") — tylko brak tytułu zastępujemy nazwą
    self.registration.showNotification(data.title ?? 'Research', {
      body: data.body || 'Nowy raport jest gotowy',
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      // Ten sam tag = nowe powiadomienie zastępuje poprzednie (nie zbiera się 3 dziennie na ekranie)
      tag: data.tag || 'raport',
      data: { url: data.url || '/' },
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = new URL(event.notification.data?.url || '/', self.location.origin).href;
  event.waitUntil(
    (async () => {
      const okna = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      // Apka już otwarta — przełączamy na nią i przechodzimy na właściwą stronę
      for (const okno of okna) {
        if (new URL(okno.url).origin === self.location.origin) {
          await okno.focus();
          return okno.navigate(url);
        }
      }
      return self.clients.openWindow(url);
    })(),
  );
});
