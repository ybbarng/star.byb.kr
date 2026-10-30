import type { Point3D } from "@/scripts/hash/types";
import type { InputStar } from "@/search/solvers";
import type { FisheyeCamera } from "@/search/utils/fisheye";
import type { Mat3 } from "@/search/utils/similarity";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { projectFisheye } from "@/search/utils/fisheye";
import { rankForSolving } from "@/search/utils/selectStars";
import { projectVecToPhoto } from "@/search/utils/wcs";
import { loadCatalog } from "@/test/synthetic/loadCatalog";

// 외부 사진 검증 (docs/external-validation-2026-10.md): 저장소에 올리지 않는 사진 묶음
// (public/samples-external/<묶음>/)을 앱과 같은 흐름으로 풀고, 맞았는지 따로 판정한다.
// 검출 캐시·풀이 결과는 build/validate/<묶음>/ 아래에 둔다 (gitignore).

export const photoDir = (set: string) =>
  resolve(process.cwd(), "public/samples-external", set);
export const outDir = (set: string) =>
  resolve(process.cwd(), "build/validate", set);
export const detPath = (set: string, file: string) =>
  resolve(outDir(set), `det${process.env.DET ?? ""}`, `${file}.json`);

// CLASS를 주면 그 분류(출처표 class 첫 단어)의 사진만
export const listPhotos = (set: string): string[] => {
  const classes = process.env.CLASS ? loadClasses(set) : null;

  return (
    readdirSync(photoDir(set))
      .filter((f) => /\.(jpe?g|png|webp)$/i.test(f))
      .filter((f) => !classes || classes.get(f) === process.env.CLASS)
      // ONLY=web-148.jpg,web-319.jpg: 그 사진만
      .filter(
        (f) => !process.env.ONLY || process.env.ONLY.split(",").includes(f),
      )
      .sort()
  );
};

// "0/4" → 네 조각 중 첫째 조각만
export const shardOf = <T>(items: T[], spec?: string): T[] => {
  if (!spec) {
    return items;
  }

  const [k, n] = spec.split("/").map(Number);

  return items.filter((_, i) => i % n === k);
};

export interface Detected {
  stars: InputStar[];
  width: number;
  height: number;
}

export const loadDetected = (set: string, file: string): Detected | null => {
  const path = detPath(set, file);

  return existsSync(path) ? JSON.parse(readFileSync(path, "utf-8")) : null;
};

// 줄인 사진 검출 캐시 (coarse 표시가 붙은 별, 좌표는 원래 사진 기준, journey 54장)
export const coarsePath = (set: string, file: string) =>
  resolve(outDir(set), "coarse", `${file}.json`);

export const loadCoarse = (set: string, file: string): InputStar[] => {
  const path = coarsePath(set, file);

  return existsSync(path) ? JSON.parse(readFileSync(path, "utf-8")) : [];
};

// 출처표(sources.csv)의 분류 첫 단어 (은하수·오로라 …). 없으면 빈 문자열
export const loadClasses = (set: string): Map<string, string> => {
  const path = resolve(photoDir(set), "sources.csv");
  const out = new Map<string, string>();

  if (!existsSync(path)) {
    return out;
  }

  const [header, ...lines] = readFileSync(path, "utf-8").split("\n");
  const col = parseCsvLine(header).indexOf("class");

  for (const line of lines) {
    const cells = parseCsvLine(line);

    if (col >= 0 && cells.length > col && cells[col]) {
      out.set(cells[0], cells[col].split("/")[0]);
    }
  }

  return out;
};

const parseCsvLine = (line: string): string[] => {
  const cells: string[] = [];
  let cur = "";
  let quoted = false;

  for (let i = 0; i < line.length; i++) {
    const c = line[i];

    if (quoted) {
      if (c === '"' && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (c === '"') {
        quoted = false;
      } else {
        cur += c;
      }
    } else if (c === '"') {
      quoted = true;
    } else if (c === ",") {
      cells.push(cur);
      cur = "";
    } else {
      cur += c;
    }
  }

  cells.push(cur);

  return cells;
};

// 한 사진의 풀이 기록
export interface RunRecord {
  file: string;
  found: boolean;
  confidence: number; // 확신한 해 또는 1위 후보의 log-odds
  inliers: number;
  center: Point3D | null;
  fovDeg: number | null;
  transform: Mat3 | null;
  timeMs: number;
  timedOut: boolean;
  phase: string; // 확신한 단계 (solver·영역·입력 크기)
  fisheye: boolean;
  fisheyeCamera?: FisheyeCamera | null; // 원형 어안 펴기·어안 blind로 풀렸으면
  trailAngleDeg?: number; // 별 궤적으로 풀렸으면 궤적이 돈 각도 (transform은 궤적 끝 순간)
}

// astrometry.net 소요 시간(ms): 로그가 만들어진 때(시작)부터 정답 WCS가 쓰인 때(끝)까지.
// 못 풀었으면 로그를 마지막으로 쓴 때까지. 기록이 없으면 null
export const astrometryTimeMs = (set: string, file: string): number | null => {
  const base = resolve(
    process.cwd(),
    "build/validate/astrometry",
    set,
    file.replace(/\.[^.]+$/, ""),
  );

  if (!existsSync(`${base}.log`)) {
    return null;
  }

  const log = statSync(`${base}.log`);
  const end = existsSync(`${base}.wcs`)
    ? statSync(`${base}.wcs`).mtimeMs
    : log.mtimeMs;

  return Math.max(0, end - log.birthtimeMs);
};

// astrometry.net을 돌린 적이 있는지: 로그나 정답 WCS가 있으면 돌렸다 (로그만 지워진 사진도 있다)
export const astrometryTried = (set: string, file: string): boolean => {
  const base = resolve(
    process.cwd(),
    "build/validate/astrometry",
    set,
    file.replace(/\.[^.]+$/, ""),
  );

  return existsSync(`${base}.log`) || existsSync(`${base}.wcs`);
};

// ─── 판정: 겹친 별 (3장) ───────────────────────────────────────────────
// 풀이가 낸 변환으로 5등급 카탈로그를 사진에 투영하고, 앱 우선순위 검출과 겹치는 수를 우연 기대와 비교한다.
// 꼬리 = -log10 P(X ≥ m | 포아송 e). 정답 자세 샘플로 보정한 기준: 꼬리 ≥ 12 이고 m ≥ 10이면 정답, < 8이면 오답.

let catalogCache: { vector: Point3D; v: number }[] | null = null;

const catalog = () => (catalogCache ??= loadCatalog());

const poissonTail = (m: number, e: number): number => {
  if (m <= 0 || e <= 0) {
    return 0;
  }

  // P(X ≥ m) = 1 - Σ_{k<m} e^-e e^k / k! — log 공간에서 항을 더한다
  let logTerm = -e; // k = 0
  let sum = Math.exp(logTerm);

  for (let k = 1; k < m; k++) {
    logTerm += Math.log(e) - Math.log(k);
    sum += Math.exp(logTerm);
  }

  if (sum < 1 - 1e-12) {
    return -Math.log10(1 - sum);
  }

  // 1 - sum이 너무 작으면 첫 항으로 어림한다 (P ≈ e^-e e^m / m!)
  let logFirst = -e;

  for (let k = 1; k <= m; k++) {
    logFirst += Math.log(e) - Math.log(k);
  }

  return -logFirst / Math.LN10;
};

export interface Overlap {
  m: number;
  e: number;
  tail: number;
  tailLate: number; // 61~150위 검출만으로 센 꼬리 (풀이에 쓰지 않은 별, 독립 증거)
  verdict: "정답" | "애매" | "오답";
}

const countOverlap = (
  projected: [number, number][],
  dets: { x: number; y: number }[],
  r: number,
  area: number,
) => {
  let m = 0;

  for (const d of dets) {
    if (projected.some(([x, y]) => (x - d.x) ** 2 + (y - d.y) ** 2 <= r * r)) {
      m++;
    }
  }

  const e = (dets.length * projected.length * Math.PI * r * r) / area;

  return { m, e, tail: poissonTail(m, e) };
};

// 궤적 끝 순간의 자세를 궤적 가운데 순간으로 되돌린다 (판정은 궤적 가운데 점으로 센다)
export const trailMidPose = (TP: Mat3, angleDeg: number): Mat3 => {
  const h = (-angleDeg * Math.PI) / 360;
  const c = Math.cos(h);
  const s = Math.sin(h);
  const R: Mat3 = [
    [c, -s, 0],
    [s, c, 0],
    [0, 0, 1],
  ];

  return TP.map((row) =>
    [0, 1, 2].map(
      (j) => row[0] * R[0][j] + row[1] * R[1][j] + row[2] * R[2][j],
    ),
  ) as Mat3;
};

// trail이면 별 궤적 점만으로 센다 (궤적 영역에서 풀린 사진). 아니면 점 검출만
export const judge = (
  det: Detected,
  transform: Mat3 | FisheyeCamera,
  trail = false,
): Overlap => {
  const { width, height } = det;
  const r = Math.hypot(width, height) * 0.006;
  const projected: [number, number][] = [];

  for (const s of catalog()) {
    const p =
      "ffish" in transform
        ? projectFisheye(transform, s.vector)
        : projectVecToPhoto(transform, s.vector);

    if (p && p[0] >= 0 && p[0] < width && p[1] >= 0 && p[1] < height) {
      projected.push([p[0], p[1]]);
    }
  }

  const ranked = rankForSolving(
    det.stars.filter((s) => Boolean(s.trail) === trail),
    width,
    height,
  );
  const top = countOverlap(projected, ranked.slice(0, 100), r, width * height);
  const late = countOverlap(
    projected,
    ranked.slice(60, 150),
    r,
    width * height,
  );
  const verdict =
    top.tail >= 12 && top.m >= 10 ? "정답" : top.tail < 8 ? "오답" : "애매";

  return { ...top, tailLate: late.tail, verdict };
};
