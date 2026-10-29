// 풀이 결과에서 알아낸 사진 정보(렌즈·화각·별 궤적 노출 시간)를 사람이 읽는 말로 바꾼다.
// 화각은 사진 짧은 변 기준(recoverFov). 35mm 환산 초점거리는 짧은 변 24mm로 계산한다.

export interface PhotoInfoInput {
  fovDeg: number | null; // 짧은 변 기준 화각
  fisheye: boolean; // 원형 어안으로 풀렸는지
  trailAngleDeg?: number; // 별 궤적이 천구 극 둘레로 돈 각도
}

export interface PhotoInfoItem {
  label: string;
  value: string;
}

// 35mm 환산 초점거리(짧은 변 24mm)
export const equivalentFocalMm = (fovDeg: number): number =>
  12 / Math.tan((fovDeg * Math.PI) / 360);

export const lensKind = (focalMm: number): string =>
  focalMm < 20
    ? "초광각"
    : focalMm < 35
      ? "광각"
      : focalMm < 70
        ? "표준"
        : focalMm < 135
          ? "중망원"
          : "망원";

// 하늘은 한 시간에 15°(정확히는 항성일 기준 15.04°) 돈다
const DEG_PER_MINUTE = 15.041 / 60;

export const formatExposure = (trailAngleDeg: number): string => {
  const seconds = (trailAngleDeg / DEG_PER_MINUTE) * 60;

  if (seconds < 90) {
    return `약 ${Math.round(seconds / 5) * 5}초`;
  }

  const minutes = Math.round(seconds / 60);

  return minutes < 90
    ? `약 ${minutes}분`
    : `약 ${Math.floor(minutes / 60)}시간 ${minutes % 60}분`;
};

export const photoInfo = (input: PhotoInfoInput): PhotoInfoItem[] => {
  const items: PhotoInfoItem[] = [];

  if (input.fisheye) {
    items.push({ label: "렌즈", value: "원형 어안 (하늘 전체)" });
  } else if (input.fovDeg) {
    const focal = equivalentFocalMm(input.fovDeg);
    items.push({
      label: "렌즈",
      value: `${lensKind(focal)} (35mm 환산 약 ${Math.round(focal)}mm)`,
    });
    items.push({
      label: "화각",
      value: `짧은 변 약 ${Math.round(input.fovDeg)}°`,
    });
  }

  if (input.trailAngleDeg) {
    items.push({
      label: "별 궤적",
      // 회전 각도는 사진의 궤적에서 잰 값이고, 노출 시간은 그 각도로 추정한 값이다 ("약"으로 나타낸다)
      value: `${input.trailAngleDeg.toFixed(1)}° → 노출 ${formatExposure(input.trailAngleDeg)}`,
    });
  }

  return items;
};
