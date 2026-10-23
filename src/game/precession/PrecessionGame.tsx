"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { zodiacAt } from "@/game/birthday/zodiac";
import { GameIntro } from "@/game/fx/Fx";
import { sfx } from "@/game/fx/sound";
import {
  CHART_SIZE,
  drawPrecessionChart,
  drawZodiacStrip,
  STRIP_HEIGHT,
  STRIP_WIDTH,
} from "@/game/precession/drawPrecession";
import {
  angleDeg,
  astrologyDriftDeg,
  equinoxConstellation,
  equinoxLonOfYear,
  nearestPoleStar,
  northPoleOfYear,
  PRECESSION_PERIOD_YEARS,
  yearLabel,
} from "@/game/precession/precession";
import { STARS } from "@/game/sky/catalog";
import { cn } from "@/utils/cn";

// 세차운동 타임머신 (docs/game-plans.md 둘러보기): 연도를 돌리면 천구의 북극이 별 사이에서 원을 그리며 옮겨 가고
// 북극성이 바뀐다. 춘분점도 황도를 따라 밀려 점성술 별자리와 실제 별자리가 어긋난다.

const YEAR_MIN = -12000;
const YEAR_MAX = 14000;
// 재생할 때 1초에 흐르는 해
const PLAY_YEARS_PER_SEC = 1200;
// 이보다 멀면 "북극성이라 부를 만한 별이 없다"
const POLE_STAR_DEG = 5;

// 북극성의 시대 (극에 가장 가까워지는 해, 이 근사로 구한 값을 반올림)
const ERAS: { latin: string; year: number; note: string }[] = [
  { latin: "Vega", year: -12000, note: "빙하기 끝 무렵" },
  { latin: "Thuban", year: -2800, note: "이집트 피라미드 무렵" },
  { latin: "Kochab", year: -1100, note: "옛 그리스 뱃사람의 길잡이" },
  { latin: "Polaris", year: 2100, note: "지금의 북극성" },
  { latin: "Errai", year: 4100, note: "" },
  { latin: "Alderamin", year: 7500, note: "" },
  { latin: "Deneb", year: 10200, note: "" },
  { latin: "Vega", year: 13800, note: "다시 직녀성" },
];

const POLARIS = STARS.find((s) => s.latinName === "Polaris")!;
const nameOf = (s: (typeof STARS)[number]) =>
  s.name ?? `이름 없는 별 (${s.mag.toFixed(1)}등급)`;

export default function PrecessionGame() {
  const [started, setStarted] = useState(false);

  return started ? (
    <PrecessionPlay />
  ) : (
    <GameIntro
      title="세차운동 타임머신"
      tagline="북극성은 영원하지 않아요. 지구의 축이 팽이처럼 천천히 돌거든요."
      howTo={[
        "연도 막대를 돌려 1만 년 전부터 1만 2천 년 뒤까지 오가요.",
        "분홍 십자가 그 해의 천구의 북극이에요. 별 사이에서 큰 원을 그리며 옮겨 가요.",
        "그 해의 북극성과, 점성술 별자리가 실제 별자리와 얼마나 어긋났는지 알려 줘요.",
      ]}
      startLabel="타임머신 타기"
      onStart={() => setStarted(true)}
    />
  );
}

function PrecessionPlay() {
  const nowYear = useMemo(() => new Date().getFullYear(), []);
  const [year, setYear] = useState(nowYear);
  const [playing, setPlaying] = useState(false);
  const chartRef = useRef<HTMLCanvasElement>(null);
  const stripRef = useRef<HTMLCanvasElement>(null);

  // 재생: 연도가 앞으로 흐르고, 끝에 닿으면 처음으로
  useEffect(() => {
    if (!playing) {
      return;
    }

    let last = performance.now();
    let id = 0;

    const step = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      setYear((y) => {
        const next = y + dt * PLAY_YEARS_PER_SEC;

        return next > YEAR_MAX ? YEAR_MIN : next;
      });
      id = requestAnimationFrame(step);
    };

    id = requestAnimationFrame(step);

    return () => cancelAnimationFrame(id);
  }, [playing]);

  const shownYear = Math.round(year);
  const nearest = useMemo(() => nearestPoleStar(shownYear, STARS), [shownYear]);
  const polarisSep = angleDeg(northPoleOfYear(shownYear), POLARIS.vector);
  const equinoxIn = equinoxConstellation(shownYear);
  const drift = astrologyDriftDeg(shownYear);
  const driftSigns = Math.round(drift / 30);
  // 점성술 양자리 한가운데(그 해 춘분점에서 15°)에 있는 해의 실제 별자리
  const ariesSun = zodiacAt(equinoxLonOfYear(shownYear) + 15);

  useEffect(() => {
    const ctx = chartRef.current?.getContext("2d");

    if (ctx) {
      drawPrecessionChart(ctx, shownYear, nowYear, {
        vector: nearest.star.vector,
        sepDeg: nearest.sepDeg,
      });
    }

    const strip = stripRef.current?.getContext("2d");

    if (strip) {
      drawZodiacStrip(strip, shownYear);
    }
  }, [shownYear, nowYear, nearest]);

  const jump = (y: number) => {
    sfx.whoosh();
    setPlaying(false);
    setYear(y);
  };

  return (
    <div className="flex w-full max-w-[1280px] flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-bold">세차운동 타임머신</h1>
        <span className="text-sm opacity-70">
          북쪽 하늘 지도예요. 연도를 돌리면 천구의 북극(분홍 십자)이 원을 그리며
          옮겨 가요.
        </span>
      </div>

      <div className="flex flex-col gap-4 md:flex-row">
        <div className="w-full md:w-auto md:max-w-[640px] md:grow">
          <canvas
            ref={chartRef}
            width={CHART_SIZE}
            height={CHART_SIZE}
            className="rounded-box block aspect-square w-full bg-black"
          />
        </div>

        <div className="flex w-full min-w-0 shrink-0 flex-col gap-4 md:w-96 md:grow">
          <div className="bg-base-200/80 rounded-box flex flex-col gap-3 p-4 text-sm backdrop-blur">
            <div className="text-center text-4xl font-black text-pink-200 tabular-nums">
              {yearLabel(shownYear)}
            </div>
            <input
              type="range"
              min={YEAR_MIN}
              max={YEAR_MAX}
              step={10}
              value={shownYear}
              className="range range-secondary range-sm"
              aria-label="연도"
              onChange={(e) => {
                setPlaying(false);
                setYear(Number(e.target.value));
              }}
            />
            <div className="flex justify-between text-xs opacity-60">
              <span>{yearLabel(YEAR_MIN)}</span>
              <span>지금</span>
              <span>{yearLabel(YEAR_MAX)}</span>
            </div>
            <div className="flex gap-2">
              <button
                className="btn btn-sm btn-primary grow"
                onClick={() => {
                  sfx.tap();
                  setPlaying(!playing);
                }}
              >
                {playing ? "❚❚ 멈춤" : "▶ 시간 흘리기"}
              </button>
              <button className="btn btn-sm" onClick={() => jump(nowYear)}>
                지금으로
              </button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {ERAS.map((e) => {
                const star = STARS.find((s) => s.latinName === e.latin)!;

                return (
                  <button
                    key={`${e.latin}${e.year}`}
                    title={e.note || undefined}
                    className={cn(
                      "btn btn-xs",
                      Math.abs(shownYear - e.year) < 150 && "btn-secondary",
                    )}
                    onClick={() => jump(e.year)}
                  >
                    {star.name} · {yearLabel(e.year)}
                  </button>
                );
              })}
            </div>
          </div>

          <div
            key={nearest.star.hr}
            className="bg-base-200/80 rounded-box fx-rise flex flex-col gap-2 p-4 text-sm backdrop-blur"
          >
            <div className="text-xs opacity-60">
              이 해의 북극에 가장 가까운 밝은 별
            </div>
            <div className="text-xl font-bold text-sky-200">
              {nameOf(nearest.star)}{" "}
              <span className="text-base font-normal tabular-nums opacity-80">
                {nearest.sepDeg.toFixed(1)}° 떨어짐
              </span>
            </div>
            <div>
              {nearest.sepDeg <= 1.5
                ? "북극 바로 곁이에요. 이 무렵 사람들에게는 이 별이 북극성이에요."
                : nearest.sepDeg <= POLE_STAR_DEG
                  ? "북극 가까이에 있어 길잡이 별로 쓸 만해요."
                  : "이 무렵엔 북극 가까이에 밝은 별이 없어요. 북쪽을 찾기 어려운 시대예요."}
            </div>
            {nearest.star.hr !== POLARIS.hr && (
              <div className="text-xs opacity-70">
                지금의 북극성(폴라리스)은 이 해의 북극에서{" "}
                <b className="tabular-nums">{polarisSep.toFixed(0)}°</b> 떨어져
                있어요.
              </div>
            )}
          </div>

          <div className="bg-base-200/80 rounded-box flex flex-col gap-2 p-4 text-sm backdrop-blur">
            <div className="font-bold">춘분점도 같이 움직여요</div>
            <div>
              점성술의 양자리는 춘분점(봄에 해가 있는 자리)부터 시작해요. 이
              해의 춘분점은 실제로는{" "}
              <b className="text-amber-300">{equinoxIn.label}</b>에 있어요.
            </div>
            <div>
              {Math.abs(drift) < 15
                ? "점성술의 열두 궁이 정해진 기원전 2세기 무렵과 비슷해서, 점성술 별자리와 실제 별자리가 거의 맞아요."
                : `점성술이 정해진 기원전 2세기보다 춘분점이 ${Math.abs(drift).toFixed(0)}°(별자리 약 ${Math.abs(driftSigns)}칸) ${drift > 0 ? "서쪽으로" : "동쪽으로"} 밀렸어요. 이 해에 점성술로 양자리인 사람의 생일 한가운데에, 해는 실제로 ${ariesSun.label}에 있어요.`}
            </div>
            <Link href="/games/birthday" className="link link-primary text-sm">
              🎂 내 생일엔 해가 어느 별자리에 있었을까? →
            </Link>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <div className="overflow-x-auto">
          <canvas
            ref={stripRef}
            width={STRIP_WIDTH}
            height={STRIP_HEIGHT}
            className="rounded-box block w-full min-w-[720px] bg-black"
          />
        </div>
        <div className="text-xs opacity-60">
          연도를 돌리면 위 줄(점성술)은 춘분점에 붙어 같이 미끄러지고, 아래
          줄(실제 별자리)은 그대로예요. 그래서 둘이 점점 어긋나요.
        </div>
      </div>

      <details className="bg-base-200/60 rounded-box p-4 text-xs opacity-80">
        <summary className="cursor-pointer text-sm font-bold">
          어떻게 계산했나요? (근사예요)
        </summary>
        <div className="mt-2 flex flex-col gap-1">
          <p>
            지구 자전축은 23.44° 기운 채 황도의 북극을 가운데 두고 팽이처럼
            돌아요. 춘분점이 1년에 50.29″씩 밀린다는 IAU 2006 세차 식의 첫째
            항만 써서, 한 바퀴를 약{" "}
            {Math.round(PRECESSION_PERIOD_YEARS / 100) * 100}년으로 일정하게
            돌렸어요.
          </p>
          <p>
            실제로는 도는 빠르기가 조금씩 바뀌고, 기울기도 약 4만 년 주기로
            22.1~24.5° 사이를 오가고, 황도도 조금 움직여요. 그래서 지금에서 몇백
            년 안은 잘 맞지만, 만 년쯤 떨어지면 1~2° 어긋날 수 있어요.
          </p>
          <p>
            별들도 저마다 조금씩 움직이지만(고유 운동), 여기서는 무시하고 2000년
            자리에 그대로 두었어요. 밝은 북극성 후보들은 1만 년에 1° 안쪽으로만
            움직여서 큰 차이는 없어요.
          </p>
        </div>
      </details>
    </div>
  );
}
