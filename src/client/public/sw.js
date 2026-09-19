// Service Worker for Octopus Agile Rate Monitor Web Push Notifications

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('push', (event) => {
  let title = '🐙 Octopus Agile Rate Alert';
  let body = 'Energy rates have changed!';
  let url = '/';

  if (event.data) {
    try {
      const parsed = event.data.json();
      if (parsed.title) title = parsed.title;
      if (parsed.body) body = parsed.body;
      if (parsed.url) url = parsed.url;
    } catch {
      try {
        const text = event.data.text();
        if (text) body = text;
      } catch (e) {
        console.error('Error reading push data:', e);
      }
    }
  }

  const options = {
    body: body,
    icon: '/apple-touch-icon.png',
    badge: '/apple-touch-icon.png',
    data: { url: url }
  };

  event.waitUntil(
    self.registration.showNotification(title, options).catch((err) => {
      console.error('Failed to show notification:', err);
      // Fallback with minimal options
      return self.registration.showNotification(title, { body: body });
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const targetUrl = event.notification.data?.url || '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});
