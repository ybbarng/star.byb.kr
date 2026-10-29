# 외부 사진 검증 결과 모음

인터넷(Wikimedia Commons)에서 모은 밤하늘 사진으로 Plate Solver를 잰 결과를 남기는 곳이다.
사진은 저작권·용량 때문에 저장소에 넣지 않는다 (`public/samples-external/<묶음>/`, gitignore). 출처·작성자·라이선스는 묶음마다 `sources.csv`에 있다.
여기에는 사진 이름과 숫자만 남긴다.

## 파일

| 파일 | 내용 |
|---|---|
| `results-2026-10-29.csv` | 사진별 결과표: 우리 풀이(8초) 결과·log-odds·시간·시야각·확신한 단계, 겹친 별 판정, astrometry.net 결과, 우리 답과의 광축 차이, 못 푼 사진의 진단 단계 |
| `astrometry-comparison-2026-10-29.md` | 우리 풀이와 astrometry.net(로컬)을 사진별로 비교한 보고서, 못 푼 사진의 단계별 진단 |

앞선 보고서: `../external-validation-2026-10.md` (200장 첫 검증과 11장 하룻밤 개선), 시도·실패 기록은 `../experiments-journey.md` 38장부터.

## 묶음

| 묶음 | 사진 | 쓰임 |
|---|---|---|
| `web-2026-10` | 200 (web-001~200) | 첫 검증, 개선을 고르는 데 씀 |
| `web-2026-10b` | 191 (web-201~391) | 2026-10-29 새로 모음, 개선을 고르는 데 씀 |
| `web-2026-10c` | 135 (web-401~535) | 2026-10-29 새로 모음, 고르는 데 쓰지 않은 확인용 (어안 모델은 이 묶음의 어안도 보고 골랐다) |
| `samples` | 앱 샘플 (`public/samples`를 가리키는 링크) | 비교용 |
| `cafe-2026-10` | 39 (cafe-001~039) | 2026-10-29 별 동호회 카페의 휴대폰 사진(Brice가 직접 받음). 원작자를 알 수 없어 기능 개선용으로만 쓰고 어디에도 올리지 않는다. astrometry도 로컬로만 |

대상은 일반인 사진(보통~넓은 화각)이다. 망원경·단망경처럼 좁은 영역은 보지 않는다 — `sources.csv`의 class에 "단망경"이 들어간 사진은 비교에서 뺀다.

## 다시 돌리기

```sh
# 1. 우리 풀이: 검출 캐시 → 앱과 같은 풀이(8초, 4조각 나란히) → 겹친 별 판정과 요약
sh src/scripts/validate/runAll.sh web-2026-10 8000 <이름> 4
npx tsx src/scripts/validate/report.ts web-2026-10 <이름> [비교할 이름]

# 2. 분석용 정답지 (astrometry.net 로컬, 앱 풀이에는 쓰지 않는다)
sh src/scripts/validate/astrometry/setup.sh            # solve-field 설치, 넓은 시야 인덱스 4110~4119
JOBS=8 node src/scripts/validate/astrometry/run-list.mjs <목록>   # 한 줄에 "묶음 파일", 한 장 최대 2분
npx tsx src/scripts/validate/astrometryTruth.ts <묶음>...         # WCS → 변환 행렬 (build/validate/astrometry/<묶음>/truth.json)

# 3. 비교·진단·결과표
npx tsx src/scripts/validate/compareAstrometry.ts <이름> <묶음>...
npx tsx src/scripts/validate/diagnose.ts <이름> <묶음>...
npx tsx src/scripts/validate/exportResults.ts <이름> docs/validation/results-<날짜>.csv <묶음>...
```

중간 결과(검출 캐시, 풀이 기록 jsonl, astrometry WCS·로그)는 `build/validate/`에 있다. 지워져도 위 순서로 다시 만들 수 있다.
