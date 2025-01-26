"use client";

import Konva from "konva";
import { useEffect, useState } from "react";
import { Stage, Layer, Ring, Image } from "react-konva";
import StepMover from "@/plate-solver/StepMover";
import { useContextStore } from "@/plate-solver/store/context";
import cv from "@/services/cv";

interface CanvasStar {
  x: number;
  y: number;
  radius: number;
  id: string;
  isDragging: boolean;
}

export default function DetectStarStep() {
  const image = useContextStore((state) => state.image);
  const setPhotoStars = useContextStore((state) => state.setPhotoStars);
  const [canvasStars, setCanvasStars] = useState<CanvasStar[]>([]);

  useEffect(() => {
    detectStars();
  }, []);

  async function detectStars() {
    if (!image) {
      console.log("DOM을 찾지 못했습니다.");

      return;
    }

    try {
      const imageData = loadImageData(image);

      const stars = await findStars(imageData);
      console.log(`별 수: ${stars.length}`);
      setCanvasStars(
        stars.map((star) => ({
          ...star,
          id: crypto.randomUUID(),
          isDragging: false,
        })),
      );
    } catch (error) {
      console.error(error);
    }
  }

  function loadImageData(imageElement: HTMLImageElement) {
    const width = imageElement.width;
    const height = imageElement.height;

    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");

    if (context === null) {
      throw new Error("canvas의 context를 얻을 수 없습니다.");
    }

    canvas.width = width;
    canvas.height = height;
    context.drawImage(imageElement, 0, 0, width, height);

    return context.getImageData(0, 0, width, height);
  }

  async function findStars(imageData: ImageData) {
    // Processing image
    const result = await cv.findStars(imageData);
    let stars: { cx: number; cy: number; radius: number }[] =
      result.data.payload;
    stars = stars.sort((a, b) => b.radius - a.radius);
    stars = stars.slice(0, 100);

    return stars.map((star) => ({
      x: star.cx,
      y: star.cy,
      radius: star.radius,
    }));
  }

  const addStar = (x: number, y: number) => {
    setCanvasStars([
      ...canvasStars,
      {
        id: crypto.randomUUID(),
        x,
        y,
        radius: 1.5,
        isDragging: false,
      },
    ]);
  };

  const removeStar = (id: string) => {
    setCanvasStars(canvasStars.filter((star) => star.id !== id));
  };

  const handleDoubleClickImage = (e: Konva.KonvaEventObject<DragEvent>) => {
    // 이벤트에서 얻어온 값과 마우스 포인터로 클릭한 곳의 오차가 있어서 보정
    addStar(e.evt.offsetX - 1, e.evt.offsetY - 3);
  };

  const handleDoubleClickRing = (e: Konva.KonvaEventObject<DragEvent>) => {
    const id = e.target.id();
    removeStar(id);
  };

  const handleDragStart = (e: Konva.KonvaEventObject<DragEvent>) => {
    const id = e.target.id();
    setCanvasStars(
      canvasStars.map((star) => {
        return {
          ...star,
          isDragging: star.id === id,
        };
      }),
    );
  };

  const handleDragEnd = () => {
    setCanvasStars(
      canvasStars.map((star) => {
        return {
          ...star,
          isDragging: false,
        };
      }),
    );
  };

  const onBeforeNext = async () => {
    setPhotoStars(
      canvasStars.map((star) => ({
        x: star.x,
        y: star.y,
      })),
    );
  };

  if (!image || !image.width) {
    return (
      <div className="flex w-full flex-col gap-4">
        <div className="flex h-[800px] w-full items-center justify-center">
          <span className="loading loading-spinner loading-lg"></span>
        </div>
        <StepMover disableNext={true} />
      </div>
    );
  }

  return (
    <div className="flex w-full flex-col gap-4">
      <div className="flex justify-center">
        <div
          style={{
            backgroundImage: `url(${image.src})`,
          }}
        >
          <Stage
            width={image.width}
            height={image.height}
            onDblClick={handleDoubleClickImage}
          >
            <Layer>
              {canvasStars.map((star) => (
                <Ring
                  key={star.id}
                  id={star.id}
                  x={star.x}
                  y={star.y}
                  innerRadius={12}
                  outerRadius={25}
                  fill="oklch(0.704 0.191 22.216)"
                  opacity={0.5}
                  draggable
                  shadowColor="black"
                  shadowBlur={10}
                  shadowOpacity={0.6}
                  shadowOffsetX={star.isDragging ? 10 : 5}
                  shadowOffsetY={star.isDragging ? 10 : 5}
                  scaleX={star.isDragging ? 1.2 : 1}
                  scaleY={star.isDragging ? 1.2 : 1}
                  onDblClick={handleDoubleClickRing}
                  onDragStart={handleDragStart}
                  onDragEnd={handleDragEnd}
                />
              ))}
            </Layer>
          </Stage>
        </div>
      </div>
      <StepMover
        disableNext={canvasStars.length < 1}
        onBeforeNext={onBeforeNext}
      />
    </div>
  );
}
