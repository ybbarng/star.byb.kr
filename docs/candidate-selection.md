# 후보 선정 및 검증

## 개요

Plate Solving의 핵심 단계로, 사진에서 검출한 별들로부터 데이터베이스 매칭 후보를 생성하고, 변환 행렬 기반 검증과 합의(consensus) 분석을 통해 정답 후보를 자동으로 선별하는 과정이다.

**관련 파일**:
- `src/plate-solver/PlateSolvingStep.tsx` — UI 및 검증/정렬 로직
- `src/search/workers/findCandidatesWorker.ts` — Web Worker에서 후보 검색
- `src/search/hooks/useFindCandidates.ts` — Worker 통신 hook
- `src/search/utils/transform.ts` — 변환 행렬 계산
- `src/search/utils/verification.ts` — 후보 검증 및 점수 계산

## 전체 파이프라인

```
검출된 별 (brightness 내림차순)
  → [1] 상위 15개 별에서 Quad 생성 (C(15,4) = 1,365개)
  → [2] 각 Quad의 4D 해시 계산
  → [3] KD-Tree에서 k=3 최근접 이웃 검색
  → [4] 중복 제거 (DB quad HR 키 기준)
  → [5] 해시 거리 순 초기 정렬
  → [6] 상위 50개 후보 실제 검증 (변환 행렬 + 별 투영)
  → [7] 합의(consensus) 분석
  → [8] 다단계 정렬 → 최고 점수 후보 자동 선택
```

## 1. Quad 생성

사진에서 검출된 별 중 **brightness 상위 15개**를 선택하여 4개 조합(quad)을 생성한다.

```
C(15, 4) = 1,365개 quad
```

각 quad에 대해 geometric hashing 알고리즘으로 4D 해시를 계산한다(해시 알고리즘 자체는 `database-design.md`의 Geometric Hashing 항목 참조).

**상위 15개를 사용하는 이유**: 10개 사용 시 C(10,4) = 210개로 조합 수가 부족하여 정답 quad가 포함되지 않을 확률이 높았다. 15개로 늘리면 조합이 6.5배 증가하면서도 계산량은 수 ms 수준으로 유지된다. 사용자가 수동으로 마커를 정리하므로 노이즈 별이 포함될 가능성은 낮다.

**파일**: `PlateSolvingStep.tsx:115` — `photoStars.slice(0, 15)`

## 2. KD-Tree 검색

Web Worker(`findCandidatesWorker.ts`)에서 사전 로드된 해시 데이터베이스로 KD-Tree를 구축한다. 각 사진 quad의 4D 해시에 대해 **k=3 최근접 이웃**을 검색한다.

```
사진 quad 1,365개 × k=3 = 최대 4,095개 매칭 결과
```

**k=3을 사용하는 이유**: k=1(최근접 1개)만 반환하면, 투영 차이로 인해 정확한 매칭이 2등이나 3등에 위치할 수 있다. k=3으로 여유를 두면 이러한 손실을 방지할 수 있다.

**파일**: `findCandidatesWorker.ts:76` — `tree.nearest(…, 3)`

## 3. 중복 제거

같은 DB quad(동일한 4개 HR 번호)가 서로 다른 사진 quad에서 여러 번 매칭될 수 있다. 이 경우 해시 거리가 가장 작은 것만 유지한다.

```typescript
// DB quad의 HR 4개를 키로 사용
const dbKey = found.join(",");  // 예: "5054,5056,5191,5267"
const existing = bestByDbQuad.get(dbKey);
if (!existing || distance < existing.distance) {
  bestByDbQuad.set(dbKey, candidate);
}
```

이후 해시 거리 오름차순으로 초기 정렬한다.

**파일**: `findCandidatesWorker.ts:128-142`

## 4. 실제 검증 (Verification)

초기 정렬된 **상위 50개** 후보에 대해 실제 변환 행렬을 계산하고 별 투영 검증을 수행한다. 해시 거리가 작다고 해서 반드시 정답은 아니며, 실제로 별이 맞는 위치에 투영되는지 확인해야 한다.

### 변환 행렬 계산

각 후보에 대해 `computeTransformMatrix()`로 변환 행렬 TP를 계산한다.

```
TP = T × P

P: 접선 평면 투영 행렬 (3D → 2D)
   - DB quad 4개 별의 평균 방향을 중심으로 접선 평면 생성
   - 3D 단위벡터를 접선 평면 좌표로 투영

T: 아핀 변환 행렬 (접선 평면 → 사진 좌표)
   - 이동(translation): DB quad 중심 → 사진 quad 중심
   - 스케일(scale): DB quad 크기 → 사진 quad 크기
   - 회전(rotation): DB quad 방향 → 사진 quad 방향
```

**파일**: `transform.ts:102-113` — `computeTransformMatrix()`

### 별 투영 검증

변환 행렬 TP를 사용하여 **카탈로그의 모든 별**을 사진 좌표로 투영하고, 실제 검출된 사진 별과의 거리를 측정한다.

```
1. 카탈로그 별 (3D 벡터) × TP → 사진 좌표 (2D)
2. 이미지 범위(±tolerance) 내의 투영 별만 대상
3. 각 사진 별에 대해 가장 가까운 투영 별과의 거리 측정
4. 거리 ≤ tolerance(20px)이면 매칭 성공
```

**파일**: `verification.ts:14-86` — `verifyCandidate()`

### 검증 지표

| 지표 | 설명 |
|:---|:---|
| `matchedCount` | 매칭 성공한 사진 별 수 |
| `unmatchedPhotoCount` | 매칭 실패한 사진 별 수 |
| `matchRatio` | matchedCount / 전체 사진 별 수 |
| `averageError` | 매칭된 별들의 평균 거리 오차 (px) |
| `score` | 종합 점수 (아래 공식) |

### 점수 공식

```
score = matchedCount × photoTrustPenalty × (1 / (1 + averageError))
```

여기서:

```
photoTrustPenalty = exp(-0.5 × unmatchedPhotoCount)
```

**비대칭 패널티**: 사진 별은 사용자가 직접 확인한 것이므로 100% 신뢰한다. 따라서 사진 별이 카탈로그와 매칭되지 않으면 해당 후보의 변환이 틀렸을 가능성이 높다. 미매칭 사진 별 1개당 점수가 약 39% 감소한다.

```
unmatchedPhotoCount = 0 → penalty = 1.00 (감소 없음)
unmatchedPhotoCount = 1 → penalty = 0.61 (39% 감소)
unmatchedPhotoCount = 2 → penalty = 0.37 (63% 감소)
unmatchedPhotoCount = 3 → penalty = 0.22 (78% 감소)
unmatchedPhotoCount = 5 → penalty = 0.08 (92% 감소)
```

**파일**: `verification.ts:80-83`

## 5. 합의 분석 (Consensus)

정답 후보들은 하늘의 같은 방향을 가리키는 반면, 오답 후보들은 무작위 방향을 가리킨다. 이 성질을 이용하여 **방향 클러스터링**을 수행한다.

### 하늘 방향 계산

각 후보의 DB quad를 구성하는 4개 별의 3D 단위벡터를 평균하여 해당 후보가 가리키는 하늘 방향(centroid)을 구한다.

```typescript
// DB quad 4개 별의 벡터 합 → 정규화
let sx = 0, sy = 0, sz = 0;
for (const { hr } of candidate.output) {
  const star = catalogMap.get(hr);
  sx += star.x; sy += star.y; sz += star.z;
}
const norm = Math.sqrt(sx*sx + sy*sy + sz*sz);
direction = [sx/norm, sy/norm, sz/norm];
```

### 이웃 수 계산

검증된 각 후보에 대해, **20° 이내**에 있는 다른 후보의 수를 센다.

```
consensusThreshold = cos(20°) ≈ 0.94

for each verified candidate i:
  neighborCount[i] = 0
  for each candidate j (j ≠ i):
    if dot(direction[i], direction[j]) >= 0.94:
      neighborCount[i]++
```

정답 후보는 수백 개의 이웃을 가지는 반면, 오답 후보는 이웃이 적거나 없다.

**파일**: `PlateSolvingStep.tsx:161-202`

## 6. 다단계 정렬

검증과 합의 분석이 완료되면, 다음 기준으로 순차 정렬한다.

```
1순위: matchedCount 내림차순   (매칭된 별이 많을수록 상위)
2순위: neighborCount 내림차순  (합의 이웃이 많을수록 상위)
3순위: averageError 오름차순   (오차가 작을수록 상위)
4순위: score 내림차순           (종합 점수가 높을수록 상위)
```

검증되지 않은 후보(51번째 이후)는 항상 검증된 후보보다 뒤에 위치한다.

정렬 후 최고 점수의 후보가 자동 선택되어 별/별자리 오버레이가 표시된다.

**파일**: `PlateSolvingStep.tsx:204-240`

## 7. UI 표시

### 후보 목록

각 후보 항목에 다음 정보가 표시된다:

```
인덱스: [별1]-[별2]-[별3]-[별4] (매칭수m, 오차px, 이웃수n)
```

예시: `3: [Alnitak]-[Cursa]-[Thabit]-[HR 1892] (16m, 9.8px, 479n)`

### 매칭률 배경 바

각 항목의 배경에 `matchRatio`에 비례하는 반투명 바를 표시한다. 시각적으로 정확도를 즉시 파악할 수 있다.

### 방향키 탐색

- `↑` / `↓`: 정렬된 순서대로 후보를 탐색
- 선택된 항목은 자동으로 스크롤 뷰에 표시

### 검증 상세 패널

선택된 후보의 상세 검증 결과를 표시한다:

| 항목 | 예시 |
|:---|:---|
| 매칭 | 16개 (80.0%) |
| 미매칭 사진별 | 4개 |
| 평균 오차 | 8.2px |
| 합의 이웃 | 479개 |
| 점수 | 1.4567 |

## DB 품질 보장: Quad 각거리 제한

데이터베이스 생성 시, quad 내 **모든 별 쌍의 각거리가 10° 이하**인 것만 포함한다.

### 배경

HEALPix nside=4에서 각 셀의 수집 반경은 10°이지만, 셀 양쪽 끝에 있는 별은 최대 20° 떨어질 수 있다. 이렇게 넓게 퍼진 quad는:

1. 접선 평면 투영의 왜곡이 커서 해시 정확도가 떨어짐
2. 매칭되더라도 변환 행렬이 부정확하여 별 오버레이가 비정상적으로 표시됨

### 필터 효과

```
필터 적용 전: 545,855 quads, 66 MB
필터 적용 후:  84,965 quads, 10 MB  (-84.4%)
```

quad 수가 84% 감소하지만, 사진 쪽에서도 좁은 영역의 별만 사용하므로 매칭 정확도에는 영향이 없다.

**파일**: `createHashFromDatabase.ts:15-33` — `isQuadCompact()`

## FOV 제한 및 반구 보호

### FOV 상한 (60°)

잘못된 변환 행렬이 비정상적으로 큰 FOV(70~80°)를 생성하면 너무 많은 별과 별자리가 오버레이되어 가독성이 떨어진다. FOV를 60°로 제한하여 이를 방지한다.

### 반대편 반구 차단

FOV가 매우 큰 경우(×1.2 마진 적용 시 90° 초과), `cos(fov × 1.2)`가 음수가 되어 반대편 반구의 별까지 표시될 수 있다. FOV 60° 상한으로 이 문제도 함께 해결된다.

```typescript
const MAX_FOV = (60 * Math.PI) / 180;
const clampedFov = Math.min(currentFov, MAX_FOV);
const threshold = Math.cos(clampedFov * 1.2);
```

**파일**: `useFindNearestStars.ts:253-256`

## 한계 및 향후 개선

- **아핀 변환의 한계**: 현재 이동+회전+스케일만 고려하며, 원근 왜곡(perspective distortion)은 무시한다. 광각 렌즈에서는 정확도가 떨어질 수 있다.
- **검증 대상 수**: 상위 50개만 검증한다. 정답이 51번째 이후에 있으면 자동 선택되지 않는다.
- **합의 임계값 고정**: 20° 합의 반경이 모든 상황에 최적은 아닐 수 있다.
- **Verification O(N×M)**: 사진 별 N개 × 카탈로그 별 M개의 brute-force 비교. 현재 규모(~20 × ~500)에서는 문제없으나, 카탈로그가 커지면 공간 인덱스가 필요하다.
