"use client";

import type { DetectedStar } from "@/plate-solver/detectPhotoStars";
import type { Point3D } from "@/scripts/hash/types";
import type { Mat3 } from "@/search/utils/similarity";
import { useEffect, useMemo, useRef, useState } from "react";
import { CONSTELLATIONS, STARS } from "@/game/sky/catalog";
import { detectPhotoStars } from "@/plate-solver/detectPhotoStars";
import { preloadSolver, solveInWorker } from "@/search/solverClient";
import { ACCEPT } from "@/search/solvers/candidates";
import { poissonTailNegLog10 } from "@/search/utils/stats";
import { projectVecToPhoto } from "@/search/utils/wcs";

// 확인 데모: 북두칠성 샘플을 실제로 풀고, 찾은 변환으로 별 지도를 사진 위에 겹친다.
// 슬라이더로 답을 일부러 조금 돌리거나 옮기면, 겹치는 별 수와 '우연일 확률'이 어떻게 무너지는지 본다.
// 겹침 판정·우연 계산은 풀이(solveCore)와 같은 식이다: 허용 반경 max(5, 대각선×0.006),
// 우연 기대 λ = 사진 별 × 화면 안 지도 별 × 허용 원 넓이 ÷ 사진 넓이, 짝 3개는 빼고 푸아송 꼬리.

const SRC = "/samples/big-dipper.jpg";
const PHOTO_STARS = 60;
const SEED = 3;
const D = Math.PI / 180;

// 축 u(단위 벡터) 둘레로 θ 돌리기
const rotate = (v: Point3D, u: Point3D, theta: number): Point3D => {
  const c = Math.cos(theta);
  const s = Math.sin(theta);
  const dot = u[0] * v[0] + u[1] * v[1] + u[2] * v[2];
  const cross: Point3D = [
    u[1] * v[2] - u[2] * v[1],
    u[2] * v[0] - u[0] * v[2],
    u[0] * v[1] - u[1] * v[0],
  ];

  return [0, 1, 2].map(
    (i) => v[i] * c + cross[i] * s + u[i] * dot * (1 - c),
  ) as Point3D;
};

const normalize = (v: Point3D): Point3D => {
  const n = Math.hypot(v[0], v[1], v[2]);

  return [v[0] / n, v[1] / n, v[2] / n];
};

export default function VerifyOverlayDemo() {
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [stars, setStars] = useState<DetectedStar[] | null>(null);
  const [solution, setSolution] = useState<{
    TP: Mat3;
    center: Point3D;
  } | null>(null);
  const [status, setStatus] = useState("사진을 불러오는 중…");
  const [spin, setSpin] = useState(0);
  const [shift, setShift] = useState(0);
  const canvas = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    let alive = true;
    const img = new Image();

    img.onload = async () => {
      if (!alive) return;

      setImage(img);
      setStatus("별을 찾는 중…");
      const found = await detectPhotoStars(img);

      if (!alive) return;

      setStars(found);
      setStatus("별 지도와 맞춰 보는 중…");
      await preloadSolver();
      const result = await solveInWorker(
        found.map((s) => ({
          x: s.x,
          y: s.y,
          brightness: s.brightness,
          ringContrast: s.ringContrast,
        })),
        img.width,
        img.height,
      );

      if (!alive) return;

      if (result.transform && result.centerVector) {
        setSolution({ TP: result.transform, center: result.centerVector });
        setStatus("");
      } else {
        setStatus("이번에는 풀지 못했어요.");
      }
    };

    img.src = SRC;

    return () => {
      alive = false;
    };
  }, []);

  // 슬라이더만큼 하늘을 돌리고 옮긴 뒤 겹쳐 보기
  const overlay = useMemo(() => {
    if (!image || !stars || !solution) return null;

    const W = image.width;
    const H = image.height;
    const tol = Math.max(5, Math.hypot(W, H) * 0.006);
    const { TP, center } = solution;
    // 옮기는 축: 광축과 천구 북극에 수직인 방향
    const side = normalize([
      center[1] * 1 - center[2] * 0,
      center[2] * 0 - center[0] * 1,
      0,
    ]);
    const move = (v: Point3D) =>
      rotate(rotate(v, center, spin * D), side, shift * D);

    const project = (v: Point3D) => {
      const p = projectVecToPhoto(TP, move(v));

      return p && p[0] >= 0 && p[0] < W && p[1] >= 0 && p[1] < H ? p : null;
    };

    const photo = stars.slice(0, PHOTO_STARS);
    const map = STARS.map((s) => project(s.vector)).filter(
      (p): p is [number, number] => p !== null,
    );
    const pairs: { photo: [number, number]; map: [number, number] }[] = [];

    for (const s of photo) {
      let best: [number, number] | null = null;
      let bestD = tol;

      for (const m of map) {
        const d = Math.hypot(m[0] - s.x, m[1] - s.y);

        if (d < bestD) {
          bestD = d;
          best = m;
        }
      }

      if (best) pairs.push({ photo: [s.x, s.y], map: best });
    }

    const expected =
      (photo.length * map.length * Math.PI * tol * tol) / (W * H);
    const logOdds = poissonTailNegLog10(pairs.length - SEED, expected);
    const lines = CONSTELLATIONS.map((c) =>
      c.stars.map((v) => projectVecToPhoto(TP, move(v))),
    );

    return { photo, map, pairs, expected, logOdds, lines, tol };
  }, [image, stars, solution, spin, shift]);

  useEffect(() => {
    const context = canvas.current?.getContext("2d");

    if (!context || !image) return;

    context.drawImage(image, 0, 0);

    if (!overlay) return;

    const unit = Math.hypot(image.width, image.height) / 1400;
    context.lineWidth = 1.5 * unit;
    context.strokeStyle = "rgba(253,230,138,0.6)";

    for (const line of overlay.lines) {
      for (let i = 0; i < line.length - 1; i++) {
        const a = line[i];
        const b = line[i + 1];

        if (!a || !b) continue;

        context.beginPath();
        context.moveTo(a[0], a[1]);
        context.lineTo(b[0], b[1]);
        context.stroke();
      }
    }

    context.strokeStyle = "rgba(196,181,253,0.9)";

    for (const [x, y] of overlay.map) {
      context.beginPath();
      context.arc(x, y, 7 * unit, 0, 2 * Math.PI);
      context.stroke();
    }

    context.strokeStyle = "rgba(252,165,165,0.9)";

    for (const s of overlay.photo) {
      context.beginPath();
      context.arc(s.x, s.y, 4 * unit, 0, 2 * Math.PI);
      context.stroke();
    }

    context.strokeStyle = "#4ade80";
    context.lineWidth = 3 * unit;

    for (const p of overlay.pairs) {
      context.beginPath();
      context.arc(p.photo[0], p.photo[1], 11 * unit, 0, 2 * Math.PI);
      context.stroke();
    }
  }, [image, overlay]);

  const confident = overlay ? overlay.logOdds >= ACCEPT.minLogOdds : false;

  return (
    <div className="flex flex-col gap-3">
      <div className="rounded-box relative overflow-hidden bg-black">
        <canvas
          ref={canvas}
          width={image?.width ?? 4}
          height={image?.height ?? 3}
          className="block h-auto w-full"
        />
        {status && (
          <div className="absolute inset-0 grid place-items-center bg-black/50 text-sm">
            <span className="flex items-center gap-2">
              <span className="loading loading-spinner loading-sm" />
              {status}
            </span>
          </div>
        )}
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm">
          답을 돌려 보기 {spin > 0 ? "+" : ""}
          {spin.toFixed(1)}°
          <input
            type="range"
            className="range range-xs"
            min={-6}
            max={6}
            step={0.1}
            value={spin}
            onChange={(e) => setSpin(Number(e.target.value))}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          답을 옮겨 보기 {shift > 0 ? "+" : ""}
          {shift.toFixed(1)}°
          <input
            type="range"
            className="range range-xs"
            min={-3}
            max={3}
            step={0.05}
            value={shift}
            onChange={(e) => setShift(Number(e.target.value))}
          />
        </label>
      </div>
      {overlay && (
        <div className="grid grid-cols-2 gap-3 text-center sm:grid-cols-4">
          <Box label="겹친 별" value={`${overlay.pairs.length}개`} />
          <Box
            label="우연히 겹칠 기대치"
            value={`${overlay.expected.toFixed(1)}개`}
          />
          <Box
            label="우연일 확률"
            value={
              overlay.logOdds < 0.5 ? (
                "흔한 일"
              ) : (
                <>
                  10<sup>-{Math.min(99, overlay.logOdds).toFixed(0)}</sup>
                </>
              )
            }
          />
          <Box
            label="판정"
            value={
              <span className={confident ? "text-success" : "text-warning"}>
                {confident ? "확신" : "후보로만"}
              </span>
            }
          />
        </div>
      )}
      <p className="text-xs opacity-70">
        빨간 작은 원은 사진에서 찾은 별(앞쪽 {PHOTO_STARS}개), 보라 원은 답대로
        겹친 별 지도, 초록 원은 둘이 {overlay ? overlay.tol.toFixed(0) : "몇"}
        픽셀 안에서 만난 곳이에요. 조금만 돌리거나 옮겨도 초록이 사라지고 확률이
        무너져요.
      </p>
    </div>
  );
}

function Box({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="bg-base-300/60 rounded-box p-2">
      <div className="text-xs opacity-60">{label}</div>
      <div className="text-lg font-black">{value}</div>
    </div>
  );
}
