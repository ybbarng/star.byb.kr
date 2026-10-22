"use client";

import type { DetectedStar } from "@/plate-solver/detectPhotoStars";
import { useEffect, useRef, useState } from "react";
import RingInspector from "@/learn/RingInspector";
import { detectPhotoStars } from "@/plate-solver/detectPhotoStars";
import { STARLIKE_RING_CONTRAST } from "@/search/utils/selectStars";
import { cn } from "@/utils/cn";

// 별 찾기 데모: 실제 샘플 사진에서 별을 찾고, "밝은 순"과 "별다운 순" 상위 30개를 비교한다.
// 밝기만 보면 건물·가로등 불빛이 앞에 오고, 별다움(주변 고리가 고른 하늘인지)을 먼저 보면 진짜 별이 앞에 온다.

const DEMO_PHOTOS = [
  {
    src: "/samples/20220607-berry-seoul.jpg",
    title: "서울 근처 산 (누각 불빛)",
  },
  { src: "/samples/big-dipper.jpg", title: "북두칠성 (나무)" },
];
const TOP = 30;

type Order = "brightness" | "priority";

// 밝은 순은 검출 크기(유효 반경) 순, 별다운 순은 detectPhotoStars가 돌려준 순서 그대로
const pickTop = (stars: DetectedStar[], order: Order) =>
  order === "priority"
    ? stars.slice(0, TOP)
    : [...stars].sort((a, b) => b.brightness - a.brightness).slice(0, TOP);

export default function FindStarsDemo() {
  const [photo, setPhoto] = useState(DEMO_PHOTOS[0]);
  const [order, setOrder] = useState<Order>("brightness");
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [stars, setStars] = useState<DetectedStar[] | null>(null);
  const [running, setRunning] = useState(false);
  const [inspect, setInspect] = useState<DetectedStar | null>(null);
  const canvas = useRef<HTMLCanvasElement>(null);

  // 사진을 바꾸면 불러오고 바로 별을 찾는다
  useEffect(() => {
    let alive = true;
    const img = new Image();

    setStars(null);
    setInspect(null);
    setRunning(true);

    img.onload = () => {
      if (!alive) return;

      setImage(img);
      detectPhotoStars(img)
        .then((found) => alive && setStars(found))
        .finally(() => alive && setRunning(false));
    };

    img.src = photo.src;

    return () => {
      alive = false;
    };
  }, [photo]);

  useEffect(() => {
    const context = canvas.current?.getContext("2d");

    if (!context || !image) return;

    context.drawImage(image, 0, 0);

    if (!stars) return;

    const picked = pickTop(stars, order);
    const unit = Math.hypot(image.width, image.height) / 1400;

    context.lineWidth = 3 * unit;
    context.strokeStyle =
      order === "priority" ? "oklch(0.85 0.17 150)" : "oklch(0.75 0.19 30)";

    for (const s of picked) {
      context.beginPath();
      context.arc(s.x, s.y, 14 * unit, 0, 2 * Math.PI);
      context.stroke();
    }

    if (inspect) {
      context.lineWidth = 4 * unit;
      context.strokeStyle = "#fde68a";
      context.beginPath();
      context.arc(inspect.x, inspect.y, 22 * unit, 0, 2 * Math.PI);
      context.stroke();
    }
  }, [image, stars, order, inspect]);

  // 누른 곳에서 가장 가까운 표시된 점을 들여다본다
  const handleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!image || !stars) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * image.width;
    const y = ((e.clientY - rect.top) / rect.height) * image.height;
    const near = pickTop(stars, order).reduce<DetectedStar | null>(
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
      <div className="flex flex-wrap items-center gap-2">
        <div className="join">
          {DEMO_PHOTOS.map((p) => (
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
          <button
            className={cn(
              "btn join-item btn-sm",
              order === "brightness" && "btn-warning",
            )}
            onClick={() => setOrder("brightness")}
          >
            밝은 순 {TOP}개
          </button>
          <button
            className={cn(
              "btn join-item btn-sm",
              order === "priority" && "btn-success",
            )}
            onClick={() => setOrder("priority")}
          >
            별다운 순 {TOP}개
          </button>
        </div>
      </div>
      <div className="grid items-start gap-3 md:grid-cols-[1fr_auto]">
        <div className="flex flex-col gap-2">
          <div className="rounded-box relative overflow-hidden bg-black">
            <canvas
              ref={canvas}
              width={image?.width ?? 4}
              height={image?.height ?? 3}
              className="block h-auto w-full cursor-pointer"
              onClick={handleClick}
            />
            {running && (
              <div className="absolute inset-0 grid place-items-center bg-black/40 text-sm">
                <span className="flex items-center gap-2">
                  <span className="loading loading-spinner loading-sm" />이
                  기기에서 별을 찾는 중…
                </span>
              </div>
            )}
          </div>
          {stars && (
            <p className="text-xs opacity-70">
              찾은 점 {stars.length}개 중 상위 {TOP}개.{" "}
              {order === "brightness"
                ? "밝기만 보면 건물·나무 사이 불빛이 앞자리를 차지해요."
                : "주변이 고른 하늘인 점을 먼저 고르면 진짜 별이 앞으로 와요."}
            </p>
          )}
        </div>
        {/* 점을 고르기 전에도 자리를 잡아 둬서, 눌러도 배치가 움직이지 않는다 */}
        <div className="md:w-[17rem]">
          {image && (
            <RingInspector
              image={image}
              star={inspect}
              starlike={STARLIKE_RING_CONTRAST}
            />
          )}
        </div>
      </div>
    </div>
  );
}
