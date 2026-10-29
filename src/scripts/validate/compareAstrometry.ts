import type { Mat3 } from "@/search/utils/similarity";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  listPhotos,
  loadClasses,
  loadDetected,
} from "@/scripts/validate/common";
import { loadRun } from "@/scripts/validate/report";
import { photoToSky } from "@/search/utils/wcs";

// 우리 풀이(8초)와 astrometry.net(로컬, 한 장 2분, 인덱스 4110~4119)을 사진별로 비교한다.
//   npx tsx src/scripts/validate/compareAstrometry.ts <풀이 이름> <묶음>...
const angle = (a: number[], b: number[]) =>
  (Math.acos(
    Math.max(-1, Math.min(1, a[0] * b[0] + a[1] * b[1] + a[2] * b[2])),
  ) *
    180) /
  Math.PI;

const [name, ...sets] = process.argv.slice(2);
const total = { both: 0, ours: 0, astro: 0, neither: 0, disagree: 0 };
const byClass: Record<string, typeof total> = {};
const oursOnly: string[] = [];
const astroOnly: string[] = [];
const disagree: string[] = [];

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
    const ours = Boolean(r?.found);
    const astro = Boolean(truth[file]);
    const cls = classes.get(file) ?? set;
    const c = (byClass[cls] ??= {
      both: 0,
      ours: 0,
      astro: 0,
      neither: 0,
      disagree: 0,
    });
    const key =
      ours && astro ? "both" : ours ? "ours" : astro ? "astro" : "neither";
    total[key]++;
    c[key]++;

    if (key === "ours") oursOnly.push(`${set}/${file}`);
    if (key === "astro") astroOnly.push(`${set}/${file}`);

    if (key === "both" && r?.center) {
      const d = loadDetected(set, file);
      const tc = d
        ? photoToSky(truth[file], [d.width / 2, d.height / 2])
        : null;
      const diff = tc ? angle(r.center, tc) : 0;

      if (diff > 2) {
        total.disagree++;
        c.disagree++;
        disagree.push(`${set}/${file} (${diff.toFixed(1)}°)`);
      }
    }
  }
}

console.log(
  "전체:",
  `둘 다 ${total.both} · 우리만 ${total.ours} · astrometry만 ${total.astro} · 둘 다 못 풂 ${total.neither} · 둘 다 풀었는데 답이 다름(2° 넘게) ${total.disagree}`,
);

for (const [cls, c] of Object.entries(byClass).sort(
  (a, b) =>
    b[1].both +
    b[1].ours +
    b[1].astro +
    b[1].neither -
    (a[1].both + a[1].ours + a[1].astro + a[1].neither),
)) {
  console.log(
    `  ${cls.padEnd(8)} 둘 다 ${c.both} · 우리만 ${c.ours} · astrometry만 ${c.astro} · 둘 다 못 풂 ${c.neither}${c.disagree ? ` · 답 다름 ${c.disagree}` : ""}`,
  );
}

console.log("우리만:", oursOnly.join(" "));
console.log("astrometry만:", astroOnly.join(" "));
console.log("답 다름:", disagree.join(" "));
