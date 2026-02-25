const CACHE_NAME = 'joint-briefing-v1';
const ASSETS = [
    './',
    './index.html', // 파일 이름에 띄어쓰기가 있으므로 정확히 일치해야 합니다.
    './manifest.json',
    './icon.png'
];
const TIMEOUT_DURATION = 3000; // 3초 타임아웃 (가짜 와이파이 방어)

// ⏱️ 타임아웃이 적용된 커스텀 fetch (가짜 와이파이 무한 로딩 차단)
const fetchWithTimeout = async (request, timeout) => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
        const response = await fetch(request, { signal: controller.signal });
        clearTimeout(timeoutId);
        return response;
    } catch (error) {
        clearTimeout(timeoutId);
        throw error; // 3초 초과 시 연결을 끊고 오프라인 모드로 강제 전환
    }
};

// 1. 앱 설치 시 파일들을 기기에 저장(캐시)
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => cache.addAll(ASSETS))
    );
    self.skipWaiting();
});

// 2. 앱 업데이트 시 구버전 찌꺼기 완벽 삭제
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

// 3. 가짜 와이파이 무시 & Cache First 전략
self.addEventListener('fetch', event => {
    event.respondWith(
        caches.match(event.request)
            .then(cachedResponse => {
                // 기기에 저장된 캐시(HTML, 아이콘)가 있으면 인터넷 안 찾고 즉시 반환 (0.1초 로딩)
                if (cachedResponse) {
                    return cachedResponse;
                }
                
                // 캐시에 없으면 타임아웃을 걸어서 네트워크 시도
                return fetchWithTimeout(event.request, TIMEOUT_DURATION).catch(() => {
                    // 통신 실패/지연(가짜 와이파이) 시 앱이 멈추지 않고 메인 화면으로 되돌아감
                    if (event.request.mode === 'navigate') {
                        return caches.match('./Joint Briefing v1.0.html');
                    }
                    return new Response('오프라인 상태입니다.', { status: 503 });
                });
            })
    );
});