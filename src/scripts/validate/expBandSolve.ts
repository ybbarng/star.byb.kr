import type { Point2D, Point3D } from "@/scripts/hash/types";
import type { SolveStar } from "@/search/solveCore";
import type { InputStar } from "@/search/solvers";
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
import {
  COLS,
  findBandLine,
  fitPlaneResidual,
  trueLine,
} from "@/scripts/validate/expBandLine";
import { loadRun } from "@/scripts/validate/report";
import { galacticToEquatorial } from "@/search/hooks/useSkyOverlay";
import { scorePose } from "@/search/solveCore";
import { heldOutLogOdds, polish } from "@/search/solvePhoto";
import { buildSolverContext } from "@/search/solverContext";
import { isConfident } from "@/search/solvers/candidates";
import { rankForSolving } from "@/search/utils/selectStars";
import { photoToSky } from "@/search/utils/wcs";
import {
  contextStars,
  loadCatalog,
  loadDeepStars,
  loadHashes,
} from "@/test/synthetic/loadCatalog";

// 실험 2단계 (journey 50장): 은하수 띠 중심선 → 후보 자세 → 앱과 같은 확신 기준.
// 선은 카메라 좌표에서 원점을 지나는 평면이다. 그 법선을 은하 북극(또는 남극)에 맞추면 남는 자유도는 은하 북극 둘레 회전(은경 φ) 하나다.
// 검출과 카탈로그 별을 "평면에서의 위도(은위)·경도"로 바꾸면, 은위가 같은 짝마다 φ = 카탈로그 경도 − 검출 경도에 한 표.
// 표가 몰린 φ로 자세를 만들고, 싸게 채점해 상위만 정밀화(polish)한 뒤 국소 밀도 채점 ≥ 9 · 교차 검증 ≥ 3으로 판정한다.
//   npx tsx src/scripts/validate/expBandSolve.ts <풀이 이름> <묶음>... (못 푼 은하수 사진만, ALL=1이면 풀린 사진도)
const FOVS = [12, 16, 20, 25, 30, 36, 42, 50, 58, 66, 75]; // 짧은 변 시야각(도)
const VOTE_STARS = 80;
const PEAKS = 3;
const POLISH_TOP = 8;

const dot = (a: number[], b: number[]) =>
  a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: number[], b: number[]): Point3D => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];

const norm = (a: number[]): Point3D => {
  const n = Math.hypot(a[0], a[1], a[2]);

  return [a[0] / n, a[1] / n, a[2] / n];
};

const angle = (a: number[], b: number[]) =>
  (Math.acos(Math.max(-1, Math.min(1, dot(a, b)))) * 180) / Math.PI;

const NGP = galacticToEquatorial(0, 90);
const GAL_L0 = galacticToEquatorial(0, 0);

// 띠 중심선(픽셀: 법선 n, 가운데에서 거리 rhoPx) · 초점거리 f · 북/남 → 은경 투표로 후보 자세(TP)들
const posesForLine = (
  n2: [number, number],
  rhoPx: number,
  f: number,
  sign: 1 | -1,
  W: number,
  H: number,
  vote: Point2D[],
  catalog: { lat: number; lon: number }[][], // 부호별로 미리 계산 (은위 순 정렬)
): { TP: Mat3; votes: number }[] => {
  const cx = W / 2;
  const cy = H / 2;
  const t2: [number, number] = [-n2[1], n2[0]];
  const foot: [number, number] = [cx + rhoPx * n2[0], cy + rhoPx * n2[1]];
  const dirOf = (p: Point2D): Point3D =>
    norm([(p[0] - cx) / f, (p[1] - cy) / f, 1]);
  const d1 = dirOf([foot[0] + 1000 * t2[0], foot[1] + 1000 * t2[1]]);
  const d2 = dirOf([foot[0] - 1000 * t2[0], foot[1] - 1000 * t2[1]]);
  const nCam = norm(cross(d1, d2));
  // 카메라 쪽 기준: a = 띠 위 발 지점 방향, b = n × a
  const aCam = norm(
    dirOf(foot).map((v, k) => v - dot(dirOf(foot), nCam) * nCam[k]),
  );
  const bCam = cross(nCam, aCam);
  const target = sign === 1 ? NGP : (NGP.map((v) => -v) as Point3D);
  const aEq = norm(GAL_L0.map((v, k) => v - dot(GAL_L0, target) * target[k]));
  const bEq = cross(target, aEq);
  const tolDeg =
    ((Math.max(5, Math.hypot(W, H) * 0.006) * 1.5) / f) * (180 / Math.PI);
  const bins = new Float32Array(720); // 0.5° 칸
  const cat = catalog[sign === 1 ? 0 : 1];

  for (const p of vote) {
    const d = dirOf(p);
    const lat =
      (Math.asin(Math.max(-1, Math.min(1, dot(d, nCam)))) * 180) / Math.PI;
    const lon = (Math.atan2(dot(d, bCam), dot(d, aCam)) * 180) / Math.PI;
    // 은위가 tolDeg 안인 카탈로그 별 (이분 탐색)
    let lo = 0;
    let hi = cat.length;

    while (lo < hi) {
      const mid = (lo + hi) >> 1;

      if (cat[mid].lat < lat - tolDeg) lo = mid + 1;
      else hi = mid;
    }

    for (let k = lo; k < cat.length && cat[k].lat <= lat + tolDeg; k++) {
      const phi = (((cat[k].lon - lon) % 360) + 360) % 360;
      bins[Math.floor(phi * 2) % 720] += 1;
    }
  }

  // 이웃 칸까지 합친 점수로 상위 봉우리
  const smooth = (i: number) =>
    bins[(i + 719) % 720] + bins[i] + bins[(i + 1) % 720];
  const peaks: { phi: number; votes: number }[] = [];
  const order = Array.from({ length: 720 }, (_, i) => i).sort(
    (a, b) => smooth(b) - smooth(a),
  );

  for (const i of order) {
    if (peaks.length >= PEAKS) break;
    if (peaks.some((p) => Math.abs(((p.phi - i / 2 + 540) % 360) - 180) < 3))
      continue;

    peaks.push({ phi: i / 2 + 0.25, votes: smooth(i) });
  }

  return peaks.map(({ phi, votes }) => {
    const c = Math.cos((phi * Math.PI) / 180);
    const s = Math.sin((phi * Math.PI) / 180);

    // 카메라 방향 d → 적도: α(c·aEq + s·bEq) + β(−s·aEq + c·bEq) + γ·target
    const toEq = (d: Point3D): Point3D => {
      const al = dot(d, aCam);
      const be = dot(d, bCam);
      const ga = dot(d, nCam);

      return [0, 1, 2].map(
        (k) =>
          al * (c * aEq[k] + s * bEq[k]) +
          be * (-s * aEq[k] + c * bEq[k]) +
          ga * target[k],
      ) as Point3D;
    };

    // R(적도 → 카메라)의 행 = 카메라 축을 적도로 옮긴 것
    const R = [toEq([1, 0, 0]), toEq([0, 1, 0]), toEq([0, 0, 1])];
    const TP: Mat3 = [
      [
        f * R[0][0] + cx * R[2][0],
        f * R[0][1] + cx * R[2][1],
        f * R[0][2] + cx * R[2][2],
      ],
      [
        f * R[1][0] + cy * R[2][0],
        f * R[1][1] + cy * R[2][1],
        f * R[1][2] + cy * R[2][2],
      ],
      [R[2][0], R[2][1], R[2][2]],
    ];

    return { TP, votes };
  });
};

const run = async () => {
  const [name, ...sets] = process.argv.slice(2);
  const ctx = buildSolverContext(
    contextStars(loadCatalog()),
    loadHashes(),
    undefined,
    loadDeepStars(),
  );
  const catalogBy = ([1, -1] as const).map((sign) => {
    const target = sign === 1 ? NGP : (NGP.map((v) => -v) as Point3D);
    const aEq = norm(GAL_L0.map((v, k) => v - dot(GAL_L0, target) * target[k]));
    const bEq = cross(target, aEq);

    return ctx.catalog
      .map((s: SolveStar) => ({
        lat: (Math.asin(dot(s.vector, target)) * 180) / Math.PI,
        lon:
          (Math.atan2(dot(s.vector, bEq), dot(s.vector, aEq)) * 180) / Math.PI,
      }))
      .sort((a, b) => a.lat - b.lat);
  });
  const rows: string[] = [];
  let tried = 0;
  let accepted = 0;
  let truthHits = 0;

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

      if (!d || classes.get(file) !== "은하수") continue;
      if (r?.found && !process.env.ALL) continue;

      tried++;
      const t0 = performance.now();
      const W = d.width;
      const H = d.height;
      const { data, info } = await sharp(resolve(photoDir(set), file))
        .resize({ width: COLS })
        .greyscale()
        .blur(1)
        .raw()
        .toBuffer({ resolveWithObject: true });
      const rowsN = info.height;
      const has = new Uint8Array(COLS * rowsN);

      for (const st of d.stars) {
        has[
          Math.min(rowsN - 1, Math.floor((st.y / H) * rowsN)) * COLS +
            Math.min(COLS - 1, Math.floor((st.x / W) * COLS))
        ] = 1;
      }

      const mask = new Uint8Array(COLS * rowsN);

      for (let j = 0; j < rowsN; j++)
        for (let i = 0; i < COLS; i++)
          for (let dj = -1; dj <= 1; dj++)
            for (let di = -1; di <= 1; di++) {
              const jj = j + dj;
              const ii = i + di;

              if (
                jj >= 0 &&
                jj < rowsN &&
                ii >= 0 &&
                ii < COLS &&
                has[jj * COLS + ii]
              )
                mask[j * COLS + i] = 1;
            }

      // ORACLE=1: 답에서 계산한 진짜 은하면 선만 넣는다 (투표·자세 만들기가 맞는지 확인용)
      const oracle =
        process.env.ORACLE && r?.transform
          ? trueLine(r.transform, W, H, COLS, rowsN)
          : null;
      const lines = oracle
        ? [{ ...oracle, score: 0 }]
        : findBandLine(
            fitPlaneResidual(data, COLS, rowsN, mask),
            COLS,
            rowsN,
            mask,
          ).top;
      const cell = W / COLS;
      const ranked = rankForSolving(
        d.stars.filter((s) => !s.trail),
        W,
        H,
      ) as InputStar[];
      // 투표에는 우선순위 상위와 밝기 상위를 함께 (띠 속 밝은 별이 별다움에서 밀려도 들어가게)
      const byBright = [...ranked].sort((a, b) => b.brightness - a.brightness);
      const voteSet = new Map<string, Point2D>();

      for (const s of [
        ...ranked.slice(0, VOTE_STARS),
        ...byBright.slice(0, VOTE_STARS),
      ])
        voteSet.set(`${s.x},${s.y}`, [s.x, s.y]);

      const vote = [...voteSet.values()];
      const top150 = ranked.slice(0, 150).map((s): Point2D => [s.x, s.y]);
      const opts = { imageWidth: W, imageHeight: H };
      const cands: { TP: Mat3; quick: number }[] = [];

      // 찾은 선은 은위 0°에서 1~2° 어긋나도 짝이 엇나가므로, 각도·위치를 흔들어 여러 번 투표한다 (JITTER=0이면 끈다).
      // 표가 많은 자세만 골라(QUICK_TOP) 싸게 채점한다
      const jit =
        process.env.JITTER === "0" || oracle ? [0] : [-3, -2, -1, 0, 1, 2, 3];
      const voted: { TP: Mat3; votes: number }[] = [];

      for (const ln of lines) {
        for (const dt of jit) {
          const th = ((ln.theta + dt * 2) * Math.PI) / 180;

          for (const dr of jit) {
            for (const fov of FOVS) {
              const f = Math.min(W, H) / 2 / Math.tan((fov * Math.PI) / 360);

              for (const sign of [1, -1] as const) {
                voted.push(
                  ...posesForLine(
                    [Math.cos(th), Math.sin(th)],
                    (ln.rho + dr * 0.75) * cell,
                    f,
                    sign,
                    W,
                    H,
                    vote,
                    catalogBy,
                  ),
                );
              }
            }
          }
        }
      }

      voted.sort((a, b) => b.votes - a.votes);

      for (const { TP } of voted.slice(
        0,
        Number(process.env.QUICK_TOP ?? 600),
      )) {
        const q = scorePose(TP, top150, ctx.catalog, opts);

        if (q) cands.push({ TP: q.TP, quick: q.logOdds });
      }

      cands.sort((a, b) => b.quick - a.quick);
      let best: {
        lo: number;
        local: number;
        held: number;
        deepLocal: number;
        TP: Mat3;
        ok: boolean;
      } | null = null;

      for (const c of cands.slice(0, POLISH_TOP)) {
        const centerVector = photoToSky(c.TP, [W / 2, H / 2]);
        const seed = {
          found: false,
          centerVector,
          fovDeg: 0,
          transform: c.TP,
          confidence: c.quick,
          inlierCount: 0,
          candidatesEvaluated: 0,
          timeMs: 0,
          candidates: [],
        };
        const out = polish(seed as never, ranked, { width: W, height: H }, ctx);

        if (!out.transform) continue;

        const local =
          scorePose(out.transform, top150, ctx.catalog, opts)?.logOdds ?? 0;
        const deepLocal =
          scorePose(out.transform, top150, ctx.verifyCatalog!, opts)?.logOdds ??
          0;
        const cand = {
          centerVector: out.centerVector!,
          fovDeg: out.fovDeg ?? 0,
          transform: out.transform,
          confidence: out.confidence,
          inlierCount: out.inlierCount ?? 0,
        };
        const plausible = isConfident({
          inlierCount: cand.inlierCount,
          fovDeg: cand.fovDeg,
          logOdds: 99,
        });
        const held5 = heldOutLogOdds(
          cand,
          ranked,
          { width: W, height: H },
          ctx,
        );
        const ok5 =
          isConfident({
            inlierCount: cand.inlierCount,
            fovDeg: cand.fovDeg,
            logOdds: out.confidence,
          }) &&
          local >= 9 &&
          held5 >= 3;
        const okDeep =
          plausible &&
          deepLocal >= 9 &&
          heldOutLogOdds(
            cand,
            ranked,
            { width: W, height: H },
            { ...ctx, catalog: ctx.verifyCatalog! },
          ) >= 3;
        const row = {
          lo: out.confidence,
          local,
          held: held5,
          deepLocal,
          TP: out.transform,
          ok: ok5 || okDeep,
        };

        if (
          !best ||
          (row.ok && !best.ok) ||
          (row.ok === best.ok && row.local > best.local)
        )
          best = row;
      }

      const ms = Math.round(performance.now() - t0);
      const tr = truth[file];
      const center = best ? photoToSky(best.TP, [W / 2, H / 2]) : null;
      const vsTruth =
        tr && center
          ? angle(center, photoToSky(tr, [W / 2, H / 2])).toFixed(1)
          : "-";
      const j = best ? judge(d, best.TP, false) : null;

      if (best?.ok) accepted++;
      if (tr && center && angle(center, photoToSky(tr, [W / 2, H / 2])) < 2)
        truthHits++;

      rows.push(
        `${set}/${file} ${r?.found ? "(풀림)" : ""} 선 ${lines.length} 후보 ${cands.length} · 최고 lo ${best?.lo.toFixed(1) ?? "-"} 국소 ${best?.local.toFixed(1) ?? "-"} 6등급 ${best?.deepLocal.toFixed(1) ?? "-"} 교차 ${best?.held.toFixed(1) ?? "-"} → ${best?.ok ? "확신" : "못 풂"} · 정답지와 ${vsTruth}° · 판정 ${j?.verdict ?? "-"} · ${ms}ms`,
      );
    }
  }

  console.log(rows.join("\n"));
  console.log(
    `사진 ${tried}장 · 확신 ${accepted}장 · 정답지 2° 안 ${truthHits}장`,
  );
};

run();
