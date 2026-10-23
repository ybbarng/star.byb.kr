import type { TonightReport } from "@/game/tonight/report";
import { drawAllSky } from "@/game/tonight/drawAllSky";
import { baseDayOf, directionName } from "@/game/tonight/report";
import { dateLabel, nightTime } from "@/game/tonight/time";

// 오늘 밤 내 하늘을 그림 한 장으로 (의존성 없이 캔버스에 직접 그린다): 제목, 한 줄 요약, 둥근 하늘 그림, 핵심 몇 줄

const W = 1080;
const H = 1620;
const FONT = '"Pretendard Variable", Pretendard, system-ui, sans-serif';

export const drawShareImage = (report: TonightReport, chartTime: number) => {
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;
  const { tz } = report.place;
  const base = baseDayOf(report);

  // 바탕: 밤하늘 그라디언트 + 흩뿌린 별
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, "#151a3f");
  bg.addColorStop(0.6, "#0d1029");
  bg.addColorStop(1, "#1d1238");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  let seed = report.year * 400 + report.month * 31 + report.day;

  const rnd = () => {
    seed = (seed * 16807) % 2147483647;

    return seed / 2147483647;
  };

  for (let i = 0; i < 160; i++) {
    ctx.fillStyle = `rgba(255,255,255,${0.15 + rnd() * 0.5})`;
    ctx.beginPath();
    ctx.arc(rnd() * W, rnd() * H, rnd() * 1.6 + 0.3, 0, Math.PI * 2);
    ctx.fill();
  }

  // 제목 (기울인 손글씨 느낌)
  ctx.save();
  ctx.translate(80, 150);
  ctx.rotate((-3 * Math.PI) / 180);
  ctx.font = `italic 900 92px ${FONT}`;
  ctx.fillStyle = "#ffe08a";
  ctx.fillText("오늘 밤 내 하늘", 0, 0);
  ctx.strokeStyle = "#ffe08a";
  ctx.lineWidth = 5;
  ctx.lineCap = "round";
  ctx.beginPath();

  for (let x = 0; x <= 640; x += 10) {
    const y = 26 + Math.sin(x / 16) * 5;

    if (x === 0) {
      ctx.moveTo(x, y);
    } else {
      ctx.lineTo(x, y);
    }
  }

  ctx.stroke();
  ctx.restore();

  ctx.font = `700 38px ${FONT}`;
  ctx.fillStyle = "rgba(255,255,255,0.85)";
  ctx.fillText(
    `${report.place.name} · ${dateLabel(report.start, tz)} 밤`,
    84,
    250,
  );

  // 한 줄 요약 + 별점
  ctx.font = `800 42px ${FONT}`;
  ctx.fillStyle = "#ffffff";
  wrap(ctx, report.headline, 84, 330, W - 168, 56);
  ctx.font = `900 46px ${FONT}`;
  ctx.fillStyle = "#ffe08a";
  ctx.fillText(
    "★".repeat(report.score) + "☆".repeat(5 - report.score),
    84,
    470,
  );

  // 하늘 그림
  drawAllSky(ctx, {
    size: 820,
    cx: W / 2,
    cy: 520 + 410,
    t: chartTime,
    observer: { latDeg: report.place.latDeg, lonDeg: report.place.lonDeg },
    highlights: report.constellations.map((c) => c.label),
    flip: report.place.latDeg < 0,
  });
  ctx.font = `600 26px ${FONT}`;
  ctx.fillStyle = "rgba(255,255,255,0.6)";
  ctx.textAlign = "center";
  ctx.fillText(
    `${nightTime(chartTime, tz, base)}의 하늘 · ${report.place.latDeg < 0 ? "북쪽" : "남쪽"}을 보고 머리 위로 들어 보세요`,
    W / 2,
    1370,
  );
  ctx.textAlign = "start";

  // 핵심 몇 줄
  const lines: string[] = [];

  if (report.sun.set) {
    lines.push(`해 짐 ${nightTime(report.sun.set, tz, base)}`);
  }

  if (report.goodWindow) {
    lines.push(
      `별 보기 좋은 때 ${nightTime(report.goodWindow.from, tz, base)} ~ ${nightTime(report.goodWindow.to, tz, base)}`,
    );
  }

  lines.push(
    `달: ${report.moon.name} (${Math.round(report.moon.lit * 100)}% 빛나요)`,
  );
  const planets = report.planets.filter((p) => p.visible && p.best);

  if (planets.length) {
    lines.push(
      `행성: ${planets.map((p) => `${p.name}(${directionName(p.best!.azDeg)})`).join(" · ")}`,
    );
  }

  ctx.font = `700 32px ${FONT}`;
  ctx.fillStyle = "rgba(255,255,255,0.9)";
  lines.slice(0, 4).forEach((l, i) => ctx.fillText(l, 84, 1430 + i * 44));

  ctx.font = `600 24px ${FONT}`;
  ctx.fillStyle = "rgba(255,255,255,0.45)";
  ctx.textAlign = "right";
  ctx.fillText("star.byb.kr/games/tonight", W - 60, H - 30);
  ctx.textAlign = "start";

  return canvas;
};

// 너비에 맞춰 줄을 나눠 쓴다 (한국어는 띄어쓰기 단위로)
const wrap = (
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
) => {
  let line = "";
  let row = 0;

  for (const word of text.split(" ")) {
    const next = line ? `${line} ${word}` : word;

    if (ctx.measureText(next).width > maxWidth && line) {
      ctx.fillText(line, x, y + row * lineHeight);
      row++;
      line = word;
    } else {
      line = next;
    }
  }

  ctx.fillText(line, x, y + row * lineHeight);
};

export const downloadShareImage = async (
  report: TonightReport,
  chartTime: number,
) => {
  try {
    await document.fonts?.ready;
  } catch {
    // 글꼴을 못 기다려도 그린다
  }

  const canvas = drawShareImage(report, chartTime);
  const blob = await new Promise<Blob | null>((ok) =>
    canvas.toBlob(ok, "image/png"),
  );

  if (!blob) {
    return;
  }

  const name = `tonight-${report.year}-${String(report.month).padStart(2, "0")}-${String(report.day).padStart(2, "0")}.png`;
  const file = new File([blob], name, { type: "image/png" });

  // 휴대폰이면 공유 시트로, 아니면 내려받기
  if (
    navigator.canShare?.({ files: [file] }) &&
    /Mobi/i.test(navigator.userAgent)
  ) {
    try {
      await navigator.share({ files: [file], title: "오늘 밤 내 하늘" });

      return;
    } catch {
      // 취소하면 내려받기로
    }
  }

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
};
