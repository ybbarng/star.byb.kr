import type { Point3D } from "@/scripts/hash/types";
import type { Mat3 } from "@/search/utils/similarity";
import { resolve } from "node:path";
import sharp from "sharp";
import { loadDetected } from "@/scripts/validate/common";
import { refineSolution } from "@/search/solveCore";
import { loadCatalog, loadDeepStars } from "@/test/synthetic/loadCatalog";

// 이정표 실험 2: 손으로 집은 대·소마젤란 은하 두 점만으로 카메라 배치(회전·크기·위치)를 계산하고,
// 예측한 별과 은하면을 사진 위에 겹쳐 그린다. 검출한 별이 예측 자리에서 몇 도 어긋나는지도 잰다.
// 좌표는 긴 변 160px로 줄인 사진 기준 (expLandmark.ts 그림에서 읽은 값)
//   npx tsx src/scripts/validate/expLandmarkPose.ts <출력 폴더> <묶음/파일> <대마젤란 x,y> <소마젤란 x,y>
const LMC = { ra: 80.894, dec: -69.756 };
const SMC = { ra: 13.187, dec: -72.829 };
const GAL_POLE = { ra: 192.859, dec: 27.128 };

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

// 세 번 상자 흐림 (가우스 흐림 근사)
const blur = (src: Float32Array, w: number, h: number, r: number) => {
  let a = src;

  for (let pass = 0; pass < 3; pass++) {
    const tmp = new Float32Array(w * h);
    const out = new Float32Array(w * h);

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        let s = 0;
        let n = 0;

        for (let k = Math.max(0, x - r); k <= Math.min(w - 1, x + r); k++) {
          s += a[y * w + k];
          n++;
        }

        tmp[y * w + x] = s / n;
      }
    }

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        let s = 0;
        let n = 0;

        for (let k = Math.max(0, y - r); k <= Math.min(h - 1, y + r); k++) {
          s += tmp[k * w + x];
          n++;
        }

        out[y * w + x] = s / n;
      }
    }

    a = out;
  }

  return a;
};

const main = async () => {
  const [out, photo, lmcArg, smcArg] = process.argv.slice(2);
  const [set, file] = photo.split("/");
  const src = resolve(process.cwd(), "public/samples-external", photo);
  const meta = await sharp(src).metadata();
  const W = meta.width!;
  const H = meta.height!;

  // 긴 변 320px에서 덩어리 중심을 다시 잡는다: 흐림(작은 반경) − 흐림(큰 반경)의 가장 밝은 곳 둘레 무게중심
  const M = 320;
  const g = await sharp(src)
    .resize(M, M, { fit: "inside" })
    .grayscale()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const w = g.info.width;
  const h = g.info.height;
  const gray = Float32Array.from(g.data.subarray(0, w * h));
  const fine = blur(gray, w, h, 2);
  const wide = blur(gray, w, h, 12);
  const dog = fine.map((v, i) => v - wide[i]);

  const refine = (arg: string) => {
    const [sx, sy] = arg.split(",").map((v) => (Number(v) * M) / 160);
    let best = [sx, sy];
    let bv = -Infinity;

    for (let y = Math.round(sy - 8); y <= sy + 8; y++) {
      for (let x = Math.round(sx - 8); x <= sx + 8; x++) {
        const v = dog[y * w + x];

        if (x >= 0 && y >= 0 && x < w && y < h && v > bv) {
          bv = v;
          best = [x, y];
        }
      }
    }

    let sw = 0;
    let cx = 0;
    let cy = 0;

    for (let y = best[1] - 5; y <= best[1] + 5; y++) {
      for (let x = best[0] - 5; x <= best[0] + 5; x++) {
        const v = x >= 0 && y >= 0 && x < w && y < h ? dog[y * w + x] : 0;

        if (v > 0) {
          sw += v;
          cx += v * x;
          cy += v * y;
        }
      }
    }

    // 줄인 사진 픽셀 가운데 → 원래 사진 좌표
    return [((cx / sw + 0.5) * W) / w - 0.5, ((cy / sw + 0.5) * H) / h - 0.5];
  };

  const pa = refine(lmcArg);
  const pb = refine(smcArg);
  console.log("두 점", pa.map(Math.round), pb.map(Math.round), W, H);
  const a = sky(LMC);
  const b = sky(SMC);
  const theta = Math.acos(dot(a, b));
  const c = [(W - 1) / 2, (H - 1) / 2];

  // 렌즈 모형: 직선투영(tan) 또는 등거리 어안(r = f·θ). 광축은 사진 가운데로 둔다
  const ray = (p: number[], f: number, fish: boolean): Point3D => {
    const dx = p[0] - c[0];
    const dy = p[1] - c[1];

    if (!fish) {
      return norm([dx, dy, f]);
    }

    const r = Math.hypot(dx, dy) || 1e-9;
    const th = r / f;

    return [(Math.sin(th) * dx) / r, (Math.sin(th) * dy) / r, Math.cos(th)];
  };

  const angleAt = (f: number, fish: boolean) =>
    Math.acos(
      Math.max(-1, Math.min(1, dot(ray(pa, f, fish), ray(pb, f, fish)))),
    );

  // 두 점 사이 각이 실제 각거리가 되는 초점 거리(픽셀): 큰 초점 거리부터 내려오며 처음 넘는 곳을 찾고 이분법으로 다듬는다.
  // 직선투영에서는 각이 초점 거리에 따라 한 방향으로만 변하지 않는다(두 점이 가운데에서 같은 쪽이면 최대가 21°에 못 미칠 수 있다)
  const solveF = (fish: boolean) => {
    const rMax = Math.max(
      Math.hypot(pa[0] - c[0], pa[1] - c[1]),
      Math.hypot(pb[0] - c[0], pb[1] - c[1]),
    );
    const fMin = fish ? rMax / Math.PI : rMax / 20;
    let hi = 100 * Math.max(W, H);

    for (let fl = hi / 1.02; fl > fMin; fl /= 1.02) {
      if (angleAt(fl, fish) >= theta) {
        let lo = fl;

        for (let i = 0; i < 60; i++) {
          const m = (lo + hi) / 2;

          if (angleAt(m, fish) >= theta) {
            lo = m;
          } else {
            hi = m;
          }
        }

        return (lo + hi) / 2;
      }

      hi = fl;
    }

    return null;
  };

  const linearF = solveF(false);
  const fish = linearF === null || process.env.FISH === "1";
  const f = fish ? solveF(true)! : linearF;

  // TRIAD: 카메라 좌표(x 오른쪽, y 아래, z 앞)의 두 광선을 하늘의 두 방향에 맞추는 회전
  const frame = (u: Point3D, v: Point3D) => {
    const t1 = u;
    const t2 = norm(cross(u, v));

    return [t1, t2, cross(t1, t2)];
  };

  const T = frame(ray(pa, f, fish), ray(pb, f, fish));
  const S = frame(a, b);

  // 하늘 → 카메라: cam_i = Σ_k T[k][i] · (S[k] · s)
  const toCam = (s: Point3D): Point3D => {
    const k = S.map((sk) => dot(sk, s));

    return [0, 1, 2].map(
      (i) => T[0][i] * k[0] + T[1][i] * k[1] + T[2][i] * k[2],
    ) as Point3D;
  };

  const project = (s: Point3D) => {
    const q = toCam(s);

    if (fish) {
      const th = Math.acos(Math.max(-1, Math.min(1, q[2])));
      const r = Math.hypot(q[0], q[1]) || 1e-9;

      return th > Math.PI * 0.6
        ? null
        : [c[0] + (f * th * q[0]) / r, c[1] + (f * th * q[1]) / r];
    }

    return q[2] <= 0.05
      ? null
      : [c[0] + (f * q[0]) / q[2], c[1] + (f * q[1]) / q[2]];
  };

  const inside = (p: number[] | null): p is number[] =>
    !!p && p[0] >= 0 && p[1] >= 0 && p[0] < W && p[1] < H;
  const fovDeg = fish
    ? (Math.max(W, H) / f) * (180 / Math.PI)
    : (2 * Math.atan(Math.max(W, H) / 2 / f) * 180) / Math.PI;

  console.log(
    `렌즈 ${fish ? "어안(등거리)" : "직선투영"}${linearF === null ? " (직선투영으로는 두 점 각을 못 맞춤)" : ""}`,
  );

  const catalog = loadCatalog();
  const predicted = catalog
    .filter((s) => s.v <= 5)
    .map((s) => ({ v: s.v, p: project(s.vector) }))
    .filter((s): s is { v: number; p: number[] } => inside(s.p));
  // 은하면: 은하 북극에 수직인 대원
  const pole = sky(GAL_POLE);
  const e1 = norm(cross(pole, [0, 0, 1]));
  const e2 = cross(pole, e1);
  const plane = Array.from({ length: 720 }, (_, i) => {
    const t = (i / 720) * 2 * Math.PI;

    return project([
      e1[0] * Math.cos(t) + e2[0] * Math.sin(t),
      e1[1] * Math.cos(t) + e2[1] * Math.sin(t),
      e1[2] * Math.cos(t) + e2[2] * Math.sin(t),
    ]);
  }).filter(inside);

  // 검출한 별(우선순위 상위 60개)이 가장 가까운 예측 별(5등급까지)에서 몇 도 떨어졌나.
  // 우연 기준: 예측을 사진 가운데로 180° 돌린 것
  const det = loadDetected(set, file)?.stars.slice(0, 60) ?? [];
  const nearestDeg = (pts: number[][]) =>
    det
      .map((d) =>
        Math.min(...pts.map((p) => Math.hypot(p[0] - d.x, p[1] - d.y))),
      )
      .map((px) => ((fish ? px / f : Math.atan(px / f)) * 180) / Math.PI)
      .sort((x, y) => x - y);
  const real = nearestDeg(predicted.map((s) => s.p));
  const rotated = nearestDeg(
    predicted.map((s) => [2 * c[0] - s.p[0], 2 * c[1] - s.p[1]]),
  );
  const share = (xs: number[], lim: number) =>
    xs.filter((x) => x <= lim).length;

  console.log(
    `${photo}\t시야 ${fovDeg.toFixed(1)}°\t예측 별 ${predicted.length}개\t` +
      `검출 ${det.length}개 중 0.5°안 ${share(real, 0.5)}(우연 ${share(rotated, 0.5)}) ` +
      `1°안 ${share(real, 1)}(우연 ${share(rotated, 1)}) ` +
      `가운데값 ${real[real.length >> 1]?.toFixed(2)}°(우연 ${rotated[rotated.length >> 1]?.toFixed(2)}°)`,
  );

  // 이 배치에서 출발해 검증 코어로 다듬는다: 허용 오차를 3° → 1.5° → 기본값으로 좁히며 refineSolution을 되풀이.
  // 초점 거리 추정도 틀릴 수 있어 ±15%를 5%씩 바꿔 보고 log-odds가 가장 높은 것을 고른다 (직선투영만)
  if (!fish) {
    const photoStars = (loadDetected(set, file)?.stars ?? [])
      .slice(0, Number(process.env.NSTARS ?? 200))
      .map((s) => [s.x, s.y] as [number, number]);
    // 앱과 같은 검증 카탈로그: 5등급 별 + 6등급 별(deep stars, journey 48장). DEEP=0이면 5등급만
    const solveCatalog = [
      ...catalog.map((s) => ({ hr: s.hr, vector: s.vector })),
      ...(process.env.DEEP === "0" ? [] : loadDeepStars()).map((vector, i) => ({
        hr: `deep-${i}`,
        vector,
      })),
    ];
    const opts = { imageWidth: W, imageHeight: H };

    // 하늘 → 사진 동차좌표: TP = K · M, M의 i행 j열 = Σ_k T[k][i] · S[k][j]
    const poseTP = (fk: number): Mat3 => {
      const Tk = frame(ray(pa, fk, false), ray(pb, fk, false));
      const M = [0, 1, 2].map((i) =>
        [0, 1, 2].map(
          (j) => Tk[0][i] * S[0][j] + Tk[1][i] * S[1][j] + Tk[2][i] * S[2][j],
        ),
      );

      return [
        M[0].map((v, j) => fk * v + c[0] * M[2][j]),
        M[1].map((v, j) => fk * v + c[1] * M[2][j]),
        M[2],
      ] as Mat3;
    };

    let best: { k: number; steps: string[]; logOdds: number } | null = null;

    for (let k = 0.85; k <= 1.151; k += 0.05) {
      const fk = f * k;
      let TP = poseTP(fk);
      const steps: string[] = [];
      let logOdds = -Infinity;

      for (const tolDeg of [3, 1.5, 0]) {
        const r = refineSolution(TP, photoStars, solveCatalog, {
          ...opts,
          ...(tolDeg
            ? { tolerancePx: fk * Math.tan((tolDeg * Math.PI) / 180) }
            : {}),
        });

        if (!r) {
          steps.push(`${tolDeg || "기본"}:실패`);
          break;
        }

        TP = r.TP;
        logOdds = r.logOdds;
        steps.push(
          `${tolDeg || "기본"}:${r.inlierCount}쌍 lo${r.logOdds.toFixed(1)} 시야${r.fovDeg.toFixed(0)}°`,
        );
      }

      if (!best || logOdds > best.logOdds) {
        best = { k, steps, logOdds };
      }
    }

    console.log(
      `  다듬기 최선: 초점×${best!.k.toFixed(2)}  ${best!.steps.join(" → ")}  ${best!.logOdds >= 9 ? "확신(9 이상)" : "확신 못 함"}`,
    );
  }

  // 겹쳐 그리기: 노란 점 은하면, 빨간 원 예측 별, 하늘색 점 검출, 초록 원 집은 두 점
  const S2 = 1200 / Math.max(W, H);
  const circles = [
    ...plane.map(
      (p) =>
        `<circle cx="${p[0] * S2}" cy="${p[1] * S2}" r="1.5" fill="yellow" opacity="0.6"/>`,
    ),
    ...det.map(
      (d) => `<circle cx="${d.x * S2}" cy="${d.y * S2}" r="2" fill="cyan"/>`,
    ),
    ...predicted.map(
      (s) =>
        `<circle cx="${s.p[0] * S2}" cy="${s.p[1] * S2}" r="${Math.max(3, 9 - s.v * 1.3)}" fill="none" stroke="red" stroke-width="1.5"/>`,
    ),
    ...[pa, pb].map(
      (p) =>
        `<circle cx="${p[0] * S2}" cy="${p[1] * S2}" r="14" fill="none" stroke="lime" stroke-width="2"/>`,
    ),
  ];
  const ow = Math.round(W * S2);
  const oh = Math.round(H * S2);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${ow}" height="${oh}">${circles.join("")}</svg>`;

  await sharp(src)
    .resize(ow, oh)
    .composite([{ input: Buffer.from(svg) }])
    .png()
    .toFile(resolve(out, `pose_${file.replace(/\.jpg$/, ".png")}`));
};

void main();
