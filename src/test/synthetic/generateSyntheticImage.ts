import type { Photo } from "@/search/type";
import type { Point3D } from "@/scripts/hash/types";
import type { CatalogStar } from "@/test/synthetic/loadCatalog";
import type {
  NoiseParams,
  SyntheticImage,
  SyntheticStar,
  TrueStar,
} from "@/test/synthetic/types";
import {
  buildGroundTruthTransform,
  projectStarToPhoto,
} from "@/test/synthetic/projection";
import { createRng, gaussian } from "@/test/synthetic/rng";

export interface GenerateOptions {
  center: Point3D; // 광축 방향(단위 벡터)
  fovDeg: number; // 시야각(짧은 변 기준)
  rotationDeg?: number;
  width: number;
  height: number;
  magnitudeLimit: number; // 이 등급 이하(더 밝은)만 별로 노출
  noise?: NoiseParams;
  seed: number;
}

// 밝을수록(작은 V) 큰 brightness 값. 검출의 brightness 규약(밝은 별=큰 값)과 맞춘다.
const baseBrightness = (v: number, magnitudeLimit: number): number =>
  Math.max(1, magnitudeLimit + 1 - v);

// 카탈로그에서 정답을 100% 아는 합성 사진을 생성한다.
export const generateSyntheticImage = (
  catalog: CatalogStar[],
  opts: GenerateOptions,
): SyntheticImage => {
  const { center, fovDeg, width, height, magnitudeLimit, seed } = opts;
  const rotationDeg = opts.rotationDeg ?? 0;
  const noise = opts.noise ?? {};
  const rng = createRng(seed);

  const { TP } = buildGroundTruthTransform(
    center,
    (fovDeg * Math.PI) / 180,
    (rotationDeg * Math.PI) / 180,
    width,
    height,
  );

  // 1. 진짜 별: 등급 이하 + 화면 안
  const trueStars: TrueStar[] = [];

  for (const star of catalog) {
    if (star.v > magnitudeLimit) {
      continue;
    }

    const p = projectStarToPhoto(star.vector, TP);

    if (!p) {
      continue;
    }
    if (p[0] < 0 || p[0] >= width || p[1] < 0 || p[1] >= height) {
      continue;
    }

    trueStars.push({ hr: star.hr, xy: p, v: star.v });
  }

  // 2. 진짜 별에 노이즈(누락/위치 흔들림/밝기 교란) 적용
  const stars: SyntheticStar[] = [];

  for (const ts of trueStars) {
    if (noise.missingProb && rng() < noise.missingProb) {
      continue;
    }

    let x = ts.xy[0];
    let y = ts.xy[1];

    if (noise.jitterPx) {
      x += gaussian(rng) * noise.jitterPx;
      y += gaussian(rng) * noise.jitterPx;
    }

    let b = baseBrightness(ts.v, magnitudeLimit);

    if (noise.brightnessJitter) {
      b *= 1 + gaussian(rng) * noise.brightnessJitter;
    }

    stars.push({
      x,
      y,
      brightness: Math.max(0.1, b),
      isFalse: false,
      hr: ts.hr,
    });
  }

  // 3. 가짜 별: 화면 전체에 균일 분포, 밝기는 진짜 별 범위와 겹치게(밀어내기 모사)
  if (noise.falseRatio) {
    const k = Math.round(trueStars.length * noise.falseRatio);

    for (let i = 0; i < k; i++) {
      stars.push({
        x: rng() * width,
        y: rng() * height,
        brightness: Math.max(0.1, 1 + rng() * magnitudeLimit),
        isFalse: true,
      });
    }
  }

  // 4. brightness 내림차순 (검출 단계 출력 흉내)
  stars.sort((a, b) => b.brightness - a.brightness);

  return {
    stars,
    trueStars,
    groundTruth: {
      centerVector: center,
      fovDeg,
      rotationDeg,
      TP,
      width,
      height,
    },
    meta: { seed, noise, magnitudeLimit },
  };
};

// 합성 사진을 매칭 단계 입력(Photo) 형식으로 변환한다.
export const toPhoto = (img: SyntheticImage): Photo => ({
  width: img.groundTruth.width,
  height: img.groundTruth.height,
  stars: img.stars.map((s) => [s.x, s.y]),
});
