# star.byb.kr

나만의 작고 소중한 Plate Solver

## 기본 사용법

### 설치

```sh
npm install
npm run dev
```

### 데이터베이스 파일 준비

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
