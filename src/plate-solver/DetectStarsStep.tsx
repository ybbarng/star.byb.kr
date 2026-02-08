"use client";

import Konva from "konva";
import { useCallback, useEffect, useRef, useState } from "react";
import { Stage, Layer, Rect, Image as KonvaImage } from "react-konva";
import SelectableStarMarker from "@/plate-solver/SelectableStarMarker";
import StepMover from "@/plate-solver/StepMover";
import { useContextStore } from "@/plate-solver/store/context";
import cv from "@/services/cv";

interface CanvasStar {
  x: number;
  y: number;
  brightness: number;
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
  const photoStars = useContextStore((state) => state.photoStars);
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
  const containerRef = useRef<HTMLDivElement>(null);
  const [stageScale, setStageScale] = useState(1);
  const [stagePos, setStagePos] = useState({ x: 0, y: 0 });
  const [containerSize, setContainerSize] = useState({
    width: 0,
    height: 0,
  });
  const [mode, setMode] = useState<"select" | "move">("select");
  const [isPanning, setIsPanning] = useState(false);
  const panStartRef = useRef({ x: 0, y: 0 });
  const spaceHeldRef = useRef(false);

  useEffect(() => {
    // store에 이미 별 데이터가 있으면 복원, 없으면 새로 검출
    if (photoStars.length > 0) {
      setCanvasStars(
        photoStars.map((star) => ({
          x: star.x,
          y: star.y,
          brightness: star.brightness,
          id: crypto.randomUUID(),
          isSelected: false,
        })),
      );
    } else {
      detectStars();
    }
  }, []);

  // 컨테이너 크기 측정 & 초기 스케일 계산
  useEffect(() => {
    if (!containerRef.current || !image) return;

    const updateSize = () => {
      const { clientWidth, clientHeight } = containerRef.current!;
      setContainerSize({ width: clientWidth, height: clientHeight });

      const scale = Math.min(
        clientWidth / image.width,
        clientHeight / image.height,
        1,
      );
      setStageScale(scale);
      setStagePos({
        x: (clientWidth - image.width * scale) / 2,
        y: (clientHeight - image.height * scale) / 2,
      });
    };

    updateSize();
    const observer = new ResizeObserver(updateSize);
    observer.observe(containerRef.current);

    return () => observer.disconnect();
  }, [image]);

  // 스페이스바: 누르는 동안 이동 모드
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === " " && !spaceHeldRef.current) {
        event.preventDefault();
        spaceHeldRef.current = true;
        setMode("move");
      }

      if (canvasStars.length < 1) return;

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

    const handleKeyUp = (event: KeyboardEvent) => {
      if (event.key === " ") {
        spaceHeldRef.current = false;
        setMode("select");
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [canvasStars]);

  // 스크린 좌표 → 이미지 좌표 변환
  const getImagePointerPosition = (): { x: number; y: number } | null => {
    const stage = stageRef.current;
    if (!stage) return null;
    const pos = stage.getPointerPosition();
    if (!pos) return null;

    return {
      x: (pos.x - stage.x()) / stage.scaleX(),
      y: (pos.y - stage.y()) / stage.scaleY(),
    };
  };

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
    let stars: { cx: number; cy: number; brightness: number }[] =
      result.data.payload;
    stars = stars.sort((a, b) => b.brightness - a.brightness);
    stars = stars.slice(0, 100);

    return stars.map((star) => ({
      x: star.cx,
      y: star.cy,
      brightness: star.brightness,
    }));
  }

  const addStar = (x: number, y: number) => {
    setCanvasStars([
      ...canvasStars,
      {
        id: crypto.randomUUID(),
        x,
        y,
        brightness: 0,
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

  const handleWheel = (e: Konva.KonvaEventObject<WheelEvent>) => {
    e.evt.preventDefault();
    const stage = stageRef.current;
    if (!stage) return;

    const oldScale = stage.scaleX();
    const pointer = stage.getPointerPosition();
    if (!pointer) return;

    const scaleBy = 1.1;
    const newScale = e.evt.deltaY < 0 ? oldScale * scaleBy : oldScale / scaleBy;
    const clampedScale = Math.max(0.05, Math.min(10, newScale));

    // 커서 위치를 기준으로 줌
    const mousePointTo = {
      x: (pointer.x - stage.x()) / oldScale,
      y: (pointer.y - stage.y()) / oldScale,
    };

    setStageScale(clampedScale);
    setStagePos({
      x: pointer.x - mousePointTo.x * clampedScale,
      y: pointer.y - mousePointTo.y * clampedScale,
    });
  };

  const handleDoubleClick = () => {
    if (mode === "move") return;
    const pos = getImagePointerPosition();
    if (pos) addStar(pos.x, pos.y);
  };

  // --- 선택 모드 핸들러 ---
  const handleSelectDragStart = () => {
    const pos = getImagePointerPosition();
    if (!pos) return;

    setIsSelecting(true);
    setSelectArea({
      x1: pos.x,
      y1: pos.y,
      x2: pos.x,
      y2: pos.y,
      visible: false,
    });
  };

  const handleSelectDragMove = () => {
    if (!isSelecting) return;
    const pos = getImagePointerPosition();
    if (!pos) return;

    setSelectArea({
      ...selectArea,
      x2: pos.x,
      y2: pos.y,
      visible: true,
    });
  };

  const handleSelectDragEnd = () => {
    if (!isSelecting) return;
    const pos = getImagePointerPosition();
    if (!pos) return;

    setIsSelecting(false);
    setSelectArea({
      ...selectArea,
      x2: pos.x,
      y2: pos.y,
      visible: false,
    });

    const select = stageRef.current?.find(".select")[0];
    const stars = stageRef.current?.find(".star");
    if (!select || !stars) return;

    const box = select.getClientRect();
    const selected = stars
      .filter((star) => Konva.Util.haveIntersection(box, star.getClientRect()))
      .map((star) => star.id());

    if (selected.length < 1) return;

    setCanvasStars(
      canvasStars.map((star) => ({
        ...star,
        isSelected: selected.includes(star.id),
      })),
    );
  };

  // --- 이동 모드 핸들러 ---
  const handlePanStart = () => {
    const stage = stageRef.current;
    if (!stage) return;
    const pointer = stage.getPointerPosition();
    if (!pointer) return;

    setIsPanning(true);
    panStartRef.current = {
      x: pointer.x - stagePos.x,
      y: pointer.y - stagePos.y,
    };
  };

  const handlePanMove = () => {
    if (!isPanning) return;
    const stage = stageRef.current;
    if (!stage) return;
    const pointer = stage.getPointerPosition();
    if (!pointer) return;

    setStagePos({
      x: pointer.x - panStartRef.current.x,
      y: pointer.y - panStartRef.current.y,
    });
  };

  const handlePanEnd = () => {
    setIsPanning(false);
  };

  // --- 통합 핸들러: 모드에 따라 분기 ---
  const handleDragStart = useCallback(() => {
    if (mode === "move") handlePanStart();
    else handleSelectDragStart();
  }, [mode, canvasStars, stagePos]);

  const handleDragMove = useCallback(() => {
    if (mode === "move" || isPanning) handlePanMove();
    else handleSelectDragMove();
  }, [mode, isPanning, isSelecting, selectArea, stagePos]);

  const handleDragEnd = useCallback(() => {
    if (mode === "move" || isPanning) handlePanEnd();
    else handleSelectDragEnd();
  }, [mode, isPanning, isSelecting, selectArea, canvasStars]);

  const onBeforeNext = async () => {
    const sorted = [...canvasStars].sort((a, b) => b.brightness - a.brightness);
    setPhotoStars(
      sorted.map((star) => ({
        x: star.x,
        y: star.y,
        brightness: star.brightness,
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
      <div className="flex flex-row items-center justify-between gap-2">
        <span className="text-sm">
          마커 {canvasStars.length}개
          {stageScale !== 1 && ` · ${Math.round(stageScale * 100)}%`}
        </span>
        <div className="flex gap-2">
          <div className="join">
            <button
              className={`btn join-item btn-sm ${mode === "select" ? "btn-active" : ""}`}
              onClick={() => setMode("select")}
              title="선택 모드 (Space 누르면 이동)"
            >
              선택
            </button>
            <button
              className={`btn join-item btn-sm ${mode === "move" ? "btn-active" : ""}`}
              onClick={() => setMode("move")}
              title="이동 모드"
            >
              이동
            </button>
          </div>
          <button
            className="btn btn-error btn-sm"
            disabled={canvasStars.length < 1}
            onClick={() => setCanvasStars([])}
          >
            전체 삭제
          </button>
        </div>
      </div>
      <div
        ref={containerRef}
        className="h-full w-full overflow-hidden"
        style={{
          cursor:
            mode === "move" ? (isPanning ? "grabbing" : "grab") : "crosshair",
        }}
      >
        {containerSize.width > 0 && (
          <Stage
            ref={stageRef}
            width={containerSize.width}
            height={containerSize.height}
            scaleX={stageScale}
            scaleY={stageScale}
            x={stagePos.x}
            y={stagePos.y}
            onWheel={handleWheel}
            onDblClick={handleDoubleClick}
            onMouseDown={handleDragStart}
            onTouchStart={handleDragStart}
            onMouseMove={handleDragMove}
            onTouchMove={handleDragMove}
            onMouseUp={handleDragEnd}
            onTouchEnd={handleDragEnd}
          >
            <Layer>
              <KonvaImage image={image} />
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
        )}
      </div>
      <StepMover
        disableNext={canvasStars.length < 1}
        onBeforeNext={onBeforeNext}
      />
    </div>
  );
}
