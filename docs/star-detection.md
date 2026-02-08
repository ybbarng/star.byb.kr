# 별 검출 알고리즘

## 개요

사진 속 별을 자동으로 검출하는 알고리즘이다. Plate Solving의 첫 번째 단계로, 검출 품질이 이후 매칭 정확도에 직접적인 영향을 미친다. OpenCV.js Web Worker에서 실행된다.

**파일**: `public/js/cv.worker.js` → `findStars()`

## 기존 방식: 이진화 + Contour

초기 구현은 OpenCV의 이진화(threshold)와 윤곽선 검출(contour)을 사용했다.

```
원본 이미지
  → grayscale 변환
  → 가우시안 블러 (51×51)
  → 차영상 (gray - blurred)
  → 고정 threshold (70) 이진화
  → contour 검출
  → contour area 기준 정렬
```

### 문제점

1. **고정 threshold**: 노출 조건이 다른 사진에 대응 불가. 밝은 사진에서는 노이즈까지 별로 검출되고, 어두운 사진에서는 별이 검출되지 않음.
2. **밝기 정보 소실**: 이진화 과정에서 픽셀 밝기 정보가 완전히 사라짐. 밝은 별과 어두운 별의 구분 불가.
3. **contour area ≠ 실제 밝기**: contour의 면적은 이진화 결과에 의존하므로, 실제 별의 겉보기 밝기(등급)와 상관관계가 약함.
4. **밝은 별 중복 검출**: 하나의 밝은 별이 여러 개의 contour로 분리될 수 있음.

## 현재 방식: Local Maxima + 유효 반경 + NMS

### 전체 파이프라인

```
원본 이미지
  → [전처리] grayscale + 가우시안 블러 + 차영상
  → [1단계] Local Maxima 후보 수집 (적응적 threshold)
  → [2단계] Non-Maximum Suppression (중복 제거)
  → [3단계] Weighted Centroid (서브픽셀 좌표)
  → 결과: { cx, cy, brightness } 배열
```

### 전처리: 차영상 생성

```
gray = cvtColor(image, GRAY)
blurred = GaussianBlur(gray, 51×51)
diff = gray - blurred
```

가우시안 블러(커널 51×51)를 원본에서 빼면 저주파 성분(하늘 배경, 광해 그라디언트)이 제거되고 고주파 성분(별)만 남는다. 이 차영상에서 별을 검출한다.

### 1단계: Local Maxima 후보 수집

**적응적 threshold 계산**:

```
threshold = mean(diff) + 3 × stddev(diff)
```

이미지마다 자동으로 threshold가 결정된다. 통계적으로 `mean + 3σ` 이상인 픽셀은 전체의 약 0.3%에 해당하며, 배경 노이즈와 유의미한 신호(별)를 구분하는 기준이 된다.

**Local maxima 검출**:

각 픽셀에 대해:
1. 값이 threshold 이상인지 확인
2. 8방향 이웃(상하좌우 + 대각선) 중 자신보다 큰 값이 있는지 확인
3. 이웃 모두보다 크거나 같으면 local maxima로 채택

**유효 반경 측정**:

밝은 별일수록 사진에서 크게(넓게) 나타난다. 이 성질을 이용하여 별의 겉보기 크기를 측정한다.

```
peak 위치에서 4방향(상, 하, 좌, 우)으로 확장
→ 각 방향에서 threshold 아래로 떨어지는 거리를 측정
→ 4방향 평균 = 유효 반경 (effectiveRadius)
```

유효 반경이 클수록 밝은 별이다. 이 값을 `brightness`로 사용하여 밝은 별 순서로 정렬한다.

단순 픽셀 값(peak intensity) 대신 유효 반경을 사용하는 이유:
- 밝은 별은 카메라 센서에서 포화(saturation)되어 peak 값이 모두 255로 동일해짐
- 하지만 밝은 별일수록 빛이 퍼지는 범위(PSF)가 넓어 유효 반경은 여전히 차이가 남
- 따라서 유효 반경이 실제 겉보기 밝기의 더 신뢰할 수 있는 지표임

### 2단계: Non-Maximum Suppression (NMS)

밝은 별은 포화 영역 내에 여러 개의 local maxima가 발생할 수 있다. 이를 하나의 별로 합치는 과정이다.

```
1. 후보를 유효 반경 내림차순 정렬 (동률이면 peak 값 내림차순)
2. 가장 큰 별부터 순회:
   a. 억제 반경 = max(3px, 유효 반경 × 2)
   b. 억제 반경 내의 더 작은 후보들을 모두 제거
   c. 현재 별을 최종 결과에 추가
```

밝은(큰) 별을 먼저 확정하고, 그 주변의 작은 후보들을 억제한다. 억제 반경을 유효 반경의 2배로 설정하여 포화 영역 가장자리에서 발생하는 위양성(false positive)을 제거한다.

### 3단계: Weighted Centroid

NMS를 통과한 각 별에 대해, 서브픽셀 정확도의 중심 좌표를 계산한다.

```
유효 반경 범위 내의 모든 픽셀에 대해:
  cx = Σ(w × x) / Σ(w)
  cy = Σ(w × y) / Σ(w)
  (w = 해당 픽셀의 차영상 값)
```

밝은 픽셀에 가중치를 더 주어, 별의 실제 광학 중심에 가까운 좌표를 얻는다.

### 최종 출력

```typescript
{ cx: number, cy: number, brightness: number }[]
```

- `cx`, `cy`: 서브픽셀 정밀도의 별 중심 좌표
- `brightness`: 유효 반경 값 (클수록 밝은 별)

이후 Plate Solving에서는 `brightness` 내림차순으로 상위 15개 별을 선택하여 quad를 생성한다.

## 파라미터

| 파라미터 | 값 | 설명 |
|:---|:---:|:---|
| 가우시안 커널 | 51×51 | 배경 추정용. 별보다 충분히 커야 함 |
| threshold | mean + 3σ | 적응적. 상위 ~0.3% 픽셀만 통과 |
| margin | 3px | 이미지 가장자리 제외 (경계 처리) |
| maxRadius | 50px | 유효 반경 측정 시 최대 확장 거리 |
| 억제 반경 | max(3, radius×2) | NMS 적용 범위 |
| centroid 범위 | max(2, ceil(radius)) | 가중 중심 계산 범위 |

## 한계 및 향후 개선

- **OpenCV 의존성**: 현재 grayscale, blur, subtract, meanStdDev에만 OpenCV를 사용하며, 모두 순수 JS로 대체 가능 (→ 11MB WASM 제거 가능)
- **가우시안 커널 크기 고정**: 51×51이 모든 해상도에 최적은 아님. 이미지 크기에 비례하여 조정하면 더 안정적
- **원형 PSF 가정**: 유효 반경을 4방향만으로 측정. 광학 수차로 인한 비대칭 PSF에는 부정확할 수 있음
