import type { Point3D } from "@/scripts/hash/types";
import type { Mat3 } from "@/search/utils/similarity";
import { resolve } from "node:path";
import sharp from "sharp";
import { loadDetected } from "@/scripts/validate/common";
import { refineSolution } from "@/search/solveCore";
import { projectVecToPhoto } from "@/search/utils/wcs";
import { loadCatalog, loadDeepStars } from "@/test/synthetic/loadCatalog";

// 이정표 실험 3 (journey 57장): 대·소마젤란 은하 두 점(원래 사진 좌표)으로 세운 배치를 검증 코어로 다듬는다.
// 렌즈 왜곡을 의심해, 검출 좌표를 반지름 방향 모형 p' = c + (p − c)(1 + k(r/R)²)로 먼저 펴고 k를 훑는다
// (R = 반대각선). 왜곡을 입력 좌표에서 펴므로 검증 코어(refineSolution)는 그대로 쓴다.
//   npx tsx src/scripts/validate/expLandmarkRefine.ts <묶음/파일> <대마젤란 x,y> <소마젤란 x,y>
//   K=-0.2,0,0.2 (훑을 k), NSTARS=200 (사진 별 수), DEEP=0 (6등급 별 빼기)
type P = [number, number];

const LMC = { ra: 80.894, dec: -69.756 };
const SMC = { ra: 13.187, dec: -72.829 };

const sky = ({ ra, dec }: { ra: number; dec: number }): Point3D => {
  const a = (ra * Math.PI) / 180;
  const d = (dec * Math.PI) / 180;

  return [Math.cos(d) * Math.cos(a), Math.cos(d) * Math.sin(a), Math.sin(d)];
};

const dot = (a: Point3D, b: Point3D) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: Point3D, b: Point3D): Point3D => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];

const norm = (a: Point3D): Point3D => {
  const n = Math.hypot(...a);

  return [a[0] / n, a[1] / n, a[2] / n];
};

const frame = (u: Point3D, v: Point3D) => {
  const t2 = norm(cross(u, v));

  return [u, t2, cross(u, t2)];
};

const [photo, lArg, sArg] = process.argv.slice(2);
const [set, file] = photo.split("/");
const det = loadDetected(set, file)!;
const W = det.width;
const H = det.height;
const c0: P = [(W - 1) / 2, (H - 1) / 2];
const R = Math.hypot(W, H) / 2;
const stars0 = det.stars
  .slice(0, Number(process.env.NSTARS ?? 200))
  .map((s) => [s.x, s.y] as P);
const catalog = [
  ...loadCatalog().map((s) => ({ hr: s.hr, vector: s.vector })),
  ...(process.env.DEEP === "0" ? [] : loadDeepStars()).map((vector, i) => ({
    hr: `deep-${i}`,
    vector,
  })),
];
const a = sky(LMC);
const b = sky(SMC);
const theta = Math.acos(dot(a, b));
const S = frame(a, b);
const ks = (process.env.K ?? "-0.2,-0.1,0,0.1,0.2,0.3,0.4")
  .split(",")
  .map(Number);

for (const k of ks) {
  // 왜곡 펴기. 펴면 사진 밖으로 나가는 점이 있어, 모서리를 편 상자를 새 사진 틀로 삼는다
  const undistort = (p: P): P => {
    const s = 1 + k * (Math.hypot(p[0] - c0[0], p[1] - c0[1]) / R) ** 2;

    return [c0[0] + (p[0] - c0[0]) * s, c0[1] + (p[1] - c0[1]) * s];
  };

  const corners = [
    [0, 0],
    [W, 0],
    [0, H],
    [W, H],
    [W / 2, 0],
    [0, H / 2],
  ].map((p) => undistort(p as P));
  const minX = Math.min(...corners.map((p) => p[0]));
  const minY = Math.min(...corners.map((p) => p[1]));
  const w = Math.max(...corners.map((p) => p[0])) - minX;
  const h = Math.max(...corners.map((p) => p[1])) - minY;

  const shift = (p: P): P => {
    const u = undistort(p);

    return [u[0] - minX, u[1] - minY];
  };

  const pts = stars0.map(shift);
  const pa = shift(lArg.split(",").map(Number) as P);
  const pb = shift(sArg.split(",").map(Number) as P);
  const c = shift(c0);
  const ray = (p: P, f: number) => norm([p[0] - c[0], p[1] - c[1], f]);
  const angleAt = (f: number) =>
    Math.acos(Math.min(1, dot(ray(pa, f), ray(pb, f))));
  // 두 점 사이 각이 21.3°가 되는 초점 거리: 큰 쪽부터 내려오며 처음 넘는 곳 (journey 57장 실수 참고)
  let f0: number | null = null;

  for (let hi = 100 * w, fl = hi / 1.02; fl > 10; fl /= 1.02) {
    if (angleAt(fl) >= theta) {
      let lo = fl;

      for (let i = 0; i < 60; i++) {
        const m = (lo + hi) / 2;

        if (angleAt(m) >= theta) {
          lo = m;
        } else {
          hi = m;
        }
      }

      f0 = (lo + hi) / 2;
      break;
    }

    hi = fl;
  }

  if (f0 === null) {
    console.log(`k=${k}\t직선투영으로 두 점 각을 못 맞춤`);
    continue;
  }

  const poseTP = (f: number): Mat3 => {
    const T = frame(ray(pa, f), ray(pb, f));
    const M = [0, 1, 2].map((i) =>
      [0, 1, 2].map(
        (j) => T[0][i] * S[0][j] + T[1][i] * S[1][j] + T[2][i] * S[2][j],
      ),
    );

    return [
      M[0].map((v, j) => f * v + c[0] * M[2][j]),
      M[1].map((v, j) => f * v + c[1] * M[2][j]),
      M[2],
    ] as Mat3;
  };

  let best: { lo: number; line: string; TP?: Mat3 } = {
    lo: -Infinity,
    line: "",
  };

  for (
    let m = Number(process.env.FMIN ?? 0.85);
    m <= Number(process.env.FMAX ?? 1.15) + 1e-3;
    m += 0.05
  ) {
    const f = f0 * m;
    let TP = poseTP(f);
    let line = "";
    let lo = -Infinity;

    for (const tolDeg of [3, 1.5, 0.75, 0]) {
      const r = refineSolution(TP, pts, catalog, {
        imageWidth: w,
        imageHeight: h,
        ...(tolDeg
          ? { tolerancePx: f * Math.tan((tolDeg * Math.PI) / 180) }
          : {}),
      });

      if (!r) {
        line += ` ${tolDeg || "기본"}:실패`;
        break;
      }

      TP = r.TP;
      lo = r.logOdds;
      // 다듬은 답이 마젤란 은하를 사진 속 두 덩어리 자리에 그대로 두는가 (흘러갔으면 틀린 답)
      const off = [
        [a, pa],
        [b, pb],
      ].map(([v, p]) => {
        const q = projectVecToPhoto(r.TP, v as Point3D);

        return q
          ? Math.hypot(q[0] - (p as P)[0], q[1] - (p as P)[1])
          : Infinity;
      });

      line = `초점×${m.toFixed(2)} ${r.inlierCount}쌍 lo${r.logOdds.toFixed(1)} 시야${r.fovDeg.toFixed(0)}° 잔차${r.rmsError.toFixed(1)}px 마젤란 어긋남 ${off.map((o) => o.toFixed(0)).join("·")}px`;
    }

    if (lo > best.lo) {
      best = { lo, line, TP };
    }
  }

  if (process.env.DRAW && k === 0 && best.TP) {
    drawIt(best.TP);
  }

  console.log(`${photo}\tk=${k}\t${best.line}${best.lo >= 9 ? "\t확신" : ""}`);
}

// DRAW=<출력 png>: k=0(왜곡 없음)에서 다듬은 답으로 4.5등급까지의 별(빨간 원)을 사진에 겹쳐 그린다. 하늘색 점은 검출
function drawIt(TP: Mat3) {
  const S2 = 1400 / Math.max(W, H);
  const circles = [
    ...stars0.map(
      (p) => `<circle cx="${p[0] * S2}" cy="${p[1] * S2}" r="2" fill="cyan"/>`,
    ),
    ...loadCatalog()
      .filter((s) => s.v <= 4.5)
      .map((s) => ({ v: s.v, p: projectVecToPhoto(TP, s.vector) }))
      .filter(
        (s) => s.p && s.p[0] >= 0 && s.p[1] >= 0 && s.p[0] < W && s.p[1] < H,
      )
      .map(
        (s) =>
          `<circle cx="${s.p![0] * S2}" cy="${s.p![1] * S2}" r="${Math.max(4, 11 - s.v * 1.6)}" fill="none" stroke="red" stroke-width="1.5"/>`,
      ),
  ];
  const ow = Math.round(W * S2);
  const oh = Math.round(H * S2);

  void sharp(resolve(process.cwd(), "public/samples-external", photo))
    .resize(ow, oh)
    .composite([
      {
        input: Buffer.from(
          `<svg xmlns="http://www.w3.org/2000/svg" width="${ow}" height="${oh}">${circles.join("")}</svg>`,
        ),
      },
    ])
    .png()
    .toFile(process.env.DRAW!);
}
