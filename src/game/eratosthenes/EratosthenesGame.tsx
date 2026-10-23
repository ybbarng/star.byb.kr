"use client";

import type { City } from "@/game/eratosthenes/eratosthenes";
import { useMemo, useState } from "react";
import {
  circumferenceKm,
  CITY_PAIRS,
  declinationDeg,
  cityLabel,
  EARTH_MERIDIAN_KM,
  lonGapDeg,
  noonShadowAngleDeg,
  northSouthKm,
} from "@/game/eratosthenes/eratosthenes";
import { EarthFigure, SideFigure } from "@/game/eratosthenes/Figures";
import { Confetti, useShake } from "@/game/fx/Fx";
import { sfx } from "@/game/fx/sound";
import WorldMap from "@/game/geo/WorldMap";
import { dayDate, dayLabel, dayOf } from "@/game/shadow/shadow";
import { cn } from "@/utils/cn";

// 에라토스테네스 되어 보기 (docs/game-plans.md): 두 도시 고르기 → 두 도시의 정오 그림자 각을 각도기로 재기 →
// 왜 그렇게 되는지 질문 세 개(햇빛은 나란히, 각이 다른 까닭, 지구 중심각) → 비례식으로 둘레 → 날짜를 바꿔 보기.
// 계산은 페이지가 하고, 단계마다 "왜"를 묻는다.

const SOLSTICE = dayOf(6, 21);

const STEPS = [
  "두 도시",
  "첫째 그림자",
  "둘째 그림자",
  "햇빛",
  "왜 다를까",
  "지구 중심",
  "둘레 구하기",
  "날짜 바꾸기",
] as const;

interface QuizOption {
  text: string;
  correct?: boolean;
  why: string;
}

export default function EratosthenesGame() {
  const [step, setStep] = useState(0);
  const [pairId, setPairId] = useState<string>("egypt");
  const [custom, setCustom] = useState<City[]>([]);
  const [measured, setMeasured] = useState<(number | null)[]>([null, null]);
  const [day, setDay] = useState(SOLSTICE);
  // 그때 하늘로 잴지(기본), 지금 하늘로 잴지. 그때 값이 있는 짝(알렉산드리아·시에네)에만 고를 수 있다
  const [ancient, setAncient] = useState(true);

  const pair = useMemo(() => {
    if (pairId === "custom" && custom.length === 2) {
      const [p, q] = [...custom].sort((x, y) => y.latDeg - x.latDeg);

      return { id: "custom", title: "내가 고른 두 곳", a: p, b: q };
    }

    return CITY_PAIRS.find((p) => p.id === pairId) ?? CITY_PAIRS[0];
  }, [pairId, custom]);
  const ready =
    pairId !== "custom" ||
    (custom.length === 2 && Math.abs(custom[0].latDeg - custom[1].latDeg) >= 2);
  const km = northSouthKm(pair.a, pair.b);
  const obliquityDeg = ancient ? pair.obliquityDeg : undefined;
  const angleA = noonShadowAngleDeg(pair.a, SOLSTICE, obliquityDeg);
  const angleB = noonShadowAngleDeg(pair.b, SOLSTICE, obliquityDeg);
  // 잰 값은 크기만, 방향(북·남)은 그림에서 읽은 대로 붙인다
  const signedA =
    measured[0] === null ? null : Math.sign(angleA || 1) * measured[0];
  const signedB =
    measured[1] === null ? null : Math.sign(angleB || 1) * measured[1];
  const diff =
    signedA !== null && signedB !== null ? Math.abs(signedA - signedB) : null;

  const next = () => {
    sfx.whoosh();
    setStep((s) => s + 1);
  };

  return (
    <div className="flex w-full max-w-[1100px] flex-col gap-3">
      <div className="bg-base-200/80 rounded-box flex flex-col gap-2 px-4 py-3 backdrop-blur">
        <div className="flex flex-wrap items-baseline gap-x-3">
          <h1 className="text-xl font-bold">📐 에라토스테네스 되어 보기</h1>
          <span className="text-sm opacity-60">
            기원전 240년 무렵, 막대 그림자로 지구 둘레를 잰 사람처럼
          </span>
        </div>
        <ul className="steps steps-horizontal w-full overflow-x-auto text-xs">
          {STEPS.map((s, i) => (
            <li
              key={s}
              className={cn("step", i <= step && "step-primary")}
              onClick={() => i < step && setStep(i)}
            >
              <span className={cn(i < step && "cursor-pointer")}>{s}</span>
            </li>
          ))}
        </ul>
      </div>

      {step === 0 && (
        <Card
          title="① 남북으로 떨어진 두 도시를 골라요"
          lead="에라토스테네스는 이집트의 시에네에서 하짓날 정오에 깊은 우물 바닥까지 햇빛이 비친다는 이야기를 들었어요. 같은 날 정오, 북쪽 알렉산드리아의 막대에는 그림자가 생겼죠. 이 차이로 지구 둘레를 잴 수 있어요."
        >
          <div className="flex flex-wrap gap-2">
            {CITY_PAIRS.map((p) => (
              <button
                key={p.id}
                className={cn(
                  "btn btn-sm",
                  pairId === p.id ? "btn-primary" : "btn-outline",
                )}
                onClick={() => {
                  sfx.tap();
                  setPairId(p.id);
                  setMeasured([null, null]);
                }}
              >
                {p.title}
              </button>
            ))}
            <button
              className={cn(
                "btn btn-sm",
                pairId === "custom" ? "btn-primary" : "btn-outline",
              )}
              onClick={() => {
                sfx.tap();
                setPairId("custom");
                setMeasured([null, null]);
              }}
            >
              🗺 지도에서 직접
            </button>
          </div>
          <WorldMap
            utc={dayDate(SOLSTICE, 12 - (pair.a.lonDeg + pair.b.lonDeg) / 30)}
            timeBands={false}
            hoverTime={false}
            pins={[
              { ...pair.a, color: "#ffd166", label: pair.a.name },
              { ...pair.b, color: "#06d6a0", label: pair.b.name },
            ]
              .filter(() => pairId !== "custom" || custom.length === 2)
              .concat(
                pairId === "custom" && custom.length === 1
                  ? [{ ...custom[0], color: "#ffd166", label: "첫째 곳" }]
                  : [],
              )}
            line={
              pairId !== "custom" || custom.length === 2
                ? [
                    { ...pair.a, color: "" },
                    { ...pair.b, color: "" },
                  ]
                : undefined
            }
            onPick={
              pairId === "custom"
                ? (latDeg, lonDeg) => {
                    sfx.tap();
                    setMeasured([null, null]);
                    setCustom((c) => {
                      const n = c.length === 2 ? 0 : c.length;
                      const city = {
                        name: n === 0 ? "첫째 곳" : "둘째 곳",
                        latDeg: Math.round(latDeg * 10) / 10,
                        lonDeg: Math.round(lonDeg * 10) / 10,
                      };

                      return n === 0 ? [city] : [c[0], city];
                    });
                  }
                : undefined
            }
          />
          {pairId === "custom" && !ready && (
            <div className="text-sm text-amber-200">
              지도에서 두 곳을 눌러요. 남북으로 2° 넘게 떨어져야 해요 (같은
              경도에 가까울수록 좋아요).
            </div>
          )}
          {ready && (
            <div className="flex flex-col gap-1 text-sm">
              <div>
                {pair.a.name}({cityLabel(pair.a)}) ↔ {pair.b.name}(
                {cityLabel(pair.b)}) · 남북 거리{" "}
                <b>{Math.round(km).toLocaleString()}km</b>
              </div>
              {"note" in pair && pair.note && (
                <div className="opacity-70">{pair.note}</div>
              )}
              {"obliquityDeg" in pair && pair.obliquityDeg !== undefined && (
                <div className="flex flex-wrap items-center gap-2">
                  <span className="opacity-70">해의 위치:</span>
                  {[
                    { on: true, label: "그때 하늘 (기원전 240년)" },
                    {
                      on: false,
                      label: "지금 하늘 (같은 두 곳에서 오늘 재면)",
                    },
                  ].map((o) => (
                    <button
                      key={o.label}
                      className={cn(
                        "btn btn-xs",
                        ancient === o.on ? "btn-primary" : "btn-outline",
                      )}
                      onClick={() => {
                        sfx.tap();
                        setAncient(o.on);
                        setMeasured([null, null]);
                      }}
                    >
                      {o.label}
                    </button>
                  ))}
                </div>
              )}
              {lonGapDeg(pair) > 5 && (
                <div className="text-amber-200">
                  경도가 {lonGapDeg(pair).toFixed(0)}° 달라서 두 곳의 정오는{" "}
                  {Math.round(lonGapDeg(pair) * 4)}분 어긋나요. 각자의 정오에
                  재고, 거리는 남북 거리만 써요.
                </div>
              )}
            </div>
          )}
          <button
            className="btn btn-primary self-end"
            disabled={!ready}
            onClick={next}
          >
            하짓날 정오로 가기 →
          </button>
        </Card>
      )}

      {(step === 1 || step === 2) && (
        <MeasureStep
          key={step}
          city={step === 1 ? pair.a : pair.b}
          angleDeg={step === 1 ? angleA : angleB}
          onDone={(v) => {
            setMeasured((m) => (step === 1 ? [v, m[1]] : [m[0], v]));
            next();
          }}
        />
      )}

      {step >= 3 && step <= 5 && (
        <div className="flex flex-col gap-3 md:flex-row">
          <div className="rounded-box overflow-hidden md:w-[45%]">
            <EarthFigure
              a={pair.a}
              b={pair.b}
              decDeg={declinationDeg(dayDate(SOLSTICE), obliquityDeg)}
              showCenter={step === 5}
            />
            <MeasuredSummary
              a={pair.a}
              b={pair.b}
              signedA={signedA}
              signedB={signedB}
            />
          </div>
          <div className="md:w-[55%]">
            {step === 3 && (
              <Quiz
                key="rays"
                question="해에서 오는 빛은 두 도시에 어떻게 닿을까요?"
                options={[
                  {
                    text: "거의 나란히 와요",
                    correct: true,
                    why: "해는 지구보다 100배 넘게 크고 1억 5천만 km나 떨어져 있어서, 지구 어디에 닿는 빛이든 거의 나란해요. 에라토스테네스도 이렇게 가정했어요.",
                  },
                  {
                    text: "해에서 부채꼴로 퍼져 와서, 두 도시에 다른 각으로 닿아요",
                    why: "해가 가까이 있다면 그렇겠지만, 해는 아주 멀어요. 몇백 km 떨어진 두 도시에 오는 빛의 각 차이는 0.0003°도 안 돼요.",
                  },
                  {
                    text: "구름과 공기에 꺾여서 제멋대로 와요",
                    why: "공기가 빛을 조금 꺾긴 하지만(해가 낮을 때 0.5° 정도), 정오의 높은 해에서는 아주 작아요.",
                  },
                ]}
                onNext={next}
              />
            )}
            {step === 4 && (
              <Quiz
                key="why"
                question={`햇빛이 나란한데, 왜 ${pair.a.name}과 ${pair.b.name}의 그림자 각이 다를까요?`}
                options={[
                  {
                    text: "땅이 둥글어서 두 막대가 서로 다른 쪽을 향해 서 있어요",
                    correct: true,
                    why: "막대는 늘 땅에 수직, 곧 지구 중심에서 바깥으로 서요. 둥근 지구 위 두 막대는 서로 기울어 있으니 같은 빛과 이루는 각도 달라요. 땅이 평평하다면 두 그림자는 똑같았을 거예요.",
                  },
                  {
                    text: "두 도시의 시각이 달라서 해 높이가 달라요",
                    why: "둘 다 각자의 정오(해가 가장 높을 때)에 쟀어요. 같은 경도에 가까우면 같은 순간이기도 해요.",
                  },
                  {
                    text: "막대 길이가 달라서요",
                    why: "막대가 길면 그림자도 길어질 뿐, 막대와 햇빛 사이의 각은 그대로예요.",
                  },
                ]}
                onNext={next}
              />
            )}
            {step === 5 && (
              <Quiz
                key="center"
                question="두 그림자 각의 차이는 그림에서 무엇과 같을까요?"
                options={[
                  {
                    text: "지구 중심에서 두 도시를 바라본 각 (중심각)",
                    correct: true,
                    why: "나란한 두 직선을 다른 직선이 가로지르면 엇각이 같아요. 그래서 막대 둘(지구 중심으로 이어진 선)이 벌어진 각이 곧 그림자 각의 차이예요. 이 각이 두 도시의 위도 차이이기도 해요.",
                  },
                  {
                    text: "해에서 두 도시를 바라본 각",
                    why: "해에서는 두 도시가 거의 한 점으로 보여요 (빛이 나란하니까요).",
                  },
                  {
                    text: "두 도시의 경도 차이",
                    why: "경도는 동서 방향이에요. 정오 그림자는 남북 방향의 각, 곧 위도 차이를 알려 줘요.",
                  },
                ]}
                onNext={next}
              />
            )}
          </div>
        </div>
      )}

      {step === 6 && diff !== null && (
        <RatioStep
          a={pair.a}
          b={pair.b}
          diff={diff}
          trueDiff={Math.abs(angleA - angleB)}
          km={km}
          onNext={next}
        />
      )}

      {step === 7 && (
        <DateStep
          a={pair.a}
          b={pair.b}
          obliquityDeg={obliquityDeg}
          day={day}
          setDay={setDay}
          onRestart={() => {
            setMeasured([null, null]);
            setDay(SOLSTICE);
            setStep(0);
          }}
        />
      )}
    </div>
  );
}

function Card({
  title,
  lead,
  children,
}: {
  title: string;
  lead?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-base-200/80 rounded-box fx-rise flex flex-col gap-3 p-4 backdrop-blur">
      <h2 className="text-lg font-bold">{title}</h2>
      {lead && <p className="text-sm opacity-80">{lead}</p>}
      {children}
    </div>
  );
}

function MeasureStep({
  city,
  angleDeg,
  onDone,
}: {
  city: City;
  angleDeg: number;
  onDone: (v: number) => void;
}) {
  const [needle, setNeedle] = useState(20);
  const [checked, setChecked] = useState(false);
  const truth = Math.abs(angleDeg);
  const off = Math.abs(needle - truth);

  return (
    <Card
      title={`② ${city.name}: 하짓날 정오의 막대 그림자 각을 재요`}
      lead="막대 꼭대기와 그림자 끝을 잇는 노란 선이 햇빛이에요. 각도기 바늘(분홍)을 끌어 햇빛에 겹쳐요. 막대(0°)와 햇빛 사이의 각이 그림자 각이에요."
    >
      <div className="flex flex-col gap-3 md:flex-row">
        <div className="rounded-box overflow-hidden md:w-[60%]">
          <SideFigure
            city={city}
            angleDeg={angleDeg}
            needleDeg={needle}
            onNeedle={(v) => {
              setNeedle(v);
              setChecked(false);
            }}
          />
        </div>
        <div className="flex flex-col gap-2 text-sm md:w-[40%]">
          <div className="flex items-center gap-2">
            <button
              className="btn btn-sm"
              onClick={() =>
                setNeedle((n) => Math.max(0, +(n - 0.1).toFixed(1)))
              }
            >
              −0.1°
            </button>
            <b className="w-20 text-center text-2xl text-pink-300 tabular-nums">
              {needle.toFixed(1)}°
            </b>
            <button
              className="btn btn-sm"
              onClick={() =>
                setNeedle((n) => Math.min(89, +(n + 0.1).toFixed(1)))
              }
            >
              +0.1°
            </button>
          </div>
          <div className="opacity-70">
            그림자는 {angleDeg >= 0 ? "북" : "남"}쪽을 가리켜요. 그림자가 아주
            짧으면 각도 아주 작아요.
          </div>
          {!checked ? (
            <button
              className="btn btn-primary"
              onClick={() => {
                setChecked(true);

                if (off <= 0.5) {
                  sfx.hit();
                } else {
                  sfx.tap();
                }
              }}
            >
              다 쟀어요
            </button>
          ) : (
            <div className="fx-rise flex flex-col gap-2 rounded-lg bg-black/25 p-3">
              <div>
                실제 각은 <b>{truth.toFixed(1)}°</b> · 내가 잰 각{" "}
                <b>{needle.toFixed(1)}°</b>
              </div>
              <div
                className={off <= 0.5 ? "text-emerald-300" : "text-amber-200"}
              >
                {off <= 0.5
                  ? "아주 잘 쟀어요!"
                  : `${off.toFixed(1)}° 차이가 나요. 잰 값 그대로 써도 되지만, 둘레가 그만큼 틀어져요.`}
              </div>
              {truth < 1.5 && (
                <div className="text-xs opacity-70">
                  해가 거의 머리 꼭대기에 있어 그림자가 거의 없어요 — 우물
                  바닥까지 햇빛이 비친다는 이야기 그대로예요.
                </div>
              )}
              <div className="flex gap-2">
                <button
                  className="btn btn-sm"
                  onClick={() => setChecked(false)}
                >
                  다시 재기
                </button>
                <button
                  className="btn btn-primary btn-sm"
                  onClick={() => onDone(needle)}
                >
                  이 값으로 →
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}

const sideText = (v: number) =>
  `${Math.abs(v).toFixed(1)}° (그림자 ${v >= 0 ? "북" : "남"}쪽)`;

function MeasuredSummary({
  a,
  b,
  signedA,
  signedB,
}: {
  a: City;
  b: City;
  signedA: number | null;
  signedB: number | null;
}) {
  if (signedA === null || signedB === null) {
    return null;
  }

  return (
    <div className="bg-base-200/80 flex flex-col gap-0.5 p-3 text-sm">
      <div>
        내가 잰 각: {a.name} <b>{sideText(signedA)}</b> · {b.name}{" "}
        <b>{sideText(signedB)}</b>
      </div>
      <div>
        차이{" "}
        <b className="text-pink-300">
          {Math.abs(signedA - signedB).toFixed(1)}°
        </b>
        {Math.sign(signedA) !== Math.sign(signedB) &&
          " (그림자가 서로 반대쪽이라 두 각을 더해요)"}
      </div>
    </div>
  );
}

function Quiz({
  question,
  options,
  onNext,
  nextLabel = "다음 →",
}: {
  question: string;
  options: QuizOption[];
  onNext: () => void;
  nextLabel?: string;
}) {
  const [picked, setPicked] = useState<number | null>(null);
  const { ref, shake } = useShake();
  const right = picked !== null && options[picked].correct;

  return (
    <div
      ref={ref}
      className="bg-base-200/80 rounded-box fx-rise flex flex-col gap-3 p-4 backdrop-blur"
    >
      <h2 className="text-lg font-bold">🤔 {question}</h2>
      <div className="flex flex-col gap-2">
        {options.map((o, i) => (
          <button
            key={o.text}
            className={cn(
              "rounded-box border-2 p-3 text-left text-sm transition",
              picked === i
                ? o.correct
                  ? "border-emerald-300 bg-emerald-300/10"
                  : "border-rose-300 bg-rose-300/10"
                : "bg-base-200/60 border-transparent hover:border-white/20",
            )}
            disabled={right}
            onClick={() => {
              setPicked(i);

              if (o.correct) {
                sfx.hit();
              } else {
                sfx.miss();
                shake();
              }
            }}
          >
            {o.text}
          </button>
        ))}
      </div>
      {picked !== null && (
        <div
          className={cn(
            "fx-rise rounded-lg p-3 text-sm",
            right ? "bg-emerald-400/10" : "bg-rose-400/10",
          )}
        >
          {right ? "맞아요! " : "다시 생각해 봐요. "}
          {options[picked].why}
        </div>
      )}
      {right && (
        <button className="btn btn-primary self-end" onClick={onNext}>
          {nextLabel}
        </button>
      )}
    </div>
  );
}

function RatioStep({
  a,
  b,
  diff,
  trueDiff,
  km,
  onNext,
}: {
  a: City;
  b: City;
  diff: number;
  trueDiff: number;
  km: number;
  onNext: () => void;
}) {
  const [solved, setSolved] = useState(false);
  const mine = circumferenceKm(diff, km);
  const exact = circumferenceKm(trueDiff, km);
  const errPct = ((mine - EARTH_MERIDIAN_KM) / EARTH_MERIDIAN_KM) * 100;
  const max = Math.max(mine, EARTH_MERIDIAN_KM) * 1.05;

  return (
    <div className="flex flex-col gap-3">
      <Quiz
        question={`중심각 ${diff.toFixed(1)}°가 ${a.name}–${b.name} ${Math.round(km).toLocaleString()}km라면, 지구 한 바퀴는? 어떤 비례식을 세울까요?`}
        options={[
          {
            text: "각도 차이 : 360° = 두 도시 남북 거리 : 지구 둘레",
            correct: true,
            why: "중심각이 한 바퀴(360°)의 몇 분의 1인지가, 두 도시 사이 거리가 둘레의 몇 분의 1인지와 같아요.",
          },
          {
            text: "각도 차이 : 90° = 두 도시 남북 거리 : 지구 둘레",
            why: "90°는 적도에서 극까지, 둘레의 4분의 1이에요. 한 바퀴는 360°예요.",
          },
          {
            text: "각도 차이 : 두 도시 남북 거리 = 지구 둘레 : 360°",
            why: "짝이 뒤바뀌었어요. 각도는 각도끼리(차이 : 360°), 거리는 거리끼리(거리 : 둘레) 맞춰요.",
          },
        ]}
        onNext={() => setSolved(true)}
      />
      {solved && (
        <div className="bg-base-200/80 rounded-box fx-rise flex flex-col gap-3 p-4 backdrop-blur">
          <Confetti fire={1} />
          <h2 className="text-lg font-bold">🌍 내가 잰 지구 둘레</h2>
          <div className="text-sm">
            둘레 = {Math.round(km).toLocaleString()}km × 360° ÷{" "}
            {diff.toFixed(1)}° ={" "}
            <b className="text-2xl text-amber-200">
              {Number.isFinite(mine) ? Math.round(mine).toLocaleString() : "∞"}
              km
            </b>
          </div>
          {Number.isFinite(mine) && (
            <div className="flex flex-col gap-1 text-xs">
              <Bar
                label="내가 잰 값"
                value={mine}
                max={max}
                color="bg-amber-300"
              />
              <Bar
                label="실제 (남북 한 바퀴)"
                value={EARTH_MERIDIAN_KM}
                max={max}
                color="bg-emerald-300"
              />
              <div className="mt-1 text-sm">
                실제와 {errPct >= 0 ? "+" : "−"}
                {Math.abs(errPct).toFixed(1)}% 차이.{" "}
                {Math.abs(mine - exact) > 200 &&
                  `각을 정확히 쟀다면 ${Math.round(exact).toLocaleString()}km — 각이 작아서 조금만 틀려도 결과가 크게 움직여요. 두 도시가 멀수록 덜 흔들려요.`}
              </div>
            </div>
          )}
          <div className="rounded-lg bg-black/25 p-3 text-xs opacity-80">
            에라토스테네스는 각 차이를 원의 50분의 1(7.2°), 거리를
            5,000스타디온으로 잡아 둘레 25만 스타디온을 얻었어요. 1스타디온을
            157~185m로 보면 약 39,000~46,000km — 2,200년 전에 막대와
            그림자만으로 거의 맞혔어요.
          </div>
          <button className="btn btn-primary self-end" onClick={onNext}>
            날짜를 바꿔 보기 →
          </button>
        </div>
      )}
    </div>
  );
}

function Bar({
  label,
  value,
  max,
  color,
}: {
  label: string;
  value: number;
  max: number;
  color: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-28 shrink-0 opacity-70">{label}</span>
      <div className="h-3 grow rounded-full bg-white/10">
        <div
          className={cn("h-3 rounded-full", color)}
          style={{ width: `${(value / max) * 100}%` }}
        />
      </div>
      <span className="w-20 text-right tabular-nums">
        {Math.round(value).toLocaleString()}km
      </span>
    </div>
  );
}

function DateStep({
  a,
  b,
  obliquityDeg,
  day,
  setDay,
  onRestart,
}: {
  a: City;
  b: City;
  obliquityDeg?: number;
  day: number;
  setDay: (d: number) => void;
  onRestart: () => void;
}) {
  const angA = noonShadowAngleDeg(a, day, obliquityDeg);
  const angB = noonShadowAngleDeg(b, day, obliquityDeg);
  const dec = declinationDeg(dayDate(day), obliquityDeg);

  return (
    <div className="flex flex-col gap-3">
      <Card
        title="⑤ 하짓날이 아니어도 될까요?"
        lead="날짜를 바꾸면 해의 높이가 바뀌어 두 그림자가 함께 길어지거나 짧아져요. 차이를 지켜보세요."
      >
        <label className="flex flex-col gap-1 text-sm">
          <div className="flex justify-between">
            <span className="opacity-70">날짜</span>
            <b className="text-amber-200">{dayLabel(day)}</b>
          </div>
          <input
            type="range"
            className="range range-primary range-sm w-full"
            min={0}
            max={364}
            value={day}
            onChange={(e) => setDay(Number(e.target.value))}
          />
        </label>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {[
            { c: a, v: angA },
            { c: b, v: angB },
          ].map(({ c, v }) => (
            <div key={c.name} className="rounded-box overflow-hidden">
              <SideFigure
                city={c}
                angleDeg={v}
                fitDeg={Math.max(Math.abs(angA), Math.abs(angB))}
              />
              <div className="bg-base-200/80 p-2 text-center text-sm">
                {c.name} <b>{sideText(v)}</b>
              </div>
            </div>
          ))}
        </div>
        <div className="text-center text-lg">
          차이{" "}
          <b className="text-2xl text-pink-300">
            {Math.abs(angA - angB).toFixed(1)}°
          </b>{" "}
          <span className="text-sm opacity-60">
            (해의 적위 {dec >= 0 ? "+" : "−"}
            {Math.abs(dec).toFixed(1)}°)
          </span>
        </div>
      </Card>
      <Quiz
        key="dates"
        question="날짜를 바꾸면 두 그림자 각의 차이는 어떻게 될까요?"
        options={[
          {
            text: "두 각은 함께 바뀌지만 차이는 그대로예요",
            correct: true,
            why: "정오 그림자 각 = 위도 − 해의 적위. 날짜가 바꾸는 건 해의 적위뿐이라 두 도시에 똑같이 더해지고 빠져요. 차이는 늘 두 도시의 위도 차이, 곧 중심각이에요. 그래서 어느 날에 재도 같은 둘레가 나와요 (두 곳에서 같은 날에 재기만 하면요).",
          },
          {
            text: "하짓날에만 차이가 생기고 다른 날은 0이 돼요",
            why: "슬라이더를 움직여 보세요. 차이는 그대로예요. 하짓날 시에네가 특별한 건 그림자가 0이라 재기 쉬웠다는 것뿐이에요.",
          },
          {
            text: "겨울에는 해가 낮아서 차이도 커져요",
            why: "두 그림자 모두 길어지지만, 각의 차이는 그대로예요.",
          },
        ]}
        nextLabel="다른 두 도시로 다시 ↺"
        onNext={() => {
          sfx.win();
          onRestart();
        }}
      />
    </div>
  );
}
