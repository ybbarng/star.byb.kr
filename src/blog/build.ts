import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import tailwind from "@tailwindcss/postcss";
import { build } from "esbuild";
import postcss from "postcss";

// 테크 블로그 글에 넣을 데모를 star.byb.kr 서버 없이 돌아가는 정적 파일로 묶는다.
//   npx tsx src/blog/build.ts <출력 폴더>
// 출력: embeds.js·embeds.css(공용) + 데모마다 <이름>.html + 데모가 쓰는 사진(samples/)·데이터(learn/).
// 블로그의 public/blog/<글>/embed/에 그대로 넣고 iframe src를 /blog/<글>/embed/<이름>.html로 쓴다.
// 데모 코드의 절대 주소("/samples/…", "/learn/…")는 HTML 옆 상대 주소로 바꿔 묶는다.

const ROOT = path.resolve(__dirname, "../..");
const out = path.resolve(process.argv[2] ?? "out-blog-embeds");

// entry.tsx의 BLOG_DEMOS와 같은 이름들 (HTML 제목)
const DEMOS: Record<string, string> = {
  "north-sky-flow": "거제에서 본 북쪽 하늘",
  "orion-sky-flow": "거제에서 본 오리온자리",
  "quad-hash": "quad 지문",
  "same-sky-orbit": "같은 하늘은 한 달에 2시간씩 일찍 온다",
  "triangle-search": "닮은 삼각형 찾기",
  "detect-pipeline": "별 찾기 과정",
  "answer-check": "가장 가까운 지문이 답일까",
  "chance-ratio": "우연일 확률",
  "find-stars": "별다움으로 별 고르기",
};

// 데모가 불러오는 파일 (public 기준)
const ASSETS = [
  "samples/20220607-berry-seoul.jpg",
  "samples/20230904-nike-jeungseun-01.png",
  "samples/20250117-carl-aurora-01.jpg",
  "samples/20250117-carl-aurora-02.jpg",
  "samples/20250117-carl-aurora-03.jpg",
  "learn/candidates-seoul.json",
];

const relativizeAssets = (code: string) =>
  code.replace(/(["'`])\/(samples|learn)\//g, "$1$2/");

const main = async () => {
  await mkdir(out, { recursive: true });

  const result = await build({
    absWorkingDir: ROOT,
    entryPoints: [path.join(ROOT, "src/blog/entry.tsx")],
    bundle: true,
    minify: true,
    format: "iife",
    target: "es2020",
    jsx: "automatic",
    outfile: path.join(out, "embeds.js"),
    tsconfig: path.join(ROOT, "tsconfig.json"),
    define: { "process.env.NODE_ENV": '"production"' },
    logLevel: "warning",
    metafile: true,
    plugins: [
      {
        name: "relative-assets",
        setup(b) {
          b.onLoad(
            { filter: /src[\\/](learn|blog)[\\/].*\.tsx?$/ },
            async (args) => ({
              contents: relativizeAssets(await readFile(args.path, "utf8")),
              loader: args.path.endsWith("x") ? "tsx" : "ts",
            }),
          );
          // 별 검출 Worker는 따로 묶은 detect-worker.js를 HTML 옆에서 띄운다
          b.onLoad(
            { filter: /src[\\/]search[\\/]detectClient\.ts$/ },
            async (args) => {
              const code = await readFile(args.path, "utf8");
              const patched = code.replace(
                /new URL\(\s*"@\/search\/workers\/detectWorker\.ts",\s*import\.meta\.url,?\s*\)/,
                '"detect-worker.js"',
              );

              if (patched === code) {
                throw new Error(
                  "detectClient.ts의 Worker 주소를 바꾸지 못했다",
                );
              }

              return { contents: patched, loader: "ts" };
            },
          );
        },
      },
    ],
  });

  await build({
    absWorkingDir: ROOT,
    entryPoints: [path.join(ROOT, "src/search/workers/detectWorker.ts")],
    bundle: true,
    minify: true,
    format: "iife",
    target: "es2020",
    outfile: path.join(out, "detect-worker.js"),
    tsconfig: path.join(ROOT, "tsconfig.json"),
    logLevel: "warning",
  });

  // 남은 절대 주소가 있으면 서버 없이는 깨진다
  const bundled = await readFile(path.join(out, "embeds.js"), "utf8");
  const leftover = bundled.match(/["'`]\/(samples|learn|data)\/[^"'`]*/g);

  if (leftover) {
    throw new Error(`묶음에 절대 주소가 남았다: ${[...new Set(leftover)]}`);
  }

  // CSS: 사이트와 같은 Tailwind·daisyui 설정으로, 묶음에 든 파일에서 쓰는 클래스만
  const globals = await readFile(
    path.join(ROOT, "src/app/globals.css"),
    "utf8",
  );
  const fx = await readFile(path.join(ROOT, "src/game/fx/fx.css"), "utf8");
  const sources = Object.keys(result.metafile.inputs)
    .filter((f) => f.startsWith("src/") && /\.tsx?$/.test(f))
    .map((f) => `@source "${path.join(ROOT, f)}";`)
    .join("\n");
  const cssInput = `${globals.replace("@import 'tailwindcss';", "@import 'tailwindcss' source(none);")}\n${sources}\n${fx}`;
  const css = await postcss([tailwind({ optimize: { minify: true } })]).process(
    cssInput,
    { from: path.join(ROOT, "src/app/globals.css") },
  );
  await writeFile(path.join(out, "embeds.css"), css.css);

  for (const [name, title] of Object.entries(DEMOS)) {
    await writeFile(
      path.join(out, `${name}.html`),
      `<!doctype html>
<html lang="ko" data-theme="dark">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>${title} — star.byb.kr</title>
<link rel="stylesheet" href="embeds.css">
</head>
<body class="antialiased">
<div id="root" data-demo="${name}"></div>
<script src="embeds.js"></script>
</body>
</html>
`,
    );
  }

  for (const asset of ASSETS) {
    await mkdir(path.join(out, path.dirname(asset)), { recursive: true });
    await copyFile(path.join(ROOT, "public", asset), path.join(out, asset));
  }

  console.info(
    `${Object.keys(DEMOS).length}개 데모 → ${out} (embeds.js ${Math.round(bundled.length / 1024)}KB, embeds.css ${Math.round(css.css.length / 1024)}KB)`,
  );
};

main();
