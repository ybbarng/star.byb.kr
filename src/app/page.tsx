"use client";

import { ChangeEvent, useEffect, useRef, useState } from "react";
import cv from "@/services/cv";
import samples from "@/services/samples";

interface Star {
  x: number;
  y: number;
  radius: number;
}

export default function Page() {
  const [isOpenCvReady, setOpenCvReady] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedSampleId, setSelectedSampleId] = useState(13);
  const [stars, setStars] = useState<Star[]>([]);
  const imageElement = useRef<HTMLImageElement>(null);
  const canvasElement = useRef<HTMLCanvasElement>(null);
  const selectedSample = samples[selectedSampleId];

  useEffect(() => {
    const init = async () => {
      await cv.load();
      setOpenCvReady(true);
    };

    init();
  }, [setOpenCvReady]);

  /**
   * In the onClick event we'll capture a frame within
   * the video to pass it to our service.
   */
  async function detectStars() {
    if (!imageElement.current || !canvasElement.current) {
      console.log("Can't find elements");

      return;
    }

    const context = canvasElement.current.getContext("2d");

    if (!context) {
      console.log("Can't find context of canvas.");

      return;
    }

    setIsProcessing(true);

    try {
      await loadImageToCanvas(context, imageElement.current);

      const stars = await findStars(context);
      console.log(`별 수: ${stars.length}`);
      setStars(stars);
    } catch (error) {
      console.error(error);
    } finally {
      setIsProcessing(false);
    }
  }

  function handleSelectChange(event: ChangeEvent<HTMLSelectElement>) {
    setSelectedSampleId(parseInt(event.target.value, 10));
  }

  async function loadImageToCanvas(
    context: CanvasRenderingContext2D,
    imageElement: HTMLImageElement,
  ) {
    context.drawImage(
      imageElement,
      0,
      0,
      selectedSample.width,
      selectedSample.height,
    );
  }

  async function findStars(context: CanvasRenderingContext2D) {
    const image = context.getImageData(
      0,
      0,
      selectedSample.width,
      selectedSample.height,
    );
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
    if (!canvasElement.current) {
      console.log("Can't find elements");

      return;
    }

    const context = canvasElement.current.getContext("2d");

    if (!context) {
      console.log("Can't find context of canvas.");

      return;
    }

    stars.forEach(({ x, y, radius }) => {
      // Render the stars to the canvas
      context.beginPath();
      context.arc(x, y, radius, 0, 2 * Math.PI);
      context.strokeStyle = "red";
      context.lineWidth = 2;
      context.stroke();

      if (radius > 1) {
        context.font = "bold 20px Arial";
        context.fillStyle = "#ff0000";
        context.fillText(`(${x.toFixed(2)}, ${y.toFixed(2)})`, x + 10, y + 10);
      }
    });
  }, [stars]);

  const aspectRatio = selectedSample.width / selectedSample.height;
  const detectButtonText = getDetectButtonText(isOpenCvReady, isProcessing);

  return (
    <div className="flex flex-col items-start gap-5 p-4">
      <div className="flex flex-row items-end gap-4">
        <form className="mx-auto max-w-sm">
          <label
            htmlFor="samples"
            className="mb-2 block text-sm font-medium text-gray-900 dark:text-white"
          >
            샘플을 선택하세요
          </label>
          <select
            id="samples"
            className="block w-full rounded-lg border border-gray-300 bg-gray-50 p-2.5 text-sm text-gray-900 focus:border-blue-500 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:placeholder-gray-400 dark:focus:border-blue-500 dark:focus:ring-blue-500"
            onChange={handleSelectChange}
            value={selectedSampleId}
          >
            {samples.map((sample, i) => (
              <option key={i} value={i}>
                {sample.src.split("/").pop()}
              </option>
            ))}
          </select>
        </form>
        <button
          disabled={!isOpenCvReady || isProcessing}
          className="h-10 w-40 rounded-lg bg-blue-500 font-bold"
          onClick={detectStars}
        >
          {detectButtonText}
        </button>
      </div>
      <div className="columns-2">
        <img
          src={selectedSample.src}
          className="w-full"
          ref={imageElement}
          style={{
            aspectRatio: aspectRatio,
          }}
        />
        <canvas
          className="w-full grow"
          ref={canvasElement}
          width={selectedSample.width}
          height={selectedSample.height}
          style={{
            aspectRatio: aspectRatio,
          }}
        />
      </div>
    </div>
  );
}

function getDetectButtonText(isOpenCvReady: boolean, isProcessing: boolean) {
  if (!isOpenCvReady) {
    return "준비 중...";
  }

  return isProcessing ? "별 찾는 중..." : "별 찾기";
}
