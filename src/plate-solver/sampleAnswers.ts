import type { Point3D } from "@/scripts/hash/types";

// 정제된 별 라벨(data/search)로 검증한 "알려진 정답" 포즈. 샘플을 plate solving 할 때
// 후보 중 어느 것이 정답인지 표시해 헷갈리지 않게 한다.
// 중심(광축)은 정확하고, FOV는 8개 별로 추정한 근사값이라 "약"으로 본다.
export interface SampleAnswer {
  centerRaDeg: number;
  centerDecDeg: number;
  fovDeg: number;
  name: string; // 사람이 읽을 별자리/하늘 영역 이름
}

// 키는 샘플 파일명(samples.ts의 src 마지막 조각).
const byFilename: Record<string, SampleAnswer> = {
  "big-dipper.jpg": {
    centerRaDeg: 184,
    centerDecDeg: 56,
    fovDeg: 36,
    name: "큰곰자리 (북두칠성)",
  },
  "20190617-jarrod-saipan.jpg": {
    centerRaDeg: 225.5,
    centerDecDeg: -66,
    fovDeg: 51,
    name: "센타우루스·남십자 (남반구)",
  },
};

// image.src(URL)에서 파일명을 뽑아 알려진 정답을 찾는다. 업로드 사진은 정답이 없다.
export const getSampleAnswer = (src?: string): SampleAnswer | null => {
  if (!src) {
    return null;
  }

  const file = decodeURIComponent(src.split("/").pop() ?? "");

  return byFilename[file] ?? null;
};

// RA/Dec(도) → 천구 단위 벡터
export const answerVector = (a: SampleAnswer): Point3D => {
  const ra = (a.centerRaDeg * Math.PI) / 180;
  const dec = (a.centerDecDeg * Math.PI) / 180;

  return [
    Math.cos(dec) * Math.cos(ra),
    Math.cos(dec) * Math.sin(ra),
    Math.sin(dec),
  ];
};

// 후보 중심이 정답 방향에서 maxDeg 이내인가
export const matchesAnswer = (
  center: Point3D,
  a: SampleAnswer,
  maxDeg = 6,
): boolean => {
  const v = answerVector(a);
  const dot = Math.max(
    -1,
    Math.min(1, center[0] * v[0] + center[1] * v[1] + center[2] * v[2]),
  );

  return (Math.acos(dot) * 180) / Math.PI <= maxDeg;
};
