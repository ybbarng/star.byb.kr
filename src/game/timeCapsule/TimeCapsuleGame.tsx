"use client";

import type { SkyItem } from "@/game/sky/drawSky";
import type { AgeStar } from "@/game/timeCapsule/capsule";
import { useEffect, useMemo, useRef, useState } from "react";
import { Confetti, CountUp, FxLayer, GameIntro, useFx } from "@/game/fx/Fx";
import LineReveal from "@/game/fx/LineReveal";
import { sfx } from "@/game/fx/sound";
import { pickItem, STARS } from "@/game/sky/catalog";
import { drawSky } from "@/game/sky/drawSky";
import { canvasPoint } from "@/game/sky/ItemInfo";
import { SCENE_HEIGHT, SCENE_WIDTH } from "@/game/sky/scene";
import {
  ageStars,
  bestMonthOf,
  CAPSULE_BADGES,
  departure,
  distanceOf,
  durationLabel,
  newBadges,
  solarLightSeconds,
  yearLabel,
} from "@/game/timeCapsule/capsule";
import { horizonCameraTP } from "@/search/horizonSolve";
import { projectVecToPhoto } from "@/search/utils/wcs";
import { cn } from "@/utils/cn";

// 빛의 타임캡슐 (docs/game-plans.md 2): 오늘 밤 9시 서울 하늘에서 별을 누르면, 그 빛이 언제 출발했는지와
// 그 무렵 지구에서 있었던 일을 보여 준다. 하늘의 별은 같은 순간이 아니라 서로 다른 과거의 모습이다.

const SEOUL = { latDeg: 37.57, lonDeg: 126.98 };
const DIRECTIONS = [
  ["북", 0],
  ["동", 90],
  ["남", 180],
  ["서", 270],
] as const;

// 별빛 도감: 모은 별과 딴 업적을 이 브라우저에 기억한다 (저장이 막혀 있으면 이번 방문 동안만)
const COLLECTION_KEY = "star-games-capsule";

interface Collection {
  stars: string[];
  badges: string[];
}

const loadCollection = (): Collection => {
  try {
    const v = JSON.parse(localStorage.getItem(COLLECTION_KEY) ?? "null");

    return v && Array.isArray(v.stars) && Array.isArray(v.badges)
      ? v
      : { stars: [], badges: [] };
  } catch {
    return { stars: [], badges: [] };
  }
};

const storeCollection = (c: Collection) => {
  try {
    localStorage.setItem(COLLECTION_KEY, JSON.stringify(c));
  } catch {
    // 저장이 막혀 있으면 기억하지 않는다
  }
};

// 오늘 밤 9시 (서울, UTC+9) = 그날 12:00 UTC
const tonight = () => {
  const now = new Date();

  return new Date(
    Date.UTC(now.getFullYear(), now.getMonth(), now.getDate(), 12),
  );
};

export default function TimeCapsuleGame() {
  const [started, setStarted] = useState(false);

  return started ? (
    <CapsulePlay />
  ) : (
    <GameIntro
      title="빛의 타임캡슐"
      tagline="별빛을 타고 과거로 떠나는 시간 여행"
      howTo={[
        "오늘 밤 9시 서울 하늘이에요. 별을 누르면 그 빛이 지구까지 날아와요.",
        "그 빛이 언제 출발했는지, 그 무렵 지구에서는 무슨 일이 있었는지 알려 줘요.",
        "누른 별은 별빛 도감에 모여요. 업적을 모두 모아 보세요!",
      ]}
      startLabel="출발!"
      onStart={() => setStarted(true)}
    />
  );
}

function CapsulePlay() {
  const [azimuth, setAzimuth] = useState(180);
  const [picked, setPicked] = useState<SkyItem | null>(null);
  const [age, setAge] = useState("");
  const canvas = useRef<HTMLCanvasElement>(null);
  const items = useRef<SkyItem[]>([]);
  const fx = useFx();
  const [collection, setCollection] = useState<Collection>({
    stars: [],
    badges: [],
  });
  const [fire, setFire] = useState(0);
  const date = useMemo(tonight, []);

  useEffect(() => setCollection(loadCollection()), []);
  const nowYear = date.getUTCFullYear();
  const TP = useMemo(
    () =>
      horizonCameraTP(
        date,
        SEOUL,
        { azimuthDeg: azimuth, altitudeDeg: 32, rollDeg: 0, fovDeg: 75 },
        SCENE_WIDTH,
        SCENE_HEIGHT,
      ),
    [date, azimuth],
  );
  const ageList = useMemo<AgeStar[]>(() => {
    const n = Number(age);

    return n > 0 && n < 200 ? ageStars(n) : [];
  }, [age]);

  useEffect(() => {
    const ctx = canvas.current?.getContext("2d");

    if (!ctx) {
      return;
    }

    items.current = drawSky(ctx, {
      width: SCENE_WIDTH,
      height: SCENE_HEIGHT,
      TP,
      date,
      observer: SEOUL,
      azimuthDeg: azimuth,
      magLimit: 4.5,
      lightPollution: 0.15,
      groundSeed: 7,
      stars: STARS,
      compass: true,
      // 별을 눌러 보는 게임이라 달빛에 별이 지워지지 않게 한다
      moonlightDimsStars: false,
    });

    // 고른 별(금색)과 내 나이 별(분홍)에 고리
    const ring = (x: number, y: number, color: string) => {
      ctx.beginPath();
      ctx.arc(x, y, 16, 0, Math.PI * 2);
      ctx.strokeStyle = color;
      ctx.lineWidth = 2.5;
      ctx.stroke();
    };

    for (const s of ageList) {
      const p = projectVecToPhoto(TP, s.vector);

      if (
        p &&
        p[0] > 0 &&
        p[0] < SCENE_WIDTH &&
        p[1] > 0 &&
        p[1] < SCENE_HEIGHT
      ) {
        ring(p[0], p[1], "rgba(255,130,190,0.95)");
      }
    }

    if (picked) {
      ring(picked.x, picked.y, "rgba(255,210,80,0.95)");
    }

    // 도감에 모은 별: 작은 하늘색 점
    for (const it of items.current) {
      if (it.kind === "star" && it.id && collection.stars.includes(it.id)) {
        ctx.beginPath();
        ctx.arc(it.x, it.y, 9, 0, Math.PI * 2);
        ctx.strokeStyle = "rgba(120,220,255,0.5)";
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
    }
  }, [TP, date, azimuth, picked, ageList, collection]);

  const pickedDistance = picked?.id ? distanceOf(picked.id) : null;
  const trip = pickedDistance
    ? departure(pickedDistance.lightYears, nowYear)
    : null;
  // 별빛이 별에서 지구(사진 아래 가운데)로 날아오는 선
  const beam = useMemo(
    () =>
      picked
        ? [
            [
              [picked.x, picked.y] as [number, number],
              [SCENE_WIDTH / 2, SCENE_HEIGHT] as [number, number],
            ],
          ]
        : [],
    [picked],
  );

  const pick = (it: SkyItem, fxX: number, fxY: number) => {
    setPicked(it);
    sfx.whoosh();
    fx.burst(fxX, fxY, "#9fe6ff", 14);

    const d = it.id ? distanceOf(it.id) : null;

    if (!it.id || !d) {
      return;
    }

    const known = collection.stars.includes(it.id);
    const stars = known ? collection.stars : [...collection.stars, it.id];
    const won = newBadges(
      {
        lightYears: d.lightYears,
        year: departure(d.lightYears, nowYear).year,
        collected: stars.length,
      },
      new Set(collection.badges),
    );
    const next = {
      stars,
      badges: [...collection.badges, ...won.map((b) => b.id)],
    };
    setCollection(next);
    storeCollection(next);

    if (!known) {
      setTimeout(() => {
        sfx.twinkle(stars.length);
        fx.popup(fxX, fxY, `도감 +1 (${stars.length}개째)`, "#9fe6ff", 22);
      }, 900);
    }

    won.forEach((b, i) =>
      setTimeout(
        () => {
          sfx.hit();
          setFire(Date.now());
          fx.popup(0.5, 0.35, `업적: ${b.title}!`, "#ffe27a", 44);
        },
        1500 + i * 900,
      ),
    );
  };

  return (
    <div className="flex w-full max-w-[1280px] flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-bold">빛의 타임캡슐</h1>
        <span className="text-sm opacity-70">
          오늘 밤 9시 서울 하늘이에요. 별을 누르면 그 빛이 언제 출발했는지 알려
          줘요.
        </span>
        <div className="grow" />
        <div className="join">
          {DIRECTIONS.map(([label, az]) => (
            <button
              key={label}
              className={cn(
                "join-item btn btn-sm",
                azimuth === az && "btn-primary",
              )}
              onClick={() => {
                sfx.tap();
                setAzimuth(az);
                setPicked(null);
              }}
            >
              {label}쪽
            </button>
          ))}
        </div>
      </div>

      <Confetti fire={fire} />
      <div className="flex flex-col gap-4 md:flex-row">
        <div className="relative w-full md:w-auto md:max-w-[880px] md:grow">
          <canvas
            ref={canvas}
            width={SCENE_WIDTH}
            height={SCENE_HEIGHT}
            className="rounded-box block w-full cursor-pointer bg-black"
            onClick={(e) => {
              const p = canvasPoint(e);
              const it = pickItem(items.current, p.x, p.y);

              if (it && it.kind !== "town") {
                pick(it, p.fx, p.fy);
              } else {
                setPicked(null);
              }
            }}
          />
          {picked && (
            <LineReveal
              key={picked.id ?? `${picked.x},${picked.y}`}
              width={SCENE_WIDTH}
              height={SCENE_HEIGHT}
              lines={beam}
              color="rgba(160,230,255,0.9)"
              duration={900}
              lineWidth={3}
            />
          )}
          <FxLayer fx={fx} />
        </div>
        <div className="flex w-full shrink-0 flex-col gap-4 md:w-80">
          <div className="bg-base-200/80 rounded-box flex flex-col gap-2 p-4 text-sm backdrop-blur">
            {!picked ? (
              <div className="opacity-70">
                밝은 별을 눌러 보세요. 달이나 행성도 눌러 보세요!
              </div>
            ) : picked.kind !== "star" ? (
              <>
                <div className="text-lg font-bold">{picked.label}</div>
                <div
                  key={picked.label}
                  className="fx-pop text-center text-3xl font-black text-sky-200"
                >
                  {durationLabel(solarLightSeconds(picked.label, date) ?? 0)} 전
                </div>
                <div>
                  {picked.label}은 스스로 빛나지 않고 햇빛을 되비쳐요. 그 빛이
                  지구까지 오는 데 겨우 이만큼 걸렸어요. 별빛은 짧아도 몇 년,
                  길면 수천 년 걸려요!
                </div>
              </>
            ) : !pickedDistance ? (
              <>
                <div className="font-bold">{picked.label}</div>
                <div className="opacity-70">이 별은 거리 기록이 없어요.</div>
              </>
            ) : (
              <>
                <div className="text-lg font-bold">{picked.label}</div>
                <div>
                  거리 {pickedDistance.reliable ? "" : "약 "}
                  {Math.round(pickedDistance.lightYears).toLocaleString()}광년
                  {!pickedDistance.reliable && " (아주 멀어 정확하지 않아요)"}
                </div>
                <div
                  key={picked.id}
                  className="fx-pop text-center text-4xl font-black text-sky-200 tabular-nums"
                >
                  <CountUp
                    from={nowYear}
                    value={trip!.year}
                    duration={1400}
                    format={yearLabel}
                  />
                </div>
                <div>
                  지금 보는 이 빛은 <b>{yearLabel(trip!.year)}</b>에 출발해{" "}
                  {Math.round(pickedDistance.lightYears).toLocaleString()}년
                  동안 날아왔어요.
                </div>
                <div
                  key={`event-${picked.id}`}
                  className="fx-rise rounded bg-black/30 p-2"
                  style={{ animationDelay: "1.2s" }}
                >
                  그 무렵 지구에서는 —{" "}
                  <b>
                    {yearLabel(trip!.event.year)} {trip!.event.text}
                  </b>
                  {trip!.gap > 0 && (
                    <span className="opacity-60"> ({trip!.gap}년 차이)</span>
                  )}
                </div>
              </>
            )}
          </div>

          <div className="bg-base-200/80 rounded-box flex flex-col gap-2 p-4 text-sm backdrop-blur">
            <div className="flex items-center justify-between">
              <span className="font-bold">별빛 도감</span>
              <span className="badge badge-info badge-sm tabular-nums">
                {collection.stars.length}개
              </span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {CAPSULE_BADGES.map((b) => {
                const owned = collection.badges.includes(b.id);

                return (
                  <span
                    key={b.id}
                    title={b.note}
                    className={cn(
                      "badge gap-1",
                      owned ? "badge-warning fx-pop" : "badge-ghost opacity-50",
                    )}
                  >
                    {owned ? "★" : "☆"} {b.title}
                  </span>
                );
              })}
            </div>
            <div className="text-xs opacity-60">
              업적에 마우스를 올리면 따는 방법이 나와요.
            </div>
          </div>

          <div className="bg-base-200/80 rounded-box flex flex-col gap-2 p-4 text-sm backdrop-blur">
            <div className="font-bold">내 나이 별</div>
            <div className="text-xs opacity-70">
              내가 태어날 무렵 출발한 빛이 지금 막 닿은 별이에요.
            </div>
            <input
              type="number"
              min={1}
              max={150}
              placeholder="나이"
              className="input input-sm w-28"
              value={age}
              onChange={(e) => setAge(e.target.value)}
            />
            {ageList.map((s) => (
              <div key={s.hr}>
                <b>{s.name ?? `HR ${s.hr}`}</b> · {s.lightYears.toFixed(1)}광년
                · {s.mag.toFixed(1)}등급 · {bestMonthOf(s.vector)}월 저녁에 잘
                보여요
              </div>
            ))}
            {age && ageList.length === 0 && (
              <div className="opacity-60">
                그 나이만큼 떨어진 밝은 별이 없어요. 한두 살 바꿔 보세요.
              </div>
            )}
            {ageList.length > 0 && (
              <div className="text-xs opacity-60">
                오늘 밤 이 방향 하늘에 있으면 분홍 고리로 표시돼요.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
