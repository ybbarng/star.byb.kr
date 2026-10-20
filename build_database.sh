#!/usr/bin/env bash

# 기본 데이터베이스의 별이 너무 많으므로 4등급 이상의 별만 사용
npx tsx src/scripts/database/reduceDatabase.ts
# RA와 DEC 로 표기된 좌표를 3차원 벡터로 변경
npx tsx src/scripts/database/toVector.ts
# quad를 미리 계산한 데이터베이스 생성
npx tsx src/scripts/hash/createHashFromDatabase.ts
# 브라우저가 받는 이진 형식으로 변환 (JSON 10.8MB → 약 2MB, 파싱 없음)
npx tsx src/scripts/hash/encodeHashedDatabase.ts
# 별자리 표시를 위해 별자리 데이터베이스 생성
npx tsx src/scripts/database/buildConstellations.ts
# 빛의 타임캡슐(게임)용 별 거리(연주 시차)
npx tsx src/scripts/database/buildParallax.ts
