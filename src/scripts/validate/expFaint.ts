import type { SolveStar } from "@/search/solveCore";
import type { Mat3 } from "@/search/utils/similarity";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { convertTo3DCoordinates } from "@/scripts/database/coordinates";
import { judge, listPhotos, loadDetected } from "@/scripts/validate/common";
import { loadRun } from "@/scripts/validate/report";
import { scorePose } from "@/search/solveCore";
import { rankForSolving } from "@/search/utils/selectStars";
import { photoToSky } from "@/search/utils/wcs";

// 실험: 검증(고정 자세 채점)에만 어두운 별(5.5·6등급)을 쓰면 맞는 답의 점수가 오르고 틀린 답은 그대로인가.
// 풀이 기록(<풀이 이름>)의 자세(풀렸으면 답, 못 풀었으면 1위 후보)를 고정하고, 앱의 정밀화 채점(localLogOdds)과 같이
// scorePose(우선순위 상위 N개)로 카탈로그 등급 한계만 바꿔 다시 채점한다.
// 맞음·틀림은 astrometry 정답지(광축 2° 안)로, 정답지가 없으면 겹친 별 판정으로 가린다.
//   npx tsx src/scripts/validate/expFaint.ts <풀이 이름> <묶음>...
const angle = (a: number[], b: number[]) =>
  (Math.acos(
    Math.max(-1, Math.min(1, a[0] * b[0] + a[1] * b[1] + a[2] * b[2])),
  ) *
    180) /
  Math.PI;

const raw = JSON.parse(
  readFileSync(resolve(process.cwd(), "data/database/bsc5-short.json"), "utf8"),
) as { HR: string; RA: string; Dec: string; V: string }[];
// reduceDatabase와 같이: 재발 신성 북쪽왕관자리 T는 평소 밝기로
const all = raw
  .map((s) => ({ ...s, v: s.HR === "5958" ? 10.2 : parseFloat(s.V) }))
  .filter((s) => !Number.isNaN(s.v))
  .map((s) => {
    const { x, y, z } = convertTo3DCoordinates(s.Dec, s.RA);

    return { hr: s.HR, v: s.v, vector: [x, y, z] as [number, number, number] };
  });
const catalogTo = (mag: number): SolveStar[] =>
  all.filter((s) => s.v <= mag).map(({ hr, vector }) => ({ hr, vector }));

const CONFIGS: { name: string; mag: number; n: number }[] = [
  { name: "3등급·150", mag: 3.0, n: 150 },
  { name: "3.5등급·150", mag: 3.5, n: 150 },
  { name: "4등급·150", mag: 4.0, n: 150 },
  { name: "4.5등급·150", mag: 4.5, n: 150 },
  { name: "5등급·150", mag: 5.0, n: 150 },
  { name: "5.5등급·150", mag: 5.5, n: 150 },
  { name: "6등급·150", mag: 6.0, n: 150 },
];
const catalogs = new Map(CONFIGS.map((c) => [c.mag, catalogTo(c.mag)]));

type Label = "맞음" | "틀림" | "모름";
const rows: {
  file: string;
  found: boolean;
  label: Label;
  fov: number;
  scores: number[];
}[] = [];

const [name, ...sets] = process.argv.slice(2);

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

  for (const file of listPhotos(set)) {
    const r = runs.get(file);
    const d = loadDetected(set, file);

    // 어안 카메라로 풀린 사진은 직선투영 자세가 아니라 뺀다
    if (!r?.transform || !r.center || !d || r.fisheyeCamera) continue;

    const t = truth[file];
    const j = judge(d, r.transform, r.phase.includes("별 궤적"));
    const label: Label = t
      ? angle(r.center, photoToSky(t, [d.width / 2, d.height / 2])) < 2
        ? "맞음"
        : "틀림"
      : j.verdict === "정답"
        ? "맞음"
        : j.verdict === "오답"
          ? "틀림"
          : "모름";
    const ranked = rankForSolving(
      d.stars.filter((s) => !s.trail),
      d.width,
      d.height,
    );
    const scores = CONFIGS.map(
      (c) =>
        scorePose(
          r.transform as Mat3,
          ranked.slice(0, c.n).map((s): [number, number] => [s.x, s.y]),
          catalogs.get(c.mag) as SolveStar[],
          { imageWidth: d.width, imageHeight: d.height },
        )?.logOdds ?? 0,
    );
    rows.push({
      file: `${set}/${file}`,
      found: r.found,
      label,
      fov: r.fovDeg ?? 0,
      scores,
    });
  }
}

const median = (xs: number[]) => {
  const v = [...xs].sort((a, b) => a - b);

  return v.length ? v[v.length >> 1] : NaN;
};

console.log(
  `자세 ${rows.length}개 (풀린 ${rows.filter((r) => r.found).length})`,
);

for (const [k, c] of CONFIGS.entries()) {
  const of = (label: Label, found: boolean) =>
    rows.filter((r) => r.label === label && r.found === found);
  const unsolvedRight = of("맞음", false);
  const wrong = rows.filter((r) => r.label === "틀림");
  const solvedRight = of("맞음", true);
  console.log(
    `${c.name.padEnd(10)} 못 푼 정답 후보 ${unsolvedRight.filter((r) => r.scores[k] >= 9).length}/${unsolvedRight.length}장이 9 이상` +
      ` · 틀린 자세 ${wrong.filter((r) => r.scores[k] >= 9).length}/${wrong.length}장이 9 이상(최고 ${Math.max(...wrong.map((r) => r.scores[k])).toFixed(1)})` +
      ` · 풀린 정답 점수 중앙 ${median(solvedRight.map((r) => r.scores[k])).toFixed(1)}` +
      ` · 풀린 정답 중 9 미만 ${solvedRight.filter((r) => r.scores[k] < 9).length}/${solvedRight.length}`,
  );
}

// 정답지와 우리 답이 갈렸지만 정답지 쪽이 의심스러운 사진(보고서 "답이 다른 2장"), 판정이 틀린 사진(M8 위치로 확인)
const DISPUTED = new Set([
  "web-2026-10b/web-384.jpg",
  "web-2026-10c/web-406.jpg",
  "web-2026-10/web-088.jpg",
]);

for (const [k, c] of CONFIGS.entries()) {
  const wrong = rows
    .filter((r) => r.label === "틀림" && !DISPUTED.has(r.file))
    .map((r) => r.scores[k])
    .sort((a, b) => b - a);
  const unknownUp = rows.filter(
    (r) => !r.found && r.label === "모름" && r.scores[k] >= 9,
  );
  console.log(
    `${c.name.padEnd(10)} 틀린 자세 최고 ${wrong
      .slice(0, 3)
      .map((s) => s.toFixed(1))
      .join(" ")}` +
      ` · 정답 모르는 못 푼 사진 중 9 이상: ${unknownUp.map((r) => `${r.file.split("/")[1]}(${r.scores[k].toFixed(1)})`).join(" ") || "없음"}`,
  );
}

console.log("--- 못 푼 정답 후보와 9 넘는 틀린 자세");

for (const r of rows.filter(
  (r) =>
    (r.label === "맞음" && !r.found) ||
    (r.label === "틀림" && r.scores.some((s) => s >= 9)),
)) {
  console.log(
    r.file,
    r.label,
    `시야 ${r.fov.toFixed(0)}°`,
    r.scores.map((s) => s.toFixed(1)).join(" → "),
  );
}

// 여러 등급 한계로 재서 가장 높은 점수를 고르는 전략들 (사진마다 찍힌 깊이가 달라서)
const at = (mag: number) =>
  CONFIGS.findIndex((c) => c.mag === mag && c.n === 150);
const STRATEGIES: { name: string; mags: number[] }[] = [
  { name: "5등급만(지금)", mags: [5] },
  { name: "5·6 중 높은 것", mags: [5, 6] },
  { name: "4·5·6 중", mags: [4, 5, 6] },
  { name: "3~6 반 등급씩", mags: [3, 3.5, 4, 4.5, 5, 5.5, 6] },
];

console.log("--- 여러 등급 중 최고 점수");

for (const st of STRATEGIES) {
  const best = (r: (typeof rows)[number]) =>
    Math.max(...st.mags.map((m) => r.scores[at(m)]));
  const unsolvedRight = rows.filter((r) => r.label === "맞음" && !r.found);
  const solvedRight = rows.filter((r) => r.label === "맞음" && r.found);
  const wrong = rows
    .filter((r) => r.label === "틀림" && !DISPUTED.has(r.file))
    .map(best)
    .sort((a, b) => b - a);
  const unknownUp = rows.filter(
    (r) => !r.found && r.label === "모름" && best(r) >= 9,
  );
  console.log(
    `${st.name.padEnd(12)} 못 푼 정답 ${unsolvedRight.filter((r) => best(r) >= 9).length}/${unsolvedRight.length}` +
      ` · 틀린 자세 최고 ${wrong
        .slice(0, 3)
        .map((s) => s.toFixed(1))
        .join(" ")}` +
      ` · 풀린 정답 중 9 미만 ${solvedRight.filter((r) => best(r) < 9).length}/${solvedRight.length}` +
      ` · 정답 모르는 못 푼 사진 9 이상 ${unknownUp.length}장: ${unknownUp.map((r) => r.file.split("/")[1]).join(" ")}`,
  );
}

// 사진마다 가장 높은 점수를 낸 등급 한계 (풀린 정답 기준): 사진의 깊이가 고르게 퍼져 있는지
const bestMag = new Map<number, number>();

for (const r of rows.filter((r) => r.label === "맞음" && r.found)) {
  const k = r.scores.indexOf(Math.max(...r.scores));
  bestMag.set(CONFIGS[k].mag, (bestMag.get(CONFIGS[k].mag) ?? 0) + 1);
}

console.log(
  "풀린 정답에서 가장 높은 점수를 낸 등급:",
  [...bestMag.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([m, n]) => `${m}등급 ${n}장`)
    .join(", "),
);
