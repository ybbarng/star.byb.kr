"use client";

import Konva from "konva";
import { useEffect, useRef, useState } from "react";
import { Stage, Layer, Rect } from "react-konva";
import SelectableStarMarker from "@/plate-solver/SelectableStarMarker";
import StepMover from "@/plate-solver/StepMover";
import { useContextStore } from "@/plate-solver/store/context";
import cv from "@/services/cv";

interface CanvasStar {
  x: number;
  y: number;
  radius: number;
  id: string;
  isSelected: boolean;
}

interface SelectArea {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  visible: boolean;
}

export default function DetectStarStep() {
  const image = useContextStore((state) => state.image);
  const setPhotoStars = useContextStore((state) => state.setPhotoStars);
  const [canvasStars, setCanvasStars] = useState<CanvasStar[]>([]);
  const [isSelecting, setIsSelecting] = useState(false);
  const [selectArea, setSelectArea] = useState<SelectArea>({
    x1: 0,
    x2: 0,
    y1: 0,
    y2: 0,
    visible: false,
  });
  const stageRef = useRef<Konva.Stage>(null);

  useEffect(() => {
    detectStars();
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (canvasStars.length < 1) {
        return;
      }

      if (event.key === "Delete" || event.key === "Backspace") {
        setCanvasStars(canvasStars.filter((star) => !star.isSelected));

        return;
      }

      if (event.key === "Escape") {
        setCanvasStars(
          canvasStars.map((star) => ({ ...star, isSelected: false })),
        );

        return;
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [canvasStars]);

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
          isSelected: false,
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
        isSelected: false,
      },
    ]);
  };

  const onPositionUpdate = (id: string, x: number, y: number) => {
    setCanvasStars(
      canvasStars.map((star) => {
        if (star.id === id) {
          return {
            ...star,
            x,
            y,
          };
        }

        return {
          ...star,
        };
      }),
    );
  };

  const removeStar = (id: string) => {
    setCanvasStars(canvasStars.filter((star) => star.id !== id));
  };

  const selectStar = (id: string) => {
    setCanvasStars(
      canvasStars.map((star) => ({
        ...star,
        isSelected: star.id === id ? true : star.isSelected,
      })),
    );
  };

  const handleDoubleClick = (e: Konva.KonvaEventObject<MouseEvent>) => {
    // 이벤트에서 얻어온 값과 마우스 포인터로 클릭한 곳의 오차가 있어서 보정
    addStar(e.evt.offsetX - 1, e.evt.offsetY - 3);
  };

  const handleDragStart = () => {
    if (!stageRef.current) {
      return;
    }

    const position = stageRef.current.getPointerPosition();

    if (!position) {
      return;
    }

    setIsSelecting(true);

    setSelectArea({
      x1: position.x,
      y1: position.y,
      x2: position.x,
      y2: position.y,
      visible: false,
    });
  };

  const handleDragMove = () => {
    if (!stageRef.current || !isSelecting) {
      return;
    }

    const position = stageRef.current.getPointerPosition();

    if (!position) {
      return;
    }

    setSelectArea({
      ...selectArea,
      x2: position.x,
      y2: position.y,
      visible: true,
    });
  };

  const handleDragEnd = () => {
    if (!stageRef.current || !isSelecting) {
      return;
    }

    const position = stageRef.current.getPointerPosition();

    if (!position) {
      return;
    }

    setIsSelecting(false);
    setSelectArea({
      ...selectArea,
      x2: position.x,
      y2: position.y,
      visible: false,
    });

    const select = stageRef.current.find(".select")[0];
    const stars = stageRef.current.find(".star");
    const box = select.getClientRect();
    const selected = stars
      .filter((star) => Konva.Util.haveIntersection(box, star.getClientRect()))
      .map((star) => star.id());

    if (selected.length < 1) {
      return;
    }

    setCanvasStars(
      canvasStars.map((star) => ({
        ...star,
        isSelected: selected.includes(star.id),
      })),
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
    <div className="flex h-full w-full flex-col gap-4">
      <div className="flex h-full w-full justify-center overflow-auto">
        <div>
          <div
            style={{
              backgroundImage: `url(${image.src})`,
            }}
          >
            <Stage
              ref={stageRef}
              width={image.width}
              height={image.height}
              onDblClick={handleDoubleClick}
              onMouseDown={handleDragStart}
              onTouchStart={handleDragStart}
              onMouseMove={handleDragMove}
              onTouchMove={handleDragMove}
              onMouseUp={handleDragEnd}
              onTouchEnd={handleDragEnd}
            >
              <Layer>
                {canvasStars.map((star) => (
                  <SelectableStarMarker
                    key={star.id}
                    id={star.id}
                    x={star.x}
                    y={star.y}
                    isSelected={star.isSelected}
                    onPositionUpdate={onPositionUpdate}
                    remove={removeStar}
                    select={selectStar}
                  />
                ))}
                <Rect
                  name="select"
                  x={Math.min(selectArea.x1, selectArea.x2)}
                  y={Math.min(selectArea.y1, selectArea.y2)}
                  width={Math.abs(selectArea.x1 - selectArea.x2)}
                  height={Math.abs(selectArea.y1 - selectArea.y2)}
                  visible={selectArea.visible}
                  fill="rgba(0,0,255,0.5)"
                  listening={false}
                />
              </Layer>
            </Stage>
          </div>
        </div>
      </div>
      <StepMover
        disableNext={canvasStars.length < 1}
        onBeforeNext={onBeforeNext}
      />
    </div>
  );
}
