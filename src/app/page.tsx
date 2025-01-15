"use client";

import {useRef, useState} from 'react'
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
  const [processing, updateProcessing] = useState(false)
  const imageElement = useRef<HTMLImageElement>(null)
  const canvasElement = useRef<HTMLCanvasElement>(null)

  /**
   * In the onClick event we'll capture a frame within
   * the video to pass it to our service.
   */
  async function onClick() {
    if (!imageElement.current || !canvasElement.current) {
      console.log("Can't find elements");
      return;
    }
    updateProcessing(true)

    const ctx = canvasElement.current.getContext('2d')
    if (!ctx) {
      updateProcessing(false)
      return;
    }
    ctx.drawImage(imageElement.current, 0, 0, SAMPLE_WIDTH, SAMPLE_HEIGHT)
    const image = ctx.getImageData(0, 0, SAMPLE_WIDTH, SAMPLE_HEIGHT)
    // Load the model
    await cv.load()
    // Processing image
    const result = await cv.findStars(image);
    const stars = result.data.payload;
    console.log(stars);

    stars.forEach(({cx, cy, radius}: {cx: number, cy: number, radius: number}) => {
      // Render the stars to the canvas
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, 2 * Math.PI);
      ctx.strokeStyle = 'red';
      ctx.lineWidth = 2;
      ctx.stroke();
    })
    updateProcessing(false)
  }

  const aspectRatio = SAMPLE_WIDTH / SAMPLE_HEIGHT;

  return (
    <div className="flex flex-col items-start p-4 gap-5">
      <button
        disabled={processing}
        className="bg-blue-500 rounded-lg w-40 py-3 font-bold"
        onClick={onClick}
      >
        {processing ? '별 찾는 중...' : '별 찾기'}
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
