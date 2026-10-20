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
- **이미지 처리**: OpenCV.js (Web Worker)
- **수학/검색**: mathjs, kd-tree-javascript, @hscmap/healpix
- **Node**: v20.11.0 (.nvmrc)

## 개발 명령어

```sh
npm install           # 의존성 설치
./build_database.sh   # 데이터베이스 파일 생성 (최초 1회)
# 브라우저가 받는 DB는 public/data/에 build 산출물 symlink로 둔다 (gitignore 대상):
#   ln -s $PWD/build/hash/hashed-database.bin public/data/
#   ln -s $PWD/build/database/vectors-database.json public/data/
npm run dev           # 개발 서버 (http://localhost:5025)
npm run build         # 프로덕션 빌드
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
│   ├── database/              # 별 DB 3D 시각화 (/database)
│   ├── demo/                  # 발표용 데모 페이지들
│   │   ├── upload-photo/      # 사진 선택 데모
│   │   ├── detect-stars/      # 별 검출 데모
│   │   ├── catalog/           # 별자리 카탈로그 시각화
│   │   └── healpix/           # HEALPix 시각화
│   └── hash/                  # 해시 알고리즘 시각화
│       ├── sample/            # 샘플 해시 시각화
│       └── feasibility/       # 해시 타당성 검증
├── plate-solver/              # Plate Solver UI 컴포넌트 & 상태
│   ├── store/                 # Zustand store (context, steps)
│   ├── SelectPhotoStep.tsx    # Step 0: 사진 선택
│   ├── DetectStarsStep.tsx    # Step 1: 별 검출 (OpenCV)
│   └── PlateSolvingStep.tsx   # Step 2: 매칭 & 별자리 표시
├── search/                    # 풀이 알고리즘 (순수 함수 코어 + 얇은 Worker/hook)
│   ├── solvePhoto.ts          # 앱의 풀이 흐름 전체 (Worker·테스트가 같이 씀)
│   ├── solveCore.ts           # 후보 하나 검증: RANSAC + 광축 재추정 + log-odds
│   ├── solvers/               # triangle(앱 사용)·improved·baseline·voting, 판정 기준(candidates.ts)
│   ├── catalogGeometry.ts     # 삼각형 인덱스 (2D 격자)
│   ├── fisheyeSolve.ts        # 어안 blind 풀이
│   ├── detectCore.ts          # 별 검출 순수 JS (테스트용, 브라우저는 cv.worker.js)
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
├── services/                  # OpenCV 래퍼(cv.js), 샘플 사진 목록
└── ui/                        # 폰트 등 공용 리소스

data/                          # 원본 카탈로그 및 입력 데이터
build/                         # 빌드된 데이터베이스 (gitignore 대상)
public/
├── catalogs/                  # bsc5.dat, ConstellationLines.dat
├── samples/                   # 샘플 사진들
├── js/                        # opencv.js, cv.worker.js
└── presentation/              # Reveal.js 발표 슬라이드
```

## Plate Solving 파이프라인

### 데이터 준비 (오프라인, build_database.sh)

1. **reduceDatabase**: BSC5 카탈로그에서 설정 등급 이하의 밝은 별만 필터링 (현재 V≤5, 1,625개)
2. **toVector**: RA/Dec 천문학 좌표 → 3D 단위 벡터 (x, y, z)
3. **createHashFromDatabase**: HEALPix로 천구를 192개 셀(nside=4, 600 arcmin)로 분할 → 각 셀에서 4개 별 조합(quad) 생성 → 별쌍이 모두 10° 이내인 compact quad만 남김(84,962개) → 접선 평면 투영 → 정규화된 4D 해시 (`hashed-database.json` 10.8MB)
4. **encodeHashedDatabase**: 브라우저용 이진 형식 `hashed-database.bin`(2.04MB, gzip 1.46MB)으로 변환. 별 번호는 vectors-database.json 순서
5. **buildConstellations**: 별자리 연결선 데이터를 벡터 형식으로 변환

### 런타임 Plate Solving (브라우저)

1. **사진 선택**: 샘플 또는 업로드. 이때 풀이 Worker가 DB를 미리 받아 인덱스를 만든다 (`preloadSolver`)
2. **별 검출**: OpenCV Local Maxima (Web Worker) → 적응적 threshold(mean+3σ) → 가까운 중복 합치기 →
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

점검 결과와 개선 계획: `docs/improvement-plan.md`, 시도·발견 기록: `docs/experiments-journey.md`

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

**Plate Solving 런타임 (브라우저)**

| 단계 | 별 수 의존 | 비고 |
|------|-----------|------|
| hashed-database.json 파싱 | O(N) | **주요 병목**. 63MB 이상이면 브라우저에서 수초~수십초 |
| KD-Tree 초기 구축 | O(N log N) | Worker에서 1회. 100K 엔트리까지 수용 가능 |
| KD-Tree 검색 | O(log N) | 1,365 × 3 × O(log N). N이 10배 늘어도 체감 차이 미미 |
| 사진 quad 생성 | 무관 | C(15,4) = 1,365 고정 |
| Verification | 무관 | 카탈로그 별 수 × 사진 별 수. 단순 거리 계산 |

### 결론

- **V<=4.5 (904별, ~6MB)**: 현실적인 최대치. Plate solving 속도 거의 변화 없음
- **V<=5.0 (1,630별, ~63MB)**: 가능하나 초기 로딩이 수초 증가. JSON→binary 포맷 전환 시 해결 가능
- **V<=5.5 이상**: 브라우저에서 감당 불가. binary 포맷 + 스트리밍 등 근본적 구조 변경 필요

### 향후 최적화 방향 (별 수를 더 늘리려면)

1. **hashed-database.json → Float32Array 기반 binary 포맷**: JSON 파싱 제거, 크기 1/3~1/4로 축소
2. **KD-Tree 사전 직렬화**: ArrayBuffer로 저장하여 구축 시간 제거
3. **HEALPix nside 조정**: 셀 크기를 줄여 셀당 별 수를 제한하면 quad 폭발 억제 가능
4. **셀당 최대 별 수 제한**: 밝은 별 우선으로 셀당 N개까지만 사용

## 코드 스타일

- 커밋 전 lefthook이 자동 확인: pre-commit(커밋 파일 ESLint + 전체 tsc), pre-push(`npm run lint`)

- ESLint + Prettier (tailwindcss 플러그인)
- import 정렬: type → builtin → external → parent → sibling
- 상대 경로 import 대신 `@/` prefix 사용
- console 사용 경고
