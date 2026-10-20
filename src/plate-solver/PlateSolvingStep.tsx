import type { SampleAnswer } from "@/plate-solver/sampleAnswers";
import type { ShotTime } from "@/plate-solver/shotTime";
import type {
  EstimateMarks,
  PickTarget,
} from "@/plate-solver/ShotTimeEstimator";
import type { HorizonSolveResult } from "@/search/horizonSolve";
import type { SolvePhase } from "@/search/solvePhoto";
import type { SolveCandidateResult } from "@/search/solvers";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getSampleAnswer, matchesAnswer } from "@/plate-solver/sampleAnswers";
import { getSampleShot, shotDate, shotFromExif } from "@/plate-solver/shotTime";
import ShotTimeControl from "@/plate-solver/ShotTimeControl";
import ShotTimeEstimator from "@/plate-solver/ShotTimeEstimator";
import StepMover from "@/plate-solver/StepMover";
import { useContextStore } from "@/plate-solver/store/context";
import useSkyOverlay from "@/search/hooks/useSkyOverlay";
import useSolve from "@/search/hooks/useSolve";
import { HORIZON_ACCEPT_LOG_ODDS } from "@/search/horizonSolve";
import { DEEP_SKY_OBJECTS, solarSystemObjects } from "@/search/skyObjects";
import { horizonSolveInWorker } from "@/search/solverClient";
import { ACCEPT } from "@/search/solvers/candidates";
import { readExif } from "@/services/exif";
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
    objects: skyObjects,
    update: updateSky,
    updateFisheye,
    clear: clearSky,
  } = useSkyOverlay();
  const [selected, setSelected] = useState(0);
  const [shot, setShot] = useState<ShotTime | null>(null);
  const [picking, setPicking] = useState<PickTarget>(null);
  const [marks, setMarks] = useState<EstimateMarks>(NO_MARKS);
  // 시각·장소·지평선 풀이 결과 (확신했을 때만 result가 있다)
  const [horizonRun, setHorizonRun] = useState<{
    running: boolean;
    result: HorizonSolveResult | null;
    message: string | null;
  }>(NO_HORIZON_RUN);
  const horizonTP = horizonRun.result?.TP;

  // 사진이 바뀌면 찍은 점도 지운다
  useEffect(() => {
    setMarks(NO_MARKS);
    setPicking(null);
    setHorizonRun(NO_HORIZON_RUN);
  }, [image]);

  // 촬영 시각 추정용으로 사진을 클릭해 지평선·달 위치를 찍는다
  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!picking || !image) {
      return;
    }

    const rect = e.currentTarget.getBoundingClientRect();
    const point: [number, number] = [
      ((e.clientX - rect.left) / rect.width) * image.width,
      ((e.clientY - rect.top) / rect.height) * image.height,
    ];

    if (picking === "moon") {
      setMarks((m) => ({ ...m, moon: point }));
      setPicking(null);

      return;
    }

    setMarks((m) => {
      const horizon = m.horizon.length >= 2 ? [point] : [...m.horizon, point];

      if (horizon.length === 2) {
        setPicking(null);
      }

      return { ...m, horizon };
    });
  };

  // 촬영 시각: 기록을 아는 샘플이면 그 기록, 아니면 사진의 EXIF. 둘 다 없으면 사람이 넣는다.
  useEffect(() => {
    if (!image) {
      return;
    }

    const known = getSampleShot(image.src);
    setShot(known);

    if (known) {
      return;
    }

    let cancelled = false;
    fetch(image.src)
      .then((r) => r.arrayBuffer())
      .then((buffer) => {
        if (!cancelled) {
          setShot(shotFromExif(readExif(buffer)));
        }
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [image]);

  // 딥스카이는 늘, 해·달·행성은 촬영 시각을 알 때만 그린다
  const objects = useMemo(() => {
    const date = shot ? shotDate(shot) : null;

    return date && !Number.isNaN(date.getTime())
      ? [...DEEP_SKY_OBJECTS, ...solarSystemObjects(date, shot?.observer)]
      : DEEP_SKY_OBJECTS;
  }, [shot]);

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
        ringContrast: s.ringContrast,
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
      updateFisheye(fisheyeCamera, image.width, image.height, objects);

      return;
    }

    if (horizonTP) {
      updateSky(horizonTP, image.width, image.height, objects);

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

    updateSky(c.transform, image.width, image.height, objects);
  }, [
    image,
    objects,
    fisheyeCamera,
    horizonTP,
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

    // 달은 밝은 빛 한가운데 있곤 해서, 어두운 테두리를 먼저 그리고 그 위에 색을 칠한다
    const SHADOW = "oklch(0 0 0 / 0.75)";

    skyObjects.forEach(({ name, kind, x, y, radiusPx }) => {
      const color = OBJECT_COLORS[kind];
      const r = Math.max(radiusPx, 12 * unit);
      const labelX = x + r * 0.75 + 4 * unit;
      const labelY = y - r * 0.75;

      context.setLineDash(kind === "deepSky" ? [6 * unit, 4 * unit] : []);

      for (const [style, width] of [
        [SHADOW, 5 * unit],
        [color, 2 * unit],
      ] as const) {
        context.strokeStyle = style;
        context.lineWidth = width;
        context.beginPath();
        context.arc(x, y, r, 0, 2 * Math.PI);
        context.stroke();
      }

      context.setLineDash([]);
      context.font = `bold ${fontPx}px Arial`;
      context.strokeStyle = SHADOW;
      context.lineWidth = 4 * unit;
      context.strokeText(name, labelX, labelY);
      context.fillStyle = color;
      context.fillText(name, labelX, labelY);
    });

    // 촬영 시각 추정용으로 찍은 점: 지평선은 초록 선, 달은 흰 십자
    context.strokeStyle = "oklch(0.792 0.209 151.711)";
    context.lineWidth = 3 * unit;
    marks.horizon.forEach(([x, y]) => {
      context.beginPath();
      context.arc(x, y, 8 * unit, 0, 2 * Math.PI);
      context.stroke();
    });

    if (marks.horizon.length === 2) {
      context.beginPath();
      context.moveTo(...marks.horizon[0]);
      context.lineTo(...marks.horizon[1]);
      context.stroke();
    }

    if (marks.moon) {
      const [x, y] = marks.moon;
      context.strokeStyle = "oklch(0.97 0 0)";
      context.beginPath();
      context.moveTo(x - 14 * unit, y);
      context.lineTo(x + 14 * unit, y);
      context.moveTo(x, y - 14 * unit);
      context.lineTo(x, y + 14 * unit);
      context.stroke();
    }
  }, [
    canvasElement,
    image,
    photoStars,
    skyStars,
    skyConstellations,
    skyObjects,
    marks,
  ]);

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
  const selectedTransform =
    !fisheyeCamera && !solving
      ? (horizonTP ?? candidates[selected]?.transform)
      : undefined;

  // 촬영 시각·장소와 지평선 두 점으로 푼다 (별이 적어 자동으로 못 푸는 사진)
  const runHorizonSolve = () => {
    const observer = shot?.observer;

    if (!observer || marks.horizon.length < 2) {
      return;
    }

    const offsetHours = parseInt(shot.offset, 10);
    setHorizonRun({ running: true, result: null, message: null });
    horizonSolveInWorker(
      [...photoStars, ...hiddenStars].map((s) => ({
        x: s.x,
        y: s.y,
        brightness: s.brightness,
        ringContrast: s.ringContrast,
      })),
      image.width,
      image.height,
      [marks.horizon[0], marks.horizon[1]],
      shotDate(shot),
      observer,
    )
      .then((r) => {
        if (!r) {
          setHorizonRun({
            running: false,
            result: null,
            message: "지평선 위에 별이 너무 적어 풀 수 없습니다.",
          });

          return;
        }

        const accepted = r.logOdds >= HORIZON_ACCEPT_LOG_ODDS;
        const local = new Date(r.date.getTime() + offsetHours * 3600000)
          .toISOString()
          .slice(0, 16)
          .replace("T", " ");
        setHorizonRun({
          running: false,
          result: accepted ? r : null,
          message: accepted
            ? `시각·장소로 찾았습니다 · 맞는 별 ${r.inlierCount}/${r.photoCount}개 · 신뢰도 ${r.logOdds.toFixed(1)} · 하늘이 맞는 촬영 시각 ${local}`
            : `확신하지 못했습니다 (맞는 별 ${r.inlierCount}/${r.photoCount}개, 신뢰도 ${r.logOdds.toFixed(1)}). 시각·장소·지평선을 확인해 보세요.`,
        });
      })
      .catch((e: Error) =>
        setHorizonRun({ running: false, result: null, message: e.message }),
      );
  };

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
        <div className="flex grow flex-col items-center gap-2">
          <ShotTimeControl shot={shot} onChange={setShot} />
          <div className="flex min-h-0 w-full flex-1 justify-center">
            <canvas
              className={cn(
                "max-h-full max-w-full",
                picking && "cursor-crosshair",
              )}
              ref={canvasElement}
              width={image.width}
              height={image.height}
              style={{ aspectRatio: image.width / image.height }}
              onClick={handleCanvasClick}
            />
          </div>
          {!fisheyeCamera && !solving && ready && (
            <ShotTimeEstimator
              transform={selectedTransform}
              width={image.width}
              shot={shot}
              marks={marks}
              picking={picking}
              onPick={setPicking}
              onClear={() => setMarks(NO_MARKS)}
              onApply={setShot}
              horizonSolve={{
                ready: Boolean(shot?.observer) && marks.horizon.length === 2,
                running: horizonRun.running,
                message: horizonRun.message,
                onRun: runHorizonSolve,
              }}
            />
          )}
        </div>
      </div>
      <StepMover disableNext={true} />
    </div>
  );
}

const NO_MARKS: EstimateMarks = { horizon: [], moon: null };
const NO_HORIZON_RUN = { running: false, result: null, message: null };

// 천체 종류별 표시 색 (별은 보라, 별자리선은 노랑)
const OBJECT_COLORS = {
  deepSky: "oklch(0.789 0.154 211.53)",
  moon: "oklch(0.97 0 0)",
  sun: "oklch(0.852 0.199 91.936)",
  planet: "oklch(0.75 0.183 55.934)",
};

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
