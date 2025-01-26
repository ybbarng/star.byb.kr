"use client";

import { useEffect, useRef, useState } from "react";
import { useContextStore } from "@/plate-solver/store/context";
import cv from "@/services/cv";

interface CanvasStar {
  x: number;
  y: number;
  radius: number;
}

export default function DetectStarStep() {
  const image = useContextStore((state) => state.image);
  const canvasElement = useRef<HTMLCanvasElement>(null);
  const [canvasStars, setCanvasStars] = useState<CanvasStar[]>([]);

  useEffect(() => {
    detectStars();
  }, []);

  async function detectStars() {
    if (!image || !canvasElement.current) {
      console.log("DOM을 찾지 못했습니다.");

      return;
    }

    const context = canvasElement.current.getContext("2d");

    if (!context) {
      console.log("Canvas의 context를 얻지 못했습니다.");

      return;
    }

    try {
      loadImageToCanvas(context, image);

      const stars = await findStars(context, image.width, image.height);
      console.log(`별 수: ${stars.length}`);
      setCanvasStars(stars);
    } catch (error) {
      console.error(error);
    }
  }

  function loadImageToCanvas(
    context: CanvasRenderingContext2D,
    imageElement: HTMLImageElement,
  ) {
    context.drawImage(
      imageElement,
      0,
      0,
      imageElement.width,
      imageElement.height,
    );
  }

  async function findStars(
    context: CanvasRenderingContext2D,
    width: number,
    height: number,
  ) {
    const image = context.getImageData(0, 0, width, height);
    // Processing image
    const result = await cv.findStars(image);
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

  useEffect(() => {
    if (!canvasElement.current || !image) {
      console.log("Can't find elements");

      return;
    }

    const context = canvasElement.current.getContext("2d");

    if (!context) {
      console.log("Can't find context of canvas.");

      return;
    }

    loadImageToCanvas(context, image);

    canvasStars.forEach(({ x, y, radius }) => {
      // Render the stars to the canvas
      context.beginPath();
      context.arc(x, y, 5, 0, 2 * Math.PI);
      context.strokeStyle = "red";
      context.lineWidth = 2;
      context.stroke();

      if (radius > 1) {
        context.font = "bold 20px Arial";
        context.fillStyle = "#ff0000";
        context.fillText(`(${x.toFixed(2)}, ${y.toFixed(2)})`, x + 10, y + 10);
      }
    });
  }, [canvasElement, image, canvasStars]);

  if (!image || !image.width) {
    return (
      <div className="flex h-[800px] w-full items-center justify-center">
        <span className="loading loading-spinner loading-lg"></span>
      </div>
    );
  }

  return (
    <div className="flex justify-center">
      <canvas
        className="max-h-[800px]"
        ref={canvasElement}
        width={image.width}
        height={image.height}
        style={{
          aspectRatio: image.width / image.height,
        }}
      />
    </div>
  );
}
