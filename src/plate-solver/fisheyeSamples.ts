import type { Point3D } from "@/scripts/hash/types";
import catalogStars from "@build/database/vectors-database.json";
import milkyway from "@data/search/milkyway.json";

// 사람이 라벨한 별로 어안 보정이 가능한 샘플들. 초광각(어안) 사진은 blind 직선투영
// 으로 안 풀리므로, 라벨 대응에서 어안 카메라를 피팅해 별자리를 정확히 그린다.

interface CatStar {
  HR: string | number;
  x: number;
  y: number;
  z: number;
}

const byHR = new Map<string, CatStar>(
  (catalogStars as CatStar[]).map((s) => [String(s.HR), s]),
);

interface LabelFile {
  width: number;
  height: number;
  stars: { label: string; position: [number, number] }[];
}

// 키는 샘플 파일명.
const filesByName: Record<string, LabelFile> = {
  "20220328-brice-Milky Way over Buzzvil.jpg": milkyway as unknown as LabelFile,
};

export interface FisheyeLabels {
  width: number;
  height: number;
  corr: { x: number; y: number; v: Point3D }[];
}

// image.src에서 파일명을 뽑아 어안 라벨(픽셀↔카탈로그 방향)을 만든다.
export const getFisheyeLabels = (src?: string): FisheyeLabels | null => {
  if (!src) {
    return null;
  }

  const file = decodeURIComponent(src.split("/").pop() ?? "");
  const data = filesByName[file];

  if (!data) {
    return null;
  }

  const corr = data.stars
    .map((s) => {
      const c = byHR.get(s.label);

      return c
        ? { x: s.position[0], y: s.position[1], v: [c.x, c.y, c.z] as Point3D }
        : null;
    })
    .filter((e): e is { x: number; y: number; v: Point3D } => e !== null);

  if (corr.length < 4) {
    return null;
  }

  return { width: data.width, height: data.height, corr };
};
