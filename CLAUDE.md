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

1. **reduceDatabase**: BSC5 카탈로그에서 4등급 이상 밝은 별만 필터링 (~700개)
2. **toVector**: RA/Dec 천문학 좌표 → 3D 단위 벡터 (x, y, z)
3. **createHashFromDatabase**: HEALPix로 천구를 192개 셀로 분할 → 각 셀에서 4개 별 조합(quad) 생성 → 접선 평면 투영 → 정규화된 4D 해시 생성
4. **buildConstellations**: 별자리 연결선 데이터를 벡터 형식으로 변환

### 런타임 Plate Solving (브라우저)

1. **사진 선택**: 샘플 또는 업로드
2. **별 검출**: OpenCV Hough 변환 (Web Worker) → 반지름 순 상위 100개
3. **후보 검색**: 검출된 상위 10개 별에서 C(10,4)=210개 quad 생성 → 4D 해시 계산 → KD-Tree로 DB 매칭
4. **정렬 & 투영**: 매칭된 quad의 3D 벡터로 접선 평면 투영 → 아핀 변환으로 사진↔천구 좌표 매핑
5. **별자리 표시**: 사진 중심 기준 45° 범위 내 별/별자리를 사진 좌표로 투영

## 핵심 알고리즘: Geometric Hashing

- 4개 별로 구성된 사각형(quad)의 기하학적 관계를 4D 벡터로 인코딩
- 정규화: 가장 먼 2점을 (0,0)→(1,1)로 매핑, 나머지 2점의 좌표가 해시
- 회전/스케일/이동 불변 → 같은 별 패턴은 어디서 찍어도 같은 해시
- 대칭성 제거로 해시 유일성 보장

## 경로 별칭 (tsconfig)

- `@/*` → `./src/*`
- `@build/*` → `./build/*`
- `@data/*` → `./data/*`

## 코드 스타일

- ESLint + Prettier (tailwindcss 플러그인)
- import 정렬: type → builtin → external → parent → sibling
- 상대 경로 import 대신 `@/` prefix 사용
- console 사용 경고
