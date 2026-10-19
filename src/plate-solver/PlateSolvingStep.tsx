import type { SampleAnswer } from "@/plate-solver/sampleAnswers";
import type { SolvePhase } from "@/search/solvePhoto";
import type { SolveCandidateResult } from "@/search/solvers";
import { useCallback, useEffect, useRef, useState } from "react";
import { getSampleAnswer, matchesAnswer } from "@/plate-solver/sampleAnswers";
import StepMover from "@/plate-solver/StepMover";
import { useContextStore } from "@/plate-solver/store/context";
import useSkyOverlay from "@/search/hooks/useSkyOverlay";
import useSolve from "@/search/hooks/useSolve";
import { ACCEPT } from "@/search/solvers/candidates";
import { cn } from "@/utils/cn";

export default function PlateSolvingStep() {
  const image = useContextStore((state) => state.image);
  const photoStars = useContextStore((state) => state.photoStars);
  const hiddenStars = useContextStore((state) => state.hiddenStars);
  const canvasElement = useRef<HTMLCanvasElement>(null);
  const { solve, outcome, solving, ready, phase, error } = useSolve();
  const {
    stars: skyStars,
    constellations: skyConstellations,
    update: updateSky,
    updateFisheye,
    clear: clearSky,
  } = useSkyOverlay();
  const [selected, setSelected] = useState(0);

  // 그릴 어안 카메라: worker의 blind 어안 풀이가 성공했을 때만(라벨 하드코딩 없음).
  const fisheyeCamera = outcome?.fisheyeCamera ?? null;

  // 검출된 별로 plate solving 실행 (직선/어안 자동 판별은 worker에서)
  const runSolve = useCallback(() => {
    if (!image || photoStars.length < 1) {
      return;
    }

    // 화면의 별 + 화면에 안 띄운 나머지 검출(사람이 고치지 않았을 때). 풀이가 영역마다 고른다.
    solve(
      [...photoStars, ...hiddenStars].map((s) => ({
        x: s.x,
        y: s.y,
        brightness: s.brightness,
      })),
      image.width,
      image.height,
    );
  }, [image, photoStars, hiddenStars, solve]);

  useEffect(() => {
    if (ready) {
      runSolve();
    }
  }, [ready, runSolve]);

  // 결과가 오면 최상위 후보 선택
  useEffect(() => {
    setSelected(0);
  }, [outcome]);

  // 어안이면 어안 카메라로, 아니면 선택 후보의 변환으로 별/별자리를 그린다
  useEffect(() => {
    if (!image) {
      return;
    }

    if (fisheyeCamera) {
      updateFisheye(fisheyeCamera, image.width, image.height);

      return;
    }

    if (!outcome || outcome.candidates.length === 0) {
      clearSky();

      return;
    }

    const c = outcome.candidates[selected];

    if (!c) {
      return;
    }

    updateSky(c.transform, image.width, image.height);
  }, [
    image,
    fisheyeCamera,
    outcome,
    selected,
    updateSky,
    updateFisheye,
    clearSky,
  ]);

  // 방향키로 후보 탐색
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const n = outcome?.candidates.length ?? 0;

      if (n === 0 || (e.key !== "ArrowUp" && e.key !== "ArrowDown")) {
        return;
      }

      e.preventDefault();
      setSelected((prev) => {
        if (e.key === "ArrowDown") {
          return prev < n - 1 ? prev + 1 : prev;
        }

        return prev > 0 ? prev - 1 : 0;
      });
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [outcome]);

  // Canvas 렌더링
  useEffect(() => {
    if (!canvasElement.current || !image) {
      return;
    }

    const context = canvasElement.current.getContext("2d");

    if (!context) {
      return;
    }

    context.drawImage(image, 0, 0, image.width, image.height);

    // 사진 크기와 무관하게 비슷한 크기로 보이도록 표시 크기를 대각선 길이에 맞춘다
    const unit = Math.hypot(image.width, image.height) / 1400;
    const fontPx = Math.round(18 * unit);

    photoStars.forEach(({ x, y }) => {
      context.beginPath();
      context.arc(x, y, 5 * unit, 0, 2 * Math.PI);
      context.strokeStyle = "oklch(0.704 0.191 22.216)";
      context.lineWidth = 2 * unit;
      context.stroke();
    });

    skyStars.forEach(({ name, x, y }) => {
      context.beginPath();
      context.arc(x, y, (name ? 10 : 6) * unit, 0, 2 * Math.PI);
      context.strokeStyle = "oklch(.606 .25 292.717)";
      context.lineWidth = (name ? 3 : 1.5) * unit;
      context.stroke();

      if (name) {
        context.font = `bold ${fontPx}px Arial`;
        context.fillStyle = "oklch(.606 .25 292.717)";
        context.fillText(name, x + 14 * unit, y + 6 * unit);
      }
    });

    skyConstellations.forEach(({ label, lines }) => {
      context.strokeStyle = "oklch(0.905 0.182 98.111)";
      context.lineWidth = 1.5 * unit;

      for (let i = 0; i < lines.length - 1; i++) {
        const a = lines[i];
        const b = lines[i + 1];

        // 한쪽 정점이라도 뒤쪽 반구/먼 영역(null)이면 그 선분은 그리지 않는다
        if (!a || !b) {
          continue;
        }

        context.beginPath();
        context.moveTo(a[0], a[1]);
        context.lineTo(b[0], b[1]);
        context.stroke();
      }

      const visible = lines.filter(
        (l): l is [number, number] =>
          l !== null &&
          l[0] >= 0 &&
          l[0] < image.width &&
          l[1] >= 0 &&
          l[1] < image.height,
      );

      if (visible.length === 0) {
        return;
      }

      const center = visible
        .reduce((sum, l) => [sum[0] + l[0], sum[1] + l[1]], [0, 0])
        .map((v) => v / visible.length);

      context.font = `bold ${fontPx}px Arial`;
      context.fillStyle = "oklch(0.905 0.182 98.111)";
      context.fillText(label, center[0], center[1]);
    });
  }, [canvasElement, image, photoStars, skyStars, skyConstellations]);

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

  const candidates = outcome?.candidates ?? [];
  const answer = getSampleAnswer(image.src);

  return (
    <div className="flex size-full flex-col justify-stretch gap-4">
      <div className="flex h-full flex-row overflow-hidden">
        {error && !solving && (
          <div className="bg-base-200 rounded-box flex h-full w-100 shrink-0 flex-col items-center justify-center gap-3 p-4 text-center">
            <div className="text-error text-xl">풀이 중 문제가 생겼습니다.</div>
            <div className="text-sm opacity-70">{error}</div>
            <button className="btn btn-sm" onClick={runSolve}>
              다시 시도
            </button>
          </div>
        )}
        {!error && fisheyeCamera && (
          <div className="bg-base-200 rounded-box flex h-full w-100 shrink-0 flex-col gap-2 p-4">
            <div className="text-success font-bold">별자리를 찾았습니다</div>
            <div className="text-xs opacity-60">
              초광각(어안) 렌즈 보정을 적용했습니다.
            </div>
          </div>
        )}
        {!error && !fisheyeCamera && (solving || !ready) && (
          <SolveProgress ready={ready} phase={phase} />
        )}
        {!error &&
          !fisheyeCamera &&
          !solving &&
          outcome &&
          candidates.length === 0 && (
            <div className="bg-base-200 rounded-box flex h-full w-100 shrink-0 flex-col items-center justify-center gap-2 p-4 text-center">
              <div className="text-xl">별자리를 찾지 못했습니다.</div>
              <div className="text-sm opacity-70">
                별이 아닌 마커(지면 불빛·나무 등)를 지우거나, 별이 있는 영역만
                골라 다시 시도해 보세요.
              </div>
              {answer && <KnownAnswerNote answer={answer} found={false} />}
            </div>
          )}
        {!error && !fisheyeCamera && !solving && candidates.length > 0 && (
          <CandidateList
            candidates={candidates}
            selected={selected}
            found={outcome?.found ?? false}
            timeMs={outcome?.timeMs ?? 0}
            timedOut={outcome?.timedOut ?? false}
            answer={answer}
            onSelect={setSelected}
          />
        )}
        <div className="flex grow justify-center">
          <canvas
            className="max-h-full"
            ref={canvasElement}
            width={image.width}
            height={image.height}
            style={{ aspectRatio: image.width / image.height }}
          />
        </div>
      </div>
      <StepMover disableNext={true} />
    </div>
  );
}

// solver가 쓰는 별 패턴 이름 (진행 문구용)
const SOLVER_PATTERN_NAMES: Record<string, string> = {
  improved: "4개 별 패턴(quad)",
  triangle: "3개 별 패턴(삼각형)",
};

// 풀이 진행 단계를 사람이 읽는 문장으로
const describePhase = (ready: boolean, phase: SolvePhase | null): string => {
  if (!ready) {
    return "별 데이터베이스를 준비하고 있습니다";
  }

  if (!phase) {
    return "풀이를 시작합니다";
  }

  if (phase.kind === "fisheye") {
    return "초광각(어안) 렌즈로 보고 다시 찾고 있습니다";
  }

  const pattern = SOLVER_PATTERN_NAMES[phase.solverKey] ?? "별 패턴";

  return `${phase.region}에서 밝은 별 ${phase.inputSize}개의 ${pattern}으로 찾고 있습니다 (${phase.index + 1}/${phase.total})`;
};

// 풀이가 진행 중임을 보여 준다. 몇 초 걸릴 수 있어 단계·경과 시간을 함께 보여 준다.
function SolveProgress({
  ready,
  phase,
}: {
  ready: boolean;
  phase: SolvePhase | null;
}) {
  const [elapsedSec, setElapsedSec] = useState(0);

  useEffect(() => {
    const startedAt = Date.now();
    const timer = setInterval(
      () => setElapsedSec((Date.now() - startedAt) / 1000),
      200,
    );

    return () => clearInterval(timer);
  }, []);

  // 직선투영 단계는 입력 크기 순서로, 어안 시도는 마지막 단계로 본다
  const progress = !phase
    ? 0
    : phase.kind === "fisheye"
      ? 0.95
      : (phase.index + 0.5) / (phase.total + 1);

  return (
    <div className="bg-base-200 rounded-box flex h-full w-100 shrink-0 flex-col items-center justify-center gap-3 p-4 text-center">
      <span className="loading loading-spinner loading-lg"></span>
      <div className="text-lg">{describePhase(ready, phase)}</div>
      {ready && (
        <progress
          className="progress progress-primary w-full"
          value={progress}
          max={1}
        />
      )}
      <div className="text-xs opacity-60">
        {elapsedSec.toFixed(1)}초 · 보통 10초 안에 끝납니다
      </div>
    </div>
  );
}

interface CandidateListProps {
  candidates: SolveCandidateResult[];
  selected: number;
  found: boolean;
  timeMs: number;
  timedOut: boolean;
  answer: SampleAnswer | null;
  onSelect: (index: number) => void;
}

function CandidateList({
  candidates,
  selected,
  found,
  timeMs,
  timedOut,
  answer,
  onSelect,
}: CandidateListProps) {
  return (
    <div className="bg-base-200 rounded-box flex h-full w-100 shrink-0 flex-col overflow-hidden">
      <div className="border-base-300 border-b p-2 text-sm">
        {found ? (
          <div className="text-success font-bold">해를 찾았습니다 (1순위)</div>
        ) : (
          <div className="opacity-70">
            확신할 수 없습니다. 후보 중 별자리가 사진과 맞는 것을 골라 보세요.
            {timedOut && " (시간 안에 다 찾지 못했습니다)"}
          </div>
        )}
        <div
          title={`신뢰도 N은 우연히 이만큼 맞을 확률이 10^-N이라는 뜻입니다. ${ACCEPT.minLogOdds} 이상이면 확신합니다.`}
        >
          후보 {candidates.length}개 (신뢰도 순) · {(timeMs / 1000).toFixed(1)}
          초
        </div>
        {answer && <KnownAnswerNote answer={answer} found />}
      </div>
      <ul className="menu h-full flex-col flex-nowrap items-start overflow-y-scroll">
        {candidates.map((c, i) => {
          // 검증된 정답(approximate 아님)일 때만 후보에 ✓를 단다
          const isAnswer =
            answer && !answer.approximate
              ? matchesAnswer(c.centerVector, answer)
              : false;

          return (
            <li
              key={`candidate-${i}`}
              className="w-full"
              ref={(el) => {
                if (el && selected === i) {
                  el.scrollIntoView({ block: "nearest" });
                }
              }}
            >
              <a
                className={cn(
                  selected === i
                    ? "bg-primary/20 font-bold"
                    : "hover:bg-base-300/50",
                )}
                onClick={() => onSelect(i)}
              >
                {isAnswer && (
                  <span className="badge badge-success badge-sm">✓ 정답</span>
                )}
                {`${i + 1}. 매칭 ${c.inlierCount}개, 신뢰도 ${c.confidence.toFixed(0)}, FOV ${c.fovDeg.toFixed(0)}°`}
              </a>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

// 이 샘플의 알려진 정답(검증된 ground truth)을 안내한다. 후보 중 ✓ 표시와 함께
// 사람이 헷갈리지 않게 한다.
function KnownAnswerNote({
  answer,
  found,
}: {
  answer: SampleAnswer;
  found: boolean;
}) {
  return (
    <div
      className={cn(
        "mt-1 text-xs",
        answer.approximate
          ? "text-warning/80"
          : found
            ? "text-success/80"
            : "text-info/80",
      )}
    >
      {answer.approximate ? "예상 영역(대략): " : "알려진 정답: "}
      {answer.name} · 중심 RA {answer.centerRaDeg.toFixed(0)}° Dec{" "}
      {answer.centerDecDeg.toFixed(0)}° · 시야 약 {answer.fovDeg.toFixed(0)}°
    </div>
  );
}
