"use client";

import type { DetectedStar } from "@/plate-solver/detectPhotoStars";
import { useEffect, useRef, useState } from "react";
import { loadImage } from "@/learn/demoAssets";
import RingInspector from "@/learn/RingInspector";
import { detectPhotoStars } from "@/plate-solver/detectPhotoStars";
import { STARLIKE_RING_CONTRAST } from "@/search/utils/selectStars";
import { cn } from "@/utils/cn";

// 테크 블로그 전용 사본 (사이트에는 쓰지 않는다): learn/FindStarsDemo에서 사진 이름 "증선"을 "정선"으로 바로잡았다
// (파일 이름 jeungseun은 정선 jeongseon의 오타).
// 별 찾기 데모: 실제 샘플 사진에서 별을 찾고, "밝은 순"과 "별다운 순" 상위 30개를 비교한다.
// 밝기만 보면 건물·가로등 불빛이 앞에 오고, 별다움(주변 고리가 고른 하늘인지)을 먼저 보면 진짜 별이 앞에 온다.

// 밝은 순으로 고르면 가짜가 앞자리를 차지하는 사진들 (괄호 안: 밝은 순 → 별다운 순, 앞쪽 25개 안 진짜 별 수)
const DEMO_PHOTOS = [
  // 1 → 13
  { src: "/samples/20220607-berry-seoul.jpg", title: "누각 (지붕·불빛)" },
  // 1 → 22: 조명 받은 나무 줄기
  { src: "/samples/20250117-carl-aurora-03.jpg", title: "오로라 (나무 줄기)" },
  // 2 → 21
  { src: "/samples/20250117-carl-aurora-01.jpg", title: "오로라 (집 불빛)" },
  // 0 → 24
  { src: "/samples/20230904-nike-jeungseun-01.png", title: "정선 (구름·노을)" },
];
const TOP = 30;

type Order = "brightness" | "priority";

// 밝은 순은 검출 크기(유효 반경) 순, 별다운 순은 detectPhotoStars가 돌려준 순서 그대로
const pickTop = (stars: DetectedStar[], order: Order) =>
  order === "priority"
    ? stars.slice(0, TOP)
    : stars
        .filter((s) => !s.trail)
        .sort((a, b) => b.brightness - a.brightness)
        .slice(0, TOP);

// score: 발표 화면은 별다움을 클수록 별다운 점수로 보여 준다 (RingInspector)
export default function FindStarsDemo({ score = false }: { score?: boolean }) {
  const [photo, setPhoto] = useState(DEMO_PHOTOS[0]);
  const [order, setOrder] = useState<Order>("brightness");
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [stars, setStars] = useState<DetectedStar[] | null>(null);
  const [running, setRunning] = useState(false);
  const [failed, setFailed] = useState(false);
  const [inspect, setInspect] = useState<DetectedStar | null>(null);
  const canvas = useRef<HTMLCanvasElement>(null);

  // 사진을 바꾸면 불러오고 바로 별을 찾는다. 사진을 못 받거나 별 찾기가 실패하면 실패를 알린다
  useEffect(() => {
    let alive = true;

    setStars(null);
    setInspect(null);
    setFailed(false);
    setRunning(true);

    loadImage(photo.src)
      .then((img) => {
        if (!alive) return;

        setImage(img);

        return detectPhotoStars(img).then((found) => alive && setStars(found));
      })
      .catch(() => alive && setFailed(true))
      .finally(() => alive && setRunning(false));

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

    // 사진은 4:3 칸 안에 비율을 지켜 들어가 있어(object-contain) 남는 여백을 빼고 잰다
    const rect = e.currentTarget.getBoundingClientRect();
    const scale = Math.min(
      rect.width / image.width,
      rect.height / image.height,
    );
    const left = rect.left + (rect.width - image.width * scale) / 2;
    const top = rect.top + (rect.height - image.height * scale) / 2;
    const x = (e.clientX - left) / scale;
    const y = (e.clientY - top) / scale;
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
          {/* 사진마다 비율이 달라도 칸 크기는 4:3 그대로 둔다 */}
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
                  기기에서 별을 찾는 중…
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
          {/* 찾는 중에도 줄을 비워 두어 높이가 바뀌지 않게 한다 */}
          <p className="min-h-[2lh] text-xs opacity-70">
            {stars && (
              <>
                찾은 점 {stars.length}개 중 상위 {TOP}개.{" "}
                {order === "brightness"
                  ? "밝기만 보면 건물·나무 사이 불빛이 앞자리를 차지해요."
                  : "주변이 고른 하늘인 점을 먼저 고르면 진짜 별이 앞으로 와요."}
              </>
            )}
          </p>
        </div>
        {/* 점을 고르기 전에도 자리를 잡아 둬서, 눌러도 배치가 움직이지 않는다 */}
        <div className="md:w-[17rem]">
          <RingInspector
            image={image}
            star={inspect}
            starlike={STARLIKE_RING_CONTRAST}
            score={score}
          />
        </div>
      </div>
    </div>
  );
}
