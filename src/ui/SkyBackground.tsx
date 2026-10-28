"use client";

import type { Point3D } from "@/scripts/hash/types";
import { useEffect, useRef } from "react";
import {
  horizontalFrameJ2000,
  julianDay,
  moonVectorFrom,
  ofDateToJ2000,
  sunVector,
} from "@/search/utils/ephemeris";
import { type EffectStar, startSkyEffects } from "@/ui/skyEffects";
import sky from "@build/database/background-sky.json";

// 사이트 배경: 지금 실제 서울 하늘을 올려다본 모습 (천정이 화면 가운데, 북쪽이 위, 동쪽이 왼쪽).
// 1분마다 그 시각의 하늘로 다시 그린다. 낮이어도 하늘을 밝히지 않고 밤하늘처럼 별을 그리며,
// 지평선 위에 있는 해는 자리만 작은 표식으로, 달은 실제 모양(빛나는 비율·해 쪽 방향)으로 그린다.
// 별은 밝을수록 크게, 표면 온도에 따라 색을 달리하고, 별자리선은 흐리게만 그린다.
// 별의 반짝임과 유성은 위층 캔버스에 따로 그린다 (ui/skyEffects).

export const SEOUL = { latDeg: 37.57, lonDeg: 126.98 };

// 색 번호(0 붉은 별 ~ 4 푸른 별) → RGB (game/sky/drawSky.ts의 starColor와 같은 색)
const COLORS = [
  "255,180,130",
  "255,215,170",
  "255,244,228",
  "225,233,255",
  "190,208,255",
];

// 등급 → 반지름(CSS px). 등급이 1 작으면 약 2.5배 밝으니, 반지름은 밝기의 제곱근 비율로 키운다.
const radiusOf = (mag: number) =>
  Math.min(3.2, 0.55 * Math.pow(10, (-0.4 * (mag - 4.5)) / 2.6));

interface Projected {
  x: number;
  y: number;
}

const dot = (a: Point3D, v: Point3D) => a[0] * v[0] + a[1] * v[1] + a[2] * v[2];

// 천정 중심 평사 투영. 지평선이 화면 모서리에 닿게 크기를 맞춘다. 지평선 아래면 null
const makeProjector = (width: number, height: number, jd: number) => {
  const frame = horizontalFrameJ2000(jd, SEOUL);
  const scale = Math.hypot(width, height) / 2 / 2;

  return (v: Point3D): Projected | null => {
    const up = dot(frame.zenith, v);

    if (up <= 0) {
      return null;
    }

    // 평사 투영: 천정에서 θ 떨어진 별은 반지름 2·tan(θ/2) = 2·sinθ/(1+cosθ)
    const k = (2 * scale) / (1 + up);

    return {
      x: width / 2 - k * dot(frame.east, v),
      y: height / 2 - k * dot(frame.north, v),
    };
  };
};

// 해: 자리만 알려 주는 작은 표식 (테두리 원 + 가운데 점 + 짧은 빛살 여덟 개). 하늘은 밝히지 않는다
const drawSun = (context: CanvasRenderingContext2D, p: Projected) => {
  context.strokeStyle = "rgba(255,200,110,0.85)";
  context.fillStyle = "rgba(255,200,110,0.9)";
  context.lineWidth = 1.2;
  context.beginPath();
  context.arc(p.x, p.y, 5, 0, 2 * Math.PI);
  context.stroke();
  context.beginPath();
  context.arc(p.x, p.y, 1.6, 0, 2 * Math.PI);
  context.fill();
  context.lineWidth = 1;
  context.beginPath();

  for (let i = 0; i < 8; i++) {
    const a = (i * Math.PI) / 4;
    context.moveTo(p.x + 7.5 * Math.cos(a), p.y + 7.5 * Math.sin(a));
    context.lineTo(p.x + 10 * Math.cos(a), p.y + 10 * Math.sin(a));
  }

  context.stroke();
};

// 달: 어두운 원판 위에 빛나는 부분만 밝게. 해 쪽 반원에서 경계 타원을 빼면 빛나는 부분이다
// (learn/MoonDateDemo와 같은 방법, 그믐달은 경계가 해 쪽으로 휜다)
const drawMoon = (
  context: CanvasRenderingContext2D,
  p: Projected,
  lit: number,
  angle: number,
) => {
  const r = 7;
  context.fillStyle = "rgba(40,50,75,0.9)";
  context.strokeStyle = "rgba(253,230,138,0.3)";
  context.lineWidth = 0.8;
  context.beginPath();
  context.arc(p.x, p.y, r, 0, 2 * Math.PI);
  context.fill();
  context.stroke();

  context.save();
  context.translate(p.x, p.y);
  context.rotate(angle);
  context.fillStyle = "rgba(253,236,170,0.95)";
  context.beginPath();
  context.arc(0, 0, r, -Math.PI / 2, Math.PI / 2);
  context.ellipse(
    0,
    0,
    r * Math.abs(1 - 2 * lit),
    r,
    0,
    Math.PI / 2,
    -Math.PI / 2,
    lit < 0.5,
  );
  context.fill();
  context.restore();
};

// 해·달을 그린다. 지평선 아래면 그리지 않는다
const drawSunAndMoon = (
  context: CanvasRenderingContext2D,
  project: (v: Point3D) => Projected | null,
  jd: number,
) => {
  const sun = ofDateToJ2000(sunVector(jd), jd);
  const moon = ofDateToJ2000(moonVectorFrom(jd, SEOUL), jd);
  const sunPoint = project(sun);
  const moonPoint = project(moon);

  if (sunPoint) {
    drawSun(context, sunPoint);
  }

  if (!moonPoint) {
    return;
  }

  // 빛나는 비율: 해와 달이 벌어진 각 E에 대해 (1 - cos E) / 2
  const cosE = dot(sun, moon);
  const lit = (1 - cosE) / 2;
  // 화면에서 해 쪽 방향: 달에서 해 쪽으로 조금 옮긴 점을 투영해 잰다 (평사 투영은 각을 보존한다)
  const toward = sun.map((c, i) => c - cosE * moon[i]);
  const length = Math.hypot(toward[0], toward[1], toward[2]) || 1;

  const step = (sign: number) => {
    const v = moon.map((c, i) => c + (sign * 0.01 * toward[i]) / length);
    const n = Math.hypot(v[0], v[1], v[2]);

    return project([v[0] / n, v[1] / n, v[2] / n]);
  };

  const ahead = step(1);
  const behind = step(-1);
  const angle = ahead
    ? Math.atan2(ahead.y - moonPoint.y, ahead.x - moonPoint.x)
    : behind
      ? Math.atan2(moonPoint.y - behind.y, moonPoint.x - behind.x)
      : 0;

  drawMoon(context, moonPoint, lit, angle);
};

const sizeCanvas = (
  canvas: HTMLCanvasElement,
  width: number,
  height: number,
  dpr: number,
) => {
  canvas.width = Math.round(width * dpr);
  canvas.height = Math.round(height * dpr);
  const context = canvas.getContext("2d")!;
  context.setTransform(dpr, 0, 0, dpr, 0, 0);
  context.clearRect(0, 0, width, height);

  return context;
};

// 지금 하늘을 그리고, 반짝일 수 있는 (화면에 보이는) 별 목록을 돌려준다
// 배경 상자(.fx-sky, 높이 100lvh)의 크기. 주소창이 숨어도 변하지 않는다
const boxSize = (box: HTMLElement) => ({
  width: box.clientWidth || window.innerWidth,
  height: box.clientHeight || window.innerHeight,
});

const draw = (
  skyCanvas: HTMLCanvasElement,
  effectCanvas: HTMLCanvasElement,
): EffectStar[] => {
  const { width, height } = boxSize(skyCanvas.parentElement!);
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const jd = julianDay(new Date());
  const project = makeProjector(width, height, jd);
  const context = sizeCanvas(skyCanvas, width, height, dpr);

  // 효과 캔버스는 크기가 바뀔 때만 다시 잡는다 (크기를 다시 잡으면 그리던 효과가 지워진다)
  if (
    effectCanvas.width !== Math.round(width * dpr) ||
    effectCanvas.height !== Math.round(height * dpr)
  ) {
    sizeCanvas(effectCanvas, width, height, dpr);
  }

  // 별자리선은 흐리게
  context.strokeStyle = "rgba(150,170,255,0.14)";
  context.lineWidth = 1;

  for (const line of sky.lines) {
    let previous: Projected | null = null;
    context.beginPath();

    for (let i = 0; i < line.length; i += 3) {
      const p = project([line[i], line[i + 1], line[i + 2]]);

      if (p && previous) {
        context.moveTo(previous.x, previous.y);
        context.lineTo(p.x, p.y);
      }

      previous = p;
    }

    context.stroke();
  }

  const { stars } = sky;
  const visible: EffectStar[] = [];

  for (let i = 0; i < stars.length; i += 5) {
    const p = project([stars[i], stars[i + 1], stars[i + 2]]);

    if (!p || p.x < 0 || p.y < 0 || p.x > width || p.y > height) {
      continue;
    }

    const mag = stars[i + 3];
    const color = COLORS[stars[i + 4]];
    const r = radiusOf(mag);

    // 밝은 별은 빛무리를 두른다
    if (mag < 2) {
      const glow = context.createRadialGradient(p.x, p.y, 0, p.x, p.y, r * 4);
      glow.addColorStop(0, `rgba(${color},0.35)`);
      glow.addColorStop(1, `rgba(${color},0)`);
      context.fillStyle = glow;
      context.beginPath();
      context.arc(p.x, p.y, r * 4, 0, 2 * Math.PI);
      context.fill();
    }

    context.fillStyle = `rgba(${color},${Math.min(1, 0.45 + r / 3)})`;
    context.beginPath();
    context.arc(p.x, p.y, r, 0, 2 * Math.PI);
    context.fill();
    visible.push({ x: p.x, y: p.y, r, mag, color });
  }

  drawSunAndMoon(context, project, jd);

  return visible;
};

export default function SkyBackground() {
  const skyRef = useRef<HTMLCanvasElement>(null);
  const effectRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const skyCanvas = skyRef.current;
    const effectCanvas = effectRef.current;

    if (!skyCanvas || !effectCanvas) {
      return;
    }

    // 안드로이드(Chrome은 주소창이 위)는 배경을 화면 아래에 붙인다 (fx.css의 .fx-sky 설명)
    if (/Android/i.test(navigator.userAgent)) {
      skyCanvas.parentElement!.dataset.anchor = "bottom";
    }

    let stars = draw(skyCanvas, effectCanvas);
    let resizeTimer = 0;
    let drawn = boxSize(skyCanvas.parentElement!);

    const redraw = () => {
      stars = draw(skyCanvas, effectCanvas);
      drawn = boxSize(skyCanvas.parentElement!);
    };

    // 배경 상자 크기가 실제로 바뀔 때만(창 크기·화면 돌리기) 다시 그린다.
    // 휴대폰에서 스크롤로 주소창이 숨을 때도 resize가 오지만, 상자(100lvh)는 그대로라 건너뛴다
    const onResize = () => {
      window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(() => {
        const now = boxSize(skyCanvas.parentElement!);

        if (now.width !== drawn.width || now.height !== drawn.height) {
          redraw();
        }
      }, 150);
    };

    // 하늘(별·해·달)은 1분마다 지금 시각으로. 탭이 안 보이면 건너뛰고, 다시 보이면 바로 맞춘다
    const minute = window.setInterval(() => {
      if (!document.hidden) {
        redraw();
      }
    }, 60_000);

    const onVisibility = () => {
      if (!document.hidden) {
        redraw();
      }
    };

    window.addEventListener("resize", onResize);
    document.addEventListener("visibilitychange", onVisibility);

    // 움직임을 줄이도록 설정했으면 반짝임·유성은 끈다
    const effects = window.matchMedia("(prefers-reduced-motion: reduce)")
      .matches
      ? null
      : startSkyEffects(effectCanvas, () => stars);

    return () => {
      effects?.stop();
      window.clearTimeout(resizeTimer);
      window.clearInterval(minute);
      window.removeEventListener("resize", onResize);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  return (
    <div className="fx-sky" aria-hidden>
      <canvas ref={skyRef} className="fx-sky-layer" />
      <canvas ref={effectRef} className="fx-sky-layer" />
    </div>
  );
}
