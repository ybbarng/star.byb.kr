import { useEffect, useRef, useState } from "react";
import StepMover from "@/plate-solver/StepMover";
import { useContextStore } from "@/plate-solver/store/context";
import useFindCandidates from "@/search/hooks/useFindCandidates";

export default function ChooseCandidateStep() {
  const image = useContextStore((state) => state.image);
  const photoStars = useContextStore((state) => state.photoStars);
  const canvasElement = useRef<HTMLCanvasElement>(null);
  const [selectedCandidateIndex, setSelectedCandidateIndex] = useState<
    number | undefined
  >(undefined);
  const { find: findCandidates, candidates } = useFindCandidates();

  useEffect(() => {
    if (!image || photoStars.length < 1) {
      return;
    }

    findCandidates({
      width: image.width,
      height: image.height,
      stars: photoStars.map((star) => [star.x, star.y]),
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
      context.strokeStyle = "red";
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
  }, [canvasElement, image, photoStars, candidates, selectedCandidateIndex]);

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
      <div className="flex justify-center">
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
      <StepMover disableNext={true} onBeforeNext={onBeforeNext} />
    </div>
  );
}
