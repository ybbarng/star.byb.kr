import type { Point3D } from "@/scripts/hash/types";
import type { Mat3 } from "@/search/utils/similarity";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import sharp from "sharp";
import {
  judge,
  listPhotos,
  loadClasses,
  loadDetected,
  photoDir,
} from "@/scripts/validate/common";
import { COLS } from "@/scripts/validate/expBandLine";
import { loadRun } from "@/scripts/validate/report";
import { galacticToEquatorial } from "@/search/hooks/useSkyOverlay";
import { photoToSky } from "@/search/utils/wcs";

// 실험 (journey 51장, 사용자 제안): 은하수 모양을 대조한다. 전천 은하수 사진(ESO/S. Brunier, eso0932a, CC BY 4.0,
// 은하 좌표 등장방형 — 가운데가 은하 중심, 은경은 왼쪽으로 커진다)을 밝기 지도로 쓰고,
// 자세마다 사진 칸의 은경·은위에서 지도를 읽어 "보여야 할 은하수"를 만든 뒤 사진의 흐린 밝기와 상관을 잰다.
// 둘 다 밝기 평면(a + bx + cy)을 빼고 잰다(지평선 빛·광해 기울기). 하늘 칸(검출이 있는 칸과 이웃)만.
//   MW_MAP=<지도 jpg> npx tsx src/scripts/validate/expTemplate.ts <풀이 이름> <묶음>...
const GX = galacticToEquatorial(0, 0);
const GY = galacticToEquatorial(90, 0);
const GZ = galacticToEquatorial(0, 90);
const dot = (a: number[], b: number[]) =>
  a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

export interface SkyMap {
  data: Float32Array;
  w: number;
  h: number;
}

export const loadSkyMap = async (path: string, blurPx = 2): Promise<SkyMap> => {
  const { data, info } = await sharp(path)
    .greyscale()
    .blur(blurPx)
    .raw()
    .toBuffer({ resolveWithObject: true });

  return { data: Float32Array.from(data), w: info.width, h: info.height };
};

// 적도 방향 → 지도 밝기 (가까운 칸)
export const mapAt = (m: SkyMap, v: Point3D): number => {
  const l = Math.atan2(dot(v, GY), dot(v, GX)); // −π..π
  const b = Math.asin(Math.max(-1, Math.min(1, dot(v, GZ))));
  const x = Math.round(m.w / 2 - (l / (2 * Math.PI)) * m.w);
  const y = Math.round(m.h / 2 - (b / Math.PI) * m.h);

  return m.data[
    Math.min(m.h - 1, Math.max(0, y)) * m.w + (((x % m.w) + m.w) % m.w)
  ];
};

// 평면을 뺀 값들의 상관 (mask 칸만)
const planeResidual = (
  vals: Float32Array,
  cols: number,
  rows: number,
  mask: Uint8Array,
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

  for (let j = 0; j < rows; j++)
    for (let i = 0; i < cols; i++) {
      if (!mask[j * cols + i]) continue;

      const v = vals[j * cols + i];
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

  // 3×3 연립 (크라메르)
  const A = [
    [n, sx, sy],
    [sx, sxx, sxy],
    [sy, sxy, syy],
  ];
  const B = [sv, sxv, syv];
  const det3 = (M: number[][]) =>
    M[0][0] * (M[1][1] * M[2][2] - M[1][2] * M[2][1]) -
    M[0][1] * (M[1][0] * M[2][2] - M[1][2] * M[2][0]) +
    M[0][2] * (M[1][0] * M[2][1] - M[1][1] * M[2][0]);
  const D = det3(A);
  const coef = [0, 1, 2].map(
    (k) => det3(A.map((row, r) => row.map((x, c) => (c === k ? B[r] : x)))) / D,
  );
  const out = new Float32Array(vals.length);

  for (let j = 0; j < rows; j++)
    for (let i = 0; i < cols; i++)
      out[j * cols + i] =
        vals[j * cols + i] - (coef[0] + coef[1] * i + coef[2] * j);

  return out;
};

export const templateCorr = (
  m: SkyMap,
  photo: Float32Array, // 흐린 회색조 (cols × rows)
  cols: number,
  rows: number,
  mask: Uint8Array,
  pose: Mat3,
  W: number,
  H: number,
): number => {
  const tmpl = new Float32Array(cols * rows);

  for (let j = 0; j < rows; j++)
    for (let i = 0; i < cols; i++) {
      if (!mask[j * cols + i]) continue;

      tmpl[j * cols + i] = mapAt(
        m,
        photoToSky(pose, [((i + 0.5) * W) / cols, ((j + 0.5) * H) / rows]),
      );
    }

  const a = planeResidual(photo, cols, rows, mask);
  const b = planeResidual(tmpl, cols, rows, mask);
  let ma = 0,
    mb = 0,
    n = 0;

  for (let k = 0; k < a.length; k++)
    if (mask[k]) {
      ma += a[k];
      mb += b[k];
      n++;
    }

  ma /= n;
  mb /= n;
  let cov = 0,
    va = 0,
    vb = 0;

  for (let k = 0; k < a.length; k++)
    if (mask[k]) {
      cov += (a[k] - ma) * (b[k] - mb);
      va += (a[k] - ma) ** 2;
      vb += (b[k] - mb) ** 2;
    }

  return va > 1e-9 && vb > 1e-9 ? cov / Math.sqrt(va * vb) : 0;
};

export const skyMaskOf = (
  stars: { x: number; y: number }[],
  W: number,
  H: number,
  cols: number,
  rows: number,
) => {
  const has = new Uint8Array(cols * rows);

  for (const st of stars)
    has[
      Math.min(rows - 1, Math.floor((st.y / H) * rows)) * cols +
        Math.min(cols - 1, Math.floor((st.x / W) * cols))
    ] = 1;

  const mask = new Uint8Array(cols * rows);

  for (let j = 0; j < rows; j++)
    for (let i = 0; i < cols; i++)
      for (let dj = -1; dj <= 1; dj++)
        for (let di = -1; di <= 1; di++) {
          const jj = j + dj,
            ii = i + di;

          if (
            jj >= 0 &&
            jj < rows &&
            ii >= 0 &&
            ii < cols &&
            has[jj * cols + ii]
          )
            mask[j * cols + i] = 1;
        }

  return mask;
};

export const photoGlow = async (set: string, file: string) => {
  const { data, info } = await sharp(resolve(photoDir(set), file))
    .resize({ width: COLS })
    .greyscale()
    .blur(1)
    .raw()
    .toBuffer({ resolveWithObject: true });

  return { glow: Float32Array.from(data), rows: info.height };
};

const angle = (a: number[], b: number[]) =>
  (Math.acos(Math.max(-1, Math.min(1, dot(a, b)))) * 180) / Math.PI;

const run = async () => {
  const [name, ...sets] = process.argv.slice(2);
  const m = await loadSkyMap(process.env.MW_MAP as string);
  const rows: {
    cls: string;
    label: string;
    found: boolean;
    r: number;
    file: string;
    lo: number;
  }[] = [];

  for (const set of sets) {
    const tp = resolve(
      process.cwd(),
      "build/validate/astrometry",
      set,
      "truth.json",
    );
    const truth: Record<string, Mat3> = existsSync(tp)
      ? JSON.parse(readFileSync(tp, "utf8"))
      : {};
    const runs = new Map(loadRun(set, name).map((r) => [r.file, r]));
    const classes = loadClasses(set);

    for (const file of listPhotos(set)) {
      const r = runs.get(file);
      const d = loadDetected(set, file);

      if (!r?.transform || !r.center || !d || r.fisheyeCamera) continue;

      const t = truth[file];
      const j = judge(d, r.transform, r.phase.includes("별 궤적"));
      const label = t
        ? angle(r.center, photoToSky(t, [d.width / 2, d.height / 2])) < 2
          ? "맞음"
          : "틀림"
        : j.verdict === "정답"
          ? "맞음"
          : j.verdict === "오답"
            ? "틀림"
            : "모름";
      const { glow, rows: rr } = await photoGlow(set, file);
      const mask = skyMaskOf(d.stars, d.width, d.height, COLS, rr);
      rows.push({
        cls: classes.get(file) ?? "",
        label,
        found: r.found,
        file: `${set}/${file}`,
        lo: r.confidence,
        r: templateCorr(
          m,
          glow,
          COLS,
          rr,
          mask,
          r.transform,
          d.width,
          d.height,
        ),
      });
    }
  }

  const q = (xs: number[], p: number) =>
    [...xs].sort((a, b) => a - b)[
      Math.min(xs.length - 1, Math.floor(p * xs.length))
    ];

  for (const [title, pick] of [
    [
      "풀린 정답·은하수",
      (r: (typeof rows)[number]) =>
        r.found && r.label === "맞음" && r.cls === "은하수",
    ],
    [
      "풀린 정답·그 밖",
      (r: (typeof rows)[number]) =>
        r.found && r.label === "맞음" && r.cls !== "은하수",
    ],
    ["틀린 자세", (r: (typeof rows)[number]) => !r.found && r.label === "틀림"],
    [
      "틀린 자세·은하수",
      (r: (typeof rows)[number]) =>
        !r.found && r.label === "틀림" && r.cls === "은하수",
    ],
  ] as const) {
    const v = rows.filter(pick).map((r) => r.r);
    console.log(
      `${title.padEnd(14)} ${v.length}장 · 상관 10%/50%/90%: ${q(v, 0.1).toFixed(2)} / ${q(v, 0.5).toFixed(2)} / ${q(v, 0.9).toFixed(2)} · 0.3 이상 ${v.filter((x) => x >= 0.3).length} · 0.5 이상 ${v.filter((x) => x >= 0.5).length}`,
    );
  }
};

if (process.argv[1]?.endsWith("expTemplate.ts")) run();
