import type { InputStar } from "@/search/solvers";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import sharp from "sharp";
import { answerVector, getSampleAnswer } from "@/plate-solver/sampleAnswers";
import {
  DEFAULT_SOLVERS,
  DEFAULT_TIME_BUDGET_MS,
  solvePhoto,
} from "@/search/solvePhoto";
import { buildSolverContext } from "@/search/solverContext";
import { detectLikeApp } from "@/test/real/detectImage";
import {
  contextStars,
  loadCatalog,
  loadHashes,
} from "@/test/synthetic/loadCatalog";

// 흔들림 벤치마크 (journey 29·30장): 자동으로 풀리는 실제 사진 14장을 형식 변환·재압축·축소로 흔들어
// 앱과 같은 흐름으로 푼다. 사진 하나에 맞추지 않고 "조금 다른 사진에도 풀리는가"를 잰다.
// 검출 결과는 build/robustness/에 캐시한다 (풀이만 바꿀 때 빠르게 다시 돈다).
//
//   npx tsx src/scripts/search/robustnessBench.ts            # 전체 112건
//   npx tsx src/scripts/search/robustnessBench.ts Milky      # 이름에 Milky가 든 사진만
//   BUDGET_MS=60000 npx tsx src/scripts/search/robustnessBench.ts   # 시간 상한을 늘려 논리만 비교

const FILES = [
  "big-dipper.jpg",
  "cafe-orion.jpg",
  "20220328-brice-Milky Way over Buzzvil.jpg",
  "20220607-berry-seoul.jpg",
  "20230904-nike-jeungseun-01.png",
  "20230904-nike-jeungseun-02.png",
  "20230904-nike-jeungseun-03.png",
  "20230904-nike-jeungseun-04.png",
  "20231012-nike-aust-01.jpg",
  "20231012-nike-aust-02.jpg",
  "20250117-carl-aurora-01.jpg",
  "20250117-carl-aurora-02.jpg",
  "20250117-carl-aurora-03.jpg",
  "20250117-carl-aurora-04.jpg",
];

const resizeTo = (k: number) => async (b: Buffer) => {
  const m = await sharp(b).metadata();

  return sharp(b)
    .resize(Math.round(m.width! * k))
    .png()
    .toBuffer();
};

export const VARIANTS: [string, (b: Buffer) => Promise<Buffer>][] = [
  ["webp90", (b) => sharp(b).webp({ quality: 90 }).toBuffer()],
  ["webp75", (b) => sharp(b).webp({ quality: 75 }).toBuffer()],
  ["webp50", (b) => sharp(b).webp({ quality: 50 }).toBuffer()],
  ["jpg90", (b) => sharp(b).jpeg({ quality: 90 }).toBuffer()],
  ["jpg75", (b) => sharp(b).jpeg({ quality: 75 }).toBuffer()],
  ["jpg50", (b) => sharp(b).jpeg({ quality: 50 }).toBuffer()],
  ["half", resizeTo(0.5)],
  ["3/4", resizeTo(0.75)],
];

const cacheDir = resolve(process.cwd(), "build/robustness");

interface Detected {
  stars: InputStar[];
  width: number;
  height: number;
}

export const detectVariant = async (
  file: string,
  variant: string,
): Promise<Detected> => {
  const path = resolve(
    cacheDir,
    `${file.replace(/[^\w.-]/g, "_")}.${variant.replace("/", "_")}.json`,
  );

  if (existsSync(path)) {
    return JSON.parse(readFileSync(path, "utf-8"));
  }

  const fn = VARIANTS.find(([v]) => v === variant)![1];
  const buf = await fn(
    readFileSync(resolve(process.cwd(), "public/samples", file)),
  );
  const out = await detectLikeApp(buf);
  mkdirSync(cacheDir, { recursive: true });
  writeFileSync(path, JSON.stringify(out));

  return out;
};

const angleDeg = (a: number[], b: number[]) =>
  (Math.acos(
    Math.max(-1, Math.min(1, a[0] * b[0] + a[1] * b[1] + a[2] * b[2])),
  ) *
    180) /
  Math.PI;

const run = async () => {
  const filter = process.argv[2];
  const ctx = buildSolverContext(contextStars(loadCatalog()), loadHashes());
  let solved = 0;
  let wrong = 0;
  let total = 0;
  let timeSum = 0;

  for (const file of FILES.filter((f) => !filter || f.includes(filter))) {
    const row = [file.slice(0, 24).padEnd(24)];

    for (const [variant] of VARIANTS) {
      const { stars, width, height } = await detectVariant(file, variant);
      const t0 = performance.now();
      const out = solvePhoto(stars, { width, height }, ctx, DEFAULT_SOLVERS, {
        // 앱과 같은 시간 상한 (넘으면 앱에서는 못 푼 것과 같다). BUDGET_MS로 늘리면 기계 부하와 상관없이
        // 풀이 논리만 비교할 수 있다
        timeBudgetMs: Number(process.env.BUDGET_MS) || DEFAULT_TIME_BUDGET_MS,
      });
      const ms = performance.now() - t0;
      const ok =
        out.found &&
        out.centerVector &&
        angleDeg(out.centerVector, answerVector(getSampleAnswer(file)!)) < 6;
      total++;
      timeSum += ms;

      if (ok) {
        solved++;
      } else if (out.found) {
        wrong++;
      }

      row.push(
        `${variant}:${ok ? "✓" : out.found ? "✗" : "-"}${(ms / 1000).toFixed(1)}s`,
      );
    }

    console.log(row.join(" "));
  }

  console.log(
    `풀림 ${solved}/${total}, 틀린 확신 ${wrong}, 평균 ${(timeSum / total / 1000).toFixed(2)}초`,
  );
};

// 다른 스크립트가 detectVariant만 가져다 쓸 때는 돌지 않는다
if (process.argv[1]?.endsWith("robustnessBench.ts")) {
  run();
}
