import type { Point2D, Point3D } from "@/scripts/hash/types";
import type { Mat3 } from "@/test/synthetic/projection";

// 합성 사진에 섞는 노이즈 종류. 각각 독립 토글 + 강도.
export interface NoiseParams {
  jitterPx?: number; // 별 위치 흔들림 표준편차(px) — 검출 centroid 오차/광학 왜곡 모사
  falseRatio?: number; // 가짜 별 수 = 진짜 별 수 × 비율 — 아파트 창문·가로등 모사
  missingProb?: number; // 진짜 별이 누락될 확률 — 검출 실패 모사
  brightnessJitter?: number; // 밝기 상대 교란(표준편차) — 상위 N 선택 순서 교란
}

// 노이즈 전 진짜 별 (recall 채점용 정답).
export interface TrueStar {
  hr: string;
  xy: Point2D;
  v: number;
}

// 정답 pose. 추정 결과를 이것과 비교해 채점한다.
export interface SyntheticGroundTruth {
  centerVector: Point3D;
  fovDeg: number;
  rotationDeg: number;
  TP: Mat3;
  width: number;
  height: number;
}

// 합성 사진의 별 한 개 (노이즈 포함). isFalse/hr는 채점용이며 알고리즘엔 주지 않는다.
export interface SyntheticStar {
  x: number;
  y: number;
  brightness: number;
  isFalse: boolean;
  hr?: string;
}

export interface SyntheticImage {
  stars: SyntheticStar[]; // 노이즈 포함, brightness 내림차순 (검출 출력 흉내)
  trueStars: TrueStar[]; // 노이즈 전 진짜 별
  groundTruth: SyntheticGroundTruth;
  meta: { seed: number; noise: NoiseParams; magnitudeLimit: number };
}
