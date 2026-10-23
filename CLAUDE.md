# star.byb.kr - Plate Solver 프로젝트

## 프로젝트 개요

밤하늘 사진을 분석하여 사진 속 별자리를 찾는 **Plate Solver** 웹 애플리케이션.
발표(Dev Seminar)용 데모 페이지와 시각화 도구를 함께 포함.

**작업 기준: [`docs/project-principles.md`](docs/project-principles.md)** — 직접 구현, 일반인 사진에 대한 강건성,
사람 협업에서 자동으로, 프론트 실행·저비용, 10초 목표, 단계별 테스트, 발표용 문서화 등.
설계·우선순위를 정할 때 이 문서를 먼저 따른다.

## 기술 스택

- **프레임워크**: Next.js 15 (App Router, Turbopack dev)
- **언어**: TypeScript (strict)
- **UI**: React 19, Tailwind CSS 4, DaisyUI 5
- **상태 관리**: Zustand
- **시각화**: Three.js (3D 천구), Konva/react-konva (2D 캔버스)
- **이미지 처리**: 순수 JS 별 검출 (Web Worker, `search/detectImage.ts`). OpenCV.js는 2026-10에 뺐다 (다운로드 3.9MB 절약)
- **수학/검색**: 순수 JS (풀이 경로), @hscmap/healpix. mathjs·kd-tree-javascript는 비교용 원본 solver·스크립트에만
- **Node**: v20.11.0 (.nvmrc)

## 개발 명령어

```sh
npm install           # 의존성 설치
./build_database.sh   # 데이터베이스 파일 생성 (최초 1회, 빌드 전에 필요 — 앱이 build/의 JSON을 코드에 싣는다)
npm run dev           # 개발 서버 (http://localhost:5025)
npm run build         # 프로덕션 빌드 (정적 내보내기 → out/, 배포는 docs/deployment.md)
npm run lint          # ESLint
npm test              # vitest (합성·실제 샘플 회귀 포함, 약 90초)
npm run benchmark:update  # 알고리즘 비교 결과를 docs/benchmark-results.json에 갱신
```

## 디렉토리 구조

```
src/
├── app/                       # Next.js App Router 페이지
│   ├── page.tsx               # 홈 (/)
│   ├── plate-solver/          # Plate Solver 메인 (/plate-solver)
│   ├── games/                 # 별 놀이터 (/games, 게임 여섯 개)
│   ├── learn/                 # 찾는 원리 (/learn, 단계별 설명·데모 — 발표 자료로도 쓴다, 부품은 src/learn)
│   └── embed/[demo]/          # 찾는 원리 데모를 발표 화면에 하나씩 (/embed/<이름>)
├── game/                      # 별 놀이터(게임): sky(공용 밤하늘 그리기·장면·카탈로그), 게임별 폴더 — docs/game-plans.md
├── plate-solver/              # Plate Solver UI 컴포넌트 & 상태
│   ├── store/                 # Zustand store (context, steps)
│   ├── SelectPhotoStep.tsx    # Step 0: 사진 선택
│   ├── DetectStarsStep.tsx    # Step 1: 별 검출
│   └── PlateSolvingStep.tsx   # Step 2: 매칭 & 별자리 표시
├── search/                    # 풀이 알고리즘 (순수 함수 코어 + 얇은 Worker/hook)
│   ├── solvePhoto.ts          # 앱의 풀이 흐름 전체 (Worker·테스트가 같이 씀)
│   ├── solveCore.ts           # 후보 하나 검증: RANSAC + 광축 재추정 + log-odds
│   ├── solvers/               # triangle(앱 사용)·improved·baseline·voting, 판정 기준(candidates.ts)
│   ├── catalogGeometry.ts     # 삼각형 인덱스 (2D 격자)
│   ├── fisheyeSolve.ts        # 어안 blind 풀이
│   ├── detectCore.ts          # 별 검출 핵심 (detectImage.ts가 회색조·흐림·차영상을 만들어 넘김, 브라우저·테스트 공통)
│   ├── solverClient.ts        # 공유 풀이 Worker 클라이언트 (미리 준비·요청 번호)
│   ├── hooks/                 # useSolve, useSkyOverlay
│   ├── workers/               # solverWorker
│   ├── solverContext.ts       # 풀이 인덱스 묶음 (quad·삼각형·밝은 별 삼각형)
│   └── utils/                 # wcs·similarity·homography·fisheye·stats·gridIndex2D·selectStars
├── test/                      # vitest: synthetic(합성 사진·픽셀 장면)·unit·e2e·real(실제 샘플·정답 포즈)
├── scripts/                   # 데이터베이스 빌드 스크립트 (tsx로 실행)
│   ├── database/              # 카탈로그 축소, 벡터 변환, 별자리 빌드
│   ├── hash/                  # quad 해시 생성 알고리즘
│   └── search/                # 검색 테스트/벤치마크
├── services/                  # 샘플 사진 목록, EXIF

data/                          # 원본 카탈로그 및 입력 데이터
build/                         # 빌드된 데이터베이스 (gitignore 대상)
public/
├── samples/                   # 샘플 사진들
└── presentation/              # Reveal.js 발표 슬라이드 (v3.html. V2 발표는 2026-10-23에 지웠다, git 기록에 있다)
```

## Plate Solving 파이프라인

### 데이터 준비 (오프라인, build_database.sh)

1. **reduceDatabase**: BSC5 카탈로그에서 설정 등급 이하의 밝은 별만 필터링 (현재 V≤5, 1,624개. 폭발 때 밝기로 실린 재발 신성 북쪽왕관자리 T는 평소 밝기로 고쳐 뺀다)
2. **toVector**: RA/Dec 천문학 좌표 → 3D 단위 벡터. 앱이 코드에 싣는 `vectors-database.json`은 쓰는 칸(HR·N·V·K·x·y·z, 좌표 소수 8자리)만 남겨 138KB(gzip 41KB)
3. **createHashFromDatabase**: quad 해시 JSON(비교용 검색 스크립트 src/scripts/search만 읽는다)
4. **buildConstellations**: 별자리 연결선 데이터를 벡터 형식으로 변환
5. **buildParallax**: 빛의 타임캡슐(게임)용 별 거리

quad 해시 DB는 내려받지 않고 풀이 Worker가 카탈로그에서 만든다 (`search/quadDatabase.ts`, node 약 0.12~0.2초):
HEALPix로 천구를 192개 셀(nside=4, 셀 중심에서 10°)로 나눔 → 셀마다 4개 별 조합 → 별쌍이 모두 10° 이내인 compact quad만
→ 이웃 셀에서 겹친 것 제거(82,605개) → 접선 평면 투영 → 정규화된 4D 해시. 예전 이진 파일(gzip 1.46MB)과 같은 quad·해시다

### 런타임 Plate Solving (브라우저)

1. **사진 선택**: 샘플 또는 업로드. 이때 풀이 Worker가 quad 해시 DB와 인덱스(4D KD-tree `utils/kdTree4.ts`, 삼각형 인덱스)를 미리 만든다 (`preloadSolver`, node 약 0.8초)
2. **별 검출**: 순수 JS Local Maxima (Web Worker, 회색조 → 상자 흐림 3번(σ≈8) → 차영상) → 적응적 threshold(mean+3σ) → 가까운 중복 합치기 →
   별다움(`ringContrast`: 주변 고리가 고른 하늘인지) 계산 → 별다운 것 먼저, 그 안에서 밝은 순.
   한 줄에 규칙적인 간격으로 줄지은 검출(비행기 불빛·창문 줄, `findAlignedStars`)은 뒤로. 상위 100개 표시.
   사람이 마커를 지우거나 추가하고, 영역만 재검출할 수 있다
3. **풀이** (`solvePhoto`, 시간 상한 8초): 우선순위(별다움 → 밝기) 상위 15·25·40·60개로 차례로 푼다.
   모든 solver로 사진 전체를 먼저 보고, 못 풀면 위쪽 영역(75·55·45%)으로. 확신하면 바로 멈춘다
   - **매칭**: 밝은 별 10개의 삼각형을 FOV 후보(10~75°)마다 접선평면 형태로 바꿔 카탈로그 삼각형 인덱스(18° 이내)와
     밝은 별(3.5등급 이하, 30° 이내) 인덱스에서 각각 k=8 검색. 그 FOV에서 크기(각거리)가 2배 넘게 다른 삼각형은 버린다
   - **검증** (`solveCore`): 대응 3별로 RANSAC + 광축 재추정 → 대응이 8개 이상이면 원근 변환(호모그래피)으로 정밀화
     (원근 보정된 사진 대응) → 카탈로그를 투영해 inlier 수집 → 우연일 확률(log-odds) 계산
   - **마무리** (`refineSolution`): 확신한 변환을 그 영역의 별 60개로 다시 검증해 점수가 오르면 바꾼다
   - **판정** (`candidates.ts`): log-odds ≥ 9(우연일 확률 10억 분의 1)일 때만 "해 찾음". 아니면 후보만 사람에게 제시
   - 직선투영으로 확신 못 하면 어안 blind 풀이 시도
4. **별자리 표시**: 선택한 해의 변환으로 카탈로그 별/별자리를 사진 좌표로 투영 (카메라 뒤쪽 별은 제외).
   유명한 딥스카이(`skyObjects.ts`)는 늘, 해·달·행성(`utils/ephemeris.ts`·`utils/planets.ts`)은 촬영 시각
   (샘플 기록 → EXIF → 사람이 입력)을 알 때만 그린다
5. **촬영 시각 추정** (`shotTimeEstimate.ts`): 사람이 찍은 지평선 두 점 → 천정 → 위도·지방 항성시 →
   날짜별로 같은 하늘이 되는 밤 시각. 달을 찍으면 달 위치가 맞는 날짜 순 (달 모양으로 27.3일 간격을 가른다)
6. **시각·장소·지평선 풀이** (`horizonSolve.ts`, 별이 10개 안팎이라 blind가 확신 못 하는 사진): 촬영 시각(범위)·장소와
   지평선 두 점으로 미지수를 방위·시야각으로 줄여 투표 → 모델 안에서만 다듬기 → 칸 수로 깎은 log-odds ≥ 0이면 확신.
   기준은 합성 장면 130개(`synthetic/horizonScene.ts`)로 정했다 (사이판 사진이 이것으로 풀린다)
   - 지평선은 자동으로 제안한다 (`utils/horizonDetect.ts`: 열마다 밝기 계단 → RANSAC 직선). 틀리면 사람이 다시 찍는다.
     blind가 확신 못 하고 촬영 시각·장소가 있으면 시각·장소 풀이가 자동으로 돈다 (사이판 샘플은 클릭 없이 풀린다)

점검 결과와 개선 계획: `docs/improvement-plan.md`, 시도·발견 기록: `docs/experiments-journey.md`, 다운로드 용량 최적화(발표용): `docs/download-optimization.md`

## 핵심 알고리즘: Geometric Hashing

- 4개 별로 구성된 사각형(quad)의 기하학적 관계를 4D 벡터로 인코딩
- 정규화: 가장 먼 2점을 (0,0)→(1,1)로 매핑, 나머지 2점의 좌표가 해시
- 회전/스케일/이동 불변 → 같은 별 패턴은 어디서 찍어도 같은 해시
- 대칭성 제거로 해시 유일성 보장

## 경로 별칭 (tsconfig)

- `@/*` → `./src/*`
- `@build/*` → `./build/*`
- `@data/*` → `./data/*`

## 별 등급별 성능 분석

원본 카탈로그(BSC5, `data/database/bsc5-short.json`, 9,096개)에서 등급별 별 수와 quad 수를 분석한 결과.
HEALPix nside=4, 192셀, 600 arcmin 기준. 2025-02-08 측정.

### 등급별 데이터 규모

| 등급 한계 | 별 수 | quad 수 | 최대 셀 별 수 | 평균 셀 별 수 | 예상 DB 크기 |
|-----------|-------|---------|--------------|--------------|-------------|
| V<=4.0 | 518 | 8,344 | 15 | 3.9 | ~1MB |
| V<=4.5 | 904 | 55,399 | 23 | 6.8 | ~6MB |
| V<=5.0 | 1,630 | 553,137 | 38 | 12.4 | ~63MB |
| **V<=5.0 + compact(10°) (현재)** | **1,625** | **84,962** | | | **10.8MB** |
| V<=5.5 | 2,887 | 4,966,646 | 64 | 21.9 | ~568MB |
| V<=6.0 | 5,080 | 41,280,631 | 104 | 38.5 | ~4.7GB |

### 병목 분석

**DB 빌드 (오프라인, 1회성)**
- 셀당 별 수 k에서 quad 수 = C(k,4). k가 증가하면 O(k⁴)로 폭발
- 4등급: 수초 / 4.5등급: 수십초 / 5등급: 수분 / 5.5등급 이상: 수십분~수시간
- 1회성이므로 빌드 시간 자체는 허용 가능

**Plate Solving 런타임 (브라우저)** — 2026-10-20 다시 점검 (node 측정, journey 28장)

| 단계 | 시간 | 비고 |
|------|------|------|
| quad 해시 DB 만들기 | 0.12~0.2초 | 내려받지 않는다 (예전 gzip 1.46MB) |
| 4D KD-tree 구축 | 0.035초 | 타입 배열 KD-tree (예전 라이브러리 0.31초) |
| 전체 삼각형 인덱스(약 113만 개) | 0.55초 | 타입 배열에 쌓아 메모리가 수백 MB로 치솟지 않는다 |
| 밝은 별 삼각형 인덱스 | 0.05초 | |

처음 받는 양 (프로덕션, 압축): 플레이트 솔버 약 0.68MB(JS 0.31·글꼴 0.31·CSS 0.03), 게임 약 0.68MB.
예전에는 플레이트 솔버만 약 8MB(OpenCV 3.9·패턴 DB 1.5·글꼴 2.0·mathjs 0.19 등)였다. 정리: docs/download-optimization.md
글꼴은 Pretendard 동적 부분 집합(92조각 중 쓰인 글자 조각만)을 쓴다.

### 결론

- 별을 더 늘리면(V≤5.5 이상) quad가 C(k,4)로 폭발한다. 지금은 브라우저에서 만드니 받는 양은 늘지 않지만
  만드는 시간·메모리가 문제가 된다 → 셀당 최대 별 수 제한, nside 조정이 다음 단계

## 코드 스타일

- 커밋 전 lefthook이 자동 확인: pre-commit(커밋 파일 ESLint + 전체 tsc), pre-push(`npm run lint` + `npm test` 회귀 테스트, 약 90초)

- ESLint + Prettier (tailwindcss 플러그인)
- import 정렬: type → builtin → external → parent → sibling
- 상대 경로 import 대신 `@/` prefix 사용
- console 사용 경고
