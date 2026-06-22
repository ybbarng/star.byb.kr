import type { Point3D } from "@/scripts/hash/types";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { fitFisheyeCamera, projectFisheye } from "@/search/utils/fisheye";

// 은하수 라벨(data/search/milkyway.json + 카탈로그)로 어안 카메라 피팅을 검증한다.
interface VStar {
  HR: string | number;
  N?: string;
  x: number;
  y: number;
  z: number;
}

const vdbPath = resolve(process.cwd(), "build/database/vectors-database.json");
const labelPath = resolve(process.cwd(), "data/search/milkyway.json");
const hasData = existsSync(vdbPath) && existsSync(labelPath);
const vdb = hasData
  ? (JSON.parse(readFileSync(vdbPath, "utf8")) as VStar[])
  : [];
const byHR = new Map<string, VStar>(vdb.map((s) => [String(s.HR), s]));

describe.skipIf(!hasData)("어안 카메라 피팅 (은하수)", () => {
  it("RMS·out-of-sample 예측이 작다", () => {
    const truth = JSON.parse(readFileSync(labelPath, "utf8")) as {
      width: number;
      height: number;
      stars: { label: string; position: [number, number] }[];
    };
    const all = truth.stars.map((s) => {
      const v = byHR.get(s.label)!;

      return {
        x: s.position[0],
        y: s.position[1],
        v: [v.x, v.y, v.z] as Point3D,
      };
    });

    // 마지막 별을 검증용으로 빼고 피팅(leave-one-out)
    const train = all.slice(0, -1);
    const test = all[all.length - 1];
    const fit = fitFisheyeCamera(train, truth.width, truth.height);

    console.warn(
      `어안 피팅: RMS ${fit.rms.toFixed(1)}px, 최대 ${fit.maxRes.toFixed(0)}px, f=${fit.camera.ffish.toFixed(0)}`,
    );

    const pred = projectFisheye(fit.camera, test.v);
    const err = pred
      ? Math.hypot(pred[0] - test.x, pred[1] - test.y)
      : Infinity;
    console.warn(`out-of-sample 예측 오차 ${err.toFixed(0)}px`);

    // 손라벨(~5px 노이즈) 기준, 어안 모델이면 충분히 작아야 한다
    expect(fit.rms).toBeLessThan(12);
    expect(err).toBeLessThan(20);
  });
});
