import http from "node:http";
import os from "node:os";

// 발표 리모컨: 노트북 화면은 그대로 미러링하고(데모를 직접 만져야 해서), 노트·다음 장은 휴대폰으로 본다.
// 의존성 없는 작은 서버다. 노트북에서 `npx tsx src/scripts/presentation/remote.ts`로 띄우고,
//   - 노트북: 발표 자료를 `…/presentation/v3.html?remote` 로 연다 (지금 장을 이 서버로 보내고, 휴대폰의 넘기기를 받는다)
//   - 휴대폰: 같은 와이파이에서 화면에 찍히는 `http://<노트북 IP>:5026/` 을 연다
// 발표장 와이파이가 기기끼리 접속을 막으면 휴대폰 핫스팟에 노트북을 붙인다.

const PORT = Number(process.env.REMOTE_PORT ?? 5026);

interface SlideState {
  index: number; // 0부터
  total: number;
  title: string;
  notes: string; // HTML (<br> 포함)
  nextTitle: string;
  fragment: number; // 지금 장 안에서 지난 클릭 수 (-1: 아직 없음)
  fragments: number; // 지금 장의 클릭 수
  appendix: boolean;
}

let state: SlideState | null = null;
const phones = new Set<http.ServerResponse>(); // 노트를 받는 휴대폰
const decks = new Set<http.ServerResponse>(); // 넘기기 명령을 받는 발표 화면

const send = (res: http.ServerResponse, event: string, data: unknown) =>
  res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  // https 페이지가 사설 주소(localhost)로 보내는 요청 허용 (Chrome Private Network Access)
  "Access-Control-Allow-Private-Network": "true",
};

const readBody = (req: http.IncomingMessage) =>
  new Promise<string>((resolve) => {
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", () => resolve(body));
  });

const openStream = (res: http.ServerResponse) => {
  res.writeHead(200, {
    ...cors,
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });
  res.write(": ok\n\n");
};

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", "http://localhost");

  if (req.method === "OPTIONS") {
    res.writeHead(204, cors);
    res.end();

    return;
  }

  // 발표 화면 → 지금 장
  if (req.method === "POST" && url.pathname === "/state") {
    state = JSON.parse(await readBody(req)) as SlideState;
    phones.forEach((p) => send(p, "state", state));
    res.writeHead(204, cors);
    res.end();

    return;
  }

  // 휴대폰 → 넘기기
  if (req.method === "POST" && url.pathname === "/command") {
    const { action } = JSON.parse(await readBody(req)) as { action: string };

    if (["next", "prev", "first"].includes(action)) {
      decks.forEach((d) => send(d, "command", { action }));
    }

    res.writeHead(204, cors);
    res.end();

    return;
  }

  // 휴대폰이 노트를 받는 흐름
  if (url.pathname === "/events") {
    openStream(res);
    phones.add(res);
    send(res, "status", { decks: decks.size });

    if (state) send(res, "state", state);

    req.on("close", () => phones.delete(res));

    return;
  }

  // 발표 화면이 넘기기를 받는 흐름
  if (url.pathname === "/deck") {
    openStream(res);
    decks.add(res);
    phones.forEach((p) => send(p, "status", { decks: decks.size }));
    req.on("close", () => {
      decks.delete(res);
      phones.forEach((p) => send(p, "status", { decks: decks.size }));
    });

    return;
  }

  if (url.pathname === "/") {
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(PHONE_PAGE);

    return;
  }

  res.writeHead(404);
  res.end();
});

// 연결이 끊기지 않게 20초마다 빈 줄
setInterval(() => {
  [...phones, ...decks].forEach((r) => r.write(": ping\n\n"));
}, 20000);

server.listen(PORT, "0.0.0.0", () => {
  const ips = Object.values(os.networkInterfaces())
    .flat()
    .filter((n) => n && n.family === "IPv4" && !n.internal)
    .map((n) => n!.address);

  console.warn(`발표 리모컨이 켜졌어요 (포트 ${PORT})`);
  console.warn(`노트북: 발표 자료 주소 끝에 ?remote 를 붙여 여세요`);
  console.warn(`휴대폰 (같은 와이파이):`);
  ips.forEach((ip) => console.warn(`  http://${ip}:${PORT}/`));
});

const PHONE_PAGE = `<!doctype html>
<html lang="ko"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>발표 노트</title>
<style>
  :root { color-scheme: dark; }
  * { box-sizing: border-box; }
  body { margin: 0; background: #0b0f1a; color: #e5e7eb; font: 17px/1.6 -apple-system, "Apple SD Gothic Neo", sans-serif;
         display: flex; flex-direction: column; height: 100dvh; }
  header { display: flex; align-items: center; gap: 10px; padding: 10px 14px; border-bottom: 1px solid #1f2937; font-size: 14px; }
  #num { font-weight: 800; font-size: 18px; color: #fde68a; }
  #timer { margin-left: auto; font-variant-numeric: tabular-nums; opacity: .8; }
  #dot { width: 9px; height: 9px; border-radius: 50%; background: #ef4444; }
  #dot.on { background: #4ade80; }
  #title { padding: 10px 14px 0; font-size: 20px; font-weight: 800; }
  #frag { padding: 0 14px; font-size: 13px; opacity: .65; }
  #notes { flex: 1; overflow-y: auto; padding: 10px 14px 16px; font-size: 19px; }
  #next { padding: 8px 14px; font-size: 13px; opacity: .6; border-top: 1px solid #1f2937; }
  nav { display: grid; grid-template-columns: 1fr 2fr; gap: 8px; padding: 8px 10px calc(10px + env(safe-area-inset-bottom)); }
  button { font: inherit; font-size: 22px; font-weight: 800; padding: 18px 0; border-radius: 14px; border: 0; color: #fff; background: #374151; }
  button.next { background: #4f46e5; }
  button:active { transform: scale(.97); }
  #timer button { font-size: 12px; padding: 2px 8px; border-radius: 8px; margin-left: 6px; }
</style></head>
<body>
<header><span id="dot"></span><span id="num">–</span><span id="conn">발표 화면을 기다리는 중…</span>
  <span id="timer"><span id="t">00:00</span><button id="reset">초기화</button></span></header>
<div id="title"></div>
<div id="frag"></div>
<div id="notes"></div>
<div id="next"></div>
<nav><button id="prev">◀</button><button id="nextBtn" class="next">다음 ▶</button></nav>
<script>
  const $ = (id) => document.getElementById(id);
  const post = (action) => fetch("/command", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action }) });
  $("prev").onclick = () => post("prev");
  $("nextBtn").onclick = () => post("next");
  let start = Date.now();
  $("reset").onclick = () => { start = Date.now(); };
  setInterval(() => {
    const s = Math.floor((Date.now() - start) / 1000);
    $("t").textContent = String(Math.floor(s / 60)).padStart(2, "0") + ":" + String(s % 60).padStart(2, "0");
  }, 1000);
  // 화면이 꺼지지 않게 (지원하는 브라우저만)
  const wake = () => navigator.wakeLock?.request("screen").catch(() => {});
  wake(); document.addEventListener("visibilitychange", () => !document.hidden && wake());
  const es = new EventSource("/events");
  es.addEventListener("status", (e) => {
    const { decks } = JSON.parse(e.data);
    $("dot").classList.toggle("on", decks > 0);
    $("conn").textContent = decks > 0 ? "연결됨" : "발표 화면(?remote)을 기다리는 중…";
  });
  es.addEventListener("state", (e) => {
    const s = JSON.parse(e.data);
    $("num").textContent = s.appendix ? "부록" : (s.index + 1) + " / " + s.total;
    $("title").textContent = s.title || "";
    $("frag").textContent = s.fragments > 0 ? "클릭 " + (s.fragment + 1) + " / " + s.fragments : "";
    $("notes").innerHTML = s.notes || "<span style='opacity:.5'>(노트 없음)</span>";
    $("notes").scrollTop = 0;
    $("next").textContent = s.nextTitle ? "다음 장: " + s.nextTitle : "";
  });
  es.onerror = () => { $("dot").classList.remove("on"); $("conn").textContent = "리모컨 서버와 연결이 끊겼어요"; };
</script>
</body></html>`;
