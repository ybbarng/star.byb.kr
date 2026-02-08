import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import StepMover from "@/plate-solver/StepMover";
import { useContextStore } from "@/plate-solver/store/context";
import useFindCandidates from "@/search/hooks/useFindCandidates";
import useFindNearestStars from "@/search/hooks/useFindNearestStars";
import { Point2D } from "@/search/type";
import { VerificationResult } from "@/search/utils/verification";
import { cn } from "@/utils/cn";

export default function PlateSolvingStep() {
  const image = useContextStore((state) => state.image);
  const photoStars = useContextStore((state) => state.photoStars);
  const canvasElement = useRef<HTMLCanvasElement>(null);
  const [selectedCandidateIndex, setSelectedCandidateIndex] = useState<
    number | undefined
  >(undefined);
  const [candidateScores, setCandidateScores] = useState<
    Map<number, VerificationResult>
  >(new Map());
  const [autoVerified, setAutoVerified] = useState(false);
  const [sortedCandidateIndices, setSortedCandidateIndices] = useState<
    number[]
  >([]);
  const [candidateNeighborCounts, setCandidateNeighborCounts] = useState<
    Map<number, number>
  >(new Map());
  const {
    find: findCandidates,
    candidates,
    progress,
    total,
  } = useFindCandidates();
  const {
    find: findNearestStars,
    nearestStars,
    nearestConstellations,
    verification,
  } = useFindNearestStars();
  const [verificationProgress, setVerificationProgress] = useState<{
    progress: number;
    total: number;
  } | null>(null);
  const verificationWorkerRef = useRef<Worker | undefined>(undefined);
  const candidateItems = useMemo(() => {
    const order =
      sortedCandidateIndices.length > 0
        ? sortedCandidateIndices
        : candidates.map((_, i) => i);

    return order.map((origIdx) => {
      const candidate = candidates[origIdx];
      const score = candidateScores.get(origIdx);
      const neighbors = candidateNeighborCounts.get(origIdx);
      const scoreStr = score
        ? ` (${score.matchedCount}m, ${score.averageError.toFixed(1)}px` +
          (neighbors !== undefined ? `, ${neighbors}n` : "") +
          ")"
        : "";

      return {
        label:
          candidate.output.map((star) => `[${star.label}]`).join("-") +
          scoreStr,
        originalIndex: origIdx,
        matchRatio: score?.matchRatio,
      };
    });
  }, [
    candidates,
    candidateScores,
    candidateNeighborCounts,
    sortedCandidateIndices,
  ]);

  // 방향키로 후보 탐색
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (candidateItems.length === 0) return;
      if (e.key !== "ArrowUp" && e.key !== "ArrowDown") return;

      e.preventDefault();
      const currentDisplayIdx = candidateItems.findIndex(
        (item) => item.originalIndex === selectedCandidateIndex,
      );
      let nextDisplayIdx: number;

      if (e.key === "ArrowDown") {
        nextDisplayIdx =
          currentDisplayIdx < candidateItems.length - 1
            ? currentDisplayIdx + 1
            : currentDisplayIdx;
      } else {
        nextDisplayIdx = currentDisplayIdx > 0 ? currentDisplayIdx - 1 : 0;
      }

      setSelectedCandidateIndex(candidateItems[nextDisplayIdx].originalIndex);
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [candidateItems, selectedCandidateIndex]);

  useEffect(() => {
    if (!image || photoStars.length < 1) {
      return;
    }

    findCandidates({
      width: image.width,
      height: image.height,
      stars: photoStars.slice(0, 15).map((star) => [star.x, star.y]),
    });
  }, [image, photoStars]);

  // Verification Worker 초기화
  const onVerificationMessage = useCallback((e: MessageEvent) => {
    switch (e.data.fn) {
      case "onProgress":
        setVerificationProgress(e.data.payload);
        break;

      case "onVerified": {
        const { scores, neighbors, sorted, bestIndex } = e.data.payload as {
          scores: Record<number, VerificationResult>;
          neighbors: Record<number, number>;
          sorted: number[];
          bestIndex: number;
        };

        const scoresMap = new Map<number, VerificationResult>();

        for (const [k, v] of Object.entries(scores)) {
          scoresMap.set(Number(k), v);
        }

        const neighborsMap = new Map<number, number>();

        for (const [k, v] of Object.entries(neighbors)) {
          neighborsMap.set(Number(k), v as number);
        }

        setCandidateScores(scoresMap);
        setCandidateNeighborCounts(neighborsMap);
        setSortedCandidateIndices(sorted);
        setAutoVerified(true);
        setVerificationProgress(null);

        if (bestIndex >= 0) {
          setSelectedCandidateIndex(bestIndex);
        }

        break;
      }
    }
  }, []);

  useEffect(() => {
    const worker = new Worker(
      new URL("@/search/workers/verificationWorker.ts", import.meta.url),
    );
    worker.onmessage = onVerificationMessage;
    verificationWorkerRef.current = worker;

    return () => {
      worker.terminate();
      verificationWorkerRef.current = undefined;
    };
  }, [onVerificationMessage]);

  // 후보 목록이 나오면 Worker에서 검증
  useEffect(() => {
    if (
      !image ||
      candidates.length === 0 ||
      autoVerified ||
      !verificationWorkerRef.current
    ) {
      return;
    }

    const allPhotoStarPoints: Point2D[] = photoStars.map((star) => [
      star.x,
      star.y,
    ]);

    verificationWorkerRef.current.postMessage({
      fn: "verify",
      payload: {
        candidates: candidates.map((c) => ({
          input: c.input,
          output: c.output,
        })),
        photoStars: allPhotoStarPoints,
        imageWidth: image.width,
        imageHeight: image.height,
      },
    });
  }, [image, photoStars, candidates, autoVerified]);

  function loadImageToCanvas(
    context: CanvasRenderingContext2D,
    imageElement: HTMLImageElement,
  ) {
    context.drawImage(
      imageElement,
      0,
      0,
      imageElement.width,
      imageElement.height,
    );
  }

  useEffect(() => {
    if (
      !image ||
      candidates.length === 0 ||
      selectedCandidateIndex === undefined
    ) {
      return;
    }

    const selectedCandidate = candidates[selectedCandidateIndex];
    const selectedPhotoStars = selectedCandidate.input
      .map((starIndex) => photoStars[starIndex])
      .map((star) => ({
        position: [star.x, star.y] as Point2D,
      }));
    const candidateStars = selectedCandidate.output.map((item) => ({
      hr: item.hr,
    }));
    const allPhotoStars: Point2D[] = photoStars.map((star) => [star.x, star.y]);
    findNearestStars({
      photo: {
        width: image.width,
        height: image.height,
        quad: selectedPhotoStars,
      },
      candidate: candidateStars,
      allPhotoStars,
    });
  }, [image, photoStars, candidates, selectedCandidateIndex]);

  // verification 결과가 오면 candidateScores 업데이트
  useEffect(() => {
    if (verification && selectedCandidateIndex !== undefined) {
      setCandidateScores((prev) => {
        const next = new Map(prev);
        next.set(selectedCandidateIndex, verification);

        return next;
      });
    }
  }, [verification, selectedCandidateIndex]);

  useEffect(() => {
    if (!canvasElement.current || !image) {
      console.log("Can't find elements");

      return;
    }

    const context = canvasElement.current.getContext("2d");

    if (!context) {
      console.log("Can't find context of canvas.");

      return;
    }

    loadImageToCanvas(context, image);

    photoStars.forEach(({ x, y }) => {
      // Render the stars to the canvas
      context.beginPath();
      context.arc(x, y, 5, 0, 2 * Math.PI);
      context.strokeStyle = "oklch(0.704 0.191 22.216)";
      context.lineWidth = 2;
      context.stroke();
    });

    if (candidates.length < 1 || selectedCandidateIndex === undefined) {
      return;
    }

    const selectedCandidate = candidates[selectedCandidateIndex];

    const [i1, i2, i3, i4] = selectedCandidate.input;
    const p1 = photoStars[i1];
    const p2 = photoStars[i2];
    const p3 = photoStars[i3];
    const p4 = photoStars[i4];

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

    if (nearestConstellations.length < 1) {
      return;
    }

    nearestConstellations.forEach(({ label, stars }) => {
      context.strokeStyle = "oklch(0.905 0.182 98.111)";
      context.lineWidth = 1;

      for (let i = 0; i < stars.length - 1; i++) {
        context.beginPath();
        context.moveTo(...stars[i]);
        context.lineTo(...stars[i + 1]);
        context.stroke();
      }

      const visibleStars = stars.filter(
        (star) =>
          star[0] >= 0 &&
          star[0] < image.width &&
          star[1] >= 0 &&
          star[1] < image.height,
      );
      if (visibleStars.length === 0) return;
      const center = visibleStars
        .reduce((sum, star) => [sum[0] + star[0], sum[1] + star[1]], [0, 0])
        .map((value) => value / visibleStars.length);
      context.font = "bold 20px Arial";
      context.fillStyle = "oklch(0.905 0.182 98.111)";
      context.fillText(label, center[0], center[1]);
    });
  }, [
    canvasElement,
    image,
    photoStars,
    candidates,
    selectedCandidateIndex,
    nearestStars,
    nearestConstellations,
  ]);

  const onBeforeNext = async () => {
    // TODO: save candidates
  };

  if (!image || !image.width) {
    return (
      <div className="flex size-full flex-col gap-4">
        <div className="flex size-full items-center justify-center">
          <span className="loading loading-spinner loading-lg"></span>
        </div>
        <StepMover disableNext={true} />
      </div>
    );
  }

  return (
    <div className="flex size-full flex-col justify-stretch gap-4">
      <div className="flex h-full flex-row overflow-hidden">
        {(candidates.length < 1 || verificationProgress) && (
          <CandidatesProgress
            progress={verificationProgress?.progress ?? progress}
            total={verificationProgress?.total ?? total}
            label={verificationProgress ? "검증 중" : "검색 중"}
          />
        )}
        {candidates.length > 0 && !verificationProgress && (
          <CandidateSelect
            selectedCandidateIndex={selectedCandidateIndex ?? -1}
            setSelectedCandidateIndex={setSelectedCandidateIndex}
            candidates={candidateItems}
            verification={
              selectedCandidateIndex !== undefined
                ? candidateScores.get(selectedCandidateIndex)
                : undefined
            }
            neighborCount={
              selectedCandidateIndex !== undefined
                ? candidateNeighborCounts.get(selectedCandidateIndex)
                : undefined
            }
          />
        )}
        <div className="flex grow justify-center">
          <canvas
            className="max-h-full"
            ref={canvasElement}
            width={image.width}
            height={image.height}
            style={{
              aspectRatio: image.width / image.height,
            }}
          />
        </div>
      </div>
      <StepMover disableNext={true} onBeforeNext={onBeforeNext} />
    </div>
  );
}

interface CandidatesProgressProps {
  progress: number;
  total: number;
  label?: string;
}

function CandidatesProgress({
  progress,
  total,
  label,
}: CandidatesProgressProps) {
  return (
    <div className="bg-base-200 rounded-box flex h-full w-100 shrink-0 flex-row items-center justify-center">
      <div className="flex flex-col items-center justify-center gap-2">
        <div className="text-xl">{label ?? "로딩"} 중입니다.</div>
        {total === 0 && (
          <span className="loading loading-spinner loading-lg"></span>
        )}
        {total !== 0 && (
          <>
            <div>{`${progress} / ${total}`}</div>
            <progress
              className="progress progress-primary w-56"
              value={progress}
              max={total}
            ></progress>
          </>
        )}
      </div>
    </div>
  );
}

interface CandidateItem {
  label: string;
  originalIndex: number;
  matchRatio?: number;
}

interface CandidateSelectProps {
  selectedCandidateIndex: number;
  setSelectedCandidateIndex: (selectedCandidateIndex: number) => void;
  candidates: CandidateItem[];
  verification?: VerificationResult;
  neighborCount?: number;
}

function CandidateSelect(props: CandidateSelectProps) {
  return (
    <div className="bg-base-200 rounded-box flex h-full w-100 shrink-0 flex-col overflow-hidden">
      {props.verification && (
        <div className="border-base-300 border-b p-2 text-sm">
          <div>
            매칭: {props.verification.matchedCount}개 (
            {(props.verification.matchRatio * 100).toFixed(1)}%)
          </div>
          <div>미매칭 사진별: {props.verification.unmatchedPhotoCount}개</div>
          <div>평균 오차: {props.verification.averageError.toFixed(1)}px</div>
          {props.neighborCount !== undefined && (
            <div>합의 이웃: {props.neighborCount}개</div>
          )}
          <div>점수: {props.verification.score.toFixed(4)}</div>
        </div>
      )}
      <ul className="menu h-full flex-col flex-nowrap items-start overflow-x-clip overflow-y-scroll">
        {props.candidates.map((item) => {
          return (
            <li
              key={`candidate-${item.originalIndex}`}
              className="w-full"
              ref={(el) => {
                if (el && props.selectedCandidateIndex === item.originalIndex) {
                  el.scrollIntoView({ block: "nearest" });
                }
              }}
            >
              <a
                className={cn(
                  "relative overflow-hidden",
                  props.selectedCandidateIndex === item.originalIndex
                    ? "bg-primary/20 font-bold"
                    : "hover:bg-base-300/50",
                )}
                onClick={() =>
                  props.setSelectedCandidateIndex(item.originalIndex)
                }
              >
                {item.matchRatio !== undefined && (
                  <span
                    className={cn(
                      "absolute inset-y-0 left-0",
                      props.selectedCandidateIndex === item.originalIndex
                        ? "bg-primary/25"
                        : "bg-primary/15",
                    )}
                    style={{ width: `${item.matchRatio * 100}%` }}
                  />
                )}
                <span className="relative">
                  {`${item.originalIndex}: ${item.label}`}
                </span>
              </a>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
