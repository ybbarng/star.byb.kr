# star.byb.kr
나만의 작고 소중한 Plate Solver

밤하늘 사진을 올리면 별들의 배치만 보고 하늘 어디를 찍었는지 찾아, 사진 위에 별자리와 별 이름을 그려 줍니다.
모든 계산은 브라우저에서 합니다. https://star.byb.kr

- **사진으로 찾기** (`/plate-solver`): 사진 고르기 → 별 찾기 → 풀이. 자동으로 못 풀면 사람이 별을 고치거나 촬영 시각·장소·지평선을 알려 주면 같이 풉니다.
- **찾는 원리** (`/learn`): 별 찾기, 모양 맞추기(삼각형·quad·HEALPix), 확인하기(우연일 확률)를 데모와 함께 설명합니다.
- **별 놀이터** (`/games`): 하늘 맞추기, SkyGuessr, 사람 계산원 vs 컴퓨터 같은 게임 12개와 생일 별자리, 오늘 밤 내 하늘 같은 둘러보기 7개.
- **발표 자료** (`/presentation/v3.html`): Reveal.js 발표. 데모는 `/embed/<이름>`으로 들어갑니다.

## 간단 사용법

> [!NOTE]
> [nvm을 설치](https://github.com/nvm-sh/nvm)해주세요. Node 버전은 `.nvmrc`(v20.11.0)를 따릅니다.

```sh
git clone https://github.com/ybbarng/star.byb.kr.git
cd star.byb.kr
nvm use
npm install
./build_database.sh   # 처음 한 번. 앱이 build/의 데이터를 코드에 싣기 때문에 서버를 켜기 전에 필요합니다
npm run dev
```

웹브라우저에서 http://localhost:5025 를 열어주세요.

## 데이터베이스 파일 준비

`./build_database.sh`가 아래를 차례로 실행해 `build/`에 파일을 만듭니다 (`build/`는 저장소에 올리지 않습니다).

```sh
# 예일 밝은 별 목록(BSC5)에서 5등급까지의 밝은 별만 남긴다 (1,625개)
npx tsx src/scripts/database/reduceDatabase.ts
# 적경·적위를 3차원 단위 벡터로 바꾼다
npx tsx src/scripts/database/toVector.ts
# quad 해시 JSON (비교용 검색 스크립트만 쓴다. 앱은 브라우저에서 카탈로그로 직접 만든다)
npx tsx src/scripts/hash/createHashFromDatabase.ts
# 별자리선과 별자리 경계
npx tsx src/scripts/database/buildConstellations.ts
# 빛의 타임캡슐(게임)용 별 거리
npx tsx src/scripts/database/buildParallax.ts
# 사이트 배경(실제 서울 하늘)용 작은 별 지도
npx tsx src/scripts/database/buildBackgroundSky.ts
```

## 자주 쓰는 명령

```sh
npm run dev      # 개발 서버 (http://localhost:5025)
npm run lint     # ESLint
npm test         # vitest (합성·실제 샘플 회귀 포함, 2분쯤)
npm run build    # 프로덕션 빌드 (정적 내보내기 → out/)
```

커밋할 때 lefthook이 린트와 타입 검사를, push할 때 린트와 전체 테스트를 돌립니다.

## 발표하기

개발 서버는 데모 iframe 안에도 Next 디버깅 표시가 떠서, 발표는 프로덕션 빌드로 합니다.

```sh
npm run build
npm run present  # out/을 http://localhost:5025 로 내려준다 → /presentation/v3.html
npm run remote   # (선택) 휴대폰 발표 노트·다음 장 미리보기·넘기기, 포트 5026
```

`remote`를 켰다면 발표 자료를 `/presentation/v3.html?remote`로 열고, 같은 와이파이의 휴대폰에서 터미널에 찍힌 주소를 엽니다.

## 문서

- [작업 원칙](docs/project-principles.md)
- [시도와 발견 기록](docs/experiments-journey.md)
- [외부 사진 200장 검증](docs/external-validation-2026-10.md)
- [별 놀이터 기획](docs/game-plans.md)
- [배포](docs/deployment.md): main에 push하면 이미지를 빌드해 star.byb.kr에 배포합니다
