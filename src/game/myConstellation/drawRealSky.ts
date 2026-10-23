import type { SkyDarkness, SkyPose } from "@/game/myConstellation/visibility";
import type { HorizonView } from "@/search/horizonSolve";
import type { Observer } from "@/search/utils/ephemeris";
import { STAR_BY_HR } from "@/game/myConstellation/shape";
import {
  altitudeContour,
  bottomAltitude,
  CONTOUR_ALTS,
  contourLabel,
  DIRECTIONS_8,
  domePoint,
  edgeDirections,
  horizonMarks,
  projectAltAz,
  viewFor,
} from "@/game/myConstellation/skyGuide";
import { STARS } from "@/game/sky/catalog";
import { drawSky } from "@/game/sky/drawSky";
import { directionName } from "@/game/tonight/report";
import { horizonCameraTP } from "@/search/horizonSolve";
import { projectVecToPhoto } from "@/search/utils/wcs";

// 나만의 별자리가 그 시각·장소의 하늘에 실제로 뜬 모습: 별자리 쪽을 바라보고 선 풍경(땅·광해·달·행성까지,
// 게임 공용 drawSky)에 내 별자리 선과 이름표를 겹친다. 같은 그림을 내려받는 카드에도 쓴다.
// 별자리가 작아도 "실제 하늘에서 어디쯤인지" 알 수 있게 지평선·방위 눈금·고도 등고선(주먹 몇 개)과
// 하늘 전체 둥근 지도를 같이 그린다.

export const SKY_W = 1200;
export const SKY_H = 900;

const FONT = '"Pretendard Variable", Pretendard, system-ui, sans-serif';

export interface RealSkyInput {
  hrs: string[];
  edges: [string, string][];
  name: string;
  t: number;
  observer: Observer;
  darkness: SkyDarkness;
  pose: SkyPose;
  radiusDeg: number;
  seed: number; // 땅 능선 모양
}

export const drawRealSky = (
  ctx: CanvasRenderingContext2D,
  input: RealSkyInput,
  W = SKY_W,
  H = SKY_H,
) => {
  const { pose } = input;
  const view = viewFor(pose, input.radiusDeg, W, H);
  const TP = horizonCameraTP(new Date(input.t), input.observer, view, W, H);

  drawSky(ctx, {
    width: W,
    height: H,
    TP,
    date: new Date(input.t),
    observer: input.observer,
    azimuthDeg: pose.centerAz,
    magLimit: input.darkness.limit,
    lightPollution: input.darkness.lightPollution,
    groundSeed: input.seed,
    stars: STARS,
  });

  drawGuides(ctx, view, W, H);

  const byHr = new Map(pose.stars.map((s) => [s.hr, s]));

  const at = (hr: string) => {
    const s = STAR_BY_HR.get(hr);

    return s ? projectVecToPhoto(TP, s.vector) : null;
  };

  // 선: 두 별이 다 떠 있으면 금색, 하나라도 지평선 아래면 흐린 점선
  ctx.lineCap = "round";

  for (const [a, b] of input.edges) {
    const pa = at(a);
    const pb = at(b);

    if (!pa || !pb || Math.hypot(pa[0] - pb[0], pa[1] - pb[1]) > W * 1.5) {
      continue;
    }

    const up =
      (byHr.get(a)?.altDeg ?? -1) > 0 && (byHr.get(b)?.altDeg ?? -1) > 0;
    ctx.strokeStyle = up ? "rgba(255,214,120,0.9)" : "rgba(255,214,120,0.35)";
    ctx.lineWidth = up ? 3 : 2;
    ctx.setLineDash(up ? [] : [8, 8]);
    ctx.shadowColor = "rgba(255,200,90,0.7)";
    ctx.shadowBlur = up ? 10 : 0;
    ctx.beginPath();
    ctx.moveTo(pa[0], pa[1]);
    ctx.lineTo(pb[0], pb[1]);
    ctx.stroke();
  }

  ctx.shadowBlur = 0;

  // 별: 보일 만하면 금색 고리, 떠 있지만 너무 어두우면 점선 고리
  const points: [number, number][] = [];

  for (const hr of input.hrs) {
    const p = at(hr);
    const s = byHr.get(hr);

    if (!p || !s) {
      continue;
    }

    points.push(p);

    if (s.altDeg <= 0) {
      continue;
    }

    ctx.setLineDash(s.visible ? [] : [4, 4]);
    ctx.strokeStyle = s.visible
      ? "rgba(255,224,150,0.95)"
      : "rgba(200,210,255,0.75)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(p[0], p[1], s.visible ? 8 : 10, 0, Math.PI * 2);
    ctx.stroke();
  }

  ctx.setLineDash([]);

  // 이름표: 별자리 맨 위 별 위에 (화면 밖이면 화면 안으로 끌어온다)
  const onScreen = points.filter(([x, y]) => x > 0 && x < W && y > 0 && y < H);
  const below = pose.centerAlt <= 0;
  const label = below ? `${input.name} · 지평선 아래` : input.name;
  ctx.font = `800 34px ${FONT}`;
  const tw = ctx.measureText(label).width;
  let lx = W / 2;
  let ly = H - 70;

  if (onScreen.length) {
    const top = onScreen.reduce((a, b) => (b[1] < a[1] ? b : a));
    lx = onScreen.reduce((s, p) => s + p[0], 0) / onScreen.length;
    ly = top[1] - 38;
  }

  lx = Math.max(tw / 2 + 24, Math.min(W - tw / 2 - 24, lx));
  ly = Math.max(56, Math.min(H - 40, ly));

  ctx.fillStyle = "rgba(10,12,32,0.72)";
  ctx.strokeStyle = "rgba(255,214,120,0.8)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(lx - tw / 2 - 18, ly - 32, tw + 36, 48, 24);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = "#ffe08a";
  ctx.textAlign = "center";
  ctx.fillText(label, lx, ly + 4);
  ctx.textAlign = "start";

  // 하늘 전체 둥근 지도: 별자리·이름표를 가리지 않는 위쪽 모서리에
  const R = Math.round(H * 0.12);
  const box = R + 46;
  const labelBox = { x0: lx - tw / 2 - 18, x1: lx + tw / 2 + 18, y0: ly - 32 };
  const right = W - box - 8;
  const left = box + 8;
  const top = box + 4;
  const covers = (cx: number) =>
    onScreen.some(
      ([x, y]) => Math.abs(x - cx) < box && Math.abs(y - top) < box,
    ) ||
    (labelBox.x1 > cx - box &&
      labelBox.x0 < cx + box &&
      labelBox.y0 < top + box);
  const cx = !covers(right) ? right : !covers(left) ? left : right;
  drawDome(ctx, input, view.azimuthDeg, cx, top, R);
};

// 지평선(방위 눈금·8방위)과 고도 등고선(10°·30°·60°, 주먹 몇 개)
const drawGuides = (
  ctx: CanvasRenderingContext2D,
  view: HorizonView,
  W: number,
  H: number,
) => {
  ctx.save();

  // 고도 등고선: 흐린 점선, 왼쪽 끝에 이름표
  ctx.font = `700 22px ${FONT}`;

  for (const alt of CONTOUR_ALTS) {
    const parts = altitudeContour(view, alt, W, H);

    if (!parts.length) {
      continue;
    }

    ctx.strokeStyle = "rgba(143,211,255,0.32)";
    ctx.lineWidth = 1.5;
    ctx.setLineDash([6, 8]);

    for (const line of parts) {
      ctx.beginPath();
      line.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
      ctx.stroke();
    }

    ctx.setLineDash([]);
    // 이름표는 화면 왼쪽(가장자리에서 조금 안)에서 등고선이 지나는 높이에
    const onScreen = parts
      .flat()
      .filter(([x, y]) => x > 16 && x < W * 0.5 && y > 30 && y < H - 30);

    if (onScreen.length) {
      const [x, y] = onScreen.reduce((a, b) => (b[0] < a[0] ? b : a));
      const text = contourLabel(alt);
      const tw = ctx.measureText(text).width;
      const bx = Math.max(10, x);
      ctx.fillStyle = "rgba(10,14,36,0.6)";
      ctx.beginPath();
      ctx.roundRect(bx - 6, y - 24, tw + 12, 30, 8);
      ctx.fill();
      ctx.fillStyle = "rgba(170,222,255,0.9)";
      ctx.fillText(text, bx, y - 2);
    }
  }

  // 지평선: 10°마다 작은 눈금, 45°마다 방위 이름
  const marks = horizonMarks(view, W, H);

  for (const m of marks) {
    ctx.strokeStyle = m.label
      ? "rgba(255,255,255,0.85)"
      : "rgba(255,255,255,0.4)";
    ctx.lineWidth = m.label ? 3 : 2;
    ctx.beginPath();
    ctx.moveTo(m.x, m.y);
    ctx.lineTo(m.x, m.y + (m.label ? 18 : 10));
    ctx.stroke();

    if (m.label) {
      const main = m.label.length === 1;
      ctx.font = `${main ? 900 : 700} ${main ? 34 : 26}px ${FONT}`;
      ctx.textAlign = "center";
      ctx.fillStyle = main ? "#ffffff" : "rgba(255,255,255,0.75)";
      ctx.fillText(m.label, m.x, Math.min(H - 12, m.y + (main ? 54 : 48)));
    }
  }

  // 화면 양 끝 너머의 방위: "← 남동", "남서 →"
  const below = bottomAltitude(view);
  const horizon = projectAltAz(view, 0, view.azimuthDeg, W, H);

  if (below <= 1 && horizon && horizon[1] < H) {
    const { left, right } = edgeDirections(view, W, H);
    const y = Math.min(H - 14, horizon[1] + 92);
    ctx.font = `800 26px ${FONT}`;
    ctx.fillStyle = "rgba(255,255,255,0.7)";
    ctx.textAlign = "left";
    ctx.fillText(`← ${left}`, 16, y);
    ctx.textAlign = "right";
    ctx.fillText(`${right} →`, W - 16, y);
  }

  // 지평선이 화면 아래로 빠졌으면(별자리가 머리 위 가까이) 아래 가운데에 알려 준다
  if (below > 1) {
    const text = `↓ ${directionName(view.azimuthDeg)} 지평선은 여기서 주먹 ${Math.max(1, Math.round(below / 10))}개(${Math.round(below)}°) 더 아래`;
    ctx.font = `700 26px ${FONT}`;
    ctx.textAlign = "center";
    const tw = ctx.measureText(text).width;
    ctx.fillStyle = "rgba(10,14,36,0.7)";
    ctx.beginPath();
    ctx.roundRect(W / 2 - tw / 2 - 14, H - 54, tw + 28, 40, 12);
    ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.9)";
    ctx.fillText(text, W / 2, H - 25);
  }

  ctx.restore();
};

// 하늘 전체를 위에서 올려다본 둥근 지도: 가운데가 머리 위, 테두리가 지평선. 큰 그림이 보는 쪽이 아래.
// 내 별자리가 하늘 어디쯤인지(방위·높이) 한눈에 보인다.
const drawDome = (
  ctx: CanvasRenderingContext2D,
  input: RealSkyInput,
  facing: number,
  cx: number,
  cy: number,
  R: number,
) => {
  const at = (alt: number, az: number) => domePoint(alt, az, facing, cx, cy, R);

  ctx.save();
  ctx.fillStyle = "rgba(8,12,34,0.82)";
  ctx.strokeStyle = "rgba(255,255,255,0.55)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(cx, cy, R + 40, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(cx, cy, R, 0, Math.PI * 2);
  ctx.stroke();

  // 고도 30°·60° 고리와 동서남북 십자
  ctx.strokeStyle = "rgba(143,211,255,0.35)";
  ctx.lineWidth = 1.5;
  ctx.setLineDash([4, 6]);

  for (const alt of [30, 60]) {
    ctx.beginPath();
    ctx.arc(cx, cy, (R * (90 - alt)) / 90, 0, Math.PI * 2);
    ctx.stroke();
  }

  ctx.setLineDash([]);

  for (const az of [0, 90]) {
    const a = at(0, az);
    const b = at(0, az + 180);
    ctx.beginPath();
    ctx.moveTo(a[0], a[1]);
    ctx.lineTo(b[0], b[1]);
    ctx.stroke();
  }

  // 큰 그림이 보는 쪽 (아래쪽 부채꼴)
  ctx.fillStyle = "rgba(255,255,255,0.08)";
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.arc(cx, cy, R, Math.PI / 2 - 0.6, Math.PI / 2 + 0.6);
  ctx.closePath();
  ctx.fill();

  // 8방위 (테두리 바깥)
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  DIRECTIONS_8.forEach((label, i) => {
    const [x, y] = domePoint(0, i * 45, facing, cx, cy, R + 22);
    const main = label.length === 1;
    ctx.font = `${main ? 900 : 600} ${main ? 26 : 17}px ${FONT}`;
    ctx.fillStyle = main ? "#ffffff" : "rgba(255,255,255,0.6)";
    ctx.fillText(label, x, y);
  });

  // 내 별자리: 떠 있는 별끼리 금색 선, 별은 점
  const byHr = new Map(input.pose.stars.map((s) => [s.hr, s]));
  ctx.strokeStyle = "rgba(255,214,120,0.95)";
  ctx.lineWidth = 2.5;

  for (const [a, b] of input.edges) {
    const sa = byHr.get(a);
    const sb = byHr.get(b);

    if (!sa || !sb || sa.altDeg <= 0 || sb.altDeg <= 0) {
      continue;
    }

    const pa = at(sa.altDeg, sa.azDeg);
    const pb = at(sb.altDeg, sb.azDeg);
    ctx.beginPath();
    ctx.moveTo(pa[0], pa[1]);
    ctx.lineTo(pb[0], pb[1]);
    ctx.stroke();
  }

  ctx.fillStyle = "#ffe08a";

  for (const s of input.pose.stars) {
    if (s.altDeg > 0) {
      const [x, y] = at(s.altDeg, s.azDeg);
      ctx.beginPath();
      ctx.arc(x, y, 3.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // 별자리 가운데에 고리 (작아도 눈에 띄게). 지평선 아래면 그 방위 테두리에 흐린 고리
  const c = at(input.pose.centerAlt, input.pose.centerAz);
  ctx.strokeStyle =
    input.pose.centerAlt > 0
      ? "rgba(255,214,120,0.9)"
      : "rgba(255,214,120,0.4)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(c[0], c[1], 14, 0, Math.PI * 2);
  ctx.stroke();

  ctx.font = `700 16px ${FONT}`;
  ctx.fillStyle = "rgba(255,255,255,0.7)";
  ctx.fillText("머리 위", cx, cy - 12);
  ctx.textBaseline = "alphabetic";
  ctx.restore();
};

// ── 내려받는 카드 ───────────────────────────────────────────────────

const CARD_W = 1080;
const CARD_H = 1350;

export interface CardText {
  place: string;
  when: string; // "10월 23일 (금) 밤 9시"
  where: string; // "남동쪽 하늘, 지평선에서 주먹 3개 높이"
  best: string | null; // "가장 잘 보이는 때: 2월 저녁 9시 무렵"
  starCount: number;
}

const fitFont = (
  ctx: CanvasRenderingContext2D,
  text: string,
  weight: number,
  max: number,
  width: number,
) => {
  let size = max;
  ctx.font = `${weight} ${size}px ${FONT}`;

  while (size > 28 && ctx.measureText(text).width > width) {
    size -= 4;
    ctx.font = `${weight} ${size}px ${FONT}`;
  }
};

export const drawCard = (input: RealSkyInput, text: CardText) => {
  const canvas = document.createElement("canvas");
  canvas.width = CARD_W;
  canvas.height = CARD_H;
  const ctx = canvas.getContext("2d")!;

  const bg = ctx.createLinearGradient(0, 0, 0, CARD_H);
  bg.addColorStop(0, "#161b44");
  bg.addColorStop(0.55, "#0c0f28");
  bg.addColorStop(1, "#1d1238");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, CARD_W, CARD_H);

  ctx.textAlign = "center";
  ctx.font = `700 28px ${FONT}`;
  ctx.fillStyle = "rgba(255,224,138,0.8)";
  ctx.fillText("✦ 나만의 별자리 ✦", CARD_W / 2, 72);
  fitFont(ctx, input.name, 900, 84, CARD_W - 120);
  ctx.fillStyle = "#ffe08a";
  ctx.fillText(input.name, CARD_W / 2, 168);
  ctx.font = `600 28px ${FONT}`;
  ctx.fillStyle = "rgba(255,255,255,0.7)";
  ctx.fillText(
    `진짜 별 ${text.starCount}개를 이어 만든, 진짜 하늘에서 찾을 수 있는 별자리`,
    CARD_W / 2,
    218,
  );

  // 하늘 그림 (둥근 모서리 액자)
  const sky = document.createElement("canvas");
  sky.width = SKY_W;
  sky.height = SKY_H;
  drawRealSky(sky.getContext("2d")!, input);
  const x = 40;
  const y = 252;
  const w = CARD_W - 80;
  const h = (w * SKY_H) / SKY_W;
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 28);
  ctx.clip();
  ctx.drawImage(sky, x, y, w, h);
  ctx.restore();
  ctx.strokeStyle = "rgba(255,224,138,0.35)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 28);
  ctx.stroke();

  let ty = y + h + 62;
  ctx.font = `800 36px ${FONT}`;
  ctx.fillStyle = "#ffffff";
  ctx.fillText(`${text.place} · ${text.when}`, CARD_W / 2, ty);
  ty += 52;
  ctx.font = `700 30px ${FONT}`;
  ctx.fillStyle = "rgba(255,255,255,0.85)";
  ctx.fillText(text.where, CARD_W / 2, ty);

  if (text.best) {
    ty += 46;
    ctx.fillStyle = "rgba(143,211,255,0.9)";
    ctx.fillText(text.best, CARD_W / 2, ty);
  }

  ctx.font = `600 24px ${FONT}`;
  ctx.fillStyle = "rgba(255,255,255,0.45)";
  ctx.fillText(
    "실제로 찾아보세요! · star.byb.kr/games/my-constellation",
    CARD_W / 2,
    CARD_H - 34,
  );
  ctx.textAlign = "start";

  return canvas;
};

// 휴대폰이면 공유 시트로, 아니면 내려받기 (오늘 밤 내 하늘과 같은 방식)
export const saveCard = async (
  input: RealSkyInput,
  text: CardText,
  fileName: string,
) => {
  try {
    await document.fonts?.ready;
  } catch {
    // 글꼴을 못 기다려도 그린다
  }

  const canvas = drawCard(input, text);
  const blob = await new Promise<Blob | null>((ok) =>
    canvas.toBlob(ok, "image/png"),
  );

  if (!blob) {
    return false;
  }

  const file = new File([blob], fileName, { type: "image/png" });

  if (
    navigator.canShare?.({ files: [file] }) &&
    /Mobi/i.test(navigator.userAgent)
  ) {
    try {
      await navigator.share({ files: [file], title: input.name });

      return true;
    } catch {
      // 취소하면 내려받기로
    }
  }

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);

  return true;
};
