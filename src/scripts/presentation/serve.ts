import fs from "node:fs";
import http from "node:http";
import path from "node:path";

// 발표용 로컬 서버: `npm run build`로 만든 정적 내보내기(out/)를 그대로 내려준다.
// 개발 서버(next dev)는 iframe 안에도 Next 디버깅 표시·오류 창이 뜨고 느리다. 발표는 배포와 같은 결과물로 한다.
//   npm run build && npx tsx src/scripts/presentation/serve.ts   → http://localhost:5025/presentation/v3.html
// 주소 규칙은 배포(nginx, ops/nginx.conf)와 같다: /a/b → a/b, a/b.html, a/b/index.html 순으로 찾는다.

const PORT = Number(process.env.PORT ?? 5025);
const ROOT = path.resolve("out");

const TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
  ".txt": "text/plain; charset=utf-8",
  ".wasm": "application/wasm",
};

const resolve = (urlPath: string) => {
  const clean = path
    .normalize(decodeURIComponent(urlPath))
    .replace(/^(\.\.[/\\])+/, "");
  const base = path.join(ROOT, clean);

  if (!base.startsWith(ROOT)) return null;

  for (const candidate of [
    base,
    `${base}.html`,
    path.join(base, "index.html"),
  ]) {
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
      return candidate;
    }
  }

  return null;
};

if (!fs.existsSync(ROOT)) {
  console.error("out/ 이 없어요. 먼저 npm run build 를 하세요.");
  process.exit(1);
}

http
  .createServer((req, res) => {
    const url = new URL(req.url ?? "/", "http://localhost");
    const file = resolve(url.pathname);

    if (!file) {
      const notFound = path.join(ROOT, "404.html");
      res.writeHead(404, { "Content-Type": TYPES[".html"] });
      res.end(fs.existsSync(notFound) ? fs.readFileSync(notFound) : "404");

      return;
    }

    res.writeHead(200, {
      "Content-Type": TYPES[path.extname(file)] ?? "application/octet-stream",
    });
    fs.createReadStream(file).pipe(res);
  })
  .listen(PORT, () => {
    console.warn(
      `정적 내보내기(out/)를 내려주는 중: http://localhost:${PORT}/`,
    );
    console.warn(`발표: http://localhost:${PORT}/presentation/v3.html`);
  });
