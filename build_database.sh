#!/usr/bin/env bash

# 기본 데이터베이스의 별이 너무 많으므로 4등급 이상의 별만 사용
npx tsx src/scripts/database/reduceDatabase.ts
# RA와 DEC 로 표기된 좌표를 3차원 벡터로 변경
npx tsx src/scripts/database/toVector.ts
# quad 해시 DB(JSON, 비교용 검색 스크립트 src/scripts/search가 읽는다). 풀이는 받지 않고 카탈로그에서 직접 만든다 (search/quadDatabase.ts)
npx tsx src/scripts/hash/createHashFromDatabase.ts
# 별자리 표시를 위해 별자리 데이터베이스 생성
npx tsx src/scripts/database/buildConstellations.ts
# 빛의 타임캡슐(게임)용 별 거리(연주 시차)
npx tsx src/scripts/database/buildParallax.ts
# 사이트 배경(실제 서울 하늘)용 작은 별 지도
npx tsx src/scripts/database/buildBackgroundSky.ts
