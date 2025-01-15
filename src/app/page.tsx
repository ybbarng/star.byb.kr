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
    const processedImage = await cv.imageProcessing(image)
    // Render the processed image to the canvas
    ctx.putImageData(processedImage.data.payload, 0, 0)
    updateProcessing(false)
  }

  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        flexDirection: 'column',
      }}
    >
      <img src={SAMPLE_SRC} width={SAMPLE_WIDTH} height={SAMPLE_HEIGHT} ref={imageElement} />
      <button
        disabled={processing}
        style={{width: SAMPLE_WIDTH, padding: 10}}
        onClick={onClick}
      >
        {processing ? 'Processing...' : 'Take a photo'}
      </button>
      <canvas
        ref={canvasElement}
        width={SAMPLE_WIDTH}
        height={SAMPLE_HEIGHT}
      ></canvas>
    </div>
  )
}
