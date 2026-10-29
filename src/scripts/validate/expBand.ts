import type { Mat3 } from "@/search/utils/similarity";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  judge,
  listPhotos,
  loadClasses,
  loadDetected,
} from "@/scripts/validate/common";
import { loadRun } from "@/scripts/validate/report";
import { galacticToEquatorial } from "@/search/hooks/useSkyOverlay";
import { mat3Inv, mat3MulVec, photoToSky } from "@/search/utils/wcs";

// 실험: 은하수 띠를 증거로 쓸 수 있나. 답이 맞으면 그 답에서 은하면 가까운 곳(|은위| < B_IN)에 검출이 몰려 있어야 한다.
// 사진을 칸으로 나눠 칸마다 검출 수와 은위를 구하고, 띠 안 칸의 검출 밀도 / 띠 밖 칸의 밀도(띠 일치도)를 잰다.
// 맞음·틀림은 astrometry 정답지(광축 2° 안)로, 없으면 겹친 별 판정으로.
//   npx tsx src/scripts/validate/expBand.ts <풀이 이름> <묶음>...
const B_IN = 10;
const GRID = 24;

const angle = (a: number[], b: number[]) =>
  (Math.acos(
    Math.max(-1, Math.min(1, a[0] * b[0] + a[1] * b[1] + a[2] * b[2])),
  ) *
    180) /
  Math.PI;

// 적도 좌표 방향 → 은위(도). 은하 북극 = galacticToEquatorial(0, 90)
const NGP = galacticToEquatorial(0, 90);
const galLat = (v: number[]) =>
  (Math.asin(
    Math.max(-1, Math.min(1, v[0] * NGP[0] + v[1] * NGP[1] + v[2] * NGP[2])),
  ) *
    180) /
  Math.PI;

const bandScore = (
  pose: Mat3,
  stars: { x: number; y: number }[],
  W: number,
  H: number,
): { ratio: number; inShare: number } | null => {
  const cw = W / GRID;
  const ch = Math.max(1, Math.round((GRID * H) / W));
  const chh = H / ch;
  const counts = new Float64Array(GRID * ch);

  for (const s of stars) {
    const i = Math.min(GRID - 1, Math.floor(s.x / cw));
    const j = Math.min(ch - 1, Math.floor(s.y / chh));
    counts[j * GRID + i]++;
  }

  let inN = 0;
  let inC = 0;
  let outN = 0;
  let outC = 0;

  for (let j = 0; j < ch; j++) {
    for (let i = 0; i < GRID; i++) {
      const b = Math.abs(
        galLat(photoToSky(pose, [(i + 0.5) * cw, (j + 0.5) * chh])),
      );

      if (b < B_IN) {
        inN += counts[j * GRID + i];
        inC++;
      } else {
        outN += counts[j * GRID + i];
        outC++;
      }
    }
  }

  // 띠가 사진의 일부만 지날 때만 잴 수 있다
  if (inC < 0.08 * GRID * ch || outC < 0.08 * GRID * ch) return null;

  return {
    ratio: inN / inC / Math.max(1e-6, outN / outC),
    inShare: inC / (GRID * ch),
  };
};

const [name, ...sets] = process.argv.slice(2);
const rows: {
  file: string;
  cls: string;
  label: string;
  found: boolean;
  lo: number;
  ratio: number;
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
    // 검출 전부(밝기 순 상위 1500, 아주 많은 사진은 줄인다)
    const stars = [...d.stars]
      .filter((s) => !s.trail)
      .sort((a, b) => b.brightness - a.brightness)
      .slice(0, 1500);
    const sc = bandScore(r.transform, stars, d.width, d.height);

    if (!sc) continue;

    rows.push({
      file: `${set}/${file}`,
      cls: classes.get(file) ?? "",
      label,
      found: r.found,
      lo: r.confidence,
      ratio: sc.ratio,
    });
  }
}

const q = (xs: number[], p: number) => {
  const v = [...xs].sort((a, b) => a - b);

  return v.length ? v[Math.min(v.length - 1, Math.floor(p * v.length))] : NaN;
};

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
  [
    "틀린 자세(못 푼 1위 후보)",
    (r: (typeof rows)[number]) => !r.found && r.label === "틀림",
  ],
  [
    "틀린 자세·은하수",
    (r: (typeof rows)[number]) =>
      !r.found && r.label === "틀림" && r.cls === "은하수",
  ],
] as const) {
  const v = rows.filter(pick).map((r) => r.ratio);
  console.log(
    `${title.padEnd(16)} ${v.length}장 · 띠 일치도 10%/50%/90%: ${q(v, 0.1).toFixed(2)} / ${q(v, 0.5).toFixed(2)} / ${q(v, 0.9).toFixed(2)} · 1.5 이상 ${v.filter((x) => x >= 1.5).length}`,
  );
}

console.log("--- 못 푼 은하수 사진의 1위 후보 (띠 일치도 높은 순)");

for (const r of rows
  .filter((r) => !r.found && r.cls === "은하수")
  .sort((a, b) => b.ratio - a.ratio)
  .slice(0, 15)) {
  console.log(
    r.file,
    r.label,
    `lo ${r.lo.toFixed(1)}`,
    `띠 ${r.ratio.toFixed(2)}`,
  );
}

// ─── 2. 검출 수 대신 흐린 밝기로 (띠는 퍼진 빛이다) ───────────────────────────
// 사진을 가로 96칸으로 줄인 회색조에서 밝기 평면(a + bx + cy)을 맞춰 빼고, 남은 밝기와 은하면 가까움(exp(−b²/2·8²))의
// 상관계수를 잰다. 하늘이 아닌 곳(아래쪽 지상)도 섞이지만 맞는 답과 틀린 답에 똑같이 섞인다.
const runGlow = async () => {
  const sharpMod = await import("sharp");
  const { photoDir } = await import("@/scripts/validate/common");

  const glowScore = async (
    set: string,
    file: string,
    pose: Mat3,
    W: number,
    H: number,
  ) => {
    const cols = 96;
    const { data, info } = await sharpMod
      .default(resolve(photoDir(set), file))
      .resize({ width: cols })
      .greyscale()
      .raw()
      .toBuffer({ resolveWithObject: true });
    const rows2 = info.height;
    const n = cols * rows2;
    // 평면 맞추기 (최소제곱)
    let sx = 0,
      sy = 0,
      sxx = 0,
      syy = 0,
      sxy = 0,
      sv = 0,
      sxv = 0,
      syv = 0;

    for (let j = 0; j < rows2; j++) {
      for (let i = 0; i < cols; i++) {
        const v = data[j * cols + i];
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

    // [n sx sy; sx sxx sxy; sy sxy syy] [a b c] = [sv sxv syv]
    const M = [
      [n, sx, sy],
      [sx, sxx, sxy],
      [sy, sxy, syy],
    ] as Mat3;
    const inv = mat3Inv(M);
    const [a, b, c] = mat3MulVec(inv, [sv, sxv, syv]);
    const res: number[] = [];
    const near: number[] = [];

    for (let j = 0; j < rows2; j++) {
      for (let i = 0; i < cols; i++) {
        res.push(data[j * cols + i] - (a + b * i + c * j));
        const lat = galLat(
          photoToSky(pose, [((i + 0.5) * W) / cols, ((j + 0.5) * H) / rows2]),
        );
        near.push(Math.exp(-(lat * lat) / (2 * 64)));
      }
    }

    const mean = (xs: number[]) => xs.reduce((s, x) => s + x, 0) / xs.length;
    const mr = mean(res),
      mn = mean(near);
    let cov = 0,
      vr = 0,
      vn = 0;

    for (let k = 0; k < res.length; k++) {
      cov += (res[k] - mr) * (near[k] - mn);
      vr += (res[k] - mr) ** 2;
      vn += (near[k] - mn) ** 2;
    }

    return vn > 1e-6 && vr > 1e-6 ? cov / Math.sqrt(vr * vn) : null;
  };

  const glow: {
    label: string;
    found: boolean;
    cls: string;
    file: string;
    r: number;
    lo: number;
  }[] = [];

  for (const row of rows) {
    const [set, file] = row.file.split("/");
    const r = loadRun(set, name).find((x) => x.file === file)!;
    const d = loadDetected(set, file)!;
    const g = await glowScore(
      set,
      file,
      r.transform as Mat3,
      d.width,
      d.height,
    );

    if (g !== null) glow.push({ ...row, r: g });
  }

  console.log("--- 흐린 밝기와 은하면 가까움의 상관");

  for (const [title, pick] of [
    [
      "풀린 정답·은하수",
      (r: (typeof glow)[number]) =>
        r.found && r.label === "맞음" && r.cls === "은하수",
    ],
    [
      "풀린 정답·그 밖",
      (r: (typeof glow)[number]) =>
        r.found && r.label === "맞음" && r.cls !== "은하수",
    ],
    ["틀린 자세", (r: (typeof glow)[number]) => !r.found && r.label === "틀림"],
    [
      "틀린 자세·은하수",
      (r: (typeof glow)[number]) =>
        !r.found && r.label === "틀림" && r.cls === "은하수",
    ],
  ] as const) {
    const v = glow.filter(pick).map((r) => r.r);
    console.log(
      `${title.padEnd(16)} ${v.length}장 · 상관 10%/50%/90%: ${q(v, 0.1).toFixed(2)} / ${q(v, 0.5).toFixed(2)} / ${q(v, 0.9).toFixed(2)} · 0.3 이상 ${v.filter((x) => x >= 0.3).length}`,
    );
  }

  console.log("--- 못 푼 은하수 사진의 1위 후보 (상관 높은 순)");

  for (const r of glow
    .filter((r) => !r.found && r.cls === "은하수")
    .sort((a, b) => b.r - a.r)
    .slice(0, 12)) {
    console.log(
      r.file,
      r.label,
      `lo ${r.lo.toFixed(1)}`,
      `상관 ${r.r.toFixed(2)}`,
    );
  }
};

runGlow();
