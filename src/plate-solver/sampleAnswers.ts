import type { Point3D } from "@/scripts/hash/types";

// 정제된 별 라벨(data/search)로 검증한 "알려진 정답" 포즈. 샘플을 plate solving 할 때
// 후보 중 어느 것이 정답인지 표시해 헷갈리지 않게 한다.
// 중심(광축)은 정확하고, FOV는 8개 별로 추정한 근사값이라 "약"으로 본다.
export interface SampleAnswer {
  centerRaDeg: number;
  centerDecDeg: number;
  fovDeg: number;
  name: string; // 사람이 읽을 별자리/하늘 영역 이름
  // 정제 라벨로 검증한 정확한 포즈가 아니라, 사진 설명으로 추정한 대략 위치일 때 true.
  // 이 경우 후보에 ✓ 정답 배지를 달지 않고 "예상 영역"으로만 안내한다.
  approximate?: boolean;
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
  // 여름 은하수(은하 중심부). 초광각 어안 사진. 사람이 라벨한 별 8개로 어안 카메라를
  // 피팅해(RMS ~5px) 사진 중심 방향·시야를 검증함 — 직선투영으론 안 풀리는 사진의 정답.
  "20220328-brice-Milky Way over Buzzvil.jpg": {
    centerRaDeg: 277,
    centerDecDeg: -12,
    fovDeg: 73,
    name: "여름 은하수 (방패·궁수·전갈·독수리)",
  },
  // 브라우저 풀이가 유의도 37.7로 확신한 해. 중심 별이 북두칠성 7별(Megrez·Alioth·
  // Phecda·Mizar·Dubhe·Merak·Alkaid)임을 카탈로그로 확인.
  "20230904-nike-jeungseun-02.png": {
    centerRaDeg: 184.7,
    centerDecDeg: 58.5,
    fovDeg: 55.5,
    name: "큰곰자리 (북두칠성)",
  },
  // 브라우저 풀이가 유의도 75.0으로 확신한 해. 중심 별이 오리온 삼태성(Mintaka·Alnilam·
  // Alnitak) + Betelgeuse·Rigel·Bellatrix임을 카탈로그로 확인.
  // 자동 풀이가 log-odds 17로 확신한 해. 예측 위치에 남십자(Acrux·Mimosa·Gacrux)·
  // 리길 켄타우루스·하다르·Atria·Miaplacidus가 사진 속 밝은 별과 겹침을 눈으로 확인.
  "20231012-nike-aust-01.jpg": {
    centerRaDeg: 202.2,
    centerDecDeg: -66.1,
    fovDeg: 59.1,
    name: "남십자·켄타우루스 (남반구)",
  },
  "cafe-orion.jpg": {
    centerRaDeg: 83.1,
    centerDecDeg: 1.2,
    fovDeg: 16.8,
    name: "오리온자리",
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
