# star.byb.kr - Plate Solver 프로젝트

## 프로젝트 개요

밤하늘 사진을 분석하여 사진 속 별자리를 찾는 **Plate Solver** 웹 애플리케이션.
발표(Dev Seminar)용 데모 페이지와 시각화 도구를 함께 포함.

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
npm run dev           # 개발 서버 (http://localhost:5025)
npm run build         # 프로덕션 빌드
npm run lint          # ESLint
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
├── search/                    # 검색 알고리즘
│   ├── hooks/                 # useFindCandidates, useFindNearestStars, useFindConstellations
│   ├── workers/               # Web Worker (findCandidatesWorker)
│   └── utils/                 # 벡터 변환
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

1. **reduceDatabase**: BSC5 카탈로그에서 설정 등급 이하의 밝은 별만 필터링 (현재 4등급, 517개)
2. **toVector**: RA/Dec 천문학 좌표 → 3D 단위 벡터 (x, y, z)
3. **createHashFromDatabase**: HEALPix로 천구를 192개 셀(nside=4, 600 arcmin)로 분할 → 각 셀에서 4개 별 조합(quad) 생성 → 접선 평면 투영 → 정규화된 4D 해시 생성
4. **buildConstellations**: 별자리 연결선 데이터를 벡터 형식으로 변환

### 런타임 Plate Solving (브라우저)

1. **사진 선택**: 샘플 또는 업로드
2. **별 검출**: OpenCV Local Maxima (Web Worker) → 적응적 threshold(mean+3σ) → brightness 순 상위 100개
3. **후보 검색**: 검출된 상위 15개 별에서 C(15,4)=1,365개 quad 생성 → 4D 해시 계산 → KD-Tree k=3으로 DB 매칭 → 중복 제거
4. **정렬 & 투영**: 매칭된 quad의 3D 벡터로 접선 평면 투영 → 아핀 변환으로 사진↔천구 좌표 매핑
5. **Verification**: 후보의 변환 행렬로 카탈로그 별을 사진에 투영 → 검출 별과의 매칭률/오차 계산
6. **별자리 표시**: 동적 FOV 계산 → FOV×1.2 범위 내 별/별자리를 사진 좌표로 투영

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
| **V<=4.0 (현재)** | **518** | **8,344** | **15** | **3.9** | **~1MB** |
| V<=4.5 | 904 | 55,399 | 23 | 6.8 | ~6MB |
| V<=5.0 | 1,630 | 553,137 | 38 | 12.4 | ~63MB |
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

- ESLint + Prettier (tailwindcss 플러그인)
- import 정렬: type → builtin → external → parent → sibling
- 상대 경로 import 대신 `@/` prefix 사용
- console 사용 경고
