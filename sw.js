self.addEventListener('install', (e) => {
    self.skipWaiting();
});

self.addEventListener('activate', (e) => {
    e.waitUntil(clients.claim());
});

// Native Notification Display Event
self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'SHOW_NOTIFICATION') {
        const { title, body, icon, url } = event.data.payload;
        self.registration.showNotification(title, {
            body: body,
            icon: icon || 'https://cdn-icons-png.flaticon.com/512/1827/1827349.png',
            badge: 'https://cdn-icons-png.flaticon.com/512/1827/1827349.png',
            vibrate: [200, 100, 200],
            data: { url: url }
        });
    }
});

self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    const targetUrl = event.notification.data ? event.notification.data.url : '/';
    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
            for (const client of clientList) {
                if (client.url.includes(targetUrl) && 'focus' in client) {
                    return client.focus();
                }
            }
            if (clients.openWindow) {
                return clients.openWindow(targetUrl);
            }
        })
    );
});