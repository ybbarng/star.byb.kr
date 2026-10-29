import type { Point3D } from "@/scripts/hash/types";
import type { Mat3 } from "@/search/utils/similarity";
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { photoToSky } from "@/search/utils/wcs";

// 조각 풀이(expTiles) 기록으로 틀린 답을 막는 규칙을 견준다 (journey 53장).
// 가. 조각끼리 대조: 겹치지 않는 두 조각에서 A의 답으로 계산한 B 가운데의 하늘이 B가 푼 광축과 AGREE_DEG 안
// 나. 둘레 확인: 조각을 25% 넓힌 띠(조각 밖) 검출로 잰 점수가 HELD 이상
//   npx tsx src/scripts/validate/expTilesCheck.ts <tiles-*.json 이름에 들어가는 글자>
interface Rec {
  set: string;
  file: string;
  label: string;
  rect: [number, number, number, number];
  full: Mat3;
  center: Point3D;
  lo: number;
  fov: number;
  held: number | null;
  truth: number | null;
}

const angle = (a: number[], b: number[]) =>
  (Math.acos(
    Math.max(-1, Math.min(1, a[0] * b[0] + a[1] * b[1] + a[2] * b[2])),
  ) *
    180) /
  Math.PI;

const overlap = (a: Rec["rect"], b: Rec["rect"]) =>
  a[0] < b[0] + b[2] &&
  b[0] < a[0] + a[2] &&
  a[1] < b[1] + b[3] &&
  b[1] < a[1] + a[3];

const dir = resolve(process.cwd(), "build/validate");
const recs: Rec[] = readdirSync(dir)
  .filter(
    (f) =>
      f.startsWith("tiles-") &&
      f.includes(process.argv[2] ?? "") &&
      f.endsWith(".json"),
  )
  .flatMap((f) => JSON.parse(readFileSync(resolve(dir, f), "utf8")) as Rec[]);
const byPhoto = new Map<string, Rec[]>();

for (const r of recs) {
  const k = `${r.set}/${r.file}`;
  byPhoto.set(k, [...(byPhoto.get(k) ?? []), r]);
}

// 둘레 점수: 정답지와 맞는 조각 vs 틀린 조각
const okHeld = recs
  .filter((r) => r.truth !== null && r.truth < 2)
  .map((r) => r.held);
const badHeld = recs
  .filter((r) => r.truth !== null && r.truth >= 2)
  .map((r) => r.held);
console.log(`조각 답 ${recs.length}개 (사진 ${byPhoto.size}장)`);
console.log(
  "정답지와 맞는 조각의 둘레 점수:",
  okHeld.map((x) => (x === null ? "-" : x.toFixed(1))).join(" "),
);
console.log(
  "정답지와 틀린 조각의 둘레 점수:",
  badHeld.map((x) => (x === null ? "-" : x.toFixed(1))).join(" "),
);

const agreeOf = (rs: Rec[], deg: number): Rec | null => {
  for (const a of rs)
    for (const b of rs) {
      if (a === b || overlap(a.rect, b.rect)) continue;

      const pb = photoToSky(a.full, [
        b.rect[0] + b.rect[2] / 2,
        b.rect[1] + b.rect[3] / 2,
      ]);

      if (angle(pb, b.center) < deg) return a.lo >= b.lo ? a : b;
    }

  return null;
};

for (const rule of [
  {
    name: "조각 하나라도(규칙 없음)",
    pick: (rs: Rec[]) => rs.sort((a, b) => b.lo - a.lo)[0] ?? null,
  },
  { name: "겹치지 않는 두 조각 대조 3°", pick: (rs: Rec[]) => agreeOf(rs, 3) },
  {
    name: "둘레 점수 ≥ 3",
    pick: (rs: Rec[]) =>
      rs.filter((r) => (r.held ?? 0) >= 3).sort((a, b) => b.lo - a.lo)[0] ??
      null,
  },
  {
    name: "둘레 점수 ≥ 5",
    pick: (rs: Rec[]) =>
      rs.filter((r) => (r.held ?? 0) >= 5).sort((a, b) => b.lo - a.lo)[0] ??
      null,
  },
  {
    name: "대조 3° 또는 둘레 ≥ 5",
    pick: (rs: Rec[]) =>
      agreeOf(rs, 3) ??
      rs.filter((r) => (r.held ?? 0) >= 5).sort((a, b) => b.lo - a.lo)[0] ??
      null,
  },
]) {
  let n = 0;
  let ok = 0;
  let bad = 0;
  const badList: string[] = [];

  for (const [k, rs] of byPhoto) {
    const r = rule.pick([...rs]);

    if (!r) continue;

    n++;

    if (r.truth !== null) {
      if (r.truth < 2) ok++;
      else {
        bad++;
        badList.push(`${k}(${r.label} ${r.truth.toFixed(1)}°)`);
      }
    }
  }

  console.log(
    `${rule.name.padEnd(22)} 받아들인 사진 ${n}장 · 정답지 맞음 ${ok} · 틀림 ${bad}${badList.length ? ` ${badList.join(" ")}` : ""}`,
  );
}
