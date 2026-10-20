# 배포 준비 메모

> 상태 (2026-10-21): **앱 저장소 쪽 완료** — 정적 내보내기(A안), `Dockerfile`(nginx), `ops/nginx.conf`, `.github/workflows/image.yml`.
> 서버 쪽(byb.kr, Traefik + Docker)은 servers 저장소 `byb.kr/apps/star/`(compose·deploy.sh·배포 키)가 맡는다
> (`~/personal/projects/servers/byb.kr/apps/star/HANDOFF.md`, `apps/README.md`).

## 지금 구성

- `next.config.ts`: `output: "export"` → `npm run build` 가 `out/` 을 만든다 (페이지마다 `games/birthday.html` 꼴)
- `Dockerfile`: node 20 에서 `./build_database.sh && npm run build` → `nginx:1.27-alpine` 에 `out/` 과 `ops/nginx.conf` 만. 컨테이너 안 포트 80
- `ops/nginx.conf`: gzip, 캐시 헤더(아래), `/games/birthday` → `games/birthday.html`, 없는 주소는 `404.html`(no-cache)
- `.github/workflows/image.yml`: main push → 이미지 빌드 → `ghcr.io/ybbarng/star.byb.kr:<sha>`·`latest` → SSH 로 `deploy <sha>`.
  문서만 바뀐 push 는 건너뛴다. 시크릿 `SERVER_HOST`·`SERVER_USER`·`SERVER_SSH_KEY`(servers 세션이 만든다)
- 헬스체크 주소: `/` (가벼운 정적 HTML, 200)
- 로컬 확인: `docker build -t star . && docker run -p 8080:80 star` (2026-10-21 확인: 샘플 풀이, WebP 업로드 풀이, 게임 여섯 개, 404)
- 이미지 크기 약 197MB — 대부분 발표 슬라이드(`public/presentation`, 122MB). 외부 사진(`samples-external`)·로컬 링크(`data`)는 들어가지 않는다

## 서버가 하는 일: 정적 파일 내려주기뿐

- `npm run build` 결과 **모든 페이지가 정적(○)**이다. 서버에서 실행되는 API·페이지 생성이 없다.
- 별 찾기·풀이·게임 계산은 모두 **사용자 기기(브라우저)**에서 한다. 업로드한 사진도 서버로 가지 않는다.
- 그래서 서버 부하는 거의 없고, 비용은 전송량에 비례한다. 첫 방문에 약 0.68MB(압축), 다시 오면 캐시
  (`download-optimization.md`). 예: 월 1만 명 첫 방문 ≈ 7GB. 샘플 사진은 고를 때마다 60KB~1.3MB를 더 받는다.

## 빌드

```sh
npm ci
./build_database.sh   # 빌드 전에 필요: 앱이 build/database/의 JSON(별 카탈로그·별자리선·별 거리)을 코드에 싣는다
npm run build
```

- 예전처럼 `public/data`에 DB 파일 링크를 둘 필요는 없다 (패턴 DB는 브라우저가 만든다, journey 28장).
- `build_database.sh`는 `data/database/bsc5-short.json`에서 시작한다 (저장소에 있음).

## 두 가지 방식

| 방식 | 구성 | 장점 | 단점 |
|---|---|---|---|
| **A. 정적 내보내기 (추천)** | `next.config.ts`에 `output: "export"` → `out/` 폴더를 정적 파일 서버 컨테이너(예: nginx:alpine, caddy)로 서빙, Traefik이 앞에서 라우팅·TLS | Node 프로세스가 없다. 가장 가볍다 | 내보내기 설정으로 바꿔 한 번 확인해야 한다 (이미지 최적화 등 서버 기능을 쓰지 않으므로 큰 걱정은 없다) |
| B. Next 서버 | `next start` 컨테이너, Traefik이 앞에서 라우팅·TLS | 지금 그대로 | Node 프로세스가 늘 떠 있다 (그래도 정적 페이지라 부하는 작다) |

Traefik은 리버스 프록시라 정적 파일을 직접 내려주지 않는다. A든 B든 뒤에 작은 컨테이너 하나가 필요하다.

## 꼭 챙길 설정

- **압축**: Traefik `compress` 미들웨어(gzip/brotli) 또는 뒤쪽 서버의 gzip. 위 0.68MB는 압축 기준이다.
- **캐시 헤더**:
  - `/_next/static/**` (파일 이름에 해시가 있다), 글꼴 조각(`*.woff2`): `Cache-Control: public, max-age=31536000, immutable`
  - HTML: `no-cache` (배포하면 바로 새 버전)
  - `/samples/**`: 하루~일주일 정도
- **Web Worker**: 별 찾기·풀이 Worker는 같은 출처의 `/_next/static/chunks/*.js`로 뜬다. 다른 도메인(CDN)으로 나누지 않는다.
- **HTTPS**: Traefik의 Let's Encrypt.

## 배포 뒤 확인할 것

- 플레이트 솔버: 샘플(북두칠성) 풀이, 사진 업로드(JPEG·PNG·WebP) 풀이, EXIF 촬영 시각이 채워지는지
- 게임 허브와 여섯 게임이 열리는지
- 브라우저 개발자 도구에서 처음 받는 양(약 0.68MB)과 압축·캐시 헤더
- 핸드폰에서 풀이 시간 (아직 실제 기기로 재지 않았다)
- `/hash/feasibility` 데모는 지금 동작하지 않는다 (발표 준비 때 정하기로 함, journey 남은 TODO)
