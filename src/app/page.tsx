"use client";

import {useEffect, useRef, useState} from 'react'
import cv from '../services/cv'

const SAMPLE_SRC ="/samples/ursa-major.jpg";
const SAMPLE_WIDTH =1152;
const SAMPLE_HEIGHT =819;

/**
 * What we're going to render is:
 *
 * 1. A video component so the user can see what's on the camera.
 *
 * 2. A button to generate an image of the video, load OpenCV and
 * process the image.
 *
 * 3. A canvas to allow us to capture the image of the video and
 * show it to the user.
 */
export default function Page() {
  const [isOpenCvReady, setOpenCvReady] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const imageElement = useRef<HTMLImageElement>(null)
  const canvasElement = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const init = async () => {
      await cv.load();
      setOpenCvReady(true);
    }
    init();
  }, [setOpenCvReady])

  /**
   * In the onClick event we'll capture a frame within
   * the video to pass it to our service.
   */
  async function onClick() {
    if (!imageElement.current || !canvasElement.current) {
      console.log("Can't find elements");
      return;
    }
    const context = canvasElement.current.getContext('2d')
    if (!context) {
      console.log("Can't find context of canvas.");
      return;
    }
    setIsProcessing(true)

    try {
      await loadImageToCanvas(context, imageElement.current);
      await findStars(context);
    } catch (error) {
      console.error(error);
    }
    finally {
      setIsProcessing(false)
    }
  }

  async function loadImageToCanvas(context: CanvasRenderingContext2D, imageElement: HTMLImageElement) {
    context.drawImage(imageElement, 0, 0, SAMPLE_WIDTH, SAMPLE_HEIGHT)
  }

  async function findStars(context: CanvasRenderingContext2D) {
    const image = context.getImageData(0, 0, SAMPLE_WIDTH, SAMPLE_HEIGHT)
    // Processing image
    const result = await cv.findStars(image);
    const stars = result.data.payload;
    console.log(stars);

    stars.forEach(({cx, cy, radius}: {cx: number, cy: number, radius: number}) => {
      // Render the stars to the canvas
      context.beginPath();
      context.arc(cx, cy, radius, 0, 2 * Math.PI);
      context.strokeStyle = 'red';
      context.lineWidth = 2;
      context.stroke();
    })
  }

  const aspectRatio = SAMPLE_WIDTH / SAMPLE_HEIGHT;
  const buttonText = getButtonText(isOpenCvReady, isProcessing);

  return (
    <div className="flex flex-col items-start p-4 gap-5">
      <button
        disabled={!isOpenCvReady || isProcessing}
        className="bg-blue-500 rounded-lg w-40 py-3 font-bold"
        onClick={onClick}
      >
        {buttonText}
      </button>
      <div className="columns-2">
        <img src={SAMPLE_SRC} className="w-full" ref={imageElement} style={{
          aspectRatio: aspectRatio,
        }}/>
        <canvas
          className="grow w-full" ref={canvasElement} width={SAMPLE_WIDTH} height={SAMPLE_HEIGHT} style={{
          aspectRatio: aspectRatio,
        }} />
      </div>
    </div>
  )
}

function getButtonText(isOpenCvReady: boolean, isProcessing: boolean) {
  if (!isOpenCvReady) {
    return "준비 중...";
  }
  return isProcessing ? "별 찾는 중...": "별 찾기";
}
