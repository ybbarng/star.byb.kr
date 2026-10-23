"use client";

import type { AltAz, WhichWayRound } from "@/game/whichWay/problem";
import type { Point2D } from "@/scripts/hash/types";
import { useEffect, useMemo, useRef } from "react";
import { drawAllSky } from "@/game/tonight/drawAllSky";
import {
  PHOTO_H,
  PHOTO_W,
  photoAim,
  photoOutline,
  photoToSkyFn,
  roundFrame,
} from "@/game/whichWay/problem";
import {
  altAzToMap,
  drawWarped,
  mapRadius,
  mapToAltAz,
  strokeOutline,
  vecToMap,
} from "@/game/whichWay/skyMap";

// 전천 하늘 지도: 누르면 고른 사진의 표시가 그 자리에 놓인다. 채점 뒤에는 사진들을 실제 자리에 휘어 펴 보여 준다.

export const PHOTO_COLORS = [
  "#fbbf24",
  "#38bdf8",
  "#f472b6",
  "#34d399",
  "#a78bfa",
];

const SIZE = 760;

export default function SkyMapBoard({
  round,
  guesses,
  selected,
  revealed,
  photos,
  highlights,
  onPlace,
}: {
  round: WhichWayRound;
  guesses: (AltAz | null)[];
  selected: number;
  revealed: boolean;
  photos: HTMLCanvasElement[] | null;
  highlights: string[];
  onPlace: (aim: AltAz) => void;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const frame = useMemo(() => roundFrame(round), [round]);
  const outlines = useMemo(
    () => round.photos.map((p) => photoOutline(p.TP, 16)),
    [round],
  );

  useEffect(() => {
    const ctx = canvas.current?.getContext("2d");

    if (!ctx) {
      return;
    }

    ctx.clearRect(0, 0, SIZE, SIZE);
    drawAllSky(ctx, {
      size: SIZE,
      t: round.date.getTime(),
      observer: round.observer,
      highlights,
      labels: true,
    });

    const toMap = (v: Parameters<typeof vecToMap>[0]) =>
      vecToMap(v, frame, SIZE);
    const R = mapRadius(SIZE);

    // 채점 뒤: 사진을 실제 자리에 (지평선 아래 땅은 지도 밖이라 잘린다)
    if (revealed) {
      if (photos) {
        ctx.save();
        ctx.beginPath();
        ctx.arc(SIZE / 2, SIZE / 2, R, 0, Math.PI * 2);
        ctx.clip();
        ctx.globalAlpha = 0.85;

        round.photos.forEach((p, i) => {
          const toSky = photoToSkyFn(p.TP);
          drawWarped(ctx, photos[i], PHOTO_W, PHOTO_H, (x, y) =>
            toMap(toSky(x, y)),
          );
        });

        ctx.restore();
      }

      round.photos.forEach((p, i) => {
        const color = PHOTO_COLORS[i % PHOTO_COLORS.length];
        ctx.strokeStyle = color;
        ctx.lineWidth = 3;
        strokeOutline(ctx, outlines[i].map(toMap), SIZE / 3);

        const aim = altAzToMap(photoAim(p), SIZE);
        const guess = guesses[i];

        if (guess) {
          const g = altAzToMap(guess, SIZE);
          ctx.setLineDash([6, 6]);
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(g[0], g[1]);
          ctx.lineTo(aim[0], aim[1]);
          ctx.stroke();
          ctx.setLineDash([]);
        }

        drawCross(ctx, aim, color);
      });
    }

    // 내가 찍은 자리
    guesses.forEach((g, i) => {
      if (g) {
        drawPin(
          ctx,
          altAzToMap(g, SIZE),
          PHOTO_COLORS[i % PHOTO_COLORS.length],
          String(i + 1),
          !revealed && i === selected,
        );
      }
    });
  }, [round, frame, outlines, guesses, selected, revealed, photos, highlights]);

  const onClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (revealed) {
      return;
    }

    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * SIZE;
    const y = ((e.clientY - rect.top) / rect.height) * SIZE;
    const R = mapRadius(SIZE);

    // 지평선 밖으로 너무 멀리 누르면 무시 (조금 밖은 지평선에 붙인다)
    if (Math.hypot(x - SIZE / 2, y - SIZE / 2) > R * 1.12) {
      return;
    }

    onPlace(mapToAltAz(x, y, SIZE));
  };

  return (
    <canvas
      ref={canvas}
      width={SIZE}
      height={SIZE}
      className={
        revealed
          ? "block aspect-square w-full"
          : "block aspect-square w-full cursor-crosshair"
      }
      onClick={onClick}
    />
  );
}

const drawPin = (
  ctx: CanvasRenderingContext2D,
  [x, y]: Point2D,
  color: string,
  label: string,
  active: boolean,
) => {
  ctx.save();

  if (active) {
    ctx.strokeStyle = "rgba(255,255,255,0.9)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(x, y, 22, 0, Math.PI * 2);
    ctx.stroke();
  }

  ctx.fillStyle = color;
  ctx.strokeStyle = "rgba(0,0,0,0.6)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(x, y, 15, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = "#111";
  ctx.font = "bold 17px Arial";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(label, x, y + 1);
  ctx.restore();
};

const drawCross = (
  ctx: CanvasRenderingContext2D,
  [x, y]: Point2D,
  color: string,
) => {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(x - 10, y);
  ctx.lineTo(x + 10, y);
  ctx.moveTo(x, y - 10);
  ctx.lineTo(x, y + 10);
  ctx.stroke();
  ctx.restore();
};
