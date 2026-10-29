import { describe, expect, it } from "vitest";
import { galacticToEquatorial } from "@/search/hooks/useSkyOverlay";

// 은하수 표시가 쓰는 은하 좌표 → 적도 좌표(J2000) 변환
const raDec = (v: number[]) => {
  const ra = ((Math.atan2(v[1], v[0]) * 180) / Math.PI + 360) % 360;
  const dec = (Math.asin(v[2]) * 180) / Math.PI;

  return [ra, dec];
};

describe("은하 좌표 → 적도 좌표", () => {
  it("은하 중심(l=0, b=0)은 궁수자리 적경 266.4°, 적위 −28.9°", () => {
    const [ra, dec] = raDec(galacticToEquatorial(0, 0));

    expect(ra).toBeCloseTo(266.405, 2);
    expect(dec).toBeCloseTo(-28.936, 2);
  });

  it("은하 북극(b=90°)은 머리털자리 적경 192.9°, 적위 27.1°", () => {
    const [ra, dec] = raDec(galacticToEquatorial(0, 90));

    expect(ra).toBeCloseTo(192.859, 2);
    expect(dec).toBeCloseTo(27.128, 2);
  });
});
