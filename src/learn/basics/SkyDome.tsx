"use client";

import type { Point3D } from "@/scripts/hash/types";
import type { Observer } from "@/search/utils/ephemeris";
import { useEffect, useRef, useState } from "react";
import { CONSTELLATIONS, STARS } from "@/game/sky/catalog";
import { domeProjector } from "@/learn/basics/skyMath";

// 하늘 읽기 기초에서 같이 쓰는 둥근 하늘 그림: 천정이 가운데, 가장자리가 지평선, 북이 위·동이 왼쪽.
// 별·별자리선 위에 선(천구 적도·황도·은하 적도)과 표시(고른 별, 은하 중심 등)를 겹쳐 그린다.

export interface DomeLine {
  points: Point3D[];
  color: string; // "r,g,b"
  width?: number;
  dash?: number[];
  band?: number; // 띠 두께(px). 은하수처럼 넓게 칠할 때
}

export interface DomeMark {
  vector: Point3D;
  label: string;
  color: string;
}

const FONT = '"Pretendard Variable", Pretendard, system-ui, sans-serif';
const MAX_SIZE = 480;

export default function SkyDome({
  t,
  observer,
  lines = [],
  marks = [],
  magLimit = 4.5,
  meridian = false,
}: {
  t: number;
  observer: Observer;
  lines?: DomeLine[];
  marks?: DomeMark[];
  magLimit?: number;
  meridian?: boolean;
}) {
  const wrapper = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const [size, setSize] = useState(320);

  useEffect(() => {
    const el = wrapper.current;

    if (!el) {
      return;
    }

    const measure = () => setSize(Math.min(MAX_SIZE, el.clientWidth));
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);

    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const ctx = canvas.current?.getContext("2d");

    if (!ctx) {
      return;
    }

    const dpr = window.devicePixelRatio || 1;
    ctx.canvas.width = Math.round(size * dpr);
    ctx.canvas.height = Math.round(size * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    drawDome(ctx, size, t, observer, lines, marks, magLimit, meridian);
  }, [size, t, observer, lines, marks, magLimit, meridian]);

  return (
    <div ref={wrapper} className="flex w-full justify-center">
      <canvas
        ref={canvas}
        style={{ width: size, height: size }}
        className="block"
        role="img"
        aria-label="둥근 하늘 그림: 가운데가 머리 위, 가장자리가 지평선"
      />
    </div>
  );
}

const drawDome = (
  ctx: CanvasRenderingContext2D,
  size: number,
  t: number,
  observer: Observer,
  lines: DomeLine[],
  marks: DomeMark[],
  magLimit: number,
  meridian: boolean,
) => {
  const cx = size / 2;
  const cy = size / 2;
  const R = size / 2 - size * 0.07;
  const project = domeProjector(t, observer, R, cx, cy);

  ctx.clearRect(0, 0, size, size);
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, R, 0, Math.PI * 2);
  ctx.clip();

  const base = ctx.createRadialGradient(cx, cy, 0, cx, cy, R);
  base.addColorStop(0, "rgb(10,14,36)");
  base.addColorStop(1, "rgb(24,30,70)");
  ctx.fillStyle = base;
  ctx.fillRect(cx - R, cy - R, 2 * R, 2 * R);

  // 고도 30°·60° 고리
  ctx.setLineDash([3, 6]);
  ctx.strokeStyle = "rgba(170,190,255,0.16)";
  ctx.lineWidth = 1;

  for (const alt of [30, 60]) {
    const r = R * Math.tan(((90 - alt) * Math.PI) / 360);
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.stroke();
  }

  ctx.setLineDash([]);

  if (meridian) {
    ctx.strokeStyle = "rgba(255,255,255,0.25)";
    ctx.setLineDash([2, 4]);
    ctx.beginPath();
    ctx.moveTo(cx, cy - R);
    ctx.lineTo(cx, cy + R);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  // 겹쳐 그릴 선: 지평선 아래로 가면 끊는다
  const strokePath = (points: Point3D[]) => {
    ctx.beginPath();
    let prev = false;

    for (const v of points) {
      const p = project(v);

      if (p) {
        if (prev) {
          ctx.lineTo(p.x, p.y);
        } else {
          ctx.moveTo(p.x, p.y);
        }
      }

      prev = !!p;
    }

    ctx.stroke();
  };

  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  for (const l of lines.filter((l) => l.band)) {
    ctx.strokeStyle = `rgba(${l.color},0.13)`;
    ctx.lineWidth = l.band!;
    strokePath(l.points);
  }

  // 별자리선
  ctx.strokeStyle = "rgba(150,170,255,0.18)";
  ctx.lineWidth = 1;

  for (const c of CONSTELLATIONS) {
    strokePath(c.stars);
  }

  for (const l of lines) {
    ctx.strokeStyle = `rgba(${l.color},0.85)`;
    ctx.lineWidth = l.width ?? 1.5;
    ctx.setLineDash(l.dash ?? []);
    strokePath(l.points);
  }

  ctx.setLineDash([]);

  // 별
  for (const s of STARS) {
    if (s.mag > magLimit) {
      continue;
    }

    const p = project(s.vector);

    if (!p || p.up < 0) {
      continue;
    }

    const r = Math.max(0.5, Math.min(3.4, 2.6 - 0.48 * s.mag)) * (size / 420);
    ctx.fillStyle = `rgba(255,248,235,${Math.min(1, 0.35 + r / 3)})`;
    ctx.beginPath();
    ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  // 표시
  const fs = Math.max(11, Math.round(size * 0.032));
  ctx.font = `700 ${fs}px ${FONT}`;
  ctx.textAlign = "center";

  for (const m of marks) {
    const p = project(m.vector);

    if (!p || p.up < 0) {
      continue;
    }

    ctx.strokeStyle = m.color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(p.x, p.y, size * 0.022, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = m.color;
    const below = p.y < cy - R + fs * 2;
    ctx.fillText(
      m.label,
      Math.max(fs * 2, Math.min(size - fs * 2, p.x)),
      below ? p.y + size * 0.022 + fs * 1.1 : p.y - size * 0.022 - fs * 0.4,
    );
  }

  ctx.restore();

  // 지평선과 동서남북
  ctx.strokeStyle = "rgba(255,255,255,0.55)";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(cx, cy, R, 0, Math.PI * 2);
  ctx.stroke();

  ctx.font = `800 ${Math.round(size * 0.04)}px ${FONT}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const gap = size * 0.038;

  for (const [label, x, y] of [
    ["북", cx, cy - R - gap],
    ["남", cx, cy + R + gap],
    ["동", cx - R - gap, cy],
    ["서", cx + R + gap, cy],
  ] as const) {
    ctx.fillStyle = "rgba(255,255,255,0.85)";
    ctx.fillText(label, x, y);
  }

  ctx.textBaseline = "alphabetic";
};
