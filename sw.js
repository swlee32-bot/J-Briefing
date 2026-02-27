const CACHE_NAME = 'joint-briefing-v4'; // 버전을 v2로 올려서 옛날 캐시를 지웁니다.
const ASSETS = [
    './',
    './index.html', 
    './manifest.json',
    './icon.png'
];
const TIMEOUT_DURATION = 3000; 

const fetchWithTimeout = async (request, timeout) => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
        const response = await fetch(request, { signal: controller.signal });
        clearTimeout(timeoutId);
        return response;
    } catch (error) {
        clearTimeout(timeoutId);
        throw error; 
    }
};

self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => cache.addAll(ASSETS))
    );
    self.skipWaiting();
});

self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cacheName => {
                    if (cacheName !== CACHE_NAME) {
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
    self.clients.claim();
});

self.addEventListener('fetch', event => {
    event.respondWith(
        caches.match(event.request)
            .then(cachedResponse => {
                if (cachedResponse) {
                    return cachedResponse;
                }
                
                return fetchWithTimeout(event.request, TIMEOUT_DURATION).catch(() => {
                    if (event.request.mode === 'navigate') {
                        // 오프라인일 때 찾아갈 파일 이름도 index.html로 변경 완료!
                        return caches.match('./index.html');
                    }
                    return new Response('오프라인 상태입니다.', { status: 503 });
                });
            })
    );

});

