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
const ZOOM_PLOT = 560;

export default function TriangleSearchDemo() {
  const [triangles, setTriangles] = useState<CatalogTriangle[] | null>(null);
  const [points, setPoints] = useState<[number, number][]>([
    [70, 200],
    [150, 60],
    [250, 170],
  ]);
  const [selected, setSelected] = useState(0);
  // 모양 값 그래프를 누르면 크게: 내 삼각형 둘레만 확대해 점 하나하나와 가까운 순서를 보인다
  const [zoom, setZoom] = useState(false);
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

    const size = zoom ? ZOOM_PLOT : PLOT;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    plot.current!.width = size * dpr;
    plot.current!.height = size * dpr;
    context.setTransform(dpr, 0, 0, dpr, 0, 0);
    context.fillStyle = "#0b0f22";
    context.fillRect(0, 0, size, size);
    // 보이는 범위: 전체는 x = 짧은÷긴 (0~1), y = 중간÷긴 (0.5~1). 확대하면 내 삼각형 둘레
    const reach = nearest.length ? nearest[nearest.length - 1].d : 0.02;
    const half = Math.max(0.01, reach * 2.2);
    const [x0, x1, y0, y1] = zoom
      ? [shape[0] - half, shape[0] + half, shape[1] - half, shape[1] + half]
      : [0, 1, 0.5, 1];
    const left = zoom ? 56 : 20;
    const bottom = zoom ? 40 : 20;
    const inner = size - left - 10;
    const px = (s: [number, number]) => ({
      x: left + ((s[0] - x0) / (x1 - x0)) * inner,
      y: size - bottom - ((s[1] - y0) / (y1 - y0)) * (size - bottom - 10),
    });

    if (zoom) {
      // 눈금
      context.strokeStyle = "rgba(255,255,255,0.12)";
      context.fillStyle = "rgba(255,255,255,0.6)";
      context.font = "12px sans-serif";
      const step = half / 2;

      for (let k = -2; k <= 2; k++) {
        const gx = px([shape[0] + k * step, y0]).x;
        const gy = px([x0, shape[1] + k * step]).y;
        context.beginPath();
        context.moveTo(gx, 10);
        context.lineTo(gx, size - bottom);
        context.moveTo(left, gy);
        context.lineTo(size - 10, gy);
        context.stroke();
        context.fillText(
          (shape[0] + k * step).toFixed(3),
          gx - 16,
          size - bottom + 16,
        );
        context.fillText((shape[1] + k * step).toFixed(3), 4, gy + 4);
      }
    }

    context.fillStyle = zoom
      ? "rgba(165,180,252,0.55)"
      : "rgba(165,180,252,0.28)";

    for (const t of triangles) {
      if (
        zoom &&
        (t.shape[0] < x0 ||
          t.shape[0] > x1 ||
          t.shape[1] < y0 ||
          t.shape[1] > y1)
      )
        continue;

      const p = px(t.shape);

      if (zoom) {
        context.beginPath();
        context.arc(p.x, p.y, 2.5, 0, 2 * Math.PI);
        context.fill();
      } else {
        context.fillRect(p.x, p.y, 1.2, 1.2);
      }
    }

    context.strokeStyle = "rgba(255,255,255,0.3)";

    if (!zoom) context.strokeRect(20, 10, PLOT - 30, PLOT - 30);

    context.fillStyle = "rgba(255,255,255,0.6)";
    context.font = zoom ? "13px sans-serif" : "10px sans-serif";
    context.fillText("짧은 변 ÷ 긴 변 →", size - (zoom ? 140 : 110), size - 6);
    context.save();
    context.translate(zoom ? 14 : 11, zoom ? size / 2 + 60 : 120);
    context.rotate(-Math.PI / 2);
    context.fillText("중간 변 ÷ 긴 변 →", 0, 0);
    context.restore();

    const me = px(shape);

    if (zoom) {
      // 가장 가까운 8개가 드는 원
      const r = px([shape[0] + reach, shape[1]]).x - me.x;
      context.strokeStyle = "rgba(253,186,116,0.6)";
      context.setLineDash([5, 4]);
      context.beginPath();
      context.arc(me.x, me.y, r, 0, 2 * Math.PI);
      context.stroke();
      context.setLineDash([]);
    }

    nearest.forEach(({ t }, i) => {
      const p = px(t.shape);
      context.fillStyle = i === selected ? "#fde68a" : "#fdba74";
      context.beginPath();
      context.arc(
        p.x,
        p.y,
        zoom ? (i === selected ? 7 : 5) : i === selected ? 4 : 2.5,
        0,
        2 * Math.PI,
      );
      context.fill();

      if (zoom) {
        context.fillStyle = "#0b0f22";
        context.font = "bold 10px sans-serif";
        context.textAlign = "center";
        context.fillText(String(i + 1), p.x, p.y + 3.5);
        context.textAlign = "start";
      }
    });

    // 내 삼각형도 이 평면의 점 하나다: 눈에 띄게 십자로
    const arm = zoom ? 14 : 9;
    context.strokeStyle = "#86efac";
    context.lineWidth = 2;
    context.beginPath();
    context.moveTo(me.x - arm, me.y);
    context.lineTo(me.x + arm, me.y);
    context.moveTo(me.x, me.y - arm);
    context.lineTo(me.x, me.y + arm);
    context.stroke();
    context.fillStyle = "#86efac";
    context.beginPath();
    context.arc(me.x, me.y, 3, 0, 2 * Math.PI);
    context.fill();
  }, [triangles, nearest, shape, selected, zoom]);

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
    <div className="relative flex flex-col gap-4">
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
          <div
            className={
              zoom
                ? "bg-base-100/95 absolute inset-0 z-10 flex cursor-zoom-out items-center justify-center gap-6 p-2"
                : "cursor-zoom-in"
            }
            onClick={() => setZoom((z) => !z)}
          >
            <canvas
              ref={plot}
              className="rounded-box"
              style={
                zoom
                  ? { width: "auto", height: "100%", aspectRatio: "1" }
                  : { width: "100%", aspectRatio: "1" }
              }
            />
            {zoom && (
              <div className="flex max-w-xs flex-col gap-2 text-sm">
                <div className="text-base font-bold">내 삼각형 둘레를 확대</div>
                <div>
                  점 하나하나가 하늘의 삼각형이에요. 번호는 모양 값이 가까운
                  순서, 점선 원 안이 풀이가 확인하는 {K}개예요.
                </div>
                <div className="opacity-60">누르면 돌아가요</div>
              </div>
            )}
          </div>
          <div className="text-xs opacity-60">
            점 하나가 삼각형 하나의 모양 값이에요. 초록 십자가 내 삼각형, 주황
            점이 모양 값이 가장 가까운 {K}개예요. 누르면 크게 볼 수 있어요.
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
            <span className="text-xs opacity-60">
              {selected + 1}번 후보를 하늘에서 본 모양
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
