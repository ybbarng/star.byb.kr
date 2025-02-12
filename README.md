# star.byb.kr
나만의 작고 소중한 Plate Solver

## 간단 사용법

> [!NOTE]
> [nvm을 설치](https://github.com/nvm-sh/nvm)해주세요.

터미널을 열고 아래의 스크립트를 실행하세요.

```sh
git clone https://github.com/ybbarng/star.byb.kr.git
cd star.byb.kr
npm install
./build_database.sh
npm run dev
```

웹브라우저에서 [홈페이지](http://localhost:5025)를 열어주세요.

## 사용법

### 설치

```sh
npm install
npm run dev
```

### 데이터베이스 파일 준비

아래 내용은 `./build_database.sh` 파일에 동일하게 작성되어 있습니다.

```sh
# 기본 데이터베이스의 별이 너무 많으므로 4등급 이상의 별만 사용
npx tsx src/scripts/database/reduceDatabase.ts
# RA와 DEC 로 표기된 좌표를 3차원 벡터로 변경
npx tsx src/scripts/database/toVector.ts
# quad를 미리 계산한 데이터베이스 생성
npx tsx src/scripts/hash/createHashFromDatabase.ts
# 별자리 표시를 위해 별자리 데이터베이스 생성
npx tsx src/scripts/database/buildConstellations.ts
```

### 실행

```sh
npm run dev
```

### 링크

* [Plate Solver](http://localhost:5025/plate-solver)
* [발표 슬라이드](http://localhost:5025/presentation/index.html)
