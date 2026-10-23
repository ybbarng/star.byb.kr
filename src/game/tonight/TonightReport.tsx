"use client";

import type { Place } from "@/game/tonight/places";
import type { TonightReport as Report } from "@/game/tonight/report";
import dynamic from "next/dynamic";
import { useEffect, useMemo, useRef, useState } from "react";
import { sfx } from "@/game/fx/sound";
import GameBasicsLinks from "@/game/GameBasicsLinks";
import { drawAllSky } from "@/game/tonight/drawAllSky";
import {
  DoodleSparkle,
  DoodleStar,
  LEVEL_COLOR,
  LEVEL_NAME,
  MoonFace,
  NightBar,
  PlanetBadge,
  SketchSvg,
  StarScore,
} from "@/game/tonight/pieces";
import { CITIES, CITY_GROUPS, SEOUL } from "@/game/tonight/places";
import {
  baseDayOf,
  brightnessWord,
  buildReport,
  directionName,
  fingersLabel,
  fistsLabel,
  heightName,
} from "@/game/tonight/report";
import { downloadShareImage } from "@/game/tonight/shareImage";
import {
  dateLabel,
  friendlyTime,
  isoDate,
  isValidTimeZone,
  nightTime,
  offsetLabel,
} from "@/game/tonight/time";
import { BasicsTerm } from "@/learn/basics/BasicsLinks";
import { cn } from "@/utils/cn";
import "@/game/tonight/tonight.css";

// 오늘 밤 내 하늘 (docs/game-plans.md): 장소·날짜를 넣으면 그날 밤 볼 만한 것을 리포트처럼 정리한다.
// 천문도 대신 "하늘 일기장" — 손글씨 느낌 제목, 테이프 붙인 스티커 카드, 직접 그린 달·행성·별자리.
// 모든 값은 브라우저에서 계산하고, 위치는 어디에도 보내지 않는다. 장소·날짜는 주소(쿼리)에 담아 공유한다.

const MapPicker = dynamic(() => import("@/game/tonight/MapPicker"), {
  ssr: false,
  loading: () => (
    <div className="flex h-40 items-center justify-center text-sm opacity-60">
      지도를 펼치는 중…
    </div>
  ),
});

const browserZone = () => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || SEOUL.tz;
  } catch {
    return SEOUL.tz;
  }
};

// 주소의 쿼리 → 장소·날짜·시각
const readQuery = () => {
  const q = new URLSearchParams(window.location.search);
  const lat = Number(q.get("lat"));
  const lon = Number(q.get("lon"));
  const name = q.get("place") ?? "";
  const tz = q.get("tz") ?? "";
  let place: Place = SEOUL;

  if (
    q.has("lat") &&
    q.has("lon") &&
    Math.abs(lat) <= 90 &&
    Math.abs(lon) <= 180
  ) {
    place = {
      name: name || `${lat.toFixed(1)}°, ${lon.toFixed(1)}°`,
      latDeg: lat,
      lonDeg: lon,
      tz: tz && isValidTimeZone(tz) ? tz : browserZone(),
    };
  } else if (name) {
    place = CITIES.find((c) => c.name === name) ?? SEOUL;
  }

  const date = /^\d{4}-\d{2}-\d{2}$/.test(q.get("date") ?? "")
    ? q.get("date")!
    : isoDate(Date.now(), place.tz);
  const time = /^\d{1,2}:\d{2}$/.test(q.get("time") ?? "")
    ? q.get("time")!
    : "";

  return { place, date, time };
};

const writeQuery = (place: Place, date: string, time: string) => {
  const q = new URLSearchParams();
  const city = CITIES.find((c) => c.name === place.name);

  if (city) {
    q.set("place", city.name);
  } else {
    q.set("place", place.name);
    q.set("lat", place.latDeg.toFixed(3));
    q.set("lon", place.lonDeg.toFixed(3));
    q.set("tz", place.tz);
  }

  q.set("date", date);

  if (time) {
    q.set("time", time);
  }

  window.history.replaceState(null, "", `${window.location.pathname}?${q}`);
};

// 카드: 색·기울기·테이프
function Sticker({
  accent,
  tilt = 0,
  order = 0,
  className,
  children,
}: {
  accent: string;
  tilt?: number;
  order?: number;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section
      className={cn("tn-sticker fx-rise p-5 pt-6 sm:p-6", className)}
      style={
        {
          "--tn-accent": accent,
          "--tn-tilt": `${tilt}deg`,
          animationDelay: `${150 + order * 110}ms`,
        } as React.CSSProperties
      }
    >
      <div className="tn-tape" />
      {children}
    </section>
  );
}

function Heading({
  num,
  title,
  note,
}: {
  num: number;
  title: string;
  note?: string;
}) {
  return (
    <div className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-1">
      <span className="tn-num">{num}</span>
      <h2 className="tn-hand text-2xl sm:text-3xl">{title}</h2>
      {note && <span className="text-sm opacity-60">{note}</span>}
    </div>
  );
}

export default function TonightReport() {
  const [ready, setReady] = useState(false);
  const [place, setPlace] = useState<Place>(SEOUL);
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [showMap, setShowMap] = useState(false);
  const [locating, setLocating] = useState(false);
  const [toast, setToast] = useState("");

  useEffect(() => {
    const q = readQuery();
    setPlace(q.place);
    setDate(q.date);
    setTime(q.time);
    setReady(true);
  }, []);

  useEffect(() => {
    if (ready && date) {
      writeQuery(place, date, time);
    }
  }, [ready, place, date, time]);

  const report = useMemo(() => {
    const m = date.match(/^(\d{4})-(\d{2})-(\d{2})$/);

    return m
      ? buildReport({
          place,
          year: Number(m[1]),
          month: Number(m[2]),
          day: Number(m[3]),
          time: time || null,
        })
      : null;
  }, [place, date, time]);

  const say = (text: string) => {
    setToast(text);
    setTimeout(() => setToast(""), 2200);
  };

  const locate = () => {
    if (!navigator.geolocation) {
      say("이 브라우저는 위치를 알려 주지 않아요");

      return;
    }

    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        sfx.twinkle(3);
        setPlace({
          name: "내 위치",
          latDeg: Math.round(pos.coords.latitude * 100) / 100,
          lonDeg: Math.round(pos.coords.longitude * 100) / 100,
          tz: browserZone(),
        });
      },
      () => {
        setLocating(false);
        say("위치를 알 수 없어요. 도시나 지도에서 골라 주세요");
      },
      { maximumAge: 600000, timeout: 10000 },
    );
  };

  return (
    <div className="tn-page relative flex w-full max-w-3xl flex-col gap-7 pb-16">
      {/* 떠다니는 낙서 */}
      <DoodleStar
        size={30}
        className="tn-float pointer-events-none absolute top-2 -right-1 sm:-right-10"
        style={{ "--tn-rot": "12deg" } as React.CSSProperties}
      />
      <DoodleSparkle
        size={20}
        color="#8fd3ff"
        className="tn-twinkle pointer-events-none absolute top-28 -left-1 sm:-left-8"
      />

      <header className="fx-rise mt-4 flex flex-col gap-3">
        <span className="text-sm tracking-widest text-[color:var(--tn-moon)] opacity-80">
          ✦ 하늘 일기장 ✦
        </span>
        <h1 className="tn-hand tn-wavy text-5xl text-[color:var(--tn-moon)] sm:text-6xl">
          오늘 밤 내 하늘
        </h1>
        <p className="opacity-75">
          장소와 날짜만 알려 주세요. 그날 밤 하늘에서 무엇을 볼 수 있는지
          계산해서 정리해 드릴게요.
        </p>
        <GameBasicsLinks />
      </header>

      {/* 어디서 · 언제 */}
      <Sticker accent="#8fd3ff" tilt={-0.6} order={0}>
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-end gap-3">
            <label className="flex min-w-40 grow flex-col gap-1 text-sm">
              <span className="font-bold opacity-80">어디서</span>
              <select
                className="select select-sm w-full"
                value={
                  CITIES.some((c) => c.name === place.name) ? place.name : ""
                }
                onChange={(e) => {
                  const c = CITIES.find((x) => x.name === e.target.value);

                  if (c) {
                    sfx.tap();
                    setPlace(c);
                  }
                }}
              >
                {!CITIES.some((c) => c.name === place.name) && (
                  <option value="">{place.name}</option>
                )}
                {CITY_GROUPS.map((g) => (
                  <optgroup key={g.title} label={g.title}>
                    {g.cities.map((c) => (
                      <option key={c.name} value={c.name}>
                        {c.name}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-bold opacity-80">언제</span>
              <input
                type="date"
                className="input input-sm"
                value={date}
                onChange={(e) => e.target.value && setDate(e.target.value)}
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-bold opacity-80">
                몇 시 하늘{" "}
                <span className="font-normal opacity-60">(골라도 돼요)</span>
              </span>
              <input
                type="time"
                className="input input-sm"
                value={time}
                onChange={(e) => setTime(e.target.value)}
              />
            </label>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              className="btn btn-sm btn-ghost"
              onClick={locate}
              disabled={locating}
            >
              {locating ? "찾는 중…" : "📍 지금 내 위치"}
            </button>
            <button
              className={cn("btn btn-sm btn-ghost", showMap && "btn-active")}
              onClick={() => setShowMap((v) => !v)}
            >
              🗺️ 지도에서 고르기
            </button>
            <button
              className="btn btn-sm btn-ghost"
              onClick={() => {
                setDate(isoDate(Date.now(), place.tz));
                setTime("");
              }}
            >
              오늘로
            </button>
          </div>
          {showMap && (
            <MapPicker
              value={place}
              onPick={(p) => {
                sfx.tap();
                setPlace(p);
              }}
            />
          )}
          <div className="text-xs opacity-55">
            {place.name} · {place.latDeg >= 0 ? "북위" : "남위"}{" "}
            {Math.abs(place.latDeg).toFixed(1)}° ·{" "}
            {place.lonDeg >= 0 ? "동경" : "서경"}{" "}
            {Math.abs(place.lonDeg).toFixed(1)}°
            {report && ` · ${offsetLabel(report.start, place.tz)}`} — 위치는 이
            브라우저 안에서만 쓰고 어디에도 보내지 않아요.
          </div>
        </div>
      </Sticker>

      {report && <ReportBody report={report} onToast={say} />}

      {toast && (
        <div className="toast toast-center toast-bottom z-50">
          <div className="alert alert-info text-sm">{toast}</div>
        </div>
      )}
    </div>
  );
}

function ReportBody({
  report,
  onToast,
}: {
  report: Report;
  onToast: (t: string) => void;
}) {
  const { tz } = report.place;
  const base = baseDayOf(report);
  const at = (t: number) => nightTime(t, tz, base);
  const south = report.place.latDeg < 0;
  const [now, setNow] = useState(0);

  useEffect(() => setNow(Date.now()), []);

  const visible = report.planets.filter((p) => p.visible && p.best);
  const hidden = report.planets.filter((p) => !p.visible);
  const moonRise = report.moon.events.find((e) => e.rising);
  const moonSet = report.moon.events.find((e) => !e.rising);
  const brightNight = report.sun.mode === "midnightSun";
  let order = 1;

  return (
    <>
      {/* 오늘 밤 한 줄 */}
      <div
        className="fx-rise relative flex flex-col items-center gap-3 px-2 py-4 text-center"
        style={{ animationDelay: "200ms" }}
      >
        <div className="text-sm opacity-70">
          {report.place.name} · {dateLabel(report.start, tz)} 밤
        </div>
        <p
          className="tn-hand text-3xl leading-snug sm:text-4xl"
          style={{ transform: "rotate(-1deg)" }}
        >
          “{report.headline}”
        </p>
        <div className="flex items-center gap-2 text-sm">
          <span className="opacity-70">별 보기 지수</span>
          <StarScore score={report.score} />
        </div>
      </div>

      {/* 1. 해 */}
      <Sticker accent="#ffb38a" tilt={0.5} order={order++}>
        <Heading num={1} title="해가 지고 깜깜해지기까지" />
        {report.sun.mode === "midnightSun" ? (
          <p>
            오늘은 해가 지지 않아요. 밤에도 해가 지평선 위를 맴도는 백야예요.
          </p>
        ) : report.sun.mode === "polarNight" ? (
          <p>오늘은 해가 뜨지 않아요. 낮에도 하늘이 어스름한 극야예요.</p>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              ["🌇 해 짐", report.sun.set],
              ["🌌 깜깜해짐", report.sun.astroDusk],
              ["🌄 하늘이 밝아짐", report.sun.astroDawn],
              ["🌅 해 뜸", report.sun.rise],
            ].map(([label, t]) => (
              <div
                key={label as string}
                className="rounded-2xl bg-black/25 p-3"
              >
                <div className="text-xs opacity-70">{label}</div>
                <div className="text-base font-black sm:text-lg">
                  {t ? friendlyTime(t as number, tz) : "없어요"}
                </div>
              </div>
            ))}
          </div>
        )}
        <div className="mt-5">
          <NightBar
            slots={report.timeline}
            tz={tz}
            good={report.goodWindow}
            now={now}
          />
          <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] opacity-70">
            {LEVEL_NAME.map((n, i) => (
              <span key={n} className="inline-flex items-center gap-1">
                <span
                  className="inline-block h-2.5 w-2.5 rounded-full border border-white/30"
                  style={{ background: LEVEL_COLOR[i] }}
                />
                {n}
              </span>
            ))}
            <span className="inline-flex items-center gap-1">
              <span className="inline-block h-2.5 w-2.5 rounded-full bg-[#ffe08a]" />
              달이 떠 있어요
            </span>
          </div>
        </div>
        {report.goodWindow && (
          <p className="mt-4 rounded-2xl bg-emerald-300/10 p-3 text-sm">
            <b className="text-[color:var(--tn-planet)]">별 보기 좋은 때</b>는{" "}
            <b>{at(report.goodWindow.from)}</b>부터{" "}
            <b>{at(report.goodWindow.to)}</b>까지예요.{" "}
            {report.goodWindow.kind === "dark"
              ? "하늘이 깜깜하고 달도 비켜 있어요."
              : report.goodWindow.kind === "twilight"
                ? "하늘이 아주 깜깜해지지는 않지만 달이 없어요."
                : "달빛이 있지만 그나마 가장 어두운 때예요."}
          </p>
        )}
      </Sticker>

      {/* 2. 달 */}
      <Sticker accent="#ffe08a" tilt={-0.7} order={order++}>
        <Heading num={2} title="달님 소식" />
        <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-start">
          <div
            className="tn-float shrink-0"
            style={{ "--tn-rot": "-4deg" } as React.CSSProperties}
          >
            <MoonFace
              lit={report.moon.lit}
              waxing={report.moon.waxing}
              south={south}
              size={132}
            />
          </div>
          <div className="flex flex-col gap-2">
            <div className="text-2xl font-black text-[color:var(--tn-moon)]">
              {report.moon.name}
              <span className="ml-2 text-base font-bold opacity-70">
                {Math.round(report.moon.lit * 100)}% 빛나요 · 음력{" "}
                {Math.round(report.moon.ageDays) + 1}일 무렵
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              {report.moon.events.map((e) => (
                <span key={e.t} className="tn-chip">
                  {e.rising ? "⬆ 뜸" : "⬇ 짐"} {at(e.t)}
                </span>
              ))}
              {report.moon.events.length === 0 && (
                <span className="tn-chip">오늘은 뜨거나 지지 않아요</span>
              )}
            </div>
            <p className="text-sm">
              {report.moon.interference < 0.05
                ? "깜깜한 동안 달빛 걱정은 없어요. 희미한 별까지 잘 보여요."
                : report.moon.interference < 0.25
                  ? `달빛이 조금 있어요.${moonRise && !moonSet ? " 달이 뜨기 전까지가 더 좋아요." : ""}`
                  : report.moon.interference < 0.55
                    ? "달빛이 꽤 밝아서 희미한 별과 은하수는 숨어요."
                    : "달빛이 아주 밝아요. 밝은 별과 행성만 보여요. 대신 달 구경엔 최고!"}{" "}
              {report.moon.constellation &&
                `오늘 달은 ${report.moon.constellation}에 머물러요.`}
            </p>
            <div className="text-xs opacity-60">
              다음 보름달{" "}
              {report.moon.nextFull ? dateLabel(report.moon.nextFull, tz) : "—"}{" "}
              · 다음 그믐(삭){" "}
              {report.moon.nextNew ? dateLabel(report.moon.nextNew, tz) : "—"}
              {south &&
                " · 남반구에서는 달의 밝은 쪽이 북반구와 좌우가 바뀌어 보여요"}
            </div>
          </div>
        </div>
      </Sticker>

      {/* 3. 행성 */}
      <Sticker accent="#8ef0c8" tilt={0.6} order={order++}>
        <Heading
          num={3}
          title="떠돌이별(행성) 찾기"
          note="반짝이지 않고 또렷하게 빛나요"
        />
        {visible.length === 0 ? (
          <p className="opacity-80">
            오늘 밤 맨눈으로 볼 만한 행성은 없어요. 별자리에 집중해 봐요!
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {visible.map((p, i) => (
              <div
                key={p.key}
                className="flex gap-3 rounded-2xl bg-black/25 p-3"
                style={{ transform: `rotate(${i % 2 ? 0.8 : -0.8}deg)` }}
              >
                <div className="shrink-0">
                  <PlanetBadge name={p.name} />
                </div>
                <div className="flex flex-col gap-1 text-sm">
                  <div className="text-lg font-black">
                    {p.name}{" "}
                    <span className="text-xs font-bold opacity-70">
                      {brightnessWord(p.magnitude)} ({p.magnitude.toFixed(1)}
                      등급)
                    </span>
                  </div>
                  <div>
                    {at(p.window!.from)} ~ {at(p.window!.to)}
                  </div>
                  <div>
                    가장 좋은 때 <b>{at(p.best!.t)}</b>,{" "}
                    {directionName(p.best!.azDeg)} 하늘{" "}
                    {heightName(p.best!.altDeg)} ({fistsLabel(p.best!.altDeg)})
                  </div>
                  {p.constellation && (
                    <div className="text-xs opacity-60">
                      {p.constellation}에 머물러요
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
        {hidden.length > 0 && (
          <ul className="mt-3 flex flex-col gap-0.5 text-xs opacity-60">
            {hidden.map((p) => (
              <li key={p.key}>
                {p.name} — {p.why}
              </li>
            ))}
          </ul>
        )}
        <p className="mt-3 text-xs opacity-55">
          <BasicsTerm slug="star-hopping">팔을 쭉 뻗어 주먹을 쥐면</BasicsTerm>{" "}
          하늘에서 약 10°예요. 지평선에서 주먹을 몇 개 쌓으면 되는지로 높이를
          적었어요.
        </p>
      </Sticker>

      {/* 4. 별자리 */}
      <Sticker accent="#b9a6ff" tilt={-0.5} order={order++}>
        <Heading
          num={4}
          title="하늘 한가운데 별자리"
          note={`${at(report.viewTime)} 기준`}
        />
        {brightNight && (
          <p className="mb-3 text-sm opacity-70">
            오늘은 하늘이 밝아 별자리가 보이지 않지만, 해 너머엔 이렇게 있어요.
          </p>
        )}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {report.constellations.map((c, i) => (
            <div
              key={c.label}
              className="flex flex-col items-center gap-2 rounded-2xl bg-black/25 p-4 text-center"
            >
              <div
                className="tn-float"
                style={
                  {
                    "--tn-rot": `${i % 2 ? 3 : -3}deg`,
                    animationDelay: `${i * 0.8}s`,
                  } as React.CSSProperties
                }
              >
                <SketchSvg sketch={c.sketch} color="#ffd678" />
              </div>
              <div className="text-xl font-black">{c.label}</div>
              <div className="flex flex-wrap justify-center gap-1.5">
                <span className="tn-chip">{c.season}</span>
                <span className="tn-chip">
                  {directionName(c.azDeg)} · {heightName(c.altDeg)}
                </span>
              </div>
              <p className="text-sm opacity-85">{c.tip}</p>
            </div>
          ))}
        </div>
        <p className="mt-3 text-xs opacity-55">
          그림은 그 자리에서 올려다본 모양 그대로예요 (위쪽이 하늘 꼭대기 쪽).
        </p>
      </Sticker>

      {/* 5. 이야깃거리 */}
      <Stories report={report} order={order++} at={at} />

      {/* 6. 하늘 그림 */}
      <SkyChart report={report} order={order++} at={at} onToast={onToast} />

      <p
        className="fx-rise px-2 text-xs leading-relaxed opacity-55"
        style={{ animationDelay: "900ms" }}
      >
        ✎ 적어 둘 것: 모든 시각은 몇 분쯤 어긋날 수 있는 어림이에요. 해는 0.01°,
        달은 0.3°, 행성은 0.02° 안팎의 간단한 공식으로 계산했고, 대기 굴절은
        평균값으로, 산·건물은 없다고 보고 셌어요. 행성 밝기와 유성 수도
        대략이에요 (유성 수는 아주 어두운 곳 기준이라 도시에서는 훨씬 적어요).
        별 위치·밝기·거리는{" "}
        <a
          className="link"
          href="https://cdsarc.cds.unistra.fr/viz-bin/cat/V/50"
          target="_blank"
          rel="noopener noreferrer"
        >
          예일 밝은 별 목록(BSC5, 1991)
        </a>
        에서 왔어요. 거리는 그 목록의 연주 시차로 셌기 때문에 최신 위성 측정과
        조금 다를 수 있어요 (직녀성: 목록 26.5광년, 위성 측정 25광년).
      </p>
    </>
  );
}

function Stories({
  report,
  order,
  at,
}: {
  report: Report;
  order: number;
  at: (t: number) => string;
}) {
  const { tz } = report.place;
  const items: { icon: string; title: string; body: React.ReactNode }[] = [];

  for (const s of report.showers) {
    const d = Math.round(s.daysFromPeak);

    items.push({
      icon: "🌠",
      title: s.shower.name,
      body: (
        <>
          {d === 0
            ? "오늘이 극대 무렵이에요!"
            : d < 0
              ? `${dateLabel(s.peak, tz)}이 극대예요. ${-d}일 남았어요.`
              : `${dateLabel(s.peak, tz)} 극대에서 ${d}일 지났어요.`}{" "}
          {s.best
            ? `${s.radiantRise ? `복사점은 ${at(s.radiantRise)}에 떠요. ` : ""}${at(s.best.t)} 무렵 한 시간에 ${Math.max(1, Math.round(s.perHour))}개쯤 볼 수 있어요.`
            : "여기서는 복사점이 밤에 떠오르지 않아 보기 어려워요."}{" "}
          <span className="opacity-70">{s.shower.note}</span>
        </>
      ),
    });
  }

  for (const a of report.tonightApproaches) {
    items.push({
      icon: a.a === "달" ? "🌙" : "✨",
      title: `${a.a}${a.a === "달" ? "과" : "와"} ${a.b}, 가까이!`,
      body: `${at(a.t)} 무렵 ${a.sepDeg.toFixed(1)}°까지 붙어요. ${fingersLabel(a.sepDeg)}예요.`,
    });
  }

  if (report.starStory) {
    const s = report.starStory;

    items.push({
      icon: "⭐",
      title: `오늘의 별: ${s.name}`,
      body: (
        <>
          {directionName(s.azDeg)} 하늘 {heightName(s.altDeg)}. {s.text}
          {s.lightYears && s.lightYears < 2000 && (
            <span className="opacity-70">
              {" "}
              지금 보는 빛은 약 {Math.round(s.lightYears)}년 전에 출발했어요.
            </span>
          )}
        </>
      ),
    });
  }

  if (report.nextShower) {
    const s = report.nextShower;

    items.push({
      icon: "📅",
      title: `다음 유성우: ${s.shower.name}`,
      body: `${dateLabel(s.peak, tz)} 무렵 극대예요 (${Math.round(-s.daysFromPeak)}일 뒤).`,
    });
  }

  if (report.upcomingApproaches.length) {
    items.push({
      icon: "🗓️",
      title: "앞으로 2주, 달이 지나가는 곳",
      body: report.upcomingApproaches
        .map(
          (a) =>
            `${dateLabel(a.t, tz)} 무렵 ${a.b} 곁 (약 ${Math.max(1, Math.round(a.sepDeg))}°)`,
        )
        .join(" · "),
    });
  }

  return (
    <Sticker accent="#ff9ecb" tilt={0.4} order={order}>
      <Heading num={5} title="오늘의 이야깃거리" />
      <div className="flex flex-col gap-3">
        {items.map((it, i) => (
          <div key={i} className="flex gap-3 rounded-2xl bg-black/25 p-3">
            <span className="text-2xl" aria-hidden>
              {it.icon}
            </span>
            <div className="text-sm">
              <div className="font-black">{it.title}</div>
              <div className="opacity-90">{it.body}</div>
            </div>
          </div>
        ))}
      </div>
    </Sticker>
  );
}

function SkyChart({
  report,
  order,
  at,
  onToast,
}: {
  report: Report;
  order: number;
  at: (t: number) => string;
  onToast: (t: string) => void;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [t, setT] = useState(report.viewTime);
  const [saving, setSaving] = useState(false);
  const from = report.sun.set ?? report.start;
  const to = report.sun.rise ?? report.end;
  const observer = useMemo(
    () => ({ latDeg: report.place.latDeg, lonDeg: report.place.lonDeg }),
    [report.place],
  );

  useEffect(() => setT(report.viewTime), [report.viewTime]);

  useEffect(() => {
    const el = canvas.current;
    const ctx = el?.getContext("2d");

    if (!el || !ctx) {
      return;
    }

    const size = 640;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    el.width = size * dpr;
    el.height = size * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, size, size);
    drawAllSky(ctx, {
      size,
      t,
      observer,
      highlights: report.constellations.map((c) => c.label),
      flip: report.place.latDeg < 0,
    });
  }, [t, observer, report.constellations, report.place.latDeg]);

  return (
    <Sticker accent="#8fd3ff" tilt={-0.4} order={order}>
      <Heading
        num={6}
        title="그 시각 하늘 그림"
        note={`${report.place.latDeg < 0 ? "북쪽" : "남쪽"}을 보고 서서 머리 위로 들어 보세요`}
      />
      <canvas
        ref={canvas}
        className="mx-auto block aspect-square w-full max-w-[560px]"
      />
      <div className="mx-auto mt-2 flex max-w-[560px] flex-col gap-1">
        <input
          type="range"
          className="range range-xs range-info w-full"
          min={from}
          max={to}
          step={15 * 60000}
          value={Math.min(to, Math.max(from, t))}
          onChange={(e) => setT(Number(e.target.value))}
          aria-label="하늘 그림 시각"
        />
        <div className="text-center text-sm font-bold">{at(t)}</div>
      </div>
      <div className="mt-5 flex flex-wrap justify-center gap-2">
        <button
          className="btn btn-sm btn-primary"
          disabled={saving}
          onClick={async () => {
            setSaving(true);
            sfx.whoosh();

            try {
              await downloadShareImage(report, t);
            } finally {
              setSaving(false);
            }
          }}
        >
          {saving ? "그리는 중…" : "🖼️ 그림으로 저장"}
        </button>
        <button
          className="btn btn-sm btn-ghost"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(window.location.href);
              sfx.tap();
              onToast("링크를 복사했어요. 친구에게 보내 보세요!");
            } catch {
              onToast("복사하지 못했어요. 주소창의 주소를 복사해 주세요");
            }
          }}
        >
          🔗 링크 복사
        </button>
      </div>
    </Sticker>
  );
}
