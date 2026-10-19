"use client";

import Konva from "konva";
import { useCallback, useEffect, useRef, useState } from "react";
import { Stage, Layer, Rect, Image as KonvaImage } from "react-konva";
import SelectableStarMarker from "@/plate-solver/SelectableStarMarker";
import StepMover from "@/plate-solver/StepMover";
import { useContextStore } from "@/plate-solver/store/context";
import {
  DEFAULT_DISPLAY_STARS,
  mergeCloseStars,
  mergeDistancePx,
} from "@/search/utils/selectStars";
import cv from "@/services/cv";

interface CanvasStar {
  x: number;
  y: number;
  brightness: number;
  fwhm: number; // 퍼짐 크기. 작을수록 또렷한 점(별), 클수록 흐리멍텅한 번짐
  id: string;
  isSelected: boolean;
}

const BLURRY_FILL = "oklch(0.75 0.18 60)"; // 흐릿한 별 표시색(주황)

// 또렷함 기준(fwhm) 기본값: 가장 큰 fwhm, 즉 처음에는 아무것도 흐릿으로 표시하지 않는다.
// fwhm만으로는 진짜 별과 가짜 빛이 갈리지 않는다. 밝은 진짜 별은 크게 번져 fwhm이 크고
// (북두칠성 7개가 모두 상위 25%), 물결 반사광 같은 가짜도 크게 번진다(사이판).
// 그래서 자동으로 고르지 않고, 필요할 때 사람이 슬라이더를 내려 흐릿한 것을 고른다.
const finiteFwhmsSorted = (stars: { fwhm: number }[]): number[] =>
  stars
    .map((s) => s.fwhm)
    .filter((f) => Number.isFinite(f))
    .sort((a, b) => a - b);

const defaultFwhmCut = (stars: { fwhm: number }[]): number | null => {
  const sorted = finiteFwhmsSorted(stars);

  return sorted.length ? sorted[sorted.length - 1] : null;
};

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
  const hiddenStars = useContextStore((state) => state.hiddenStars);
  const setPhotoStars = useContextStore((state) => state.setPhotoStars);
  // 사람이 마커를 고쳤는지(추가·삭제·이동·영역 재검출). 고쳤으면 그 판단을 존중해 화면의 별만 풀이에 넘긴다.
  const editedRef = useRef(false);
  const [canvasStars, setCanvasStars] = useState<CanvasStar[]>([]);
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
  // cv 검출 전체 결과(밝기순, 캡 없음). 영역 재검출 때 가려진 어두운 별을 꺼내 쓴다.
  const allDetectionsRef = useRef<
    { x: number; y: number; brightness: number; fwhm: number }[]
  >([]);
  // 마지막으로 그린 선택 사각형(이미지 좌표). 영역 재검출의 대상 영역.
  const [lastBox, setLastBox] = useState<{
    x1: number;
    y1: number;
    x2: number;
    y2: number;
  } | null>(null);
  // 또렷함 기준. 이 값보다 fwhm이 크면 흐릿한 별로 보고 주황으로 표시한다.
  const [fwhmCut, setFwhmCut] = useState<number | null>(null);

  useEffect(() => {
    // store에 이미 별 데이터가 있으면 복원, 없으면 새로 검출
    if (photoStars.length > 0) {
      setCanvasStars(
        photoStars.map((star) => ({
          x: star.x,
          y: star.y,
          brightness: star.brightness,
          fwhm: 0, // 복원된 별은 모양 정보가 없으므로 또렷으로 취급
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
        editedRef.current = true;
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

  // 브라우저 client 좌표 → 이미지 좌표 (캔버스 밖 window 이벤트에서도 쓰려고).
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

  async function detectStars() {
    if (!image) {
      console.warn("검출할 이미지가 없습니다.");

      return;
    }

    try {
      const imageData = loadImageData(image);

      const stars = await findStars(imageData);
      setCanvasStars(
        stars.map((star) => ({
          ...star,
          id: crypto.randomUUID(),
          isSelected: false,
        })),
      );
      setFwhmCut(defaultFwhmCut(stars));
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
    const raw: {
      cx: number;
      cy: number;
      brightness: number;
      fwhm?: number;
    }[] = result.data.payload;
    // 너무 가까운 중복 검출은 밝은 것만 남긴다(거의 같은 위치의 별쌍 정리).
    const minDistPx = mergeDistancePx(imageData.width, imageData.height);
    // 전체 검출을 밝기순으로 보관(영역 재검출에서 어두운 별까지 꺼내 쓴다)
    const all = mergeCloseStars(
      raw.map((star) => ({
        x: star.cx,
        y: star.cy,
        brightness: star.brightness,
        fwhm: star.fwhm ?? 0,
      })),
      minDistPx,
    ).sort((a, b) => b.brightness - a.brightness);
    allDetectionsRef.current = all;

    // 기본 화면은 밝기 상위 일부만(전체를 다 그리면 노이즈가 가림)
    return all.slice(0, DEFAULT_DISPLAY_STARS);
  }

  // 선택한 영역 안에서만 별을 다시 표시한다. 전역 밝기 상위 100에서 밀려
  // 가려졌던 어두운 별이, 좁은 영역 안에서는 상위로 올라와 마커로 보인다.
  // (물결·가로등 같은 밝은 가짜가 다른 영역에 있을 때 진짜 별을 꺼내는 용도)
  const redetectInBox = async () => {
    if (!lastBox) return;

    editedRef.current = true;

    // 단계 이동 후 복귀 등으로 전체 검출이 비어 있으면 새로 검출
    if (allDetectionsRef.current.length === 0 && image) {
      await findStars(loadImageData(image));
    }

    const { x1, y1, x2, y2 } = lastBox;
    const inBox = allDetectionsRef.current.filter(
      (star) => star.x >= x1 && star.x <= x2 && star.y >= y1 && star.y <= y2,
    );
    // 이미 밝기순. 영역이 넓어도 너무 많지 않게 상한을 둔다.
    const picked = inBox.slice(0, 120);
    setCanvasStars(
      picked.map((star) => ({
        ...star,
        id: crypto.randomUUID(),
        isSelected: false,
      })),
    );
    // 영역 안 별들 기준으로 또렷함 기준을 다시 잡는다
    setFwhmCut(defaultFwhmCut(picked));
  };

  const addStar = (x: number, y: number) => {
    editedRef.current = true;
    setCanvasStars([
      ...canvasStars,
      {
        id: crypto.randomUUID(),
        x,
        y,
        brightness: 0,
        fwhm: 0, // 손으로 찍은 별은 또렷으로 취급
        isSelected: false,
      },
    ]);
  };

  const onPositionUpdate = (id: string, x: number, y: number) => {
    editedRef.current = true;
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
    editedRef.current = true;
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
  // 드래그가 캔버스(Stage) 밖으로 나가도 이어지도록 window pointer 이벤트로 처리한다.
  // (세로 사진은 이미지가 높이를 꽉 채워 아래로 나가면 Stage 이벤트가 끊기던 문제)
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

  // 시작·끝 이미지 좌표로 선택 사각형을 확정하고, 그 안의 별을 선택한다.
  const finalizeSelection = (
    start: { x: number; y: number },
    end: { x: number; y: number },
  ) => {
    const x1 = Math.min(start.x, end.x);
    const x2 = Math.max(start.x, end.x);
    const y1 = Math.min(start.y, end.y);
    const y2 = Math.max(start.y, end.y);

    setSelectArea((a) => ({ ...a, visible: false }));
    // 영역 재검출에 쓸 수 있도록 그린 사각형을 기억
    setLastBox({ x1, y1, x2, y2 });

    // 거의 안 움직였으면(클릭) 선택 변경 안 함
    if (Math.hypot(end.x - start.x, end.y - start.y) < 3) {
      return;
    }

    const inBox = new Set(
      canvasStars
        .filter((s) => s.x >= x1 && s.x <= x2 && s.y >= y1 && s.y <= y2)
        .map((s) => s.id),
    );

    if (inBox.size < 1) {
      return;
    }

    setCanvasStars(
      canvasStars.map((star) => ({ ...star, isSelected: inBox.has(star.id) })),
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
    // 선택 드래그는 window pointer 이벤트가 처리한다(캔버스 밖에서도 이어지게).
    if (mode === "move" || isPanning) handlePanMove();
  }, [mode, isPanning, stagePos]);

  const handleDragEnd = useCallback(() => {
    if (mode === "move" || isPanning) handlePanEnd();
  }, [mode, isPanning]);

  const onBeforeNext = async () => {
    const toPhotoStar = (star: {
      x: number;
      y: number;
      brightness: number;
    }) => ({
      x: star.x,
      y: star.y,
      brightness: star.brightness,
    });
    const sorted = [...canvasStars].sort((a, b) => b.brightness - a.brightness);
    // 사람이 고치지 않았으면 화면에 안 띄운 나머지 검출도 넘긴다(위쪽 영역 재선택용).
    // 이번에 검출하지 않고 복원만 했으면(단계 복귀) 이전에 넘긴 값을 그대로 쓴다.
    const hidden = editedRef.current
      ? []
      : allDetectionsRef.current.length > 0
        ? allDetectionsRef.current.slice(DEFAULT_DISPLAY_STARS).map(toPhotoStar)
        : hiddenStars;

    setPhotoStars(sorted.map(toPhotoStar), hidden);
  };

  // 흐릿한 별(fwhm > 기준)인지
  const isBlurry = (star: { fwhm: number }) =>
    fwhmCut !== null && Number.isFinite(star.fwhm) && star.fwhm > fwhmCut;

  // 흐릿한 별을 모두 선택(사람이 보고 Delete로 지우게)
  const selectBlurry = () => {
    setMode("select");
    setCanvasStars(
      canvasStars.map((star) => ({ ...star, isSelected: isBlurry(star) })),
    );
  };

  const blurryCount = canvasStars.filter(isBlurry).length;
  const fwhmSorted = finiteFwhmsSorted(canvasStars);
  const fwhmMin = fwhmSorted.length ? fwhmSorted[0] : 0;
  const fwhmMax = fwhmSorted.length ? fwhmSorted[fwhmSorted.length - 1] : 0;
  // 또렷함 기준 슬라이더를 보여줄 수 있는지(모양 정보가 있는 검출 결과일 때)
  const canFilterCrispness = fwhmCut !== null && fwhmMax > fwhmMin;

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
          {canFilterCrispness && (
            <span className="text-warning"> · 흐릿 {blurryCount}개</span>
          )}
          {stageScale !== 1 && ` · ${Math.round(stageScale * 100)}%`}
        </span>
        <div className="flex items-center gap-2">
          {canFilterCrispness && (
            <div
              className="flex items-center gap-1"
              title="오른쪽으로 갈수록 더 흐린 것까지 또렷으로 봅니다. 왼쪽으로 당기면 흐릿(주황)한 별이 늘어납니다."
            >
              <span className="text-xs whitespace-nowrap">또렷함 기준</span>
              <input
                type="range"
                className="range range-xs w-28"
                min={fwhmMin}
                max={fwhmMax}
                step={(fwhmMax - fwhmMin) / 100 || 0.01}
                value={fwhmCut ?? fwhmMax}
                onChange={(e) => setFwhmCut(Number(e.target.value))}
              />
              <button
                className="btn btn-sm btn-warning"
                disabled={blurryCount < 1}
                onClick={selectBlurry}
                title="흐릿한 별을 모두 선택합니다. Delete 키로 지우세요."
              >
                흐릿한 별 선택
              </button>
            </div>
          )}
          <div className="join">
            <button
              className={`btn join-item btn-sm ${mode === "select" ? "btn-primary" : ""}`}
              onClick={() => setMode("select")}
              title="선택 모드 (Space 누르면 이동)"
            >
              선택
            </button>
            <button
              className={`btn join-item btn-sm ${mode === "move" ? "btn-primary" : ""}`}
              onClick={() => setMode("move")}
              title="이동 모드"
            >
              이동
            </button>
          </div>
          <button
            className="btn btn-sm"
            disabled={!lastBox}
            onClick={redetectInBox}
            title="선택한 영역 안에서만 별을 다시 찾습니다. 다른 곳의 밝은 가짜 빛(물결·가로등)에 가려 안 보이던 어두운 별이 마커로 나타납니다."
          >
            영역만 재검출
          </button>
          <button
            className="btn btn-error btn-sm"
            disabled={canvasStars.length < 1}
            onClick={() => {
              editedRef.current = true;
              setCanvasStars([]);
            }}
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
                  fill={isBlurry(star) ? BLURRY_FILL : undefined}
                  onPositionUpdate={onPositionUpdate}
                  remove={removeStar}
                  select={selectStar}
                />
              ))}
              {lastBox && !selectArea.visible && (
                <Rect
                  x={lastBox.x1}
                  y={lastBox.y1}
                  width={lastBox.x2 - lastBox.x1}
                  height={lastBox.y2 - lastBox.y1}
                  stroke="rgba(0,200,120,0.9)"
                  strokeWidth={2 / stageScale}
                  dash={[8 / stageScale, 4 / stageScale]}
                  listening={false}
                />
              )}
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
