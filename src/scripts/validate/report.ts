import type { Overlap, RunRecord } from "@/scripts/validate/common";
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  judge,
  loadClasses,
  loadDetected,
  outDir,
  trailMidPose,
} from "@/scripts/validate/common";

// 풀이 기록을 판정하고 요약한다. 두 번째 이름을 주면 사진별로 무엇이 바뀌었는지 비교한다.
//   npx tsx src/scripts/validate/report.ts web-2026-10 base [비교할 이름]

export const loadRun = (set: string, name: string): RunRecord[] => {
  const dir = resolve(outDir(set), "runs");

  return readdirSync(dir)
    .filter((f) => f.startsWith(`${name}.`) && f.endsWith(".jsonl"))
    .flatMap((f) =>
      readFileSync(resolve(dir, f), "utf-8")
        .split("\n")
        .filter(Boolean)
        .map((l) => JSON.parse(l) as RunRecord),
    )
    .sort((a, b) => a.file.localeCompare(b.file));
};

type Judged = RunRecord & { overlap: Overlap | null };

const judgeRun = (set: string, records: RunRecord[]): Judged[] =>
  records.map((r) => {
    const det = loadDetected(set, r.file);

    return {
      ...r,
      overlap:
        det && (r.fisheyeCamera ?? r.transform)
          ? judge(
              det,
              r.fisheyeCamera ??
                (r.trailAngleDeg
                  ? trailMidPose(r.transform!, r.trailAngleDeg)
                  : r.transform!),
              r.phase.includes("별 궤적"),
            )
          : null,
    };
  });

const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);

  return s.length ? s[Math.floor(s.length / 2)] : 0;
};

const short = (f: string) => f.replace(/^web-|\.jpg$/g, "");

const run = () => {
  const [set, name, other] = process.argv.slice(2);
  const classes = loadClasses(set);
  const rows = judgeRun(set, loadRun(set, name));
  const found = rows.filter((r) => r.found);
  const count = (v: string) =>
    found.filter((r) => r.overlap?.verdict === v).length;

  console.log(
    `[${name}] ${rows.length}장: 확신 ${found.length} (정답 ${count("정답")} · 애매 ${count("애매")} · 오답 ${count("오답")}), 모름 ${rows.length - found.length}`,
  );
  console.log(
    `  확신 시간 중앙 ${(median(found.map((r) => r.timeMs)) / 1000).toFixed(2)}초, 1초 안 ${found.filter((r) => r.timeMs < 1000).length}, 시간 상한에 걸린 모름 ${rows.filter((r) => !r.found && r.timedOut).length}`,
  );

  const wrongOrVague = found.filter((r) => r.overlap?.verdict !== "정답");

  if (wrongOrVague.length) {
    console.log(
      `  정답이 아닌 확신: ${wrongOrVague.map((r) => `${short(r.file)}(${r.overlap?.verdict} 꼬리 ${r.overlap?.tail.toFixed(1)}·늦은 ${r.overlap?.tailLate.toFixed(1)} lo ${r.confidence.toFixed(1)})`).join(", ")}`,
    );
  }

  // 분류별
  const byClass = new Map<string, [number, number]>();

  for (const r of rows) {
    const c = classes.get(r.file) ?? "?";
    const v = byClass.get(c) ?? [0, 0];
    v[1]++;

    if (r.found) {
      v[0]++;
    }

    byClass.set(c, v);
  }

  console.log(
    `  분류별: ${[...byClass.entries()]
      .sort((a, b) => b[1][1] - a[1][1])
      .map(([c, [f, t]]) => `${c} ${f}/${t}`)
      .join(", ")}`,
  );

  // 확신 못 했지만 1위 후보가 겹친 별 기준 정답인 사진 (풀이가 답 근처까지 갔다)
  const nearMiss = rows.filter(
    (r) => !r.found && r.overlap?.verdict === "정답",
  );
  console.log(
    `  모름인데 1위 후보가 정답: ${nearMiss.length}장 ${nearMiss.map((r) => `${short(r.file)}(lo ${r.confidence.toFixed(1)})`).join(" ")}`,
  );

  writeFileSync(
    resolve(outDir(set), "runs", `${name}.judged.json`),
    JSON.stringify(
      rows.map(({ transform: _t, ...r }) => ({
        ...r,
        class: classes.get(r.file),
      })),
      null,
      1,
    ),
  );

  if (other && existsSync(resolve(outDir(set), "runs"))) {
    const prev = new Map(loadRun(set, other).map((r) => [r.file, r]));
    const gained = rows.filter((r) => r.found && !prev.get(r.file)?.found);
    const lost = rows.filter((r) => !r.found && prev.get(r.file)?.found);
    console.log(
      `  ${other} 대비 새로 확신 ${gained.length}: ${gained.map((r) => `${short(r.file)}(${r.overlap?.verdict} ${(r.timeMs / 1000).toFixed(1)}s)`).join(" ")}`,
    );
    console.log(
      `  ${other} 대비 잃음 ${lost.length}: ${lost.map((r) => `${short(r.file)}(이전 ${((prev.get(r.file)?.timeMs ?? 0) / 1000).toFixed(1)}s)`).join(" ")}`,
    );
  }
};

if (process.argv[1]?.endsWith("report.ts")) {
  run();
}
