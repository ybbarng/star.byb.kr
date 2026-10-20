"use client";

import type { SkyItem } from "@/game/sky/drawSky";
import type { Difficulty, SkyScene } from "@/game/sky/scene";
import type { Emphasis } from "@/game/skyMatch/AllSkyView";
import type {
  ComputerSolve,
  Dials,
  HintDial,
} from "@/game/skyMatch/solveSteps";
import type { HintStage } from "@/game/skyMatch/solveSteps";
import type { Point2D, Point3D } from "@/scripts/hash/types";
import type { Mat3 } from "@/search/utils/similarity";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ChoiceCards,
  Confetti,
  FxLayer,
  GameIntro,
  readBest,
  saveBest,
  StarRating,
  useFx,
} from "@/game/fx/Fx";
import LineReveal from "@/game/fx/LineReveal";
import { sfx } from "@/game/fx/sound";
import {
  CONSTELLATIONS,
  pickItem,
  projectLines,
  STARS,
} from "@/game/sky/catalog";
import { drawSky } from "@/game/sky/drawSky";
import ItemInfo, { canvasPoint } from "@/game/sky/ItemInfo";
import { dailySeed, localMeanTime, makeSkyScene } from "@/game/sky/scene";
import AllSkyView from "@/game/skyMatch/AllSkyView";
import {
  answerDials,
  dialDate,
  matchedFlags,
  SOLVED_RATIO,
  targetStars,
} from "@/game/skyMatch/match";
import { computerSolve, dragDials, hintFor } from "@/game/skyMatch/solveSteps";
import { horizonCameraTP } from "@/search/horizonSolve";
import { estimateShotTimes } from "@/search/shotTimeEstimate";
import {
  fromAltAzJ2000,
  horizontalFrameJ2000,
  julianDay,
  localSiderealDeg,
} from "@/search/utils/ephemeris";
import { photoToSky, projectVecToPhoto } from "@/search/utils/wcs";
import { cn } from "@/utils/cn";

// 하늘 맞추기 퍼즐 (docs/game-plans.md 1): 정답 사진의 밝은 별 자리(고리)에 내 하늘을 겹친다.
// 위도를 돌리면 하늘이 기울고, 시각·날짜를 돌리면 하늘이 돈다. 같은 하늘이면 어느 날짜·시각 조합이든 정답이다.
// 어렵지 않게: 단계(돌리기만 → 기울이기만 → 둘 다), 쉬움에서는 정답 하늘의 별자리선(유령)을 보여 주고,
// 한동안 진전이 없으면 방향 힌트를 조금씩 더 준다. 하늘 전체 뷰에서 극의 높이(위도)와 회전(시각)을 함께 본다.
// 다 맞추면 "컴퓨터는 이렇게 풀어요": 플레이트 솔빙 → 지평선 → 천정 → 위도·시각.

type Level = "1" | "2" | "3";

const LEVELS: { value: Level; title: string; note: string }[] = [
  {
    value: "1",
    title: "1단계 돌리기",
    note: "위도는 맞춰 뒀어요. 날짜·시각만",
  },
  {
    value: "2",
    title: "2단계 기울이기",
    note: "날짜·시각은 맞춰 뒀어요. 위도만",
  },
  { value: "3", title: "3단계 둘 다", note: "위도·날짜·시각 모두" },
];

const DIFFICULTIES: { value: Difficulty; title: string; note: string }[] = [
  { value: "easy", title: "쉬움", note: "정답 별자리선이 흐리게 보여요" },
  { value: "normal", title: "보통", note: "고리만 보여요" },
  { value: "hard", title: "어려움", note: "고리만, 도시 불빛, 별이 적어요" },
];

// 이 단계에서 움직이지 않는 다이얼
const LOCKED: Record<Level, HintDial | null> = {
  "1": "lat",
  "2": "time",
  "3": null,
};

const HINT_TITLES: Record<HintStage, string> = {
  1: "이야기 단서",
  2: "하늘 단서",
  3: "별이 가야 할 쪽",
  4: "다이얼 구간",
};
// 연한 화살표를 그릴 별 수 (밝은 순)
const ARROW_STARS = 4;
// 화살표 길이 상한 (정답 자리까지 잇지 않고 방향만)
const ARROW_MAX_PX = 70;

// 진전이 없으면 이만큼마다 힌트를 한 단계씩 더 준다
const HINT_INTERVAL_MS = 15000;
// 다이얼을 놓은 뒤 이만큼 동안 극·적도·별 궤적 단서를 보여 준다
const CUE_MS = 1500;
// 궤적을 그릴 밝은 별 수
const TRAIL_STARS = STARS.filter((s) => s.mag < 2.6);

// 다이얼을 적게 잡을수록 별이 많다
const starsFor = (moves: number) => (moves <= 8 ? 3 : moves <= 16 ? 2 : 1);

const pad = (n: number) => String(n).padStart(2, "0");
const MONTH_STARTS = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];

const dayLabel = (day: number) => {
  const m = MONTH_STARTS.findLastIndex((s) => s <= day);

  return `${m + 1}월 ${day - MONTH_STARTS[m] + 1}일`;
};

const timeLabel = (minutes: number) =>
  `${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}`;

const latLabel = (lat: number) =>
  lat === 0 ? "적도" : `${lat > 0 ? "북위" : "남위"} ${Math.abs(lat)}°`;

const LAT_MIN = -60;
const LAT_MAX = 70;

// 처음 다이얼: 오늘 날짜 밤 9시, 북위 37° (서울쯤). 단계에 따라 잠긴 다이얼은 정답으로 맞춰 둔다
const startDials = (scene: SkyScene, level: Level): Dials => {
  const now = new Date();
  const today = Math.floor(
    (Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) -
      Date.UTC(now.getFullYear(), 0, 1)) /
      86400000,
  );
  const a = answerDials(scene);
  const lat = Math.round(a.latDeg);

  if (level === "1") {
    return { latDeg: lat, dayOfYear: today, minutes: 21 * 60 };
  }

  if (level === "2") {
    // 정답에서 25~35° 떨어진 위도에서 시작
    const off = 25 + (scene.seed % 11);
    const start = lat + off <= LAT_MAX ? lat + off : lat - off;

    return {
      latDeg: Math.max(LAT_MIN, Math.min(LAT_MAX, start)),
      dayOfYear: a.dayOfYear,
      minutes: a.minutes,
    };
  }

  return { latDeg: 37, dayOfYear: today, minutes: 21 * 60 };
};

export default function SkyMatchGame() {
  const [started, setStarted] = useState(false);
  const [level, setLevel] = useState<Level>("1");
  const [difficulty, setDifficulty] = useState<Difficulty>("easy");

  // 깬 단계가 있으면 그다음 단계를 미리 골라 둔다 (처음이면 1단계)
  useEffect(() => {
    const cleared = LEVELS.filter((l) =>
      DIFFICULTIES.some((d) => readBest(`sky-match-${d.value}-${l.value}`)),
    ).map((l) => Number(l.value));
    const next = Math.min(3, Math.max(0, ...cleared) + 1);

    setLevel(String(next) as Level);
  }, []);

  if (!started) {
    return (
      <GameIntro
        title="하늘 맞추기"
        tagline="다이얼을 돌려 사진 속 하늘을 똑같이 만들어라!"
        howTo={[
          "고리는 정답 사진에서 별이 있던 자리예요. 내 하늘의 별을 고리 안에 넣으세요.",
          "위도는 하늘을 기울이고, 날짜·시각은 하늘을 돌려요. 오른쪽 하늘 전체 뷰에서 그 모습이 보여요.",
          "하늘을 직접 끌어도 돼요. 별을 잡고 끌면 그 별이 따라오도록 다이얼이 저절로 돌아가요.",
          `고리 ${Math.round(SOLVED_RATIO * 100)}%가 초록이 되면 성공! 막히면 힌트가 조금씩 나와요.`,
        ]}
        onStart={() => setStarted(true)}
      >
        <ChoiceCards
          label="단계 · 무엇을 돌릴까요?"
          options={LEVELS}
          value={level}
          onChange={setLevel}
        />
        <ChoiceCards
          label="난이도 · 얼마나 도와줄까요?"
          options={DIFFICULTIES}
          value={difficulty}
          onChange={setDifficulty}
        />
      </GameIntro>
    );
  }

  return <SkyMatchPlay startLevel={level} difficulty={difficulty} />;
}

interface RobotState {
  step: 1 | 2 | 3 | 4;
  solve: ComputerSolve;
}

function SkyMatchPlay({
  startLevel,
  difficulty,
}: {
  startLevel: Level;
  difficulty: Difficulty;
}) {
  const [level, setLevel] = useState<Level>(startLevel);
  // 시작할 때마다 새 문제 ("오늘의 문제" 버튼은 날짜로 정한 문제)
  const [seed, setSeed] = useState(() => Math.floor(Math.random() * 1e9));
  const [dialState, setDialState] = useState<Dials | null>(null);
  const [lines, setLines] = useState(false);
  const [moves, setMoves] = useState(0);
  const [hintStage, setHintStage] = useState<0 | HintStage>(0);
  const [emphasis, setEmphasis] = useState<Emphasis>(null);
  const [robot, setRobot] = useState<RobotState | null>(null);
  const [info, setInfo] = useState<{
    item: SkyItem | null;
    fx: number;
    fy: number;
  } | null>(null);
  const [fire, setFire] = useState(0);
  const [result, setResult] = useState<{
    newBest: boolean;
    best: number | null;
    byRobot: boolean;
  } | null>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const items = useRef<SkyItem[]>([]);
  const prevFlags = useRef<boolean[]>([]);
  const progress = useRef({ best: 0, at: Date.now() });
  const cueTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const trails = useRef<{ TP: Mat3; at: number }[]>([]);
  // 하늘을 끌 때 잡은 별 (그 별이 커서를 따라오게 다이얼을 고친다)
  const grab = useRef<{
    vector: Point3D;
    x: number;
    y: number;
    moved: boolean;
  } | null>(null);
  const dialsRef = useRef<Dials>({ latDeg: 0, dayOfYear: 0, minutes: 0 });
  const fx = useFx();

  const scene = useMemo(
    () => makeSkyScene(seed, difficulty),
    [seed, difficulty],
  );
  const dials = dialState ?? startDials(scene, level);
  dialsRef.current = dials;
  const locked = LOCKED[level];
  const targets = useMemo(() => targetStars(scene, STARS), [scene]);
  // 하늘 단서에 쓸, 정답 사진에서 가장 밝은 이름 있는 별 (지평선에 붙은 별보다 사진 위쪽 별)
  const landmark = useMemo(() => {
    const named = targets.flatMap((t) => {
      const star = STARS.find((s) => s.vector === t.vector);

      return star?.name
        ? [{ name: star.name, vector: t.vector, y: t.at[1] }]
        : [];
    });
    const high = named.find((n) => n.y < scene.height * 0.55) ?? named[0];

    return high && { name: high.name, vector: high.vector };
  }, [targets, scene]);
  // 다이얼로 정한 내 하늘 (같은 카메라 방향, 내 위도·날짜·시각)
  const player = useMemo(() => {
    const date = dialDate(scene, dials.dayOfYear, dials.minutes);
    const observer = { latDeg: dials.latDeg, lonDeg: scene.observer.lonDeg };

    return {
      date,
      observer,
      TP: horizonCameraTP(
        date,
        observer,
        scene.view,
        scene.width,
        scene.height,
      ),
    };
  }, [scene, dials.dayOfYear, dials.minutes, dials.latDeg]);
  const flags = useMemo(
    () => matchedFlags(targets, player.TP, scene),
    [targets, player, scene],
  );
  const ratio = flags.filter(Boolean).length / Math.max(1, flags.length);
  const solved = ratio >= SOLVED_RATIO;
  const inView = ([x, y]: Point2D) =>
    x > 0 && x < scene.width && y > 0 && y < scene.height;
  // 쉬움: 정답 하늘의 별자리선 (유령)
  const ghost = useMemo(
    () =>
      difficulty === "easy"
        ? projectLines(scene.TP, CONSTELLATIONS).filter((l) => l.some(inView))
        : [],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [difficulty, scene],
  );
  // 다 맞춘 하늘에 이어 그릴 별자리선
  const solvedLines = useMemo(
    () =>
      solved
        ? projectLines(player.TP, CONSTELLATIONS).filter((l) => l.some(inView))
        : [],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [solved, player, scene],
  );
  const hint =
    hintStage > 0 && !solved
      ? hintFor(scene, dials, hintStage as HintStage, locked, landmark)
      : null;

  // 새로 고리에 들어간 별: 초록 고리가 퍼지고, 맞은 수가 늘수록 높은 음
  useEffect(() => {
    const fresh = flags.flatMap((f, i) =>
      f && !prevFlags.current[i] && prevFlags.current.length ? [i] : [],
    );
    prevFlags.current = flags;

    if (fresh.length === 0) {
      return;
    }

    for (const i of fresh) {
      fx.ring(
        targets[i].at[0] / scene.width,
        targets[i].at[1] / scene.height,
        "#5ae678",
      );
    }

    sfx.twinkle(flags.filter(Boolean).length);
  }, [flags, targets, scene, fx]);

  // 진전(일치도가 오름)이 없으면 일정 시간마다 힌트를 한 단계 더
  useEffect(() => {
    if (ratio > progress.current.best + 0.03) {
      progress.current = { best: ratio, at: Date.now() };
    }
  }, [ratio]);

  useEffect(() => {
    if (solved || robot) {
      return;
    }

    const t = setInterval(() => {
      if (Date.now() - progress.current.at < HINT_INTERVAL_MS) {
        return;
      }

      progress.current.at = Date.now();
      setHintStage((s) => {
        if (s >= 4) {
          return s;
        }

        sfx.twinkle(2);

        return (s + 1) as HintStage;
      });
    }, 1000);

    return () => clearInterval(t);
  }, [solved, robot]);

  // 다 맞췄을 때 한 번: 팡파르, 색종이, 최소 기록 (컴퓨터가 풀었으면 기록하지 않는다)
  useEffect(() => {
    if (!solved || result) {
      return;
    }

    if (robot) {
      setResult({ newBest: false, best: null, byRobot: true });
      sfx.hit();

      return;
    }

    const key = `sky-match-${difficulty}-${level}`;
    const best = readBest(key);
    setResult({ newBest: saveBest(key, moves, true), best, byRobot: false });
    setFire(Date.now());
    sfx.win();
    fx.popup(0.5, 0.45, "맞췄어요!", "#7dffa0", 56);
  }, [solved, result, robot, difficulty, level, moves, fx]);

  // 다이얼을 움직이는 동안의 별 궤적 (최근 내 하늘들)
  useEffect(() => {
    if (!emphasis) {
      trails.current = [];

      return;
    }

    const now = Date.now();
    trails.current = [
      ...trails.current.filter((t) => now - t.at < CUE_MS),
      { TP: player.TP, at: now },
    ];
  }, [player, emphasis]);

  useEffect(() => {
    const ctx = canvas.current?.getContext("2d");

    if (!ctx) {
      return;
    }

    items.current = drawSky(ctx, {
      width: scene.width,
      height: scene.height,
      TP: player.TP,
      date: player.date,
      observer: player.observer,
      azimuthDeg: scene.view.azimuthDeg,
      magLimit: scene.magLimit,
      lightPollution: scene.lightPollution,
      groundSeed: scene.seed,
      stars: STARS,
      constellations: lines && !solved ? CONSTELLATIONS : undefined,
      compass: scene.difficulty === "easy" || solved,
    });

    drawGhost(ctx, scene, ghost);
    drawCues(ctx, scene, player.TP, emphasis, trails.current);

    if (hint?.arrows) {
      drawHintArrows(
        ctx,
        scene,
        targets,
        flags,
        player.TP,
        horizontalFrameJ2000(julianDay(player.date), player.observer).zenith,
      );
    }

    // 정답 사진의 별 자리: 맞으면 초록, 아직이면 하늘색 고리
    targets.forEach((t, i) => {
      const r = 7 + Math.max(0, 3.5 - t.mag) * 2;
      ctx.beginPath();
      ctx.arc(t.at[0], t.at[1], r, 0, Math.PI * 2);
      ctx.lineWidth = 2;
      ctx.strokeStyle = flags[i]
        ? "rgba(90,230,120,0.9)"
        : "rgba(120,200,255,0.7)";
      ctx.stroke();
    });

    if (robot) {
      drawRobot(ctx, scene, robot);
    }
  }, [
    scene,
    player,
    lines,
    solved,
    targets,
    flags,
    ghost,
    emphasis,
    robot,
    hint?.arrows,
  ]);

  const newRound = (next: number, nextLevel = level) => {
    setLevel(nextLevel);
    setSeed(next);
    setDialState(null);
    setLines(false);
    setMoves(0);
    setInfo(null);
    setResult(null);
    setHintStage(0);
    setRobot(null);
    prevFlags.current = [];
    progress.current = { best: 0, at: Date.now() };
    sfx.whoosh();
  };

  const setDial = (patch: Partial<Dials>, which: Emphasis) => {
    setDialState({ ...dials, ...patch });
    setInfo(null);
    setEmphasis(which);

    if (cueTimer.current) {
      clearTimeout(cueTimer.current);
    }

    cueTimer.current = setTimeout(() => setEmphasis(null), CUE_MS);
  };

  // 다이얼을 한 번 잡을 때마다 한 수
  const countMove = () => setMoves((m) => m + 1);

  // 컴퓨터에게 풀게 하기: 한 단계씩 보여 주고, 마지막에 다이얼을 구한 값으로 돌린다
  const runRobot = () => {
    sfx.whoosh();
    setHintStage(0);
    setRobot({
      step: 1,
      solve: computerSolve(
        scene,
        dials.dayOfYear,
        targets.map((t) => t.at),
      ),
    });
  };

  const robotNext = () => {
    if (!robot || robot.step >= 4) {
      return;
    }

    sfx.tap();
    const step = (robot.step + 1) as RobotState["step"];
    setRobot({ ...robot, step });

    if (step === 3) {
      animateDials(dials, {
        ...dials,
        latDeg: Math.round(robot.solve.latDeg),
        minutes: robot.solve.minutes,
      });
    }
  };

  // 다이얼이 저절로 돌아가는 모습 (시각은 가까운 쪽으로 돈다)
  const animateDials = (from: Dials, to: Dials) => {
    const start = performance.now();
    const dm = ((to.minutes - from.minutes + 720 + 1440) % 1440) - 720;

    const frame = (now: number) => {
      const k = Math.min(1, (now - start) / 1800);
      const e = 1 - (1 - k) ** 3;
      setDial(
        {
          latDeg: Math.round(from.latDeg + (to.latDeg - from.latDeg) * e),
          minutes:
            (((Math.round((from.minutes + dm * e) / 5) * 5) % 1440) + 1440) %
            1440,
        },
        k < 0.5 ? "lat" : "time",
      );

      if (k < 1) {
        requestAnimationFrame(frame);
      } else {
        setDialState({ ...to });
      }
    };

    requestAnimationFrame(frame);
  };

  return (
    <div className="flex w-full max-w-[1280px] flex-col gap-4">
      <Confetti fire={fire} />
      <div className="bg-base-200/80 rounded-box flex flex-wrap items-center gap-3 px-4 py-2 backdrop-blur">
        <h1 className="text-xl font-bold">하늘 맞추기</h1>
        <span className="badge badge-primary">
          {LEVELS.find((l) => l.value === level)!.title}
        </span>
        <span className="badge badge-ghost tabular-nums">다이얼 {moves}번</span>
        <div className="grow" />
        <button className="btn btn-sm" onClick={() => newRound(dailySeed())}>
          오늘의 문제
        </button>
        <button
          className="btn btn-sm btn-primary"
          onClick={() => newRound(Math.floor(Math.random() * 1e9))}
        >
          새 문제
        </button>
      </div>

      <div className="flex flex-col gap-4 lg:flex-row">
        <div className="relative grow">
          <canvas
            ref={canvas}
            width={scene.width}
            height={scene.height}
            className={cn(
              "rounded-box block w-full touch-none bg-black",
              solved ? "cursor-help" : "cursor-grab active:cursor-grabbing",
            )}
            onPointerDown={(e) => {
              const p = canvasPoint(e);
              grab.current = {
                vector: photoToSky(player.TP, [p.x, p.y]),
                x: e.clientX,
                y: e.clientY,
                moved: false,
              };
              e.currentTarget.setPointerCapture(e.pointerId);
            }}
            onPointerMove={(e) => {
              const g = grab.current;

              if (!g || solved || robot) {
                return;
              }

              if (
                !g.moved &&
                Math.hypot(e.clientX - g.x, e.clientY - g.y) < 5
              ) {
                return;
              }

              if (!g.moved) {
                g.moved = true;
                countMove();
              }

              const p = canvasPoint(e);
              const next = dragDials(
                scene,
                dialsRef.current,
                g.vector,
                [p.x, p.y],
                locked,
                [LAT_MIN, LAT_MAX],
              );
              const which: Emphasis =
                Math.abs(next.latDeg - dialsRef.current.latDeg) > 0.05
                  ? "lat"
                  : "time";
              setDial({ latDeg: next.latDeg, minutes: next.minutes }, which);
            }}
            onPointerUp={(e) => {
              const g = grab.current;
              grab.current = null;

              // 끌지 않고 눌렀으면 "이건 뭐예요?"
              if (g && !g.moved) {
                const p = canvasPoint(e);
                setInfo({
                  item: pickItem(items.current, p.x, p.y),
                  fx: p.fx,
                  fy: p.fy,
                });
              }
            }}
            onPointerCancel={() => {
              grab.current = null;
            }}
          />
          {solved && !robot && (
            <LineReveal
              width={scene.width}
              height={scene.height}
              lines={solvedLines}
              color="rgba(140,230,170,0.85)"
              duration={2200}
              lineWidth={1.5}
            />
          )}
          <FxLayer fx={fx} />
          {info && (
            <ItemInfo
              item={info.item}
              left={info.fx}
              top={info.fy}
              onClose={() => setInfo(null)}
            />
          )}
          <div
            className={cn(
              "absolute top-3 left-3 flex items-center gap-2 rounded-full bg-black/60 px-4 py-1.5 text-sm backdrop-blur transition",
              solved && "fx-glow",
            )}
          >
            <span>일치도</span>
            <progress
              className={cn(
                "progress w-24 md:w-40",
                solved ? "progress-success" : "progress-info",
              )}
              value={ratio}
              max={1}
            />
            <span className="w-10 text-right font-bold tabular-nums">
              {Math.round(ratio * 100)}%
            </span>
          </div>
          {hint && (
            <div
              key={`${hint.stage}-${hint.dial}`}
              className="fx-rise absolute right-3 bottom-3 left-3 rounded-xl bg-amber-300/90 px-4 py-2 text-sm font-bold text-black shadow-lg"
            >
              <span className="mr-2">
                💡 힌트 {hint.stage}/4 · {HINT_TITLES[hint.stage]}
              </span>
              {hint.texts.map((t) => (
                <span key={t} className="mr-2 font-normal">
                  {t}
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="flex w-full shrink-0 flex-col gap-3 lg:w-[340px]">
          <div className="bg-base-200/80 rounded-box flex flex-col gap-2 p-3 backdrop-blur">
            <div className="flex items-center justify-between text-sm">
              <span className="font-bold">
                하늘 전체 (누워서 올려다본 하늘)
              </span>
            </div>
            <AllSkyView
              date={player.date}
              observer={player.observer}
              TP={player.TP}
              photoWidth={scene.width}
              photoHeight={scene.height}
              emphasis={emphasis}
            />
            <div className="text-xs leading-relaxed opacity-70">
              <span className="text-amber-200">노란 네모</span>가 사진에 찍힌
              곳이에요. <span className="text-amber-200">★</span>(천구의 극)은
              지평선에서 <b>위도만큼</b> 떠 있고, 시간이 흐르면 별들이{" "}
              <span className="text-emerald-300">초록 화살표</span>처럼 극을
              중심으로 돌아요.
            </div>
          </div>
          {robot && (
            <RobotPanel
              robot={robot}
              scene={scene}
              dials={dials}
              onNext={robotNext}
            />
          )}
        </div>
      </div>

      {!solved ? (
        <div className="bg-base-200/80 rounded-box grid grid-cols-1 gap-4 p-4 backdrop-blur md:grid-cols-3">
          <Dial
            label={`위도: ${latLabel(Math.round(dials.latDeg))}`}
            note="돌리면 하늘이 기울어요 (극의 높이가 바뀌어요)"
            min={LAT_MIN}
            max={LAT_MAX}
            step={1}
            value={dials.latDeg}
            locked={locked === "lat"}
            glow={hint?.dial === "lat"}
            target={hint?.dial === "lat" ? hint.target : undefined}
            onChange={(v) => setDial({ latDeg: v }, "lat")}
            onGrab={countMove}
          />
          <Dial
            label={`날짜: ${dayLabel(dials.dayOfYear)}`}
            note="하루에 하늘이 4분씩 일찍 와요"
            min={0}
            max={364}
            step={1}
            value={dials.dayOfYear}
            locked={locked === "time"}
            glow={false}
            onChange={(v) => setDial({ dayOfYear: v }, "time")}
            onGrab={countMove}
          />
          <Dial
            label={`현지 시각: ${timeLabel(dials.minutes)}`}
            note="돌리면 하늘이 돌아요 (극을 중심으로)"
            min={0}
            max={1435}
            step={5}
            value={dials.minutes}
            locked={locked === "time"}
            glow={hint?.dial === "time"}
            target={hint?.dial === "time" ? hint.target : undefined}
            onChange={(v) => setDial({ minutes: v }, "time")}
            onGrab={countMove}
          />
          <div className="flex flex-wrap items-center gap-2 md:col-span-3">
            <button className="btn btn-sm" onClick={() => setLines((h) => !h)}>
              {lines ? "내 하늘 별자리선 끄기" : "내 하늘 별자리선 보기"}
            </button>
            {!robot && (
              <button className="btn btn-sm btn-ghost" onClick={runRobot}>
                🤖 컴퓨터에게 맡기기
              </button>
            )}
            <span className="text-xs opacity-60">
              고리 {targets.length}개 중 {flags.filter(Boolean).length}개 맞음 ·{" "}
              {Math.round(SOLVED_RATIO * 100)}% 넘으면 성공
            </span>
          </div>
        </div>
      ) : (
        <Solved
          scene={scene}
          dials={dials}
          moves={moves}
          result={result}
          level={level}
          showRobot={!robot}
          onRobot={runRobot}
          onNext={() => newRound(Math.floor(Math.random() * 1e9))}
          onNextLevel={
            level !== "3"
              ? () =>
                  newRound(
                    Math.floor(Math.random() * 1e9),
                    String(Number(level) + 1) as Level,
                  )
              : undefined
          }
        />
      )}
    </div>
  );
}

// 힌트 3단계부터: 아직 고리에 안 들어간 밝은 별 곁에, 그 별이 가야 할 쪽으로 짧고 연한 화살표
const drawHintArrows = (
  ctx: CanvasRenderingContext2D,
  scene: SkyScene,
  targets: { vector: Point3D; at: Point2D }[],
  flags: boolean[],
  TP: Mat3,
  zenith: Point3D, // 내 하늘의 천정: 땅 아래로 내려간 별에는 그리지 않는다
) => {
  ctx.save();
  ctx.strokeStyle = "rgba(255,230,140,0.55)";
  ctx.fillStyle = "rgba(255,230,140,0.55)";
  ctx.lineWidth = 3;
  ctx.lineCap = "round";
  let drawn = 0;

  for (let i = 0; i < targets.length && drawn < ARROW_STARS; i++) {
    const v = targets[i].vector;

    if (
      flags[i] ||
      v[0] * zenith[0] + v[1] * zenith[1] + v[2] * zenith[2] < 0.02
    ) {
      continue;
    }

    const from = projectVecToPhoto(TP, targets[i].vector);

    if (
      !from ||
      from[0] < 0 ||
      from[0] > scene.width ||
      from[1] < 0 ||
      from[1] > scene.height
    ) {
      continue;
    }

    const dx = targets[i].at[0] - from[0];
    const dy = targets[i].at[1] - from[1];
    const dist = Math.hypot(dx, dy);

    if (dist < 12) {
      continue;
    }

    const len = Math.min(ARROW_MAX_PX, dist * 0.6);
    const ux = dx / dist;
    const uy = dy / dist;
    const sx = from[0] + ux * 12;
    const sy = from[1] + uy * 12;
    const ex = sx + ux * len;
    const ey = sy + uy * len;
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.lineTo(ex, ey);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(ex + ux * 6, ey + uy * 6);
    ctx.lineTo(ex - uy * 7 - ux * 6, ey + ux * 7 - uy * 6);
    ctx.lineTo(ex + uy * 7 - ux * 6, ey - ux * 7 - uy * 6);
    ctx.closePath();
    ctx.fill();
    drawn++;
  }

  ctx.restore();
};

// 땅 아래는 그리지 않는다: 사진 속 지평선(고도 0°) 위쪽만 남긴다 (카메라가 지평선에 고정이라 내 하늘도 같다)
const clipAboveHorizon = (ctx: CanvasRenderingContext2D, scene: SkyScene) => {
  const frame = horizontalFrameJ2000(julianDay(scene.date), scene.observer);
  const horizon: Point2D[] = [];

  for (let d = -90; d <= 90; d += 3) {
    const p = projectVecToPhoto(
      scene.TP,
      fromAltAzJ2000(frame, 0, scene.view.azimuthDeg + d),
    );

    if (p) {
      horizon.push(p);
    }
  }

  if (horizon.length > 1) {
    horizon.sort((a, b) => a[0] - b[0]);
    ctx.beginPath();
    ctx.moveTo(horizon[0][0], -scene.height);
    horizon.forEach(([x, y]) => ctx.lineTo(x, y));
    ctx.lineTo(horizon[horizon.length - 1][0], -scene.height);
    ctx.closePath();
    ctx.clip();
  }
};

// 쉬움: 정답 하늘의 별자리선을 흐린 점선으로
const drawGhost = (
  ctx: CanvasRenderingContext2D,
  scene: SkyScene,
  ghost: Point2D[][],
) => {
  if (ghost.length === 0) {
    return;
  }

  ctx.save();
  clipAboveHorizon(ctx, scene);

  ctx.setLineDash([6, 6]);
  ctx.strokeStyle = "rgba(170,210,255,0.4)";
  ctx.lineWidth = 1.5;

  for (const line of ghost) {
    ctx.beginPath();
    line.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    ctx.stroke();
  }

  ctx.restore();
};

// 다이얼을 움직이는 동안의 단서: 밝은 별의 궤적, 위도를 움직이면 천구의 극과 적도
const drawCues = (
  ctx: CanvasRenderingContext2D,
  scene: SkyScene,
  TP: Mat3,
  emphasis: Emphasis,
  trails: { TP: Mat3; at: number }[],
) => {
  if (!emphasis) {
    return;
  }

  ctx.save();
  clipAboveHorizon(ctx, scene);

  if (trails.length > 1) {
    ctx.lineWidth = 2;
    ctx.strokeStyle =
      emphasis === "time" ? "rgba(120,255,170,0.55)" : "rgba(140,200,255,0.55)";

    for (const s of TRAIL_STARS) {
      ctx.beginPath();
      let pen = false;

      for (const t of trails) {
        const p = projectVecToPhoto(t.TP, s.vector);

        if (!p) {
          pen = false;
          continue;
        }

        if (pen) {
          ctx.lineTo(p[0], p[1]);
        } else {
          ctx.moveTo(p[0], p[1]);
        }

        pen = true;
      }

      ctx.stroke();
    }
  }

  if (emphasis === "lat") {
    // 천구의 적도
    ctx.setLineDash([8, 6]);
    ctx.strokeStyle = "rgba(140,200,255,0.8)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    let pen = false;

    for (let a = 0; a <= 360; a += 2) {
      const p = projectVecToPhoto(TP, [
        Math.cos((a * Math.PI) / 180),
        Math.sin((a * Math.PI) / 180),
        0,
      ]);

      if (
        !p ||
        Math.abs(p[0]) > 4 * scene.width ||
        Math.abs(p[1]) > 4 * scene.height
      ) {
        pen = false;
        continue;
      }

      if (pen) {
        ctx.lineTo(p[0], p[1]);
      } else {
        ctx.moveTo(p[0], p[1]);
      }

      pen = true;
    }

    ctx.stroke();
    ctx.setLineDash([]);

    // 천구의 극 (사진 안에 있으면)
    for (const [z, name] of [
      [1, "천구 북극"],
      [-1, "천구 남극"],
    ] as const) {
      const p = projectVecToPhoto(TP, [0, 0, z]);

      if (
        p &&
        p[0] > 0 &&
        p[0] < scene.width &&
        p[1] > 0 &&
        p[1] < scene.height
      ) {
        ctx.font = "28px Arial";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillStyle = "rgb(255,235,140)";
        ctx.shadowColor = "rgba(255,220,100,0.9)";
        ctx.shadowBlur = 12;
        ctx.fillText("★", p[0], p[1]);
        ctx.shadowBlur = 0;
        ctx.font = "bold 14px Arial";
        ctx.fillText(name, p[0], p[1] + 22);
      }
    }
  }

  ctx.restore();
};

// 컴퓨터 풀이 단계별 그림
const drawRobot = (
  ctx: CanvasRenderingContext2D,
  scene: SkyScene,
  robot: RobotState,
) => {
  const { solve, step } = robot;
  ctx.save();
  ctx.font = "bold 16px Arial";
  ctx.textAlign = "center";
  ctx.shadowColor = "rgba(0,0,0,0.8)";
  ctx.shadowBlur = 4;

  if (step === 1 && solve.quad.length === 4) {
    // 밝은 별 넷이 만드는 모양 (해시)
    ctx.strokeStyle = "rgba(255,200,80,0.95)";
    ctx.fillStyle = "rgba(255,200,80,0.12)";
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    const q = solve.quad;

    for (const [a, b] of [
      [0, 1],
      [0, 2],
      [0, 3],
      [1, 2],
      [1, 3],
      [2, 3],
    ]) {
      ctx.moveTo(q[a][0], q[a][1]);
      ctx.lineTo(q[b][0], q[b][1]);
    }

    ctx.stroke();

    for (const p of q) {
      ctx.beginPath();
      ctx.arc(p[0], p[1], 14, 0, Math.PI * 2);
      ctx.stroke();
    }

    const cx = q.reduce((s, p) => s + p[0], 0) / 4;
    const cy = Math.min(...q.map((p) => p[1])) - 24;
    ctx.fillStyle = "rgb(255,220,120)";
    ctx.fillText(
      "이 네 별의 모양으로 하늘 지도에서 찾기",
      cx,
      Math.max(20, cy),
    );
  }

  if (step >= 2) {
    // 지평선 두 점과 천정 방향
    const [a, b] = solve.horizon;
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const len = Math.hypot(dx, dy);
    const ext = 3000 / len;
    ctx.strokeStyle = "rgba(255,160,90,0.9)";
    ctx.lineWidth = 2;
    ctx.setLineDash([10, 6]);
    ctx.beginPath();
    ctx.moveTo(a[0] - dx * ext, a[1] - dy * ext);
    ctx.lineTo(b[0] + dx * ext, b[1] + dy * ext);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = "rgb(255,160,90)";

    for (const p of [a, b]) {
      ctx.beginPath();
      ctx.arc(p[0], p[1], 8, 0, Math.PI * 2);
      ctx.fill();
    }

    // 지평선에 직각인 위쪽 = 천정 쪽
    const mx = (a[0] + b[0]) / 2;
    const my = (a[1] + b[1]) / 2;
    let nx = dy / len;
    let ny = -dx / len;

    if (ny > 0) {
      nx = -nx;
      ny = -ny;
    }

    const tip: Point2D = [mx + nx * my * 0.85, my + ny * my * 0.85];
    ctx.strokeStyle = "rgb(255,160,90)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(mx, my);
    ctx.lineTo(tip[0], tip[1]);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(tip[0], tip[1]);
    ctx.lineTo(tip[0] - nx * 14 - ny * 9, tip[1] - ny * 14 + nx * 9);
    ctx.lineTo(tip[0] - nx * 14 + ny * 9, tip[1] - ny * 14 - nx * 9);
    ctx.closePath();
    ctx.fill();
    ctx.fillText("천정 쪽 (지평선과 직각)", tip[0], tip[1] + 22);
    ctx.fillText("지평선", a[0], a[1] + 26);
  }

  ctx.restore();
};

function RobotPanel({
  robot,
  scene,
  dials,
  onNext,
}: {
  robot: RobotState;
  scene: SkyScene;
  dials: Dials;
  onNext: () => void;
}) {
  const { solve, step } = robot;
  const lstHours = solve.lstDeg / 15;
  const steps = [
    {
      title: "① 별 모양으로 하늘의 어디인지 찾기",
      body: "밝은 별 네 개가 만드는 모양을 숫자(해시)로 바꿔 별 지도 데이터베이스에서 찾아요. 그러면 사진이 하늘의 어디를 찍었는지 알아요. — 플레이트 솔빙",
    },
    {
      title: "② 지평선으로 천정 찾기",
      body: "사진 속 지평선 위 두 점을 하늘 방향으로 바꾸면, 두 방향에 모두 직각인 방향이 머리 꼭대기(천정)예요.",
    },
    {
      title: "③ 천정 → 위도와 시각",
      body: `천정의 적위 ${solve.latDeg.toFixed(1)}° = 이곳의 위도 (${latLabel(Math.round(solve.latDeg))}). 천정의 적경 ${Math.floor(lstHours)}시 ${Math.round((lstHours % 1) * 60)}분 = 지방 항성시 → ${dayLabel(dials.dayOfYear)}이면 ${timeLabel(solve.minutes)}에 이 하늘이 돼요.`,
    },
    {
      title: "끝 — 다이얼 대신 계산으로",
      body: `사람이 다이얼을 돌려 맞춘 일을 컴퓨터는 계산 한 번으로 해요. 실제 사진도 같은 방법으로 풀어요 (사이판 사진처럼). 정답: ${latLabel(Math.round(scene.observer.latDeg))}`,
    },
  ];

  return (
    <div className="bg-base-200/90 rounded-box fx-rise flex flex-col gap-2 p-4 text-sm backdrop-blur">
      <div className="font-bold">🤖 컴퓨터는 이렇게 풀어요</div>
      {steps.map((s, i) => (
        <div
          key={s.title}
          className={cn(
            "rounded-lg p-2 transition",
            i + 1 === step
              ? "bg-amber-300/15 ring-1 ring-amber-300/60"
              : i + 1 < step
                ? "opacity-60"
                : "opacity-25",
          )}
        >
          <div className="font-bold">{s.title}</div>
          {i + 1 <= step && (
            <div className="text-xs leading-relaxed">{s.body}</div>
          )}
        </div>
      ))}
      {step < 4 && (
        <button className="btn btn-sm btn-primary" onClick={onNext}>
          다음 단계 →
        </button>
      )}
    </div>
  );
}

function Dial({
  label,
  note,
  min,
  max,
  step,
  value,
  locked,
  glow,
  target,
  onChange,
  onGrab,
}: {
  label: string;
  note: string;
  min: number;
  max: number;
  step: number;
  value: number;
  locked: boolean;
  glow: boolean;
  target?: { center: number; halfWidth: number };
  onChange: (v: number) => void;
  onGrab: () => void;
}) {
  const nudge = (d: number) => {
    onGrab();
    sfx.tick();
    onChange(Math.min(max, Math.max(min, value + d)));
  };

  const span = max - min;

  return (
    <div
      className={cn(
        "flex flex-col gap-1 rounded-lg p-2 transition",
        glow && "fx-glow bg-amber-300/10 ring-2 ring-amber-300/70",
        locked && "opacity-50",
      )}
    >
      <div className="flex items-center justify-between text-sm">
        <span>
          {locked && "🔒 "}
          {label}
        </span>
        {!locked && (
          <span className="flex gap-1">
            <button className="btn btn-xs" onClick={() => nudge(-step)}>
              −
            </button>
            <button className="btn btn-xs" onClick={() => nudge(step)}>
              +
            </button>
          </span>
        )}
      </div>
      <div className="relative">
        {target && (
          <div
            className="fx-glow pointer-events-none absolute top-0 h-full rounded-full bg-amber-300/40"
            style={{
              left: `${Math.max(0, ((target.center - target.halfWidth - min) / span) * 100)}%`,
              width: `${Math.min(100, ((target.halfWidth * 2) / span) * 100)}%`,
            }}
          />
        )}
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          disabled={locked}
          className="range range-sm range-primary relative w-full"
          onPointerDown={onGrab}
          onKeyDown={onGrab}
          onChange={(e) => onChange(Number(e.target.value))}
        />
      </div>
      <span className="text-xs opacity-60">
        {locked ? "이 단계에서는 맞춰 뒀어요" : note}
      </span>
    </div>
  );
}

function Solved({
  scene,
  dials,
  moves,
  result,
  level,
  showRobot,
  onRobot,
  onNext,
  onNextLevel,
}: {
  scene: SkyScene;
  dials: Dials;
  moves: number;
  result: { newBest: boolean; best: number | null; byRobot: boolean } | null;
  level: Level;
  showRobot: boolean;
  onRobot: () => void;
  onNext: () => void;
  onNextLevel?: () => void;
}) {
  const answer = answerDials(scene);
  const lat = scene.observer.latDeg;
  const lon = scene.observer.lonDeg;
  const lst = localSiderealDeg(julianDay(scene.date), scene.observer);
  const truthLocal = localMeanTime(scene.date, lon);
  const year = truthLocal.getUTCFullYear();
  const fmt = (d: Date) =>
    `${d.getUTCMonth() + 1}월 ${d.getUTCDate()}일 ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;

  // 같은 하늘이 되는 다른 날짜들 (매달 1일, 밤인 것만)
  const sameSky = useMemo(
    () =>
      estimateShotTimes(
        { latDeg: lat, lstDeg: lst },
        {
          lonDeg: lon,
          from: new Date(Date.UTC(year, 0, 1) - (lon / 15) * 3600000),
          days: 365,
        },
      )
        .map((c) => localMeanTime(c.date, lon))
        .filter((d) => d.getUTCDate() === 1),
    [lat, lst, lon, year],
  );

  return (
    <div className="flex flex-col gap-3">
      <div className="bg-base-200/80 rounded-box fx-rise flex flex-wrap items-center gap-6 p-4 backdrop-blur">
        {result?.byRobot ? (
          <div className="text-4xl">🤖</div>
        ) : (
          <StarRating stars={starsFor(moves)} />
        )}
        <div className="flex flex-col">
          <div className="text-success text-2xl font-bold">
            {result?.byRobot ? "컴퓨터가 맞췄어요" : "맞췄어요!"}
          </div>
          {!result?.byRobot && (
            <div className="text-sm">
              다이얼 {moves}번 만에
              {result?.newBest ? (
                <span className="badge badge-warning fx-pop ml-2 font-bold">
                  최소 기록!
                </span>
              ) : (
                result?.best != null && (
                  <span className="ml-2 opacity-60">
                    (최소 기록 {result.best}번)
                  </span>
                )
              )}
            </div>
          )}
        </div>
        <div className="text-sm">
          내 답 {latLabel(Math.round(dials.latDeg))},{" "}
          {dayLabel(dials.dayOfYear)} {timeLabel(dials.minutes)}
        </div>
        <div className="text-sm opacity-80">
          실제로 찍은 곳·때: {latLabel(Math.round(answer.latDeg))},{" "}
          {fmt(truthLocal)}
        </div>
        <div className="grow" />
        {showRobot && (
          <button className="btn" onClick={onRobot}>
            🤖 컴퓨터는 어떻게 풀까?
          </button>
        )}
        <button
          className={cn(
            "btn",
            onNextLevel ? "btn-ghost" : "btn-primary btn-lg",
          )}
          onClick={onNext}
        >
          같은 단계 새 문제
        </button>
        {onNextLevel && (
          <button className="btn btn-primary btn-lg" onClick={onNextLevel}>
            {Number(level) + 1}단계로 →
          </button>
        )}
      </div>
      <div
        className="bg-base-200/80 rounded-box fx-rise flex flex-col gap-2 p-4 text-sm backdrop-blur"
        style={{ animationDelay: "200ms" }}
      >
        <div className="font-bold">알고 보면</div>
        <div>
          <b>위도</b>: 천구의{" "}
          {lat >= 0 ? "북극(북극성 근처)" : "남극(남십자 아래)"}은 지평선에서
          위도만큼 높이 떠 있어요. 위도 다이얼을 돌리면 하늘이 기울던 게 그
          때문이에요.
        </div>
        <div>
          <b>날짜와 시각</b>: 같은 하늘은 하루 4분, 한 달 2시간씩 일찍 와요.
          그래서 이 하늘은 {sameSky.slice(0, 6).map(fmt).join(", ")}
          {sameSky.length > 6 && " …"}에도 똑같이 보여요. 내가 고른 날짜가
          실제와 달라도 정답인 이유예요.
        </div>
      </div>
    </div>
  );
}
