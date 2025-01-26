import { useStepsStore } from "@/plate-solver/store/steps";

interface Props {
  disablePrev?: boolean;
  disableNext?: boolean;
  onBeforeNext?: () => Promise<void>;
}

export default function StepMover(props: Props) {
  const current = useStepsStore((state) => state.current);
  const steps = useStepsStore((state) => state.steps);
  const moveToPrev = useStepsStore((state) => state.moveToPrev);
  const moveToNext = useStepsStore((state) => state.moveToNext);

  const handleMoveToNext = async () => {
    if (props.onBeforeNext) {
      await props.onBeforeNext();
    }

    moveToNext();
  };

  return (
    <div className="flex flex-row justify-between">
      <button
        className="btn btn-lg"
        disabled={props.disablePrev || current <= 0}
        onClick={moveToPrev}
      >
        이전
      </button>
      <button
        className="btn btn-lg btn-primary"
        disabled={props.disableNext || current >= steps.length - 1}
        onClick={handleMoveToNext}
      >
        다음
      </button>
    </div>
  );
}
