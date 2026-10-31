"use client";

import type { DetectedStar } from "@/plate-solver/detectPhotoStars";
import { useEffect, useMemo, useRef, useState } from "react";
import { loadImage } from "@/learn/demoAssets";
import { MILKY_WAY_PHOTOS } from "@/learn/milkyWayPhotos";
import { detectPhotoStarsWithCoarse } from "@/plate-solver/detectPhotoStars";
import { cn } from "@/utils/cn";

// 줄여서 보기 (journey 54장): 빛무리가 넓은 밝은 별은 검출의 흐림(σ8)보다 넓어 약하게 잡힌다.
// 긴 변 480px로 줄이면 빛무리가 점이 되어 잡힌다. 원래 검출 상위와 줄인 사진 검출 상위를 겹치고,
// 줄인 사진에서만 앞에 선 별(원래 상위 근처에 없는 것)을 노랗게 표시한다.

const TOP = 60;
const COARSE_TOP = 40;
const ZOOM_PX = 150;
// 줄인 사진의 긴 변 (search/detectImage의 COARSE_LONG_SIDE와 같다)
const COARSE_LONG_SIDE = 480;

export default function MilkyWayCoarseDemo() {
  const [photo, setPhoto] = useState(MILKY_WAY_PHOTOS[0]);
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [found, setFound] = useState<{
    stars: DetectedStar[];
    coarse: DetectedStar[];
  } | null>(null);
  const [inspect, setInspect] = useState<DetectedStar | null>(null);
  const [running, setRunning] = useState(false);
  const [failed, setFailed] = useState(false);
  const canvas = useRef<HTMLCanvasElement>(null);
  const full = useRef<HTMLCanvasElement>(null);
  const small = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    let alive = true;

    setFound(null);
    setInspect(null);
    setFailed(false);
    setRunning(true);

    loadImage(photo.src)
      .then(async (img) => {
        if (!alive) return;

        setImage(img);

        const r = await detectPhotoStarsWithCoarse(img);

        if (alive) setFound({ stars: r.stars, coarse: r.coarse });
      })
      .catch(() => alive && setFailed(true))
      .finally(() => alive && setRunning(false));

    return () => {
      alive = false;
    };
  }, [photo]);

  // 줄인 사진 상위 중 원래 상위 60개의 어느 점과도 가깝지 않은 것 (대각선의 1.5%)
  const coarseOnly = useMemo(() => {
    if (!found || !image) return [];

    const near = Math.hypot(image.width, image.height) * 0.015;
    const top = found.stars.slice(0, TOP);

    return found.coarse
      .slice(0, COARSE_TOP)
      .filter((c) => top.every((s) => Math.hypot(s.x - c.x, s.y - c.y) > near));
  }, [found, image]);

  useEffect(() => {
    const context = canvas.current?.getContext("2d");

    if (!context || !image) return;

    context.drawImage(image, 0, 0);

    if (!found) return;

    const unit = Math.hypot(image.width, image.height) / 1400;

    context.lineWidth = 2.5 * unit;
    context.strokeStyle = "oklch(0.85 0.17 150)";

    for (const s of found.stars.slice(0, TOP)) {
      context.beginPath();
      context.arc(s.x, s.y, 10 * unit, 0, 2 * Math.PI);
      context.stroke();
    }

    for (const c of found.coarse.slice(0, COARSE_TOP)) {
      const only = coarseOnly.includes(c);

      context.lineWidth = (only ? 4 : 2) * unit;
      context.strokeStyle = only ? "#fde68a" : "rgba(103,232,249,0.8)";
      context.beginPath();
      context.arc(c.x, c.y, 18 * unit, 0, 2 * Math.PI);
      context.stroke();
    }

    if (inspect) {
      context.lineWidth = 3 * unit;
      context.strokeStyle = "#fff";
      context.beginPath();
      context.arc(inspect.x, inspect.y, 28 * unit, 0, 2 * Math.PI);
      context.stroke();
    }
  }, [image, found, coarseOnly, inspect]);

  // 고른 별 둘레를 원래 크기와 줄인 크기로 확대해 나란히
  useEffect(() => {
    const a = full.current?.getContext("2d");
    const b = small.current?.getContext("2d");

    if (!a || !b) return;

    a.clearRect(0, 0, ZOOM_PX, ZOOM_PX);
    b.clearRect(0, 0, ZOOM_PX, ZOOM_PX);

    if (!image || !inspect) return;

    const k = Math.max(
      2,
      Math.round(Math.max(image.width, image.height) / COARSE_LONG_SIDE),
    );
    const half = Math.round(
      Math.max(24, (Math.hypot(image.width, image.height) / 1400) * 40),
    );
    const sx = Math.round(inspect.x) - half;
    const sy = Math.round(inspect.y) - half;

    a.imageSmoothingEnabled = false;
    a.drawImage(image, sx, sy, half * 2, half * 2, 0, 0, ZOOM_PX, ZOOM_PX);

    const tiny = document.createElement("canvas");
    tiny.width = Math.max(1, Math.round((half * 2) / k));
    tiny.height = tiny.width;
    tiny
      .getContext("2d")!
      .drawImage(
        image,
        sx,
        sy,
        half * 2,
        half * 2,
        0,
        0,
        tiny.width,
        tiny.height,
      );
    b.imageSmoothingEnabled = false;
    b.drawImage(tiny, 0, 0, ZOOM_PX, ZOOM_PX);
  }, [image, inspect]);

  const handleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!image || !found) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const scale = Math.min(
      rect.width / image.width,
      rect.height / image.height,
    );
    const x =
      (e.clientX - rect.left - (rect.width - image.width * scale) / 2) / scale;
    const y =
      (e.clientY - rect.top - (rect.height - image.height * scale) / 2) / scale;
    const near = found.coarse
      .slice(0, COARSE_TOP)
      .reduce<DetectedStar | null>(
        (best, s) =>
          !best ||
          Math.hypot(s.x - x, s.y - y) < Math.hypot(best.x - x, best.y - y)
            ? s
            : best,
        null,
      );

    setInspect(near);
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="join flex-wrap">
        {MILKY_WAY_PHOTOS.map((p) => (
          <button
            key={p.src}
            className={cn(
              "btn join-item btn-sm",
              photo.src === p.src && "btn-active",
            )}
            onClick={() => setPhoto(p)}
          >
            {p.title}
          </button>
        ))}
      </div>
      <div className="grid items-start gap-3 md:grid-cols-[1fr_auto]">
        <div className="flex flex-col gap-2">
          <div className="rounded-box relative aspect-[4/3] overflow-hidden bg-black">
            <canvas
              ref={canvas}
              width={image?.width ?? 4}
              height={image?.height ?? 3}
              className="block h-full w-full cursor-pointer object-contain"
              onClick={handleClick}
            />
            {running && (
              <div className="absolute inset-0 grid place-items-center bg-black/40 text-sm">
                <span className="flex items-center gap-2">
                  <span className="loading loading-spinner loading-sm" />이
                  기기에서 원래 크기·줄인 크기로 별을 찾는 중…
                </span>
              </div>
            )}
            {failed && (
              <div
                role="alert"
                className="absolute inset-0 grid place-items-center bg-black/60 p-4 text-center text-sm"
              >
                이 사진에서 별을 찾지 못했어요. 다른 사진을 골라 보세요.
              </div>
            )}
          </div>
          <p className="min-h-[2lh] text-xs opacity-70">
            {found && (
              <>
                초록: 원래 크기에서 별다운 순 {TOP}개 · 하늘색: 줄인 사진에서{" "}
                {COARSE_TOP}개 · <b className="text-yellow-200">노랑</b>: 줄인
                사진에서만 앞에 선 점 {coarseOnly.length}개. 큰 원을 누르면
                확대해 봐요.
              </>
            )}
          </p>
        </div>
        <div className="flex flex-col gap-2 md:w-[17rem]">
          <div className="grid grid-cols-2 gap-2 text-center text-xs opacity-80">
            <div className="flex flex-col items-center gap-1">
              <canvas
                ref={full}
                width={ZOOM_PX}
                height={ZOOM_PX}
                className="rounded-box w-full bg-black"
              />
              원래 크기
            </div>
            <div className="flex flex-col items-center gap-1">
              <canvas
                ref={small}
                width={ZOOM_PX}
                height={ZOOM_PX}
                className="rounded-box w-full bg-black"
              />
              긴 변 480px로 줄이면
            </div>
          </div>
          <p className="text-xs opacity-70">
            빛무리가 넓은 별은 원래 크기에서는 넓고 흐린 얼룩이라
            &ldquo;주변보다 튀어나온 점&rdquo;으로 약하게 잡혀요. 줄이면 같은
            빛이 몇 칸에 모여 또렷한 점이 돼요.
          </p>
        </div>
      </div>
    </div>
  );
}
