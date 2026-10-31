"use client";

import type { DetectedStar } from "@/plate-solver/detectPhotoStars";
import type { SolvePhotoResult } from "@/search/solvePhoto";
import { useEffect, useRef, useState } from "react";
import { loadImage } from "@/learn/demoAssets";
import { MILKY_WAY_PHOTOS } from "@/learn/milkyWayPhotos";
import { detectPhotoStars } from "@/plate-solver/detectPhotoStars";
import { solveInWorker } from "@/search/solverClient";
import { cn } from "@/utils/cn";

// 잘라서 보기 (journey 53·55장): 광각 은하수 사진은 가장자리가 직선투영에서 벗어나 사진 전체로는 모양이 어긋나지만,
// 조각 하나는 맞는다. 조각을 누르면 그 안의 별만으로 앱과 같은 풀이를 돌린다.

// 조각 [x, y, 너비, 높이] (사진 크기 비율). 앱의 조각 단계(search/solvePhoto.ts TILES)와 같은 순서·크기다
const TILES: { rect: [number, number, number, number]; label: string }[] = [
  { rect: [0.25, 0.25, 0.5, 0.5], label: "가운데 절반" },
  { rect: [0, 0, 0.5, 0.5], label: "왼쪽 위" },
  { rect: [0.5, 0, 0.5, 0.5], label: "오른쪽 위" },
  { rect: [0, 0.5, 0.5, 0.5], label: "왼쪽 아래" },
  { rect: [0.5, 0.5, 0.5, 0.5], label: "오른쪽 아래" },
  { rect: [0, 0, 0.5, 1], label: "왼쪽 반" },
  { rect: [0.5, 0, 0.5, 1], label: "오른쪽 반" },
];

type TileResult =
  | { state: "solving" }
  | { state: "done"; found: boolean; confidence: number; timeMs: number }
  | { state: "failed" };

export default function MilkyWayTileDemo() {
  const [photo, setPhoto] = useState(MILKY_WAY_PHOTOS[0]);
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [stars, setStars] = useState<DetectedStar[] | null>(null);
  const [results, setResults] = useState<Record<number, TileResult>>({});
  const [pick, setPick] = useState(0);
  const [failed, setFailed] = useState(false);
  const canvas = useRef<HTMLCanvasElement>(null);
  // 사진을 바꾸면 이전 사진의 늦은 풀이 결과는 버린다
  const photoNo = useRef(0);
  const solving = Object.values(results).some((r) => r.state === "solving");

  useEffect(() => {
    let alive = true;

    photoNo.current++;
    setStars(null);
    setResults({});
    setFailed(false);

    loadImage(photo.src)
      .then(async (img) => {
        if (!alive) return;

        setImage(img);

        const found = await detectPhotoStars(img);

        if (alive) setStars(found);
      })
      .catch(() => alive && setFailed(true));

    return () => {
      alive = false;
    };
  }, [photo]);

  useEffect(() => {
    const context = canvas.current?.getContext("2d");

    if (!context || !image) return;

    context.drawImage(image, 0, 0);

    const unit = Math.hypot(image.width, image.height) / 1400;

    TILES.forEach((t, i) => {
      const r = results[i];
      const [fx, fy, fw, fh] = t.rect;
      const solved = r?.state === "done" && r.found;
      const missed = r?.state === "done" && !r.found;

      if (i !== pick && !solved && !missed) return;

      context.lineWidth = (i === pick ? 5 : 3) * unit;
      context.strokeStyle = solved
        ? "oklch(0.85 0.17 150)"
        : missed
          ? "oklch(0.7 0.18 25)"
          : "#fde68a";
      context.setLineDash(i === pick ? [] : [12 * unit, 8 * unit]);
      context.strokeRect(
        fx * image.width + 4 * unit,
        fy * image.height + 4 * unit,
        fw * image.width - 8 * unit,
        fh * image.height - 8 * unit,
      );
      context.setLineDash([]);
    });
  }, [image, results, pick]);

  const solveTile = (i: number) => {
    if (!image || !stars) return;

    const no = photoNo.current;
    const [fx, fy, fw, fh] = TILES[i].rect;
    const x0 = fx * image.width;
    const y0 = fy * image.height;
    const w = fw * image.width;
    const h = fh * image.height;
    const inside = stars
      .filter((s) => s.x >= x0 && s.x < x0 + w && s.y >= y0 && s.y < y0 + h)
      .map((s) => ({
        x: s.x - x0,
        y: s.y - y0,
        brightness: s.brightness,
        ringContrast: s.ringContrast,
        trail: s.trail,
        chord: s.chord,
      }));

    setPick(i);
    setResults((r) => ({ ...r, [i]: { state: "solving" } }));

    solveInWorker(inside, w, h)
      .then((out: SolvePhotoResult) => {
        if (no !== photoNo.current) return;

        setResults((r) => ({
          ...r,
          [i]: {
            state: "done",
            found: out.found,
            confidence: out.confidence,
            timeMs: out.timeMs,
          },
        }));
      })
      .catch(() => {
        if (no === photoNo.current) {
          setResults((r) => ({ ...r, [i]: { state: "failed" } }));
        }
      });
  };

  const current = results[pick];

  return (
    <div className="flex flex-col gap-3">
      <div className="join flex-wrap">
        {MILKY_WAY_PHOTOS.map((p) => (
          <button
            key={p.src}
            disabled={solving}
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
      <div className="flex flex-wrap gap-2">
        {TILES.map((t, i) => {
          const r = results[i];

          return (
            <button
              key={t.label}
              disabled={!stars || solving}
              className={cn(
                "btn btn-sm",
                r?.state === "done" && r.found && "btn-success",
                r?.state === "done" && !r.found && "btn-error btn-outline",
                pick === i && !r && "btn-warning",
              )}
              onClick={() => solveTile(i)}
            >
              {i + 1}. {t.label}
              {r?.state === "solving" && (
                <span className="loading loading-spinner loading-xs" />
              )}
            </button>
          );
        })}
      </div>
      <div className="rounded-box relative aspect-[4/3] overflow-hidden bg-black">
        <canvas
          ref={canvas}
          width={image?.width ?? 4}
          height={image?.height ?? 3}
          className="block h-full w-full object-contain"
        />
        {!stars && !failed && (
          <div className="absolute inset-0 grid place-items-center bg-black/40 text-sm">
            <span className="flex items-center gap-2">
              <span className="loading loading-spinner loading-sm" />이 기기에서
              별을 찾는 중…
            </span>
          </div>
        )}
        {failed && (
          <div
            role="alert"
            className="absolute inset-0 grid place-items-center bg-black/60 p-4 text-center text-sm"
          >
            사진을 불러오지 못했어요. 다른 사진을 골라 보세요.
          </div>
        )}
      </div>
      <p className="min-h-[2lh] text-xs opacity-70">
        {!current &&
          "조각 단추를 누르면 그 조각 안의 별만으로 앱과 같은 풀이를 돌려요 (최대 8초)."}
        {current?.state === "solving" &&
          `${TILES[pick].label} 조각을 푸는 중… (최대 8초)`}
        {current?.state === "done" &&
          (current.found
            ? `${TILES[pick].label}: 찾았어요 (우연일 확률 10^-${current.confidence.toFixed(0)}, ${(current.timeMs / 1000).toFixed(1)}초).`
            : `${TILES[pick].label}: 이 조각만으로는 확신하지 못했어요 (${(current.timeMs / 1000).toFixed(1)}초). 다른 조각을 눌러 보세요.`)}
        {current?.state === "failed" &&
          "풀이 Worker가 멈췄어요. 새로고침해 보세요."}
      </p>
    </div>
  );
}
