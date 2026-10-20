"use client";

import type { Point3D } from "@/scripts/hash/types";
import { useEffect, useRef } from "react";
import { horizontalFrameJ2000, julianDay } from "@/search/utils/ephemeris";
import sky from "@build/database/background-sky.json";

// 사이트 배경: 페이지에 들어온 순간의 실제 서울 하늘을 올려다본 모습 (천정이 화면 가운데, 북쪽이 위, 동쪽이 왼쪽).
// 낮이어도 해 없이 밤하늘처럼 별을 그린다. 별은 밝을수록 크게, 표면 온도에 따라 색을 달리하고,
// 별자리선은 흐리게만 그린다. 별을 두 층으로 나눠 CSS로 번갈아 밝기를 바꿔 반짝이게 한다.

const SEOUL = { latDeg: 37.57, lonDeg: 126.98 };

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

// 천정 중심 평사 투영. 지평선이 화면 모서리에 닿게 크기를 맞춘다. 지평선 아래면 null
const makeProjector = (width: number, height: number) => {
  const frame = horizontalFrameJ2000(julianDay(new Date()), SEOUL);
  const scale = Math.hypot(width, height) / 2 / 2;
  const dot = (a: Point3D, v: Point3D) =>
    a[0] * v[0] + a[1] * v[1] + a[2] * v[2];

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

const draw = (layers: HTMLCanvasElement[]) => {
  const width = window.innerWidth;
  const height = window.innerHeight;
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const project = makeProjector(width, height);
  const contexts = layers.map((canvas) => {
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    const context = canvas.getContext("2d")!;
    context.setTransform(dpr, 0, 0, dpr, 0, 0);
    context.clearRect(0, 0, width, height);

    return context;
  });

  // 별자리선은 아래층에 흐리게
  const lineContext = contexts[0];
  lineContext.strokeStyle = "rgba(150,170,255,0.14)";
  lineContext.lineWidth = 1;

  for (const line of sky.lines) {
    let previous: Projected | null = null;
    lineContext.beginPath();

    for (let i = 0; i < line.length; i += 3) {
      const p = project([line[i], line[i + 1], line[i + 2]]);

      if (p && previous) {
        lineContext.moveTo(previous.x, previous.y);
        lineContext.lineTo(p.x, p.y);
      }

      previous = p;
    }

    lineContext.stroke();
  }

  const { stars } = sky;

  for (let i = 0; i < stars.length; i += 5) {
    const p = project([stars[i], stars[i + 1], stars[i + 2]]);

    if (!p) {
      continue;
    }

    const mag = stars[i + 3];
    const color = COLORS[stars[i + 4]];
    const r = radiusOf(mag);
    // 별마다 두 층 중 하나에 그려, 두 층이 번갈아 밝아지며 반짝인다
    const context = contexts[(i / 5) % 2];

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
  }
};

export default function SkyBackground() {
  const lower = useRef<HTMLCanvasElement>(null);
  const upper = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!lower.current || !upper.current) {
      return;
    }

    const layers = [lower.current, upper.current];
    let timer = 0;

    // 들어온 순간의 하늘을 그리고, 창 크기가 바뀌면 다시 그린다
    const redraw = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => draw(layers), 150);
    };

    draw(layers);
    window.addEventListener("resize", redraw);

    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("resize", redraw);
    };
  }, []);

  return (
    <div className="fx-sky" aria-hidden>
      <canvas ref={lower} className="fx-sky-layer" />
      <canvas ref={upper} className="fx-sky-layer fx-sky-layer-alt" />
    </div>
  );
}
