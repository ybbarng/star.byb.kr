"use client";

import type { DetectedStar } from "@/plate-solver/detectPhotoStars";
import type { EditTool, EstimateMarks } from "@/plate-solver/types";
import Konva from "konva";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Circle,
  Image as KonvaImage,
  Layer,
  Line,
  Rect,
  Stage,
} from "react-konva";
import { detectPhotoStars } from "@/plate-solver/detectPhotoStars";
import SelectableStarMarker from "@/plate-solver/SelectableStarMarker";
import { useContextStore } from "@/plate-solver/store/context";
import { NO_MARKS } from "@/plate-solver/types";
import {
  byStarPriority,
  DEFAULT_DISPLAY_STARS,
} from "@/search/utils/selectStars";
import { cn } from "@/utils/cn";

// 별 고치기: 자동으로 못 풀었거나 틀렸을 때 사람이 돕는 화면.
// 별이 아닌 표시(나무·불빛)를 지우고 빠진 별을 더하고, 지평선·달을 찍은 뒤 다시 찾는다.

interface CanvasStar {
  x: number;
  y: number;
  brightness: number;
  ringContrast?: number;
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

const HORIZON_COLOR = "oklch(0.792 0.209 151.711)";

const toCanvasStar = (star: {
  x: number;
  y: number;
  brightness: number;
  ringContrast?: number;
}): CanvasStar => ({
  x: star.x,
  y: star.y,
  brightness: star.brightness,
  ringContrast: star.ringContrast,
  id: crypto.randomUUID(),
  isSelected: false,
});

const TOOLS: { key: EditTool; label: string; help: string }[] = [
  {
    key: "select",
    label: "★ 별",
    help: "별을 눌러 고르고 끌어서 여러 개 고를 수 있어요. 빈 곳을 두 번 누르면 별을 더하고, 별을 두 번 누르면 지워요.",
  },
  {
    key: "move",
    label: "✋ 화면 이동",
    help: "끌어서 사진을 옮겨요. 별 도구에서는 스페이스바를 누르는 동안 이동해요.",
  },
  {
    key: "horizon",
    label: "― 지평선",
    help: "땅과 하늘이 만나는 곳(먼 산·바다 끝)을 왼쪽과 오른쪽 두 곳 눌러요. 별이 적은 사진을 촬영 시각·장소로 풀 때 써요.",
  },
  {
    key: "moon",
    label: "☾ 달",
    help: "사진에 달이 있으면 달 한가운데를 눌러요. 촬영 날짜를 추정할 때 써요.",
  },
];

export default function StarEditor() {
  const image = useContextStore((state) => state.image);
  const photoStars = useContextStore((state) => state.photoStars);
  const hiddenStars = useContextStore((state) => state.hiddenStars);
  const detections = useContextStore((state) => state.detections);
  const storedMarks = useContextStore((state) => state.marks);
  const initialTool = useContextStore((state) => state.editTool);
  const setPhotoStars = useContextStore((state) => state.setPhotoStars);
  const setDetections = useContextStore((state) => state.setDetections);
  const setStoredMarks = useContextStore((state) => state.setMarks);
  const goTo = useContextStore((state) => state.goTo);

  // 사람이 별을 고쳤는지. 고쳤으면 그 판단을 존중해 화면의 별만 풀이에 넘긴다.
  const [edited, setEdited] = useState(false);
  const [canvasStars, setCanvasStars] = useState<CanvasStar[]>(() =>
    photoStars.map(toCanvasStar),
  );
  const [marks, setMarks] = useState<EstimateMarks>(storedMarks);
  const [tool, setTool] = useState<EditTool>(initialTool);
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
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const panStartRef = useRef({ x: 0, y: 0 });
  const spaceHeldRef = useRef(false);
  // 마지막으로 그린 선택 사각형(이미지 좌표). 영역 다시 찾기의 대상 영역.
  const [lastBox, setLastBox] = useState<{
    x1: number;
    y1: number;
    x2: number;
    y2: number;
  } | null>(null);
  // 영역 다시 찾기가 실패했다 (별 찾기 Worker를 못 띄우는 등)
  const [redetectFailed, setRedetectFailed] = useState(false);

  const markEdited = () => setEdited(true);

  const fitToScreen = useCallback(() => {
    if (!containerRef.current || !image) return;

    const { clientWidth, clientHeight } = containerRef.current;
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
  }, [image]);

  // 컨테이너 크기 측정 & 처음 배율
  useEffect(() => {
    if (!containerRef.current || !image) return;

    const updateSize = () => {
      const { clientWidth, clientHeight } = containerRef.current!;
      setContainerSize({ width: clientWidth, height: clientHeight });
      fitToScreen();
    };

    updateSize();
    const observer = new ResizeObserver(updateSize);
    observer.observe(containerRef.current);

    return () => observer.disconnect();
  }, [image, fitToScreen]);

  const deleteSelected = useCallback(() => {
    markEdited();
    setCanvasStars((stars) => stars.filter((star) => !star.isSelected));
  }, []);

  // 스페이스바: 누르는 동안 이동. Delete: 고른 별 지우기. Esc: 고르기 풀기
  useEffect(() => {
    let toolBeforeSpace: EditTool = "select";

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLInputElement) return;

      if (event.key === " " && !spaceHeldRef.current) {
        event.preventDefault();
        spaceHeldRef.current = true;
        setTool((t) => {
          toolBeforeSpace = t;

          return "move";
        });
      }

      if (event.key === "Delete" || event.key === "Backspace") {
        deleteSelected();
      }

      if (event.key === "Escape") {
        setCanvasStars((stars) =>
          stars.map((star) => ({ ...star, isSelected: false })),
        );
      }
    };

    const handleKeyUp = (event: KeyboardEvent) => {
      if (event.key === " ") {
        spaceHeldRef.current = false;
        setTool(toolBeforeSpace);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [deleteSelected]);

  // 화면 좌표 → 이미지 좌표
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

  // 브라우저 client 좌표 → 이미지 좌표 (캔버스 밖 window 이벤트에서도 쓰려고)
  const clientToImage = (
    clientX: number,
    clientY: number,
  ): { x: number; y: number } | null => {
    const stage = stageRef.current;
    if (!stage) return null;
    const rect = stage.container().getBoundingClientRect();

    return {
      x: (clientX - rect.left - stage.x()) / stage.scaleX(),
      y: (clientY - rect.top - stage.y()) / stage.scaleY(),
    };
  };

  // 검출 전체 결과(풀이 순서). 비어 있으면(드물게) 새로 찾는다.
  const allDetections = async (): Promise<DetectedStar[]> => {
    if (detections.length > 0 || !image) {
      return detections;
    }

    const found = await detectPhotoStars(image);
    setDetections(found);

    return found;
  };

  // 고른 영역 안에서만 별을 다시 찾는다. 전체 상위 100개에서 밀려 가려졌던 어두운 별이,
  // 좁은 영역 안에서는 상위로 올라와 표시된다 (물결·가로등 같은 밝은 가짜가 다른 곳에 있을 때).
  const redetectInBox = async () => {
    if (!lastBox) return;

    setRedetectFailed(false);
    const { x1, y1, x2, y2 } = lastBox;
    let found: DetectedStar[];

    try {
      found = await allDetections();
    } catch {
      setRedetectFailed(true);

      return;
    }

    markEdited();
    const inBox = found.filter(
      (star) => star.x >= x1 && star.x <= x2 && star.y >= y1 && star.y <= y2,
    );
    setCanvasStars(inBox.slice(0, 120).map(toCanvasStar));
  };

  // 자동으로 찾은 처음 상태로 되돌린다
  const resetToAuto = async () => {
    setEdited(false);
    setLastBox(null);
    setCanvasStars(
      (await allDetections()).slice(0, DEFAULT_DISPLAY_STARS).map(toCanvasStar),
    );
  };

  const addStar = (x: number, y: number) => {
    markEdited();
    setCanvasStars((stars) => [
      ...stars,
      toCanvasStar({ x, y, brightness: 0 }),
    ]);
  };

  const onPositionUpdate = (id: string, x: number, y: number) => {
    markEdited();
    setCanvasStars((stars) =>
      stars.map((star) => (star.id === id ? { ...star, x, y } : star)),
    );
  };

  const removeStar = (id: string) => {
    markEdited();
    setCanvasStars((stars) => stars.filter((star) => star.id !== id));
  };

  const selectStar = (id: string) => {
    setCanvasStars((stars) =>
      stars.map((star) => ({
        ...star,
        isSelected: star.id === id ? !star.isSelected : star.isSelected,
      })),
    );
  };

  // 배율을 바꾸되 기준점(화면 좌표)은 제자리에 둔다
  const zoomAt = (factor: number, pointer: { x: number; y: number }) => {
    const oldScale = stageScale;
    const scale = Math.max(0.05, Math.min(10, oldScale * factor));
    const mousePointTo = {
      x: (pointer.x - stagePos.x) / oldScale,
      y: (pointer.y - stagePos.y) / oldScale,
    };

    setStageScale(scale);
    setStagePos({
      x: pointer.x - mousePointTo.x * scale,
      y: pointer.y - mousePointTo.y * scale,
    });
  };

  const handleWheel = (e: Konva.KonvaEventObject<WheelEvent>) => {
    e.evt.preventDefault();
    const pointer = stageRef.current?.getPointerPosition();
    if (!pointer) return;

    zoomAt(e.evt.deltaY < 0 ? 1.1 : 1 / 1.1, pointer);
  };

  const zoomCenter = (factor: number) =>
    zoomAt(factor, {
      x: containerSize.width / 2,
      y: containerSize.height / 2,
    });

  const handleDoubleClick = (e: Konva.KonvaEventObject<Event>) => {
    // 별을 두 번 누른 것은 마커가 지운다
    if (tool !== "select" || e.target.name() === "star") return;
    const pos = getImagePointerPosition();
    if (pos) addStar(pos.x, pos.y);
  };

  // 지평선·달 도구: 누른 곳을 찍는다
  const handlePick = () => {
    const pos = getImagePointerPosition();
    if (!pos) return;
    const point: [number, number] = [pos.x, pos.y];

    if (tool === "moon") {
      setMarks((m) => ({ ...m, moon: point }));

      return;
    }

    if (tool === "horizon") {
      setMarks((m) => ({
        ...m,
        horizon: m.horizon.length >= 2 ? [point] : [...m.horizon, point],
        horizonAuto: false,
      }));
    }
  };

  // --- 별 도구: 끌어서 여러 개 고르기 ---
  // 끌기가 캔버스 밖으로 나가도 이어지도록 window pointer 이벤트로 처리한다.
  const handleSelectDragStart = () => {
    const start = getImagePointerPosition();
    if (!start) return;

    setSelectArea({
      x1: start.x,
      y1: start.y,
      x2: start.x,
      y2: start.y,
      visible: false,
    });

    const onMove = (e: PointerEvent) => {
      const p = clientToImage(e.clientX, e.clientY);
      if (!p) return;

      setSelectArea({
        x1: start.x,
        y1: start.y,
        x2: p.x,
        y2: p.y,
        visible: true,
      });
    };

    const onUp = (e: PointerEvent) => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      finalizeSelection(start, clientToImage(e.clientX, e.clientY) ?? start);
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };

  const finalizeSelection = (
    start: { x: number; y: number },
    end: { x: number; y: number },
  ) => {
    setSelectArea((a) => ({ ...a, visible: false }));

    // 거의 안 움직였으면(클릭) 고르기를 바꾸지 않는다
    if (Math.hypot(end.x - start.x, end.y - start.y) < 3) {
      return;
    }

    const x1 = Math.min(start.x, end.x);
    const x2 = Math.max(start.x, end.x);
    const y1 = Math.min(start.y, end.y);
    const y2 = Math.max(start.y, end.y);
    setLastBox({ x1, y1, x2, y2 });
    setCanvasStars((stars) =>
      stars.map((star) => ({
        ...star,
        isSelected:
          star.x >= x1 && star.x <= x2 && star.y >= y1 && star.y <= y2,
      })),
    );
  };

  // --- 화면 이동 ---
  const handlePanStart = () => {
    const pointer = stageRef.current?.getPointerPosition();
    if (!pointer) return;

    setIsPanning(true);
    panStartRef.current = {
      x: pointer.x - stagePos.x,
      y: pointer.y - stagePos.y,
    };
  };

  const handlePanMove = () => {
    if (!isPanning) return;
    const pointer = stageRef.current?.getPointerPosition();
    if (!pointer) return;

    setStagePos({
      x: pointer.x - panStartRef.current.x,
      y: pointer.y - panStartRef.current.y,
    });
  };

  const handlePointerDown = (e: Konva.KonvaEventObject<Event>) => {
    if (tool === "move") {
      handlePanStart();

      return;
    }

    if (tool === "select") {
      // 별 마커를 누른 것이면 마커가 처리한다(끌어 옮기기)
      if (e.target.name() === "star") return;

      handleSelectDragStart();
    }
  };

  const apply = () => {
    const toPhotoStar = (star: {
      x: number;
      y: number;
      brightness: number;
      ringContrast?: number;
    }) => ({
      x: star.x,
      y: star.y,
      brightness: star.brightness,
      ringContrast: star.ringContrast,
    });
    const sorted = [...canvasStars].sort(byStarPriority);
    // 사람이 별을 고치지 않았으면 화면에 안 띄운 나머지 검출도 넘긴다(위쪽 영역 재선택용)
    const hidden = edited ? [] : hiddenStars;

    setPhotoStars(sorted.map(toPhotoStar), hidden);
    setStoredMarks(marks);
    goTo("solve");
  };

  if (!image) {
    return null;
  }

  const selectedCount = canvasStars.filter((s) => s.isSelected).length;
  const toolHelp = TOOLS.find((t) => t.key === tool)?.help;
  const unit = 1 / stageScale;

  return (
    <div className="flex w-full max-w-[1280px] flex-col gap-3">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-2xl font-black">별 고치기</h1>
          <p className="text-sm opacity-70">
            별이 아닌 표시는 지우고 빠진 별은 더한 뒤, 다시 찾아 보세요.
          </p>
        </div>
        <div className="flex gap-2">
          <button className="btn btn-ghost" onClick={() => goTo("solve")}>
            취소
          </button>
          <button
            className="btn btn-primary"
            disabled={canvasStars.length < 3}
            onClick={apply}
          >
            이 별로 다시 찾기
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="join">
          {TOOLS.map((t) => (
            <button
              key={t.key}
              className={cn(
                "btn join-item btn-sm",
                tool === t.key && "btn-primary",
              )}
              onClick={() => setTool(t.key)}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className="join">
          <button
            className="btn join-item btn-sm"
            aria-label="줌 아웃"
            onClick={() => zoomCenter(1 / 1.4)}
          >
            −
          </button>
          <button className="btn join-item btn-sm" onClick={fitToScreen}>
            {Math.round(stageScale * 100)}%
          </button>
          <button
            className="btn join-item btn-sm"
            aria-label="줌 인"
            onClick={() => zoomCenter(1.4)}
          >
            +
          </button>
        </div>
        <div className="grow" />
        {tool === "select" && (
          <>
            <button
              className="btn btn-sm"
              disabled={selectedCount < 1}
              onClick={deleteSelected}
            >
              고른 별 지우기{selectedCount > 0 && ` (${selectedCount})`}
            </button>
            <button
              className="btn btn-sm"
              disabled={!lastBox}
              onClick={redetectInBox}
              title="다른 곳의 밝은 가짜 빛(물결·가로등)에 가려 안 보이던 어두운 별을 이 영역 안에서 다시 찾아요."
            >
              고른 영역에서만 다시 찾기
            </button>
            {redetectFailed && (
              <span role="alert" className="text-error text-xs">
                별을 다시 찾지 못했어요
              </span>
            )}
            <button className="btn btn-sm btn-ghost" onClick={resetToAuto}>
              처음 상태로
            </button>
          </>
        )}
        {(tool === "horizon" || tool === "moon") && (
          <button
            className="btn btn-sm btn-ghost"
            onClick={() =>
              setMarks((m) =>
                tool === "moon"
                  ? { ...m, moon: null }
                  : { ...NO_MARKS, moon: m.moon },
              )
            }
          >
            {tool === "moon" ? "달 지우기" : "지평선 지우기"}
          </button>
        )}
      </div>

      <div className="text-info text-xs">
        {toolHelp}
        {tool === "select" && ` · 지금 별 ${canvasStars.length}개`}
        {tool === "horizon" &&
          (marks.horizon.length === 2
            ? marks.horizonAuto
              ? " · 초록 선은 자동으로 찾은 지평선이에요."
              : " · 지평선을 찍었어요."
            : ` · ${marks.horizon.length}/2`)}
      </div>

      <div
        ref={containerRef}
        className="rounded-box h-[65dvh] w-full touch-none overflow-hidden bg-black lg:h-[calc(100dvh-15rem)]"
        style={{
          cursor:
            tool === "move" ? (isPanning ? "grabbing" : "grab") : "crosshair",
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
            onDblTap={handleDoubleClick}
            onClick={handlePick}
            onTap={handlePick}
            onMouseDown={handlePointerDown}
            onTouchStart={handlePointerDown}
            onMouseMove={handlePanMove}
            onTouchMove={handlePanMove}
            onMouseUp={() => setIsPanning(false)}
            onTouchEnd={() => setIsPanning(false)}
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
                  draggable={tool === "select"}
                  onPositionUpdate={onPositionUpdate}
                  remove={removeStar}
                  select={selectStar}
                />
              ))}
              {marks.horizon.length === 2 && (
                <Line
                  points={[...marks.horizon[0], ...marks.horizon[1]]}
                  stroke={HORIZON_COLOR}
                  strokeWidth={3 * unit}
                  dash={marks.horizonAuto ? [12 * unit, 6 * unit] : undefined}
                  listening={false}
                />
              )}
              {marks.horizon.map(([x, y], i) => (
                <Circle
                  key={i}
                  x={x}
                  y={y}
                  radius={8 * unit}
                  stroke={HORIZON_COLOR}
                  strokeWidth={3 * unit}
                  listening={false}
                />
              ))}
              {marks.moon && (
                <Line
                  points={[
                    marks.moon[0] - 16 * unit,
                    marks.moon[1],
                    marks.moon[0] + 16 * unit,
                    marks.moon[1],
                    marks.moon[0],
                    marks.moon[1],
                    marks.moon[0],
                    marks.moon[1] - 16 * unit,
                    marks.moon[0],
                    marks.moon[1] + 16 * unit,
                  ]}
                  stroke="white"
                  strokeWidth={3 * unit}
                  listening={false}
                />
              )}
              {lastBox && !selectArea.visible && tool === "select" && (
                <Rect
                  x={lastBox.x1}
                  y={lastBox.y1}
                  width={lastBox.x2 - lastBox.x1}
                  height={lastBox.y2 - lastBox.y1}
                  stroke="rgba(0,200,120,0.9)"
                  strokeWidth={2 * unit}
                  dash={[8 * unit, 4 * unit]}
                  listening={false}
                />
              )}
              <Rect
                x={Math.min(selectArea.x1, selectArea.x2)}
                y={Math.min(selectArea.y1, selectArea.y2)}
                width={Math.abs(selectArea.x1 - selectArea.x2)}
                height={Math.abs(selectArea.y1 - selectArea.y2)}
                visible={selectArea.visible}
                fill="rgba(80,120,255,0.35)"
                listening={false}
              />
            </Layer>
          </Stage>
        )}
      </div>
    </div>
  );
}
