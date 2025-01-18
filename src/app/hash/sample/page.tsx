"use client";

import samplePhoto from "@hash/data/sample-photo.json";
import {useEffect, useRef } from 'react'
import samples from "@/services/samples";
import {useThreeScene} from "@/app/hash/sample/hooks/useThreeScene";
import {useThreeStars} from "@/app/hash/sample/hooks/useThreeStars";
import "./style.css";

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
  const imageElement = useRef<HTMLImageElement>(null)
  const canvasElement = useRef<HTMLCanvasElement>(null)
  const mountRef = useRef<HTMLDivElement>(null);
  const { scene } = useThreeScene(mountRef);
  const { stars, labels } = useThreeStars();
  const photo = samples[13];

  useEffect(() => {
    const init = async () => {
      if (!imageElement.current || !canvasElement.current) {
        return;
      }
      const context = canvasElement.current.getContext('2d')
      if (!context) {
        console.log("Can't find context of canvas.");
        return;
      }
      await loadImageToCanvas(context, imageElement.current);

      const stars = await findStars(context);
      console.log(`별 수: ${stars.length}`);

      const quadrilaterals = await createQuadrilaterals(context, stars);
      console.log(`사각형 수: ${quadrilaterals.length}`);
    }
    init();
  }, [imageElement, canvasElement])

  useEffect(() => {
    if (!scene || !stars || !labels) {
      return;
    }
    console.log(stars);
    scene.add(stars);
    labels.forEach((label) => {
      scene.add(label);
    })
  }, [scene, stars, labels]);

  async function loadImageToCanvas(context: CanvasRenderingContext2D, imageElement: HTMLImageElement) {
    context.drawImage(imageElement, 0, 0, photo.width, photo.height)
  }

  async function findStars(context: CanvasRenderingContext2D) {
    const stars = samplePhoto;

    stars.forEach(([x, y, radius]) => {
      // Render the stars to the canvas
      context.beginPath();
      context.arc(x, y, radius, 0, 2 * Math.PI);
      context.strokeStyle = 'red';
      context.lineWidth = 2;
      context.stroke();

      context.font = "bold 20px Arial";
      context.fillStyle = "#ff0000";
      context.fillText(`(${x.toFixed(2)}, ${y.toFixed(2)})`, x + 10, y + 10);
    })

    return stars.map((star) => ({
      x: star[0],
      y: star[1],
    }));
  }

  interface Point {
    x: number;
    y: number;
  }

  interface Quadrilateral {
    p1: Point;
    p2: Point;
    p3: Point;
    p4: Point;
  }

  async function createQuadrilaterals(context: CanvasRenderingContext2D, stars: Point[]) {
    const result: Quadrilateral[] = findQuadrilateralsAll(stars);

    // Draw triangles
    context.strokeStyle = 'blue';
    context.lineWidth = 1;

    result.forEach(({p1, p2, p3, p4}: Quadrilateral) => {
      context.beginPath();
      context.moveTo(p1.x, p1.y);
      context.lineTo(p2.x, p2.y);
      context.lineTo(p3.x, p3.y);
      context.lineTo(p4.x, p4.y);
      context.closePath();
      context.stroke();
    })

    // 사각형 한 개를 하이라이트
    const {p1, p2, p3, p4} = result[0];
    context.strokeStyle = 'green';
    context.lineWidth = 4;
    context.beginPath();
    context.moveTo(p1.x, p1.y);
    context.lineTo(p2.x, p2.y);
    context.lineTo(p3.x, p3.y);
    context.lineTo(p4.x, p4.y);
    context.closePath();
    context.stroke();

    return result;
  }

  // hash/quadrilateral
  // TODO: 같은 코드를 공유하도록 리팩토링
  const findQuadrilateralsAll = (stars: Point[]): Quadrilateral[] => {
    const result = [];
    for (let s1 = 0; s1 < stars.length - 3; s1++) {
      for (let s2 = s1 + 1; s2 < stars.length - 2; s2++) {
        for (let s3 = s2 + 1; s3 < stars.length - 1; s3++) {
          for (let s4 = s3 + 1; s4 < stars.length; s4++) {
            result.push({
              p1: stars[s1],
              p2: stars[s2],
              p3: stars[s3],
              p4: stars[s4],
            });
          }
        }
      }
    }
    return result;
  }

  const aspectRatio = photo.width / photo.height;

  return (
    <div className="flex flex-col items-start p-4 gap-5">
      <div className="columns-2">
        <canvas
          className="grow w-full" ref={canvasElement} width={photo.width} height={photo.height} style={{
          aspectRatio: aspectRatio,
        }}/>
        <div className="grow w-full" width={photo.width} height={photo.height} ref={mountRef} style={{
          aspectRatio: aspectRatio,
        }}></div>
      </div>
      <img src={photo.src} className="hidden" ref={imageElement} style={{
        aspectRatio: aspectRatio,
      }}/>
    </div>
  )
}
