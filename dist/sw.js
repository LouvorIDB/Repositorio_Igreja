const CACHE_NAME = 'liturge-v23';

const ASSETS_TO_CACHE = [
    './',
    './index.html',
    './manifest.json',
    './favicon.ico',
    './icon-192.png',
    './icon-512.png',
    './css/style.css',
    './js/config.js',
    './js/store.js',
    './js/db.js',
    './js/router.js',
    './js/utils.js',
    './js/player.js',
    './js/admin.js',
    './js/culto-editor.js',
    './js/holyrics-exporter.js',
    './js/almoxarifado.js',
    './js/analytics.js',
    './js/agenda.js',
    './js/disponibilidade.js',
    './js/whatsapp-dispatcher.js',
    './js/app.js',
    './views/admin-panel.html',
    './views/secao-cultos.html',
    './views/secao-novas.html',
    './views/secao-repertorio.html',
    './views/secao-midia.html',
    './views/secao-agenda.html',
    './views/secao-almoxarifado.html',
    './views/secao-analytics.html',
    './views/secao-holyrics.html',
    './views/modais.html',
    './icon-192.png',
    './icon-512.png'
];

// Instalação: Precaching resiliente do App Shell + Views HTML
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(async (cache) => {
                for (const asset of ASSETS_TO_CACHE) {
                    try {
                        await cache.add(asset);
                    } catch (e) {
                        // Não interrompe os demais arquivos caso algum retorne 404
                    }
                }
            })
            .then(() => self.skipWaiting())
    );
});

// Ativação: Limpeza de caches antigos
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cache) => {
                    if (cache !== CACHE_NAME) {
                        return caches.delete(cache);
                    }
                })
            );
        }).then(() => self.clients.claim())
    );
});

// Interceptação de requisições com suporte a Cache First para Assets Locais
self.addEventListener('fetch', (event) => {
    if (event.request.method !== 'GET') return;

    const url = new URL(event.request.url);
    if (url.origin !== location.origin) return;

    event.respondWith(
        caches.match(event.request, { ignoreSearch: true }).then((cachedResponse) => {
            if (cachedResponse) {
                // Tenta atualizar em segundo plano se houver rede
                fetch(event.request).then((networkResponse) => {
                    if (networkResponse && networkResponse.status === 200) {
                        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, networkResponse));
                    }
                }).catch(() => {});
                return cachedResponse;
            }

            return fetch(event.request).then((networkResponse) => {
                if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
                    const responseToCache = networkResponse.clone();
                    caches.open(CACHE_NAME).then((cache) => cache.put(event.request, responseToCache));
                }
                return networkResponse;
            }).catch(() => {
                // Fallback para index.html se for navegação
                if (event.request.mode === 'navigate') {
                    return caches.match('./index.html');
                }
            });
        })
    );
});
