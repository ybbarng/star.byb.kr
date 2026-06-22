import type { SampleAnswer } from "@/plate-solver/sampleAnswers";
import type { SolveCandidateResult } from "@/search/solvers";
import { useEffect, useMemo, useRef, useState } from "react";
import { getFisheyeLabels } from "@/plate-solver/fisheyeSamples";
import { getSampleAnswer, matchesAnswer } from "@/plate-solver/sampleAnswers";
import StepMover from "@/plate-solver/StepMover";
import { useContextStore } from "@/plate-solver/store/context";
import useSkyOverlay from "@/search/hooks/useSkyOverlay";
import useSolve from "@/search/hooks/useSolve";
import { fitFisheyeCamera } from "@/search/utils/fisheye";
import { cn } from "@/utils/cn";

export default function PlateSolvingStep() {
  const image = useContextStore((state) => state.image);
  const photoStars = useContextStore((state) => state.photoStars);
  const canvasElement = useRef<HTMLCanvasElement>(null);
  const { solve, outcome, solving, ready } = useSolve();
  const {
    stars: skyStars,
    constellations: skyConstellations,
    update: updateSky,
    updateFisheye,
    clear: clearSky,
  } = useSkyOverlay();
  const [selected, setSelected] = useState(0);

  // 어안 보정이 있는 샘플이면 라벨로 카메라를 피팅한다(초광각 은하수 등).
  const fisheye = useMemo(() => {
    const labels = getFisheyeLabels(image?.src);

    if (!labels) {
      return null;
    }

    return fitFisheyeCamera(labels.corr, labels.width, labels.height);
  }, [image?.src]);

  // 검출된 별로 plate solving 실행 (어안 샘플은 라벨 기준으로 바로 그린다)
  useEffect(() => {
    if (fisheye || !image || photoStars.length < 1 || !ready) {
      return;
    }

    solve(
      photoStars.map((s) => ({ x: s.x, y: s.y, brightness: s.brightness })),
      image.width,
      image.height,
      "triangle",
    );
  }, [fisheye, image, photoStars, ready, solve]);

  // 결과가 오면 최상위 후보 선택
  useEffect(() => {
    setSelected(0);
  }, [outcome]);

  // 어안 보정 샘플: 라벨로 피팅한 어안 카메라로 별자리를 그린다
  useEffect(() => {
    if (!image || !fisheye) {
      return;
    }

    updateFisheye(fisheye.camera, image.width, image.height);
  }, [image, fisheye, updateFisheye]);

  // 선택된 후보의 변환행렬로 별/별자리 투영 (어안 샘플은 위에서 처리)
  useEffect(() => {
    if (fisheye) {
      return;
    }

    if (!image || !outcome || outcome.candidates.length === 0) {
      clearSky();

      return;
    }

    const c = outcome.candidates[selected];

    if (!c) {
      return;
    }

    updateSky(c.transform, image.width, image.height);
  }, [fisheye, image, outcome, selected, updateSky, clearSky]);

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

    photoStars.forEach(({ x, y }) => {
      context.beginPath();
      context.arc(x, y, 5, 0, 2 * Math.PI);
      context.strokeStyle = "oklch(0.704 0.191 22.216)";
      context.lineWidth = 2;
      context.stroke();
    });

    skyStars.forEach(({ label, x, y }) => {
      context.beginPath();
      context.arc(x, y, 10, 0, 2 * Math.PI);
      context.strokeStyle = "oklch(.606 .25 292.717)";
      context.lineWidth = 3;
      context.stroke();

      context.font = "bold 20px Arial";
      context.fillStyle = "oklch(.606 .25 292.717)";
      context.fillText(label, x + 16, y + 7);
    });

    skyConstellations.forEach(({ label, lines }) => {
      context.strokeStyle = "oklch(0.905 0.182 98.111)";
      context.lineWidth = 1;

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

      context.font = "bold 20px Arial";
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
        {fisheye && (
          <div className="bg-base-200 rounded-box flex h-full w-100 shrink-0 flex-col gap-2 p-4">
            <div className="text-success text-xl font-bold">어안 보정 적용</div>
            <div className="text-sm opacity-80">
              초광각(어안) 렌즈로 찍은 사진이라 직선투영으로는 안 맞습니다.
              사람이 라벨한 별로 어안 카메라를 보정해 별자리를 그렸습니다.
            </div>
            <div className="text-xs opacity-60">
              피팅 오차 RMS {fisheye.rms.toFixed(1)}px · 어안초점 f≈
              {fisheye.camera.ffish.toFixed(0)}px
            </div>
            {answer && <KnownAnswerNote answer={answer} found />}
          </div>
        )}
        {!fisheye && (solving || !ready) && (
          <div className="bg-base-200 rounded-box flex h-full w-100 shrink-0 flex-col items-center justify-center gap-2">
            <div className="text-xl">
              {!ready ? "데이터베이스 로딩" : "별자리 분석"} 중입니다.
            </div>
            <span className="loading loading-spinner loading-lg"></span>
          </div>
        )}
        {!fisheye && !solving && outcome && candidates.length === 0 && (
          <div className="bg-base-200 rounded-box flex h-full w-100 shrink-0 flex-col items-center justify-center gap-2 p-4 text-center">
            <div className="text-xl">별자리를 찾지 못했습니다.</div>
            <div className="text-sm opacity-70">
              별을 더 정확히 표시하거나 더 많이 선택해 보세요.
            </div>
            {answer && <KnownAnswerNote answer={answer} found={false} />}
          </div>
        )}
        {!fisheye && !solving && candidates.length > 0 && (
          <CandidateList
            candidates={candidates}
            selected={selected}
            found={outcome?.found ?? false}
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

interface CandidateListProps {
  candidates: SolveCandidateResult[];
  selected: number;
  found: boolean;
  answer: SampleAnswer | null;
  onSelect: (index: number) => void;
}

function CandidateList({
  candidates,
  selected,
  found,
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
            확신할 수 없습니다. 후보 중 골라 보세요.
          </div>
        )}
        <div>후보 {candidates.length}개 (신뢰도 순)</div>
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
