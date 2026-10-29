import type { Mat3 } from "@/search/utils/similarity";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  astrometryTimeMs,
  judge,
  listPhotos,
  loadClasses,
  loadDetected,
} from "@/scripts/validate/common";
import { loadRun } from "@/scripts/validate/report";
import { photoToSky } from "@/search/utils/wcs";

// 사진별 결과표(CSV)를 저장소에 남긴다: 우리 풀이 결과·겹친 별 판정·astrometry 결과·진단 단계.
// 사진은 넣지 않는다 (외부 사진 규칙). 사진은 public/samples-external/<묶음>/ 와 sources.csv로 찾는다.
//   npx tsx src/scripts/validate/exportResults.ts <풀이 이름> <출력 csv> <묶음>...
const angle = (a: number[], b: number[]) =>
  (Math.acos(
    Math.max(-1, Math.min(1, a[0] * b[0] + a[1] * b[1] + a[2] * b[2])),
  ) *
    180) /
  Math.PI;

const csv = (v: unknown) => {
  const s = v === undefined || v === null ? "" : String(v);

  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

const [name, out, ...sets] = process.argv.slice(2);
const diagPath = resolve(
  process.cwd(),
  "build/validate/astrometry/diagnosis.json",
);
const diagnosis = new Map<string, string>(
  existsSync(diagPath)
    ? (
        JSON.parse(readFileSync(diagPath, "utf8")) as {
          set: string;
          file: string;
          stage: string;
        }[]
      ).map((d) => [`${d.set}/${d.file}`, d.stage])
    : [],
);
const rows = [
  [
    "set",
    "file",
    "class",
    "ours_found",
    "ours_log_odds",
    "ours_time_ms",
    "ours_fov_deg",
    "ours_phase",
    "ours_trail_deg",
    "ours_fisheye",
    "overlap_verdict",
    "overlap_tail",
    "astrometry_solved",
    "astrometry_time_s",
    "center_diff_deg",
    "diagnosis",
  ].join(","),
];

for (const set of sets) {
  const truthPath = resolve(
    process.cwd(),
    "build/validate/astrometry",
    set,
    "truth.json",
  );
  const truth: Record<string, Mat3> = existsSync(truthPath)
    ? JSON.parse(readFileSync(truthPath, "utf8"))
    : {};
  const runs = new Map(loadRun(set, name).map((r) => [r.file, r]));
  const classes = loadClasses(set);

  for (const file of listPhotos(set)) {
    const r = runs.get(file);
    const d = loadDetected(set, file);
    const pose = r?.fisheyeCamera ?? r?.transform;
    const j =
      r?.found && d && pose
        ? judge(d, pose, r.phase.includes("별 궤적"))
        : null;
    const t = truth[file];
    const diff =
      r?.found && r.center && t && d
        ? angle(r.center, photoToSky(t, [d.width / 2, d.height / 2]))
        : null;
    rows.push(
      [
        set,
        file,
        classes.get(file),
        r?.found ? 1 : 0,
        r?.found ? r.confidence.toFixed(1) : "",
        r?.timeMs,
        r?.found ? r.fovDeg?.toFixed(1) : "",
        r?.found ? r.phase : "",
        r?.trailAngleDeg?.toFixed(1),
        r?.fisheyeCamera ? 1 : 0,
        j?.verdict,
        j?.tail.toFixed(1),
        t ? 1 : 0,
        ((astrometryTimeMs(set, file) ?? NaN) / 1000)
          .toFixed(1)
          .replace("NaN", ""),
        diff?.toFixed(2),
        diagnosis.get(`${set}/${file}`),
      ]
        .map(csv)
        .join(","),
    );
  }
}

writeFileSync(out, `${rows.join("\n")}\n`);
console.log(out, rows.length - 1, "장");
