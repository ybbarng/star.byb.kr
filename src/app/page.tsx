"use client";

import {useEffect, useRef, useState} from 'react'
import cv from '../services/cv'
import Delaunator from 'delaunator';

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
      const stars = await findStars(context);
      console.log(`별 수: ${stars.length}`);
      const triangles = await findTriangles(context, stars)
      console.log(`삼각형 수: ${triangles.length}`);
      const quadrilaterals = await createQuadrilateralExtraction(context, triangles);
      console.log(`사각형 수: ${quadrilaterals.length}`);
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
    const stars: {cx: number, cy: number, radius: number}[] = result.data.payload;

    stars.forEach(({cx, cy, radius}) => {
      // Render the stars to the canvas
      context.beginPath();
      context.arc(cx, cy, radius, 0, 2 * Math.PI);
      context.strokeStyle = 'red';
      context.lineWidth = 2;
      context.stroke();
    })

    return stars.map((star) => ({
      x: star.cx,
      y: star.cy
    }));
  }

  interface Point {
    x: number;
    y: number;
  }
  interface Triangle {
    p1: Point;
    p2: Point;
    p3: Point;
  }
  interface Quadrilateral {
    p1: Point;
    p2: Point;
    p3: Point;
    p4: Point;
  }
  async function findTriangles(context: CanvasRenderingContext2D, stars: {x: number, y: number}[]) {
    const useOpenCv = false; // 에러가 발생함
    let triangles: Triangle[] = [];
    if (useOpenCv) {
      triangles = await findTrianglesByOpenCv(stars);
    }
    triangles = await findTrianglesByLibrary(stars);

    // Draw triangles
    context.strokeStyle = 'blue';
    context.lineWidth = 1;

    triangles.forEach(({p1, p2, p3}: {p1: Point, p2: Point, p3: Point}) => {
      context.beginPath();
      context.moveTo(p1.x, p1.y);
      context.lineTo(p2.x, p2.y);
      context.lineTo(p3.x, p3.y);
      context.closePath();
      context.stroke();
    })
    return triangles;
  }

  async function findTrianglesByOpenCv(points: Point[]) {
    const result = await cv.findTriangles({
      points,
      width: SAMPLE_WIDTH,
      height: SAMPLE_HEIGHT
    });
    return result.data.payload as Triangle[];
  }

  async function findTrianglesByLibrary(points: Point[]) {
    const flattenedPoints = flattenPoints(points);
    const delaunay = new Delaunator(flattenedPoints);
    const triangles = delaunay.triangles;
    const result = [];
    for (let i = 0; i < triangles.length; i += 3) {
        const p1 = points[triangles[i]];
        const p2 = points[triangles[i + 1]];
        const p3 = points[triangles[i + 2]];
        result.push({p1, p2, p3});
    }
    return result;
  }

  async function createQuadrilateralExtraction(context: CanvasRenderingContext2D, triangles: Triangle[]) {
    // Store edges and their associated triangles
    const edges: {[key: string]: Triangle[]} = {};
    triangles.forEach((triangle) => {
      const {p1, p2, p3} = triangle;
      [[p1, p2], [p2, p3], [p3, p1]].forEach((points) => {
        const edgeKey = getEdgeKey(points[0], points[1]);
        if (!edges[edgeKey]) {
          edges[edgeKey] = [];
        }
        edges[edgeKey].push(triangle);
      })
    });
    const result: Quadrilateral[] = [];
    for (const edgeKey in edges) {
      if (edges[edgeKey].length !== 2) {
        continue;
      }
      const tri1 = edges[edgeKey][0];
      const tri2 = edges[edgeKey][1];
      const quad = [...new Set([tri1.p1, tri1.p2, tri1.p3, tri2.p1, tri2.p2, tri2.p3])];
      if (quad.length === 4) {
        result.push({
          p1: quad[0],
          p2: quad[1],
          p3: quad[2],
          p4: quad[3],
        })
      }
    }

    // Draw triangles
    context.strokeStyle = 'green';
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
    return result;
  }

  function flattenPoints(points: Point[]) {
    return points.flatMap(point => [point.x, point.y]);
  }

  function getEdgeKey(p1: Point, p2: Point) {
    const edge = [p1, p2].sort((a, b) => a.x - b.x || a.y - b.y);
    return `${edge[0].x},${edge[0].y}-${edge[1].x},${edge[1].y}`;
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
