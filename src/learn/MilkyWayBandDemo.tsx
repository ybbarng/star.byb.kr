"use client";

import type { DetectedStar } from "@/plate-solver/detectPhotoStars";
import { useEffect, useMemo, useRef, useState } from "react";
import { loadImage } from "@/learn/demoAssets";
import {
  findBandLines,
  makeGlow,
  planeResidual,
  skyMask,
} from "@/learn/milkyWayBand";
import { MILKY_WAY_PHOTOS } from "@/learn/milkyWayPhotos";
import { detectPhotoStars } from "@/plate-solver/detectPhotoStars";
import { toGray } from "@/search/detectImage";
import { cn } from "@/utils/cn";

// 은하수 띠의 중심선 찾기 (journey 50장): 사진을 가로 96칸으로 흐리게 줄여 하늘 칸에서 밝기 평면을 빼고,
// "선 둘레 띠의 평균 − 바깥 평균"이 큰 직선을 후보로 고른다. 띠 중심(은위 0°)은 큰 원이라 보통 사진에서 직선이다.

interface Band {
  lines: { theta: number; rho: number; score: number }[];
  res: Float32Array;
  mask: Uint8Array;
  cols: number;
  rows: number;
}

const computeBand = (image: HTMLImageElement, stars: DetectedStar[]): Band => {
  const c = document.createElement("canvas");
  c.width = image.width;
  c.height = image.height;
  const context = c.getContext("2d")!;
  context.drawImage(image, 0, 0);
  const rgba = context.getImageData(0, 0, image.width, image.height).data;
  const glow = makeGlow(
    toGray(rgba, image.width, image.height),
    image.width,
    image.height,
  );
  const mask = skyMask(stars, image.width, image.height, glow.cols, glow.rows);
  const res = planeResidual(glow.data, glow.cols, glow.rows, mask);

  return {
    lines: findBandLines(res, glow.cols, glow.rows, mask),
    res,
    mask,
    cols: glow.cols,
    rows: glow.rows,
  };
};

export default function MilkyWayBandDemo() {
  const [photo, setPhoto] = useState(MILKY_WAY_PHOTOS[0]);
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [band, setBand] = useState<Band | null>(null);
  const [pick, setPick] = useState(0);
  const [running, setRunning] = useState(false);
  const [failed, setFailed] = useState(false);
  const canvas = useRef<HTMLCanvasElement>(null);
  const heat = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    let alive = true;

    setBand(null);
    setPick(0);
    setFailed(false);
    setRunning(true);

    loadImage(photo.src)
      .then(async (img) => {
        if (!alive) return;

        setImage(img);

        const stars = await detectPhotoStars(img);

        if (alive) setBand(computeBand(img, stars));
      })
      .catch(() => alive && setFailed(true))
      .finally(() => alive && setRunning(false));

    return () => {
      alive = false;
    };
  }, [photo]);

  // 사진 위에 후보 선들과 고른 선의 띠(±8%)를 그린다
  useEffect(() => {
    const context = canvas.current?.getContext("2d");

    if (!context || !image) return;

    context.drawImage(image, 0, 0);

    if (!band) return;

    const W = image.width;
    const H = image.height;
    const cell = W / band.cols;
    const reach = Math.hypot(W, H);
    const unit = reach / 1400;

    band.lines.forEach((ln, i) => {
      const th = (ln.theta * Math.PI) / 180;
      const n = [Math.cos(th), Math.sin(th)];
      const foot = [W / 2 + ln.rho * cell * n[0], H / 2 + ln.rho * cell * n[1]];
      const t = [-n[1], n[0]];
      const a = [foot[0] - reach * t[0], foot[1] - reach * t[1]];
      const b = [foot[0] + reach * t[0], foot[1] + reach * t[1]];

      if (i === pick) {
        context.strokeStyle = "rgba(129,140,248,0.22)";
        context.lineWidth = 2 * 0.08 * Math.min(band.cols, band.rows) * cell;
        context.beginPath();
        context.moveTo(a[0], a[1]);
        context.lineTo(b[0], b[1]);
        context.stroke();
      }

      context.strokeStyle =
        i === pick ? "oklch(0.85 0.17 280)" : "rgba(255,255,255,0.35)";
      context.lineWidth = (i === pick ? 4 : 2) * unit;
      context.setLineDash(i === pick ? [] : [10 * unit, 8 * unit]);
      context.beginPath();
      context.moveTo(a[0], a[1]);
      context.lineTo(b[0], b[1]);
      context.stroke();
      context.setLineDash([]);
    });
  }, [image, band, pick]);

  // 계산에 쓴 "평면을 뺀 흐린 밝기"(하늘 칸만, 밝을수록 노랗게)
  const range = useMemo(() => {
    if (!band) return null;

    let lo = Infinity;
    let hi = -Infinity;

    band.res.forEach((v, k) => {
      if (band.mask[k]) {
        lo = Math.min(lo, v);
        hi = Math.max(hi, v);
      }
    });

    return { lo, hi };
  }, [band]);

  useEffect(() => {
    const context = heat.current?.getContext("2d");

    if (!context || !band || !range) return;

    const img = context.createImageData(band.cols, band.rows);

    for (let k = 0; k < band.res.length; k++) {
      const t = band.mask[k]
        ? (band.res[k] - range.lo) / Math.max(1e-6, range.hi - range.lo)
        : 0;
      img.data[k * 4] = band.mask[k] ? 40 + 215 * t : 20;
      img.data[k * 4 + 1] = band.mask[k] ? 30 + 190 * t * t : 20;
      img.data[k * 4 + 2] = band.mask[k] ? 90 * (1 - t) + 20 : 30;
      img.data[k * 4 + 3] = 255;
    }

    context.putImageData(img, 0, 0);
  }, [band, range]);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="join">
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
        <div className="join">
          {Array.from({ length: 5 }, (_, i) => (
            <button
              key={i}
              disabled={!band || i >= band.lines.length}
              className={cn(
                "btn join-item btn-sm",
                pick === i && "btn-primary",
              )}
              onClick={() => setPick(i)}
            >
              후보 {i + 1}
            </button>
          ))}
        </div>
      </div>
      <div className="grid items-start gap-3 md:grid-cols-[1fr_auto]">
        <div className="rounded-box relative aspect-[4/3] overflow-hidden bg-black">
          <canvas
            ref={canvas}
            width={image?.width ?? 4}
            height={image?.height ?? 3}
            className="block h-full w-full object-contain"
          />
          {running && (
            <div className="absolute inset-0 grid place-items-center bg-black/40 text-sm">
              <span className="flex items-center gap-2">
                <span className="loading loading-spinner loading-sm" />이
                기기에서 띠를 찾는 중…
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
        <div className="flex flex-col gap-2 md:w-[15rem]">
          <canvas
            ref={heat}
            width={band?.cols ?? 96}
            height={band?.rows ?? 64}
            className="rounded-box w-full bg-black [image-rendering:pixelated]"
          />
          <p className="text-xs opacity-70">
            사진을 가로 96칸으로 흐리게 줄이고, 지평선 빛·광해처럼 한쪽으로 기운
            밝기(평면)를 뺀 모습이에요. 검출이 없는 칸(지상)은 어둡게 비웠어요.
          </p>
          {band?.lines[pick] && (
            <p className="text-xs opacity-70">
              후보 {pick + 1}: 띠 안이 바깥보다 평균{" "}
              {band.lines[pick].score.toFixed(1)}만큼 밝아요.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
