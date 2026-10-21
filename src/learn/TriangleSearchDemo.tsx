"use client";

import type { CatalogTriangle } from "@/learn/brightTriangles";
import { useEffect, useMemo, useRef, useState } from "react";
import { STARS } from "@/game/sky/catalog";
import { buildBrightTriangles, shapeOf } from "@/learn/brightTriangles";

// 삼각형 색인 데모: 밝은 별(3.5등급까지)로 만든 삼각형을 모양 값 평면에 모두 찍고,
// 사람이 끌어 만든 삼각형과 모양이 가장 가까운 8개를 찾는다. 풀이의 밝은 별 삼각형 색인
// (search/solverContext.ts: 3.5등급, 30°)과 같은 규칙이다.

const K = 8;

const nameOf = (i: number) => STARS[i].name ?? `HR ${STARS[i].hr}`;

const PLOT = 320;

export default function TriangleSearchDemo() {
  const [triangles, setTriangles] = useState<CatalogTriangle[] | null>(null);
  const [points, setPoints] = useState<[number, number][]>([
    [70, 200],
    [150, 60],
    [250, 170],
  ]);
  const [selected, setSelected] = useState(0);
  const dragging = useRef<number | null>(null);
  const svg = useRef<SVGSVGElement>(null);
  const plot = useRef<HTMLCanvasElement>(null);

  // 색인 만들기는 화면을 그린 뒤에
  useEffect(() => {
    const id = window.setTimeout(
      () => setTriangles(buildBrightTriangles()),
      50,
    );

    return () => window.clearTimeout(id);
  }, []);

  const shape = shapeOf(points);
  const nearest = useMemo(() => {
    if (!triangles) return [];

    return triangles
      .map((t) => ({
        t,
        d: Math.hypot(t.shape[0] - shape[0], t.shape[1] - shape[1]),
      }))
      .sort((a, b) => a.d - b.d)
      .slice(0, K);
  }, [triangles, shape]);

  useEffect(() => {
    const context = plot.current?.getContext("2d");

    if (!context || !triangles) return;

    const dpr = Math.min(2, window.devicePixelRatio || 1);
    plot.current!.width = PLOT * dpr;
    plot.current!.height = PLOT * dpr;
    context.setTransform(dpr, 0, 0, dpr, 0, 0);
    context.fillStyle = "#0b0f22";
    context.fillRect(0, 0, PLOT, PLOT);
    // x = 짧은÷긴 (0~1), y = 중간÷긴 (0.5~1)
    const px = (s: [number, number]) => ({
      x: 20 + s[0] * (PLOT - 30),
      y: PLOT - 20 - ((s[1] - 0.5) / 0.5) * (PLOT - 30),
    });

    context.fillStyle = "rgba(165,180,252,0.28)";

    for (const t of triangles) {
      const p = px(t.shape);
      context.fillRect(p.x, p.y, 1.2, 1.2);
    }

    context.strokeStyle = "rgba(255,255,255,0.3)";
    context.strokeRect(20, 10, PLOT - 30, PLOT - 30);
    context.fillStyle = "rgba(255,255,255,0.6)";
    context.font = "10px sans-serif";
    context.fillText("짧은 변 ÷ 긴 변 →", PLOT - 110, PLOT - 6);
    context.save();
    context.translate(11, 120);
    context.rotate(-Math.PI / 2);
    context.fillText("중간 변 ÷ 긴 변 →", 0, 0);
    context.restore();

    nearest.forEach(({ t }, i) => {
      const p = px(t.shape);
      context.fillStyle = i === selected ? "#fde68a" : "#fdba74";
      context.beginPath();
      context.arc(p.x, p.y, i === selected ? 4 : 2.5, 0, 2 * Math.PI);
      context.fill();
    });

    const me = px(shape);
    context.strokeStyle = "#86efac";
    context.lineWidth = 2;
    context.beginPath();
    context.arc(me.x, me.y, 7, 0, 2 * Math.PI);
    context.stroke();
  }, [triangles, nearest, shape, selected]);

  const toSvg = (e: React.PointerEvent): [number, number] => {
    const rect = svg.current!.getBoundingClientRect();

    return [
      ((e.clientX - rect.left) / rect.width) * 320,
      ((e.clientY - rect.top) / rect.height) * 260,
    ];
  };

  const match = nearest[selected];
  // 고른 별 지도 삼각형을 오른쪽 칸 크기에 맞춰 그린다
  const matchPath = useMemo(() => {
    if (!match) return null;

    const pts = match.t.points;
    const xs = pts.map((p) => p[0]);
    const ys = pts.map((p) => p[1]);
    const span = Math.max(
      Math.max(...xs) - Math.min(...xs),
      Math.max(...ys) - Math.min(...ys),
    );
    const cx = (Math.max(...xs) + Math.min(...xs)) / 2;
    const cy = (Math.max(...ys) + Math.min(...ys)) / 2;

    return pts.map(([x, y]): [number, number] => [
      60 + ((x - cx) / span) * 90,
      60 - ((y - cy) / span) * 90,
    ]);
  }, [match]);

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 md:grid-cols-2">
        <div className="flex flex-col gap-1">
          <div className="text-xs opacity-70">
            ① 별 셋을 끌어서 사진 속 삼각형을 만들어 보세요
          </div>
          <svg
            ref={svg}
            viewBox="0 0 320 260"
            className="rounded-box w-full touch-none bg-[#0b0f22]"
            onPointerMove={(e) => {
              if (dragging.current === null) return;

              const p = toSvg(e);
              setPoints((ps) =>
                ps.map((q, i) => (i === dragging.current ? p : q)),
              );
            }}
            onPointerUp={() => (dragging.current = null)}
            onPointerLeave={() => (dragging.current = null)}
          >
            <polygon
              points={points.map((p) => p.join(",")).join(" ")}
              fill="rgba(134,239,172,0.1)"
              stroke="#86efac"
              strokeWidth="1.5"
            />
            {points.map(([x, y], i) => (
              <circle
                key={i}
                cx={x}
                cy={y}
                r={11}
                fill="white"
                fillOpacity={0.9}
                className="cursor-grab"
                onPointerDown={(e) => {
                  dragging.current = i;
                  (e.target as Element).setPointerCapture?.(e.pointerId);
                }}
              />
            ))}
          </svg>
          <div className="font-mono text-xs text-green-300">
            모양 값 ({shape[0].toFixed(3)}, {shape[1].toFixed(3)})
          </div>
        </div>
        <div className="flex flex-col gap-1">
          <div className="text-xs opacity-70">
            ② 밝은 별 삼각형{" "}
            {triangles ? triangles.length.toLocaleString("ko-KR") : "…"}개의
            모양 값
          </div>
          <canvas
            ref={plot}
            className="rounded-box w-full"
            style={{ aspectRatio: "1" }}
          />
          <div className="text-xs opacity-60">
            초록 원이 내 삼각형, 주황 점이 가장 가까운 {K}개예요.
          </div>
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-[1fr_auto]">
        <ol className="flex flex-col gap-1 text-sm">
          {nearest.map(({ t, d }, i) => (
            <li key={t.stars.join()}>
              <button
                className={
                  i === selected
                    ? "w-full rounded bg-amber-300/20 px-2 py-1 text-left font-bold"
                    : "hover:bg-base-300/60 w-full rounded px-2 py-1 text-left"
                }
                onClick={() => setSelected(i)}
              >
                {i + 1}. {t.stars.map(nameOf).join(" · ")}{" "}
                <span className="text-xs opacity-60">차이 {d.toFixed(3)}</span>
              </button>
            </li>
          ))}
        </ol>
        {matchPath && (
          <div className="flex flex-col items-center gap-1">
            <svg
              viewBox="0 0 120 120"
              className="rounded-box h-32 w-32 bg-[#0b0f22]"
            >
              <polygon
                points={matchPath.map((p) => p.join(",")).join(" ")}
                fill="rgba(253,230,138,0.12)"
                stroke="#fde68a"
              />
              {matchPath.map(([x, y], i) => (
                <circle key={i} cx={x} cy={y} r={3} fill="white" />
              ))}
            </svg>
            <span className="text-xs opacity-60">하늘의 그 삼각형</span>
          </div>
        )}
      </div>
    </div>
  );
}
