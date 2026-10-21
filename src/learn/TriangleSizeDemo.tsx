"use client";

import type { CatalogTriangle } from "@/learn/brightTriangles";
import { useEffect, useMemo, useRef, useState } from "react";
import { STARS } from "@/game/sky/catalog";
import {
  angleDeg,
  buildBrightTriangles,
  shapeOfSides,
} from "@/learn/brightTriangles";

// 삼각형 크기 거르기 데모: 북두칠성 사진에서 별 셋을 고르면, 밝은 별 삼각형 4만여 개 중 모양이 닮은 것을
// 가로 = 모양 차이, 세로 = 하늘에서의 크기(가장 긴 변, 로그 눈금)로 찍는다. 사진만으로는 픽셀이 몇 도인지 몰라
// 크기를 비교할 수 없다. 화각을 하나 짐작하면 사진 삼각형의 크기가 정해지고, 그 절반~두 배 밖은 버린다.
// 풀이(search/solvers/triangle.ts)와 같은 화각 후보·크기 허용 배율(2)·확인 개수(가까운 8개)다.
// 자료: public/learn/triangle-dipper.json (scripts/learn/buildDemoData.ts)

const SRC = "/samples/big-dipper.jpg";
const FOV_CANDIDATES = [10, 14, 18, 23, 29, 37, 47, 60, 75];
const SIZE_TOLERANCE = 2;
const K = 8;
const TAU = 0.03; // 이 안이면 "모양이 닮았다"
const PLOT_W = 560;
const PLOT_H = 380;
const PAD = { left: 48, right: 12, top: 12, bottom: 34 };
const Y_MIN = 1.5; // 도
const Y_MAX = 50;

interface Dipper {
  W: number;
  H: number;
  fovDeg: number;
  stars: { name: string; hr: string; x: number; y: number }[];
}

const toX = (diff: number) =>
  PAD.left + (diff / TAU) * (PLOT_W - PAD.left - PAD.right);
const toY = (deg: number) =>
  PLOT_H -
  PAD.bottom -
  ((Math.log(Math.max(Y_MIN, Math.min(Y_MAX, deg))) - Math.log(Y_MIN)) /
    (Math.log(Y_MAX) - Math.log(Y_MIN))) *
    (PLOT_H - PAD.top - PAD.bottom);

export default function TriangleSizeDemo() {
  const [data, setData] = useState<Dipper | null>(null);
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [triangles, setTriangles] = useState<CatalogTriangle[] | null>(null);
  const [picked, setPicked] = useState<number[]>([1, 2, 3]);
  const [fov, setFov] = useState<number | null>(null);
  const photo = useRef<HTMLCanvasElement>(null);
  const plot = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    let alive = true;

    fetch("/learn/triangle-dipper.json")
      .then((r) => r.json())
      .then((d: Dipper) => alive && setData(d));
    const img = new Image();
    img.onload = () => alive && setImage(img);
    img.src = SRC;
    // 색인 만들기는 화면을 그린 뒤에
    const id = window.setTimeout(
      () => alive && setTriangles(buildBrightTriangles()),
      50,
    );

    return () => {
      alive = false;
      window.clearTimeout(id);
    };
  }, []);

  const view = useMemo(() => {
    if (!data || !triangles) return null;

    const p = picked.map((i) => data.stars[i]);
    const px = (a: (typeof p)[0], b: (typeof p)[0]) =>
      Math.hypot(a.x - b.x, a.y - b.y);
    const shape = shapeOfSides([
      px(p[1], p[2]),
      px(p[0], p[2]),
      px(p[0], p[1]),
    ]);
    const truthKey = p
      .map((s) => s.hr)
      .sort()
      .join();
    const similar = triangles
      .map((t) => ({
        t,
        diff: Math.hypot(t.shape[0] - shape[0], t.shape[1] - shape[1]),
        truth:
          t.stars
            .map((i) => STARS[i].hr)
            .sort()
            .join() === truthKey,
      }))
      .filter((c) => c.diff < TAU)
      .sort((a, b) => a.diff - b.diff);

    // 이 화각이라면 사진 삼각형의 가장 긴 변이 하늘에서 몇 도인가 (짧은 변 기준 화각, 핀홀)
    let photoSize: number | null = null;

    if (fov !== null) {
      const f =
        Math.min(data.W, data.H) / 2 / Math.tan(((fov / 2) * Math.PI) / 180);

      const ray = (s: (typeof p)[0]) => {
        const v = [s.x - data.W / 2, s.y - data.H / 2, f];
        const n = Math.hypot(v[0], v[1], v[2]);

        return [v[0] / n, v[1] / n, v[2] / n] as [number, number, number];
      };

      const r = p.map(ray);
      photoSize = Math.max(
        angleDeg(r[0], r[1]),
        angleDeg(r[0], r[2]),
        angleDeg(r[1], r[2]),
      );
    }

    const fits = (sizeDeg: number) =>
      photoSize === null ||
      (sizeDeg / photoSize <= SIZE_TOLERANCE &&
        sizeDeg / photoSize >= 1 / SIZE_TOLERANCE);
    const eligible = similar.filter((c) => fits(c.t.sizeDeg));
    const rankAll = similar.findIndex((c) => c.truth) + 1;
    const rankNow = eligible.findIndex((c) => c.truth) + 1;

    return { similar, eligible, photoSize, fits, rankAll, rankNow };
  }, [data, triangles, picked, fov]);

  // 사진과 고른 삼각형
  useEffect(() => {
    const el = photo.current;
    const ctx = el?.getContext("2d");

    if (!el || !ctx || !data || !image) return;

    const W = 560;
    const k = W / data.W;
    const H = Math.round(data.H * k);
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    el.width = W * dpr;
    el.height = H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.drawImage(image, 0, 0, W, H);
    ctx.fillStyle = "rgba(5,8,20,0.35)";
    ctx.fillRect(0, 0, W, H);

    const p = picked.map((i) => data.stars[i]);
    ctx.strokeStyle = "#4ade80";
    ctx.fillStyle = "rgba(74,222,128,0.15)";
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    p.forEach((s, i) =>
      i ? ctx.lineTo(s.x * k, s.y * k) : ctx.moveTo(s.x * k, s.y * k),
    );
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.font = "13px sans-serif";

    data.stars.forEach((s, i) => {
      const on = picked.includes(i);
      ctx.strokeStyle = on ? "#4ade80" : "rgba(255,255,255,0.7)";
      ctx.lineWidth = on ? 3 : 1.5;
      ctx.beginPath();
      ctx.arc(s.x * k, s.y * k, 11, 0, 2 * Math.PI);
      ctx.stroke();
      ctx.fillStyle = on ? "#4ade80" : "rgba(255,255,255,0.8)";
      ctx.fillText(s.name, s.x * k + 14, s.y * k + 4);
    });
  }, [data, image, picked]);

  // 모양 차이 × 크기
  useEffect(() => {
    const el = plot.current;
    const ctx = el?.getContext("2d");

    if (!el || !ctx || !view) return;

    const dpr = Math.min(2, window.devicePixelRatio || 1);
    el.width = PLOT_W * dpr;
    el.height = PLOT_H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = "#0b0f22";
    ctx.fillRect(0, 0, PLOT_W, PLOT_H);

    ctx.strokeStyle = "rgba(255,255,255,0.15)";
    ctx.fillStyle = "rgba(255,255,255,0.6)";
    ctx.font = "12px sans-serif";
    ctx.lineWidth = 1;

    for (const deg of [2, 5, 10, 20, 40]) {
      ctx.beginPath();
      ctx.moveTo(PAD.left, toY(deg));
      ctx.lineTo(PLOT_W - PAD.right, toY(deg));
      ctx.stroke();
      ctx.fillText(`${deg}°`, PAD.left - 30, toY(deg) + 4);
    }

    ctx.fillText("← 모양이 더 닮음      모양 차이", PAD.left, PLOT_H - 10);
    ctx.save();
    ctx.translate(12, PLOT_H / 2 + 50);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText("하늘에서의 크기 →", 0, 0);
    ctx.restore();

    // 이 화각에서 사진 삼각형의 크기와 허용 범위
    if (view.photoSize !== null) {
      const top = toY(view.photoSize * SIZE_TOLERANCE);
      const bottom = toY(view.photoSize / SIZE_TOLERANCE);
      ctx.fillStyle = "rgba(74,222,128,0.12)";
      ctx.fillRect(PAD.left, top, PLOT_W - PAD.left - PAD.right, bottom - top);
      ctx.strokeStyle = "#4ade80";
      ctx.setLineDash([5, 4]);
      ctx.beginPath();
      ctx.moveTo(PAD.left, toY(view.photoSize));
      ctx.lineTo(PLOT_W - PAD.right, toY(view.photoSize));
      ctx.stroke();
      ctx.setLineDash([]);
    }

    const top8 = new Set(view.eligible.slice(0, K).map((c) => c.t));

    for (const c of view.similar) {
      const on = view.fits(c.t.sizeDeg);
      ctx.fillStyle = top8.has(c.t)
        ? "#fdba74"
        : on
          ? "rgba(199,210,254,0.9)"
          : "rgba(199,210,254,0.12)";
      ctx.beginPath();
      ctx.arc(
        toX(c.diff),
        toY(c.t.sizeDeg),
        top8.has(c.t) ? 4 : 2.6,
        0,
        2 * Math.PI,
      );
      ctx.fill();
    }

    const truth = view.similar.find((c) => c.truth);

    if (truth) {
      const x = toX(truth.diff);
      const y = toY(truth.t.sizeDeg);
      ctx.strokeStyle = "#4ade80";
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(x, y, 9, 0, 2 * Math.PI);
      ctx.stroke();
      ctx.fillStyle = "#4ade80";
      ctx.font = "bold 13px sans-serif";
      ctx.fillText("정답", x + 11, y - 8);
    }
  }, [view]);

  const pickStar = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!data) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * data.W;
    const y = ((e.clientY - rect.top) / rect.height) * data.H;
    const near = data.stars
      .map((s, i) => ({ i, d: Math.hypot(s.x - x, s.y - y) }))
      .sort((a, b) => a.d - b.d)[0];

    if (!near || near.d > 60 || picked.includes(near.i)) return;

    setPicked((p) => [...p.slice(1), near.i]);
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="grid gap-3 md:grid-cols-2">
        <div className="flex flex-col gap-1">
          <div className="text-sm opacity-70">
            ① 사진에서 별 셋을 골라 보세요 (누르면 바뀌어요)
          </div>
          <canvas
            ref={photo}
            className="rounded-box h-auto w-full cursor-pointer"
            style={{ maxHeight: "80vh" }}
            onClick={pickStar}
          />
        </div>
        <div className="flex flex-col gap-1">
          <div className="text-sm opacity-70">
            ② 밝은 별 삼각형{" "}
            {triangles ? triangles.length.toLocaleString("ko-KR") : "…"}개 중
            모양이 닮은 것
          </div>
          <canvas
            ref={plot}
            className="rounded-box h-auto w-full"
            style={{ maxHeight: "80vh" }}
          />
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-1 text-base">
        <span className="mr-1">③ 화각을 짐작하면:</span>
        <button
          className={`btn btn-sm ${fov === null ? "btn-primary" : ""}`}
          onClick={() => setFov(null)}
        >
          모름
        </button>
        {FOV_CANDIDATES.map((f) => (
          <button
            key={f}
            className={`btn btn-sm ${fov === f ? "btn-primary" : ""}`}
            onClick={() => setFov(f)}
          >
            {f}°
          </button>
        ))}
        {data && (
          <span className="ml-2 text-sm opacity-60">
            (이 사진의 실제 화각 약 {Math.round(data.fovDeg)}°)
          </span>
        )}
      </div>
      {view && (
        <div className="grid gap-2 text-base md:grid-cols-3">
          <div className="bg-base-300/60 rounded-box p-3">
            모양이 닮은 삼각형{" "}
            <b className="text-lg">{view.similar.length}개</b>
          </div>
          <div className="bg-base-300/60 rounded-box p-3">
            {view.photoSize === null ? (
              "화각을 모르면 크기로 거를 수 없다"
            ) : (
              <>
                크기 {view.photoSize.toFixed(1)}°의 절반~두 배만{" "}
                <b className="text-lg">{view.eligible.length}개</b>
              </>
            )}
          </div>
          <div className="bg-base-300/60 rounded-box p-3">
            정답 순위{" "}
            <b className="text-lg">
              {view.rankNow > 0 ? `${view.rankNow}등` : "밖"}
            </b>{" "}
            {view.rankNow > 0 && view.rankNow <= K ? (
              <span className="text-green-400">가까운 {K}개 안 → 확인</span>
            ) : (
              <span className="text-red-400">가까운 {K}개 밖</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
