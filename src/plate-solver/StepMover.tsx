import { useState } from "react";
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

  // 다음 단계 준비(사진 불러오기 등)가 몇 초 걸릴 수 있어, 그동안 버튼을 막고 진행 중임을 보여 준다.
  // 두 번 눌려 단계가 두 번 넘어가지 않게 한다.
  const [moving, setMoving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleMoveToNext = async () => {
    setMoving(true);
    setError(null);

    try {
      if (props.onBeforeNext) {
        await props.onBeforeNext();
      }

      moveToNext();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setMoving(false);
    }
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
      <div className="flex items-center gap-3">
        {error && <span className="text-error text-sm">{error}</span>}
        <button
          className="btn btn-lg btn-primary"
          disabled={moving || props.disableNext || current >= steps.length - 1}
          onClick={handleMoveToNext}
        >
          {moving && <span className="loading loading-spinner loading-sm" />}
          다음
        </button>
      </div>
    </div>
  );
}
