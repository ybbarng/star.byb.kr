# PWA (홈 화면에 추가·오프라인)

2026-10-27. 사이트 전체가 한 앱이다. 별 놀이터만 따로 앱으로 두지 않았다: 범위를 `/games/`로 좁히면 게임 속
"하늘 읽기 기초"·"찾는 원리" 링크가 범위 밖이라 앱 안에 브라우저 창이 따로 뜬다.

## 무엇이 있나

| 파일 | 하는 일 |
|------|---------|
| `src/app/manifest.ts` → `/manifest.webmanifest` | 이름·색·시작 주소(`/`)·바로가기(사진으로 별 찾기·별 놀이터·오늘 밤 하늘) |
| `src/app/icon.svg`·`favicon.ico`·`apple-icon.png`, `public/icons/` | 아이콘. 마스커블은 원으로 잘려도 되게 그림을 가운데 72%로 모았다 |
| `src/pwa/sw.js` | 서비스 워커 틀. 직접 내려주지 않는다 |
| `src/scripts/pwa/buildServiceWorker.ts` | `npm run build` 뒤(postbuild)에 `out/sw.js`·`out/sitemap.xml`을 만든다 |
| `src/ui/ServiceWorker.tsx` | 프로덕션에서만 `/sw.js`를 등록한다 (개발 서버에는 sw.js가 없다) |
| `ops/nginx.conf` | `sw.js`·매니페스트는 `no-cache` (배포가 바로 퍼지게) |

## 서비스 워커가 하는 일

- **설치**: 페이지(HTML과 화면 이동 때 받는 RSC `.txt`)와 `/_next/static`의 JS·CSS를 모두 받아 둔다.
  계산이 모두 브라우저에서 돌아서, 한 번 열면 오프라인에서도 게임·별 찾기·기초가 된다.
  처음 받는 양은 압축 기준 약 1.35MB(페이지 0.4·JS·CSS 0.94). 해시 이름 파일은 예전 버전에 있으면 다시 받지 않는다
- **버전**: 받아 둘 파일들 내용의 해시. 바뀐 게 없으면 sw.js도 그대로라 아무 일도 없다
- **페이지**: 네트워크 먼저. 온라인이면 늘 새 버전, 오프라인이면 받아 둔 것
- **JS·CSS**: 받아 둔 것 먼저 (이름에 해시가 있다)
- **글꼴 조각·샘플 사진·첫 화면 그림·아이콘**: 처음 쓸 때 `runtime-v1`에 담는다. 글꼴은 92조각 중 쓴 것만
- **건드리지 않는 것**: 발표 자료(`/presentation`, 32MB), `/data`(앱이 안 쓴다), 다른 주소(방문 통계)
- **배포 뒤**: 새 sw.js가 설치를 마치면 바로 자리를 잡고(`skipWaiting`) 예전 받아 둔 것을 지운다.
  시험(로컬, 2026-10-27): 배포 직후 온라인 새로고침은 바로 새 페이지, 약 1.5초 뒤 새 버전이 자리를 잡고 옛 캐시를 지웠다. 그 뒤 오프라인에서도 새 버전

## 주의

- 샘플 사진을 같은 이름으로 바꾸면 이미 담아 둔 기기에는 옛 사진이 남는다. `sw.js`의 `RUNTIME_NAME` 숫자를 올린다
- iOS에는 설치 단추가 없다. Safari 공유 → "홈 화면에 추가". 홈 화면에 추가하면 7일 안 쓰면 지우는 규칙에서 빠져
  게임 기록(localStorage)도 더 안전하다

## 문제가 생기면: 서비스 워커 끄기

서비스 워커는 사용자 기기에 남는다. 잘못된 버전이 퍼졌으면 `src/pwa/sw.js`를 아래로 바꿔 배포한다
(받아 둔 것을 지우고 스스로 등록을 풀고 열린 화면을 새로 연다). 등록 코드(`ServiceWorker.tsx`)는 그대로 둔다:
등록을 빼면 이미 설치된 기기의 서비스 워커가 새 sw.js를 받지 못한다.

```js
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      for (const name of await caches.keys()) await caches.delete(name);
      await self.registration.unregister();
      for (const client of await self.clients.matchAll()) client.navigate(client.url);
    })(),
  );
});
```

틀의 자리 표시(`__VERSION__`·`__PRECACHE__`)가 없으면 빌드 스크립트가 멈추니, 끄는 버전을 쓸 때는
`const VERSION = "__VERSION__"; const PRECACHE = __PRECACHE__;` 두 줄을 남겨 둔다.
