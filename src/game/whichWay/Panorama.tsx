"use client";

import type { WhichWayRound } from "@/game/whichWay/problem";
import { useEffect, useRef } from "react";
import {
  altAzInFrame,
  PHOTO_H,
  PHOTO_W,
  photoAim,
  photoOutline,
  photoToSkyFn,
  roundFrame,
} from "@/game/whichWay/problem";
import {
  drawWarped,
  PANO_ALT_BOTTOM,
  PANO_ALT_TOP,
  panoXY,
  strokeOutline,
} from "@/game/whichWay/skyMap";
import { PHOTO_COLORS } from "@/game/whichWay/SkyMapBoard";

// 사진 테두리를 이어 붙인 파노라마: 가로는 방위(북 → 동 → 남 → 서 → 북), 세로는 고도.
// 한 바퀴 둘러선 모습이라, 사진이 서로 어디쯤 이어지는지 보인다.

const W = 1440;
const H = 400;
const LABELS = [
  [0, "북"],
  [45, "북동"],
  [90, "동"],
  [135, "남동"],
  [180, "남"],
  [225, "남서"],
  [270, "서"],
  [315, "북서"],
  [360, "북"],
] as const;

export default function Panorama({
  round,
  photos,
}: {
  round: WhichWayRound;
  photos: HTMLCanvasElement[];
}) {
  const canvas = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const ctx = canvas.current?.getContext("2d");

    if (!ctx) {
      return;
    }

    const frame = roundFrame(round);
    const horizonY =
      ((PANO_ALT_TOP - 0) / (PANO_ALT_TOP - PANO_ALT_BOTTOM)) * H;

    // 바탕: 하늘과 땅, 고도 30°·60° 점선
    ctx.fillStyle = "#070b1c";
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = "#0b0c10";
    ctx.fillRect(0, horizonY, W, H - horizonY);
    ctx.strokeStyle = "rgba(170,190,255,0.18)";
    ctx.setLineDash([3, 6]);

    for (const alt of [30, 60]) {
      const y = ((PANO_ALT_TOP - alt) / (PANO_ALT_TOP - PANO_ALT_BOTTOM)) * H;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(W, y);
      ctx.stroke();
    }

    ctx.setLineDash([]);

    // 사진: 이음매(북)를 넘는 사진은 왼쪽·오른쪽에 한 번씩 더 그린다
    round.photos.forEach((p, i) => {
      const toSky = photoToSkyFn(p.TP);
      const ref = photoAim(p).azDeg;
      const to = (x: number, y: number) =>
        panoXY(altAzInFrame(toSky(x, y), frame), W, H, ref);
      const outline = photoOutline(p.TP, 16).map((v) =>
        panoXY(altAzInFrame(v, frame), W, H, ref),
      );

      for (const shift of [-W, 0, W]) {
        ctx.save();
        ctx.translate(shift, 0);
        drawWarped(ctx, photos[i], PHOTO_W, PHOTO_H, to, 12, 9);
        ctx.strokeStyle = PHOTO_COLORS[i % PHOTO_COLORS.length];
        ctx.lineWidth = 3;
        strokeOutline(ctx, outline, W / 2);
        ctx.restore();
      }
    });

    // 지평선과 방위
    ctx.strokeStyle = "rgba(255,255,255,0.5)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(0, horizonY);
    ctx.lineTo(W, horizonY);
    ctx.stroke();
    ctx.font = "bold 20px Arial";
    ctx.textAlign = "center";

    for (const [az, label] of LABELS) {
      const x = Math.min(W - 20, Math.max(20, (az / 360) * W));
      ctx.fillStyle = "rgba(0,0,0,0.6)";
      ctx.fillRect(x - 26, H - 30, 52, 26);
      ctx.fillStyle = az % 90 === 0 ? "#fde68a" : "rgba(255,255,255,0.8)";
      ctx.fillText(label, x, H - 10);
    }

    ctx.textAlign = "start";
  }, [round, photos]);

  return (
    <div className="flex flex-col gap-1">
      <canvas
        ref={canvas}
        width={W}
        height={H}
        className="rounded-box block w-full bg-black"
      />
      <div className="text-xs opacity-60">
        한 바퀴 둘러선 파노라마 · 가로는 방위(북 → 동 → 남 → 서), 세로는 고도
        (위 끝이 머리 꼭대기)
      </div>
    </div>
  );
}
