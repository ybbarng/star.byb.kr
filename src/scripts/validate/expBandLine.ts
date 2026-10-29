import type { Mat3 } from "@/search/utils/similarity";
import { resolve } from "node:path";
import sharp from "sharp";
import {
  judge,
  listPhotos,
  loadClasses,
  loadDetected,
  photoDir,
} from "@/scripts/validate/common";
import { loadRun } from "@/scripts/validate/report";
import { galacticToEquatorial } from "@/search/hooks/useSkyOverlay";
import { mat3Inv, mat3MulVec, projectVecToPhoto } from "@/search/utils/wcs";

// 실험 1단계: 사진만으로 은하수 띠의 중심선(직선)을 찾을 수 있나 (사용자 제안, journey 50장).
// 큰 원(은위 0°)은 직선투영 사진에서 직선이다. 흐린 회색조(가로 COLS칸)에서 밝기 평면을 빼고,
// 모든 직선(각도 2°, 거리 1칸 간격)에 대해 "선 둘레 띠(±BAND칸)의 평균 − 그 바깥 평균"이 가장 큰 직선을 고른다.
// 풀린 은하수 사진에서 답으로 투영한 은하면 직선과 각도·거리 차이를 잰다.
//   npx tsx src/scripts/validate/expBandLine.ts <풀이 이름> <묶음>...
export const COLS = 96;
const BAND = 0.08; // 띠 반폭: 짧은 변의 8%

export const fitPlaneResidual = (
  data: Uint8Array | Buffer,
  cols: number,
  rows: number,
  mask?: Uint8Array,
) => {
  let n = 0,
    sx = 0,
    sy = 0,
    sxx = 0,
    syy = 0,
    sxy = 0,
    sv = 0,
    sxv = 0,
    syv = 0;

  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      if (mask && !mask[j * cols + i]) continue;

      const v = data[j * cols + i];
      n++;
      sx += i;
      sy += j;
      sxx += i * i;
      syy += j * j;
      sxy += i * j;
      sv += v;
      sxv += i * v;
      syv += j * v;
    }
  }

  const inv = mat3Inv([
    [n, sx, sy],
    [sx, sxx, sxy],
    [sy, sxy, syy],
  ] as Mat3);
  const [a, b, c] = mat3MulVec(inv, [sv, sxv, syv]);
  const res = new Float32Array(cols * rows);

  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++)
      res[j * cols + i] = data[j * cols + i] - (a + b * i + c * j);
  }

  return res;
};

// 직선: 법선 각 θ, 원점(사진 가운데)에서 거리 ρ (칸 단위). x cosθ + y sinθ = ρ
export const findBandLine = (
  res: Float32Array,
  cols: number,
  rows: number,
  mask?: Uint8Array,
) => {
  const skyN = mask ? mask.reduce((a, b) => a + b, 0) : cols * rows;
  const half = BAND * Math.min(cols, rows);
  const cx = cols / 2;
  const cy = rows / 2;
  const rMax = Math.hypot(cx, cy);
  let best = { theta: 0, rho: 0, score: -Infinity };
  const all: { theta: number; rho: number; score: number }[] = [];

  for (let t = 0; t < 180; t += 2) {
    const th = (t * Math.PI) / 180;
    const c = Math.cos(th);
    const s = Math.sin(th);

    for (let rho = -rMax * 0.8; rho <= rMax * 0.8; rho += 1) {
      let inS = 0,
        inN = 0,
        outS = 0,
        outN = 0;

      for (let j = 0; j < rows; j++) {
        for (let i = 0; i < cols; i++) {
          if (mask && !mask[j * cols + i]) continue;

          const d = Math.abs((i + 0.5 - cx) * c + (j + 0.5 - cy) * s - rho);
          const v = res[j * cols + i];

          if (d < half) {
            inS += v;
            inN++;
          } else {
            outS += v;
            outN++;
          }
        }
      }

      if (inN < 0.05 * skyN || outN < 0.2 * skyN) continue;

      const score = inS / inN - outS / outN;

      all.push({ theta: t, rho, score });

      if (score > best.score) best = { theta: t, rho, score };
    }
  }

  all.sort((a, b) => b.score - a.score);
  const top: typeof all = [];
  const minDim = Math.min(cols, rows);

  for (const l of all) {
    if (top.length >= 5) break;

    const far = top.every((o) => {
      let dt = Math.abs(o.theta - l.theta);
      let dr = Math.abs(o.rho - l.rho);

      if (dt > 90) {
        dt = 180 - dt;
        dr = Math.abs(o.rho + l.rho);
      }

      return dt > 10 || dr > 0.1 * minDim;
    });

    if (far) top.push(l);
  }

  return { ...best, top };
};

// 답으로 투영한 은하면 직선 (칸 단위, 같은 θ·ρ 표현). 사진 안에 든 은하면 점들을 최소제곱 직선으로
export const trueLine = (
  pose: Mat3,
  W: number,
  H: number,
  cols: number,
  rows: number,
) => {
  const pts: [number, number][] = [];

  for (let l = 0; l < 360; l += 1) {
    const p = projectVecToPhoto(pose, galacticToEquatorial(l, 0));

    if (p && p[0] >= 0 && p[0] < W && p[1] >= 0 && p[1] < H)
      pts.push([(p[0] / W) * cols, (p[1] / H) * rows]);
  }

  if (pts.length < 3) return null;

  // 주성분 방향
  const mx = pts.reduce((s, p) => s + p[0], 0) / pts.length;
  const my = pts.reduce((s, p) => s + p[1], 0) / pts.length;
  let sxx = 0,
    syy = 0,
    sxy = 0;

  for (const [x, y] of pts) {
    sxx += (x - mx) ** 2;
    syy += (y - my) ** 2;
    sxy += (x - mx) * (y - my);
  }

  const dir = 0.5 * Math.atan2(2 * sxy, sxx - syy); // 선 방향
  let th = dir + Math.PI / 2; // 법선
  let rho = (mx - cols / 2) * Math.cos(th) + (my - rows / 2) * Math.sin(th);

  if (th < 0) {
    th += Math.PI;
    rho = -rho;
  }

  if (th >= Math.PI) {
    th -= Math.PI;
    rho = -rho;
  }

  return { theta: (th * 180) / Math.PI, rho };
};

const run = async () => {
  const [name, ...sets] = process.argv.slice(2);
  const out: { file: string; dTheta: number; dRho: number; score: number }[] =
    [];
  const ranks: number[] = [];

  for (const set of sets) {
    const runs = new Map(loadRun(set, name).map((r) => [r.file, r]));
    const classes = loadClasses(set);

    for (const file of listPhotos(set)) {
      const r = runs.get(file);
      const d = loadDetected(set, file);

      if (
        !r?.found ||
        !r.transform ||
        r.fisheyeCamera ||
        !d ||
        classes.get(file) !== "은하수"
      )
        continue;
      if (judge(d, r.transform, false).verdict !== "정답") continue;

      const { data, info } = await sharp(resolve(photoDir(set), file))
        .resize({ width: COLS })
        .greyscale()
        .blur(1)
        .raw()
        .toBuffer({ resolveWithObject: true });
      // 하늘 칸: 검출이 있는 칸과 그 이웃 (지상은 검출이 거의 없다). SKY=0이면 마스크를 쓰지 않는다
      const rows = info.height;
      const has = new Uint8Array(COLS * rows);

      for (const st of d.stars) {
        const i = Math.min(COLS - 1, Math.floor((st.x / d.width) * COLS));
        const j = Math.min(rows - 1, Math.floor((st.y / d.height) * rows));
        has[j * COLS + i] = 1;
      }

      const mask = new Uint8Array(COLS * rows);

      for (let j = 0; j < rows; j++)
        for (let i = 0; i < COLS; i++)
          for (let dj = -1; dj <= 1; dj++)
            for (let di = -1; di <= 1; di++) {
              const jj = j + dj,
                ii = i + di;

              if (
                jj >= 0 &&
                jj < rows &&
                ii >= 0 &&
                ii < COLS &&
                has[jj * COLS + ii]
              )
                mask[j * COLS + i] = 1;
            }

      const useMask = process.env.SKY === "0" ? undefined : mask;
      const res = fitPlaneResidual(data, COLS, rows, useMask);
      const found = findBandLine(res, COLS, rows, useMask);
      const truth = trueLine(r.transform, d.width, d.height, COLS, info.height);

      if (!truth) continue;

      let dTheta = Math.abs(found.theta - truth.theta);
      let dRho = Math.abs(found.rho - truth.rho);

      if (dTheta > 90) {
        dTheta = 180 - dTheta;
        dRho = Math.abs(found.rho + truth.rho);
      }

      const near = (l: { theta: number; rho: number }) => {
        let dt = Math.abs(l.theta - truth.theta);
        let dr = Math.abs(l.rho - truth.rho);

        if (dt > 90) {
          dt = 180 - dt;
          dr = Math.abs(l.rho + truth.rho);
        }

        return dt < 10 && dr / Math.min(COLS, rows) < 0.1;
      };

      const rank = found.top.findIndex(near);

      ranks.push(rank);
      out.push({
        file: `${set}/${file}`,
        dTheta,
        dRho: dRho / Math.min(COLS, info.height),
        score: found.score,
      });
    }
  }

  const q = (xs: number[], p: number) =>
    [...xs].sort((a, b) => a - b)[
      Math.min(xs.length - 1, Math.floor(p * xs.length))
    ];
  const ok = out.filter((o) => o.dTheta < 10 && o.dRho < 0.1);
  console.log(`풀린 은하수 사진 ${out.length}장 (겹친 별 판정 정답만)`);
  console.log(
    `각도 차이 25%/50%/75%: ${q(
      out.map((o) => o.dTheta),
      0.25,
    ).toFixed(1)}° / ${q(
      out.map((o) => o.dTheta),
      0.5,
    ).toFixed(1)}° / ${q(
      out.map((o) => o.dTheta),
      0.75,
    ).toFixed(1)}°`,
  );
  console.log(
    `거리 차이(짧은 변 비율) 25%/50%/75%: ${q(
      out.map((o) => o.dRho),
      0.25,
    ).toFixed(2)} / ${q(
      out.map((o) => o.dRho),
      0.5,
    ).toFixed(2)} / ${q(
      out.map((o) => o.dRho),
      0.75,
    ).toFixed(2)}`,
  );
  console.log(
    `각도 10° 안 · 거리 짧은 변 10% 안: ${ok.length}/${out.length}장`,
  );
  for (const k of [1, 3, 5])
    console.log(
      `상위 ${k}개 선 안에 실제 은하면: ${ranks.filter((r) => r >= 0 && r < k).length}/${ranks.length}장`,
    );
};

// 다른 실험(expBandSolve)이 함수만 불러 쓸 때는 돌리지 않는다
if (process.argv[1]?.endsWith("expBandLine.ts")) run();
