import type { SkyDarkness, SkyPose } from "@/game/myConstellation/visibility";
import type { HorizonView } from "@/search/horizonSolve";
import type { Observer } from "@/search/utils/ephemeris";
import { STAR_BY_HR } from "@/game/myConstellation/shape";
import { STARS } from "@/game/sky/catalog";
import { drawSky } from "@/game/sky/drawSky";
import { horizonCameraTP } from "@/search/horizonSolve";
import { projectVecToPhoto } from "@/search/utils/wcs";

// 나만의 별자리가 그 시각·장소의 하늘에 실제로 뜬 모습: 별자리 쪽을 바라보고 선 풍경(땅·광해·달·행성까지,
// 게임 공용 drawSky)에 내 별자리 선과 이름표를 겹친다. 같은 그림을 내려받는 카드에도 쓴다.

export const SKY_W = 1200;
export const SKY_H = 900;

const FONT = '"Pretendard Variable", Pretendard, system-ui, sans-serif';

// 별자리가 화면에 다 들어오게 시야를 잡고, 지평선이 아래쪽에 걸리게 든다. 지평선 아래면 그 방위의 지평선을 본다
export const viewFor = (pose: SkyPose, radiusDeg: number): HorizonView => {
  const fovDeg = Math.max(50, Math.min(100, radiusDeg * 2.6 + 16));
  const low = fovDeg * 0.32;

  return {
    azimuthDeg: pose.centerAz,
    altitudeDeg:
      pose.centerAlt > 0 ? Math.max(low, Math.min(78, pose.centerAlt)) : low,
    rollDeg: 0,
    fovDeg,
  };
};

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
  const TP = horizonCameraTP(
    new Date(input.t),
    input.observer,
    viewFor(pose, input.radiusDeg),
    W,
    H,
  );

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
    compass: true,
  });

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
