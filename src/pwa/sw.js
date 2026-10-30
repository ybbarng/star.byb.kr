// star.byb.kr 서비스 워커 (docs/pwa.md). 빌드 뒤 src/scripts/pwa/buildServiceWorker.ts가
// VERSION·PRECACHE를 채워 out/sw.js로 쓴다. 이 파일을 직접 내려주지 않는다.
//
// - 설치: 사이트의 모든 페이지(HTML·RSC .txt)와 JS·CSS를 받아 둔다. 그래서 한 번 열면 오프라인에서도
//   게임·별 찾기가 된다 (계산이 모두 브라우저에서 돈다). 해시 이름 파일은 예전 캐시에 있으면 다시 받지 않는다
// - 페이지: 네트워크 먼저 (배포하면 바로 새 버전), 안 되면 받아 둔 것
// - JS·CSS(/_next/static): 받아 둔 것 먼저 (이름에 해시가 있어 바뀌지 않는다)
// - 글꼴 조각·샘플 사진·아이콘: 처음 쓸 때 담아 두고 그다음부터 그것을
// - 발표 자료·다른 주소(방문 통계)는 건드리지 않는다

const VERSION = "__VERSION__";
const PRECACHE = /** @type {string[]} */ (__PRECACHE__);
const PRECACHE_NAME = `precache-${VERSION}`;
const RUNTIME_NAME = "runtime-v1";

const isImmutable = (path) => path.startsWith("/_next/static/");
const isRuntime = (path) =>
  path.endsWith(".woff2") ||
  path.startsWith("/samples/") ||
  path.startsWith("/home/") ||
  path.startsWith("/icons/") ||
  // 은하수 지도 (풀이 Worker가 처음 필요할 때 받는다, journey 57장)
  path.startsWith("/sky/");
const isSkipped = (path) =>
  path.startsWith("/presentation/") || path.startsWith("/data/");

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(PRECACHE_NAME);

      // 동시에 너무 많이 받지 않게 8개씩
      for (let i = 0; i < PRECACHE.length; i += 8) {
        await Promise.all(
          PRECACHE.slice(i, i + 8).map(async (url) => {
            const old = isImmutable(url) ? await caches.match(url) : undefined;
            const response = old ?? (await fetch(url, { cache: "no-cache" }));

            if (!response.ok) {
              throw new Error(`${url}: ${response.status}`);
            }

            await cache.put(url, response);
          }),
        );
      }

      await self.skipWaiting();
    })(),
  );
});

// 새 버전이 자리를 잡으면 예전 버전의 받아 둔 것을 지운다
self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      for (const name of await caches.keys()) {
        // 담아 둔 사진을 새로 받게 하려면 RUNTIME_NAME의 숫자를 올린다
        if (name !== PRECACHE_NAME && name !== RUNTIME_NAME) {
          await caches.delete(name);
        }
      }

      await self.clients.claim();
    })(),
  );
});

// 주소 → 받아 둔 페이지. /games/birthday 와 /games/birthday.txt?_rsc=… 는 물음표 뒤를 빼고 찾는다
const fromPrecache = async (request) => {
  const cache = await caches.open(PRECACHE_NAME);

  return cache.match(request, { ignoreSearch: true });
};

const networkFirst = async (request) => {
  try {
    return await fetch(request);
  } catch (error) {
    const cached = await fromPrecache(request);

    if (cached) {
      return cached;
    }

    throw error;
  }
};

const cacheFirst = async (request, cacheName) => {
  const cached = await caches.match(request);

  if (cached) {
    return cached;
  }

  const response = await fetch(request);

  if (response.ok && cacheName) {
    const cache = await caches.open(cacheName);
    await cache.put(request, response.clone());
  }

  return response;
};

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (
    request.method !== "GET" ||
    url.origin !== self.location.origin ||
    isSkipped(url.pathname)
  ) {
    return;
  }

  // JS·CSS는 받아 둔 것에 있다. 없는 것(예전 탭이 찾는 예전 파일)은 담지 않아 캐시가 쌓이지 않게
  if (isImmutable(url.pathname) && !isRuntime(url.pathname)) {
    event.respondWith(cacheFirst(request, null));
  } else if (isRuntime(url.pathname)) {
    event.respondWith(cacheFirst(request, RUNTIME_NAME));
  } else {
    event.respondWith(networkFirst(request));
  }
});
