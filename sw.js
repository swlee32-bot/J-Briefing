const CACHE_NAME = 'joint-briefing-v6'; 
const ASSETS = [
  './',
  './index.html', 
  './manifest.json',
  './icon.png'
];
const TIMEOUT_DURATION = 3000; 

// ⏱️ 타임아웃이 적용된 커스텀 fetch (가짜 와이파이 방어)
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

// 1. 앱 설치 시 지정된 파일들을 캐시에 저장
self.addEventListener('install', event => {
  self.skipWaiting(); // 새 버전 즉시 활성화
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(ASSETS))
  );
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
  self.clients.claim(); // 즉시 클라이언트 제어권 획득
});

// 3. 통신 가로채기 (오프라인 완벽 대응 + 동적 캐싱)
self.addEventListener('fetch', event => {
  // 🚨 예외 처리: POST 요청 등 캐시하면 안 되는 통신은 네트워크만 사용
  if (event.request.method !== 'GET') {
    event.respondWith(
      fetchWithTimeout(event.request, 5000).catch(() => {
        return new Response(JSON.stringify({ result: "error", msg: "오프라인 상태입니다." }), {
          headers: { 'Content-Type': 'application/json' }
        });
      })
    );
    return;
  }

  // 🛡️ 일반 화면/파일 요청: 철저한 Cache-First 전략
  event.respondWith(
    (async () => {
      // ① 기기에 저장된 캐시가 있으면 즉시 반환 (0.1초 로딩)
      const cachedResponse = await caches.match(event.request);
      if (cachedResponse) {
        return cachedResponse;
      }
      
      // ② 캐시에 없는 파일은 타임아웃을 걸어 네트워크 요청
      try {
        const networkResponse = await fetchWithTimeout(event.request, TIMEOUT_DURATION);
        
        // 💡 핵심: 정상적으로 다운받은 파일(200 OK)만 캐시에 동적 추가 (캐시 오염 방지)
        if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
          const cache = await caches.open(CACHE_NAME);
          cache.put(event.request, networkResponse.clone());
        }

        return networkResponse;
      } catch (error) {
        // ③ 실패 시 (완전 오프라인이거나 가짜 와이파이에 갇혔을 때) 화면 이탈 방어
        if (event.request.mode === 'navigate') {
          return await caches.match('./index.html');
        }
        
        return new Response('오프라인 상태이거나 자원을 찾을 수 없습니다.', {
          status: 503,
          statusText: 'Service Unavailable'
        });
      }
    })()
  );
});

