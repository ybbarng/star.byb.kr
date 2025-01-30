import { useEffect, useMemo, useRef, useState } from "react";
import StepMover from "@/plate-solver/StepMover";
import { useContextStore } from "@/plate-solver/store/context";
import useFindCandidates from "@/search/hooks/useFindCandidates";
import useFindNearestStars from "@/search/hooks/useFindNearestStars";
import { Point2D } from "@/search/type";
import { cn } from "@/utils/cn";

export default function ChooseCandidateStep() {
  const image = useContextStore((state) => state.image);
  const photoStars = useContextStore((state) => state.photoStars);
  const canvasElement = useRef<HTMLCanvasElement>(null);
  const [selectedCandidateIndex, setSelectedCandidateIndex] = useState<
    number | undefined
  >(undefined);
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
  } = useFindNearestStars();
  const candidateNames = useMemo(() => {
    return candidates.map((candidate) => {
      return candidate.output.map((star) => `[${star.label}]`).join("-");
    });
  }, [candidates]);

  useEffect(() => {
    if (!image || photoStars.length < 1) {
      return;
    }

    findCandidates({
      width: image.width,
      height: image.height,
      stars: photoStars.slice(0, 10).map((star) => [star.x, star.y]),
    });
  }, [image, photoStars]);

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
    findNearestStars({
      photo: {
        width: image.width,
        height: image.height,
        quad: selectedPhotoStars,
      },
      candidate: candidateStars,
    });
  }, [image, photoStars, candidates, selectedCandidateIndex]);

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

    console.log(nearestConstellations.length);

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
      <div className="flex w-full flex-col gap-4">
        <div className="flex h-[800px] w-full items-center justify-center">
          <span className="loading loading-spinner loading-lg"></span>
        </div>
        <StepMover disableNext={true} />
      </div>
    );
  }

  return (
    <div className="flex w-full flex-col gap-4">
      <div className="flex flex-row">
        {candidates.length < 1 && (
          <CandidatesProgress progress={progress} total={total} />
        )}
        {candidates.length > 0 && (
          <CandidateSelect
            selectedCandidateIndex={selectedCandidateIndex || -1}
            setSelectedCandidateIndex={setSelectedCandidateIndex}
            candidates={candidateNames}
          />
        )}
        <div className="flex grow justify-center">
          <canvas
            className="max-h-[800px]"
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
}

function CandidatesProgress({ progress, total }: CandidatesProgressProps) {
  return (
    <div className="bg-base-200 rounded-box flex h-[800px] w-100 flex-row items-center justify-center">
      <div className="flex flex-col items-center justify-center gap-2">
        <div className="text-xl">로딩 중입니다.</div>
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

interface CandidateSelectProps {
  selectedCandidateIndex: number;
  setSelectedCandidateIndex: (selectedCandidateIndex: number) => void;
  candidates: string[];
}

function CandidateSelect(props: CandidateSelectProps) {
  return (
    <ul className="menu bg-base-200 rounded-box h-[800px] w-100 flex-row overflow-x-clip overflow-y-scroll">
      {props.candidates.map((candidate, i) => {
        return (
          <li key={`${candidate}-${i}`} className="w-full">
            <a
              className={cn(
                props.selectedCandidateIndex === i && "menu-active",
              )}
              onClick={() => props.setSelectedCandidateIndex(i)}
            >
              {`${i}: ${candidate}`}
            </a>
          </li>
        );
      })}
    </ul>
  );
}
