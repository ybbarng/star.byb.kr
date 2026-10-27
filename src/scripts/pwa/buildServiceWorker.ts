import { createHash } from "node:crypto";
import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

// 빌드(next build → out/) 뒤에 돈다 (package.json의 postbuild). 두 파일을 out/에 쓴다.
// - sw.js: src/pwa/sw.js에 받아 둘 목록(PRECACHE)과 버전(VERSION, 그 파일들 내용의 해시)을 채운다
// - sitemap.xml: 같은 페이지 목록으로
// 받아 두는 것: 페이지(HTML·RSC .txt)와 /_next/static의 JS·CSS. 글꼴 조각(92개 중 쓰는 것만 받는다)·사진은
// 처음 쓸 때 담고, 발표 자료·발표용 데모 화면(embed)·404는 넣지 않는다 (docs/pwa.md).

const ROOT = path.resolve(__dirname, "../../..");
const OUT = path.join(ROOT, "out");
const SITE = "https://star.byb.kr";

const walk = async (dir: string): Promise<string[]> => {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = await Promise.all(
    entries.map((e) =>
      e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)],
    ),
  );

  return files.flat();
};

const SKIPPED_PAGES = /^\/(embed|presentation)\/|^\/404(\.html)?$/;

// out/의 파일 → 사이트 주소. games/birthday.html → /games/birthday, index.html → /
const pageUrl = (file: string) =>
  `/${path.relative(OUT, file).split(path.sep).join("/")}`
    .replace(/\.html$/, "")
    .replace(/^\/index$/, "/");

const main = async () => {
  const files = await walk(OUT);
  const assets = files
    .map((f) => ({
      file: f,
      url: `/${path.relative(OUT, f).split(path.sep).join("/")}`,
    }))
    .filter(
      ({ url }) =>
        url.startsWith("/_next/static/") &&
        (url.endsWith(".js") || url.endsWith(".css")),
    );
  const pages = files
    .filter((f) => f.endsWith(".html") || f.endsWith(".txt"))
    .map((f) => ({ file: f, url: pageUrl(f) }))
    .filter(
      ({ url }) => !url.startsWith("/_next/") && !SKIPPED_PAGES.test(url),
    );
  const precache = [...pages, ...assets].sort((a, b) =>
    a.url.localeCompare(b.url),
  );

  // 버전: 받아 둘 파일들의 내용 해시. 바뀐 게 없으면 버전도 그대로라 다시 받지 않는다
  const hash = createHash("sha256");

  for (const { file, url } of precache) {
    hash.update(url);
    hash.update(await readFile(file));
  }

  const version = hash.digest("hex").slice(0, 12);
  const template = await readFile(path.join(ROOT, "src/pwa/sw.js"), "utf8");
  const sw = template
    .replace('"__VERSION__"', JSON.stringify(version))
    .replace("__PRECACHE__", JSON.stringify(precache.map((p) => p.url)));

  if (sw.includes("__VERSION__") || sw.includes("__PRECACHE__")) {
    throw new Error("sw.js 틀의 자리 표시를 채우지 못했다");
  }

  await writeFile(path.join(OUT, "sw.js"), sw);

  const htmlPages = pages.filter(({ file }) => file.endsWith(".html"));
  const sitemap = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...htmlPages.map(({ url }) => `  <url><loc>${SITE}${url}</loc></url>`),
    "</urlset>",
    "",
  ].join("\n");

  await writeFile(path.join(OUT, "sitemap.xml"), sitemap);

  const kb = (await Promise.all(precache.map((p) => readFile(p.file)))).reduce(
    (sum, b) => sum + b.length,
    0,
  );
  process.stdout.write(
    `sw.js ${version}: 페이지 ${pages.length}개·JS/CSS ${assets.length}개 (${(kb / 1e6).toFixed(1)}MB, 압축 전), sitemap ${htmlPages.length}쪽\n`,
  );
};

main();
