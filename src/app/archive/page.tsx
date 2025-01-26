"use client";

import { ChangeEvent, useEffect, useRef, useState } from "react";
import useFindCandidates from "@/search/hooks/useFindCandidates";
import useFindNearestStars from "@/search/hooks/useFindNearestStars";
import { NearestStar2D, Point2D } from "@/search/type";
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
  const [selectedSampleId, setSelectedSampleId] = useState(0);
  const [selectedCandidateIndex, setSelectedCandidateIndex] = useState<
    number | undefined
  >(undefined);
  const [stars, setStars] = useState<Star[]>([]);
  const [nearestStars, setNearestStars] = useState<NearestStar2D[]>([]);
  const { find: findCandidates, candidates } = useFindCandidates();
  const { find: findNearestStars } = useFindNearestStars();

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
      loadImageToCanvas(context, imageElement.current);

      const stars = await findStars(context);
      console.log(`별 수: ${stars.length}`);
      setStars(stars);
    } catch (error) {
      console.error(error);
    } finally {
      setIsProcessing(false);
    }
  }

  async function plateSolving() {
    findCandidates({
      width: selectedSample.width,
      height: selectedSample.height,
      stars: stars.slice(0, 10).map((star) => [star.x, star.y]),
    });
  }

  function handleSelectChange(event: ChangeEvent<HTMLSelectElement>) {
    setSelectedSampleId(Number(event.target.value));
  }

  function handleSelectCandidateChange(event: ChangeEvent<HTMLSelectElement>) {
    setSelectedCandidateIndex(Number(event.target.value));
  }

  function loadImageToCanvas(
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

  async function handleFindNearestStarsButtonClicked() {
    if (
      !selectedSample ||
      candidates.length === 0 ||
      selectedCandidateIndex === undefined
    ) {
      return;
    }

    const selectedCandidate = candidates[selectedCandidateIndex];
    const selectedPhotoStars = selectedCandidate.input
      .map((starIndex) => stars[starIndex])
      .map((star) => ({
        position: [star.x, star.y] as Point2D,
      }));
    const candidateStars = selectedCandidate.output.map((item) => ({
      hr: item.hr,
    }));
    const nearestStars = findNearestStars({
      photo: {
        width: selectedSample.width,
        height: selectedSample.height,
        quad: selectedPhotoStars,
      },
      candidate: candidateStars,
    });
    setNearestStars(nearestStars);
  }

  useEffect(() => {
    if (!canvasElement.current || !imageElement.current) {
      console.log("Can't find elements");

      return;
    }

    const context = canvasElement.current.getContext("2d");

    if (!context) {
      console.log("Can't find context of canvas.");

      return;
    }

    loadImageToCanvas(context, imageElement.current);

    stars.forEach(({ x, y, radius }) => {
      // Render the stars to the canvas
      context.beginPath();
      context.arc(x, y, 5, 0, 2 * Math.PI);
      context.strokeStyle = "red";
      context.lineWidth = 2;
      context.stroke();

      if (radius > 1 && nearestStars.length < 1) {
        context.font = "bold 20px Arial";
        context.fillStyle = "#ff0000";
        context.fillText(`(${x.toFixed(2)}, ${y.toFixed(2)})`, x + 10, y + 10);
      }
    });

    if (candidates.length < 1 || selectedCandidateIndex === undefined) {
      return;
    }

    const selectedCandidate = candidates[selectedCandidateIndex];

    const [i1, i2, i3, i4] = selectedCandidate.input;
    const p1 = stars[i1];
    const p2 = stars[i2];
    const p3 = stars[i3];
    const p4 = stars[i4];

    context.strokeStyle = "green";
    context.lineWidth = 4;
    context.beginPath();
    context.moveTo(p1.x, p1.y);
    context.lineTo(p2.x, p2.y);
    context.lineTo(p3.x, p3.y);
    context.lineTo(p4.x, p4.y);
    context.closePath();
    context.stroke();

    if (nearestStars.length < 1) {
      return;
    }

    nearestStars.forEach(({ label, vector }) => {
      const [x, y] = vector;
      context.beginPath();
      context.arc(x, y, 10, 0, 2 * Math.PI);
      context.strokeStyle = "oklch(.606 .25 292.717)";
      context.lineWidth = 3;
      context.stroke();

      context.font = "bold 20px Arial";
      context.fillStyle = "oklch(.606 .25 292.717)";
      context.fillText(label, x + 16, y + 7);
    });
  }, [
    canvasElement,
    imageElement,
    stars,
    candidates,
    selectedCandidateIndex,
    nearestStars,
  ]);

  useEffect(() => {
    candidates.map((candidate) => {
      console.log(
        candidate.distance,
        candidate.input.map((item) => item).join(", "),
        " -> ",
        candidate.output.map((item) => item.label).join(", "),
      );
    });
  }, [candidates]);

  const aspectRatio = selectedSample.width / selectedSample.height;
  const detectButtonText = getDetectButtonText(isOpenCvReady, isProcessing);
  const plateSolvingButtonText = getPlateSolvingButtonText(stars.length > 0);

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
        <button
          disabled={stars.length < 1}
          className="h-10 w-40 rounded-lg bg-blue-500 font-bold"
          onClick={plateSolving}
        >
          {plateSolvingButtonText}
        </button>
        {candidates.length > 0 && (
          <form className="mx-auto max-w-sm">
            <label
              htmlFor="samples"
              className="mb-2 block text-sm font-medium text-gray-900 dark:text-white"
            >
              후보 별 사각형을 선택하세요
            </label>
            <select
              id="candidates"
              className="block w-full rounded-lg border border-gray-300 bg-gray-50 p-2.5 text-sm text-gray-900 focus:border-blue-500 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:placeholder-gray-400 dark:focus:border-blue-500 dark:focus:ring-blue-500"
              onChange={handleSelectCandidateChange}
              value={selectedCandidateIndex}
            >
              {candidates.map((candidate, i) => (
                <option key={i} value={i}>
                  {candidate.output.map((star) => star.label).join(", ")}
                </option>
              ))}
            </select>
          </form>
        )}
        {selectedCandidateIndex !== undefined && (
          <button
            className="h-10 w-40 rounded-lg bg-blue-500 font-bold"
            onClick={handleFindNearestStarsButtonClicked}
          >
            주변 별 찾기
          </button>
        )}
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

function getPlateSolvingButtonText(hasStars: boolean) {
  if (!hasStars) {
    return "별 찾기를 먼저 하세요.";
  }

  return "플레이트 솔빙";
}
