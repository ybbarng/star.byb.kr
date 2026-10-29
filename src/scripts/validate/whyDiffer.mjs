// 결과표(results-*.csv)로 우리와 astrometry가 갈린 까닭을 센다: 풀린 단계·시야 구간별 성공률·분류.
//   node src/scripts/validate/whyDiffer.mjs [cafe]
import { readFileSync } from "node:fs";

const parse = (line) => {
  const out = [];
  let cur = "",
    q = false;

  for (const ch of line) {
    if (q) {
      if (ch === '"') q = false;
      else cur += ch;
    } else if (ch === '"') q = true;
    else if (ch === ",") {
      out.push(cur);
      cur = "";
    } else cur += ch;
  }

  out.push(cur);

  return out;
};

const l = readFileSync("docs/validation/results-2026-10-29.csv", "utf8")
  .trim()
  .split("\n");
const h = parse(l[0]);
const rows = l
  .slice(1)
  .map((x) => Object.fromEntries(parse(x).map((v, i) => [h[i], v])));
const sets =
  process.argv[2] === "cafe"
    ? ["cafe-2026-10"]
    : ["web-2026-10", "web-2026-10b", "web-2026-10c", "samples"];
const R = rows.filter(
  (r) => sets.includes(r.set) && !r.class.includes("단망경"),
);

const group = (xs, f) => {
  const m = {};

  for (const x of xs) {
    const k = f(x);
    m[k] = (m[k] ?? 0) + 1;
  }

  return Object.entries(m).sort((a, b) => b[1] - a[1]);
};

const fovBin = (f) => {
  f = +f;

  return f < 20
    ? "<20"
    : f < 40
      ? "20-40"
      : f < 60
        ? "40-60"
        : f < 80
          ? "60-80"
          : "80+";
};

const ours = R.filter(
  (r) => r.ours_found === "1" && r.astrometry_solved !== "1",
);
const both = R.filter(
  (r) => r.ours_found === "1" && r.astrometry_solved === "1",
);
const phaseKey = (r) =>
  r.ours_fisheye === "1"
    ? "어안"
    : r.ours_phase.includes("궤적")
      ? "별 궤적"
      : /위쪽|가운데/.test(r.ours_phase)
        ? "영역"
        : "전체";
console.log("우리만", ours.length, "단계", group(ours, phaseKey));
console.log("둘다", both.length, "단계", group(both, phaseKey));
console.log(
  "우리만 시야",
  group(
    ours.filter((r) => r.ours_fisheye !== "1"),
    (r) => fovBin(r.ours_fov_deg),
  ),
);
console.log(
  "둘다 시야",
  group(both, (r) => fovBin(r.ours_fov_deg)),
);
console.log("우리만 phase 원문", group(ours, (r) => r.ours_phase).slice(0, 15));
console.log(
  "우리만 astrometry 시간 중앙",
  (() => {
    const v = ours
      .map((r) => +r.astrometry_time_s)
      .filter((x) => x > 0)
      .sort((a, b) => a - b);

    return [v.length, v[v.length >> 1], v.filter((x) => x >= 110).length];
  })(),
);
// 우리가 푼 사진(우리 시야각을 기준으로)에서 시야 구간별 astrometry 성공률
const solved = R.filter((r) => r.ours_found === "1" && r.ours_fisheye !== "1");
const bins = {};

for (const r of solved) {
  const b = fovBin(r.ours_fov_deg);
  bins[b] ??= [0, 0];
  bins[b][0]++;
  bins[b][1] += r.astrometry_solved === "1" ? 1 : 0;
}

console.log("시야별 [우리가 푼, 그중 astrometry도 푼]", bins);
console.log(
  "우리만·전체 단계 시야",
  group(
    ours.filter((r) => phaseKey(r) === "전체"),
    (r) => fovBin(r.ours_fov_deg),
  ),
);
console.log(
  "우리만·영역 시야",
  group(
    ours.filter((r) => phaseKey(r) === "영역"),
    (r) => fovBin(r.ours_fov_deg),
  ),
);
console.log(
  "우리만 분류",
  group(ours, (r) => r.class),
);
